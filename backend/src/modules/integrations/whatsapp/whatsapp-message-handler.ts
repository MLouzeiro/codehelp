import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { ensureHelpdeskConfigs } from '../../helpdesk/helpdesk.service';
import { iniciarOuResetarTriagem, enviarMenuInicial } from '../../helpdesk/triagem.service';
import { isHorarioAtendimento, getHorarioConfig } from '../../helpdesk/horario';
import { etapaInicialSlug } from '../../helpdesk/stages.service';
import {
  detectarOpcaoMenu,
  montarAckDepartamento,
  montarOpcaoInvalida,
  resolverOpcaoMenu,
  montarPosicaoFilaComInfo,
  montarForaHorario,
} from '../../helpdesk/menu';
import { classificarPorPalavrasChave } from '../../helpdesk/rules.service';
import { notificarAtendentesFila } from '../../alerts/alerts.service';
import { processarDescricaoProblema, montarMensagemConfirmacao } from '../../ai/aiTriage.service';
import { getConfigAutoAtendimento, propostaRespostaIA, enviarRespostaValidada, respostaJaValidada } from '../../ai/aiValidation.service';
import { responderCsat } from '../../csat/csat.service';

// ── Shared WhatsApp Message Handler ────────────────────────────────────
// Provider-agnostic bot/triage logic used by all WhatsApp backends.

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const processingLocks = new Set<string>();
const PROCESSING_LOCK_TIMEOUT_MS = 30_000; // 30 segundos

// ── Conversation State Machine ─────────────────────────────────────────
type ConversationState = 'IDLE' | 'AWAITING_CSAT' | 'AWAITING_DEPARTMENT';
const conversationStates = new Map<string, ConversationState>();
const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const stateTimestamps = new Map<string, number>();

function getConversationState(phoneDigits: string): ConversationState {
  const key = phoneDigits.slice(-11);
  const state = conversationStates.get(key);
  if (!state) return 'IDLE';
  const ts = stateTimestamps.get(key) || 0;
  if (Date.now() - ts > STATE_TTL_MS) {
    conversationStates.delete(key);
    stateTimestamps.delete(key);
    console.log(`[State] ${key}: expirado (TTL), resetando para IDLE`);
    return 'IDLE';
  }
  return state;
}

function setConversationState(phoneDigits: string, state: ConversationState) {
  const key = phoneDigits.slice(-11);
  conversationStates.set(key, state);
  stateTimestamps.set(key, Date.now());
  console.log(`[State] ${key}: → ${state}`);
}

export function setWhatsAppConversationState(phoneDigits: string, state: ConversationState) {
  setConversationState(phoneDigits, state);
}

async function detectarRespostaCsat(phoneDigits: string, text: string): Promise<boolean> {
  try {
    const trimmed = text.trim();
    
    // Aceita tanto "1" como "1 - Péssimo" (resposta de lista interativa)
    let nota: number | null = null;
    
    // Tenta extrair apenas o número
    const numeroMatch = trimmed.match(/^([1-5])/);
    if (numeroMatch) {
      nota = parseInt(numeroMatch[1], 10);
    }
    
    if (nota === null) return false;

    const phoneLookup = phoneDigits.slice(-11);
    console.log(`[CSAT] Detectada possível resposta CSAT: nota=${nota}, phone=${phoneLookup}`);

    const csat = await prisma.cSATResposta.findFirst({
      where: {
        respondidoEm: null,
        enviadoEm: { not: null, gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ticket: {
          OR: [
            { contactPhone: phoneLookup },
            { contactPhone: phoneDigits },
          ],
        },
      },
      include: { ticket: { select: { id: true, protocolo: true, contactName: true, assignee: { select: { name: true } } } } },
      orderBy: { enviadoEm: 'desc' },
    });

    if (!csat) {
      console.log(`[CSAT] Nenhum CSAT pendente encontrado para o telefone ${phoneLookup}`);
      return false;
    }

    console.log(`[CSAT] CSAT encontrado: ${csat.id}, respondendo com nota ${nota}`);
    await responderCsat(csat.tokenResposta, { nota });
    return true;
  } catch (err: any) {
    console.warn('[CSAT] Erro ao detectar/responder CSAT:', err?.message);
    return false;
  }
}

export interface IncomingMessageData {
  phone: string;
  text: string;
  contactName?: string;
  mediaUrl?: string | null;
  mimeType?: string | null;
  connectionId?: string;
  provider: 'baileys' | 'whatsapp-webjs' | 'evolution' | 'cloud';
  jid?: string;
}

export interface SendMessageFn {
  (to: string, message: string): Promise<{ success: boolean; error?: string }>;
}

export async function processIncomingMessageHandler(
  data: IncomingMessageData,
  sendMessage: SendMessageFn,
): Promise<void> {
  const { phone, text, contactName, mediaUrl, mimeType, connectionId, provider } = data;

  if (!phone) return;

  const chatId = phone.replace(/@c\.us$/i, '');
  const phoneDigits = chatId.replace(/[^\d]/g, '');
  const phoneLookup = phoneDigits.slice(-11);
  const phoneSemSufixo = phoneDigits;

  // Aguardar lock com timeout
  const lockStart = Date.now();
  while (processingLocks.has(chatId)) {
    if (Date.now() - lockStart > PROCESSING_LOCK_TIMEOUT_MS) {
      console.warn(`[WhatsApp] Lock timeout para ${chatId} — liberando lock preso apos ${PROCESSING_LOCK_TIMEOUT_MS / 1000}s`);
      processingLocks.delete(chatId);
      break;
    }
    await sleep(50);
  }
  processingLocks.add(chatId);

  const jid = data.jid;

  try {
    // ── CSAT Response Detection ────────────────────────────────────────
    // Só detecta CSAT se o estado da conversa for AWAITING_CSAT
    const convState = getConversationState(phoneDigits);
    console.log(`[WhatsApp] Estado da conversa: ${convState}`);

    if (convState === 'AWAITING_CSAT') {
      try {
        console.log(`[WhatsApp] Verificando resposta CSAT para phone: ${phoneDigits}, text: "${text}"`);
        const isCsatResponse = await detectarRespostaCsat(phoneDigits, text || '');
        console.log(`[WhatsApp] Resultado detecção CSAT: ${isCsatResponse}`);
        if (isCsatResponse) {
          const nota = parseInt(text.trim().match(/^([1-5])/)?.[1] || '0', 10);
          const stars = '⭐'.repeat(nota);
          const thankYou = `Obrigado pela sua avaliação! ${stars}\n\nSeu feedback é muito importante para continuarmos melhorando nosso atendimento. 🙏`;
          await sendMessage(chatId, thankYou).catch(() => {});
          setConversationState(phoneDigits, 'IDLE');
          return;
        }
      } catch (csatErr: any) {
        console.warn('[CSAT] Erro na detecção CSAT, continuando como mensagem normal:', csatErr?.message);
      }
    }

    const horarioCfg = await getHorarioConfig();
    const horarioOk = isHorarioAtendimento(horarioCfg);

    // Find existing open ticket
    let ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          ...(jid ? [{ contactJid: jid }] : []),
          { contactPhone: chatId },
          { contactPhone: phoneSemSufixo },
        ],
        status: { notIn: ['fechado', 'cancelado', 'arquivado'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no open ticket, check for a recently closed ticket (CSAT response or follow-up)
    if (!ticket) {
      // First: check if there's a pending CSAT for this phone
      const phoneLookupForCsat = phoneDigits.slice(-11);
      const pendingCsat = await prisma.cSATResposta.findFirst({
        where: {
          respondidoEm: null,
          enviadoEm: { not: null, gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ticket: {
            OR: [
              { contactPhone: phoneLookupForCsat },
              { contactPhone: phoneDigits },
            ],
          },
        },
        include: { ticket: { select: { id: true, contactPhone: true, contactJid: true } } },
        orderBy: { enviadoEm: 'desc' },
      });

      // If there's a pending CSAT and message is a valid CSAT response, let it flow to detection at top
      if (pendingCsat) {
        const isPotentialCsatResponse = /^[1-5]$/.test((text || '').trim());
        if (isPotentialCsatResponse) {
          console.log(`[WhatsApp] CSAT pendente encontrado ${pendingCsat.id} — resposta CSAT detectada, processando`);
          return;
        }
        // Message is NOT a CSAT response — treat as a new conversation, create new ticket
        console.log(`[WhatsApp] CSAT pendente ${pendingCsat.id} ignorado (mensagem não é resposta CSAT) — criando novo ticket`);
      }

      const recentClosed = await prisma.ticket.findFirst({
        where: {
          OR: [
            ...(jid ? [{ contactJid: jid }] : []),
            { contactPhone: chatId },
            { contactPhone: phoneSemSufixo },
          ],
          status: { in: ['fechado'] },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentClosed) {
        // Check if CSAT was already created but message failed to send
        const existingCsat = await prisma.cSATResposta.findUnique({ where: { ticketId: recentClosed.id } });
        if (existingCsat && !existingCsat.respondidoEm) {
          // Don't reopen — let the flow continue to create a new ticket below
          console.log(`[WhatsApp] Ticket ${recentClosed.id} fechado com CSAT pendente, criando novo ticket`);
        } else {
          // No pending CSAT — reopen the closed ticket
          const reopenEtapa = await etapaInicialSlug();
          ticket = await prisma.ticket.update({
            where: { id: recentClosed.id },
            data: { status: 'aberto', etapa: reopenEtapa, departamentoId: null, protocolo: null, dataFechamento: null },
          });
          await prisma.ticketStageEvent.create({
            data: {
              ticketId: ticket.id,
              etapaAnterior: 'concluido',
              etapaNova: reopenEtapa,
              origem: 'automatico',
            },
          });
        }
      }
    }

    if (ticket) {
      if (ticket.status === 'fechado') {
        const jaTemCsat = await prisma.cSATResposta.findUnique({ where: { ticketId: ticket.id } });
        if (!jaTemCsat) {
          const reopenEtapa = await etapaInicialSlug();
          ticket = await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'em_atendimento', etapa: reopenEtapa, departamentoId: null, protocolo: null, dataFechamento: null },
          });
          await prisma.ticketStageEvent.create({
            data: {
              ticketId: ticket.id,
              etapaAnterior: 'concluido',
              etapaNova: reopenEtapa,
              origem: 'automatico',
            },
          });
        }
      }
    } else {
      // Find client by phone
      let client = null;
      if (phoneLookup) {
        client = await prisma.client.findFirst({
          where: { telefone: { contains: phoneLookup } },
        });
        if (!client) {
          const colaborador = await prisma.colaborador.findFirst({
            where: {
              OR: [
                { telefone: { contains: phoneLookup } },
                { whatsapp: { contains: phoneLookup } },
              ],
            },
            include: { client: true },
          });
          if (colaborador?.client) {
            client = colaborador.client;
          }
        }
      }

      let resolvedContactName = contactName || null;
      if (!resolvedContactName) {
        const pdigits = chatId.replace(/[^\d]/g, '');
        const phoneFormatted = pdigits.length >= 10
          ? `(${pdigits.slice(0, 2)}) ${pdigits.slice(2, -4)}-${pdigits.slice(-4)}`
          : pdigits;
        resolvedContactName = phoneFormatted || chatId;
      }

      await ensureHelpdeskConfigs();

      const etapaInicial = horarioOk ? await etapaInicialSlug() : 'aguardando_expediente';

      const created = await prisma.ticket.create({
        data: {
          contactName: resolvedContactName,
          contactPhone: phoneSemSufixo,
          contactJid: jid || null,
          status: 'aberto',
          etapa: etapaInicial,
          canal: `whatsapp_${provider}`,
          clientId: client?.id,
          whatsappConnectionId: connectionId || null,
        },
      });
      ticket = created;

      await prisma.ticketStageEvent.create({
        data: {
          ticketId: created.id,
          etapaAnterior: 'novo',
          etapaNova: etapaInicial,
          origem: 'automatico',
        },
      });

      notificarAtendentesFila(created.id).catch((e) =>
        console.warn(`[${provider}] Falha ao notificar atendentes:`, e?.message || e)
      );

      const { avaliarRegras } = await import('../../automations/automations.service');
      avaliarRegras('novo_ticket', { ticketId: created.id }).catch((e) =>
        console.warn(`[${provider}] Falha ao avaliar regras novo_ticket:`, e?.message || e)
      );
    }

    // Save incoming message
    if (text || mediaUrl) {
      await prisma.message.create({
        data: {
          ticketId: ticket!.id,
          fromMe: false,
          content: text || (mediaUrl ? '(midia)' : ''),
          mediaUrl: mediaUrl || null,
          mimeType: mimeType || null,
        },
      });
      await prisma.ticket.update({
        where: { id: ticket!.id },
        data: { updatedAt: new Date() },
      });
    }

    // ── Business hours check ────────────────────────────────────────
    if (!horarioOk && (ticket!.etapa === 'aguardando_expediente' || ((ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId))) {
      const jaEnviouForaHorario = await prisma.message.count({
        where: { ticketId: ticket!.id, fromMe: true, source: 'bot' },
      });
      if (jaEnviouForaHorario === 0) {
        const msgForaHorario = await montarForaHorario(ticket!.contactName || 'cliente');
        const result = await sendMessage(chatId, msgForaHorario);
        if (result?.success) {
          await prisma.message.create({
            data: { ticketId: ticket!.id, fromMe: true, content: msgForaHorario, source: 'bot', tipo: 'system' },
          });
        }
      }
      return;
    }

    // ── Send initial menu if needed (BEFORE department selection) ───
    const needsMenu = (ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId;
    if (needsMenu) {
      const temMenuEnviado = await prisma.message.findFirst({
        where: { ticketId: ticket!.id, fromMe: true, content: { contains: 'Menu de departamentos enviado' } },
      });
      if (!temMenuEnviado) {
        await enviarMenuInicial(ticket!.id).catch((e) =>
          console.error(`[${provider}] Erro ao enviar menu inicial:`, e?.message || e)
        );
        setConversationState(phoneDigits, 'AWAITING_DEPARTMENT');
        return;
      }
    }

    // ── Bot menu: department selection ──────────────────────────────
    if (text && needsMenu) {
      const opcao = detectarOpcaoMenu(text);
      if (opcao) {
        const deptInfo = await resolverOpcaoMenu(opcao);
        if (!deptInfo) {
          const opcaoInvalida = await montarOpcaoInvalida(ticket!.contactName || 'cliente');
          const result = await sendMessage(chatId, opcaoInvalida);
          if (result?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: opcaoInvalida, source: 'bot', tipo: 'system' },
            });
          }
          setConversationState(phoneDigits, 'AWAITING_DEPARTMENT');
          return;
        }

        await prisma.ticket.update({
          where: { id: ticket!.id },
          data: { departamentoId: deptInfo.departamentoId, etapa: 'fila' },
        });

        const ackMsg = await montarAckDepartamento(ticket!.contactName || 'cliente', deptInfo.departamentoNome);
        const result = await sendMessage(chatId, ackMsg);
        if (result?.success) {
          await prisma.message.create({
            data: { ticketId: ticket!.id, fromMe: true, content: ackMsg, source: 'bot', tipo: 'system' },
          });
        }

        await prisma.ticketStageEvent.create({
          data: {
            ticketId: ticket!.id,
            etapaAnterior: 'triagem',
            etapaNova: 'fila',
            origem: 'automatico',
            mensagemAutomatica: `Departamento "${deptInfo.departamentoNome}" selecionado pelo cliente`,
          },
        });

        console.log(`[${provider}] Departamento "${deptInfo.departamentoNome}" selecionado no ticket ${ticket!.id}`);
        setConversationState(phoneDigits, 'IDLE');
        return;
      }

      const temAlgumaMsgDoBot = await prisma.message.count({
        where: { ticketId: ticket!.id, fromMe: true },
      });
      if (temAlgumaMsgDoBot > 0 && !ticket!.departamentoId) {
        const opcaoInvalida = await montarOpcaoInvalida(ticket!.contactName || 'cliente');
        const result = await sendMessage(chatId, opcaoInvalida);
        if (result?.success) {
          await prisma.message.create({
            data: { ticketId: ticket!.id, fromMe: true, content: opcaoInvalida, source: 'bot', tipo: 'system' },
          });
        }
        setConversationState(phoneDigits, 'AWAITING_DEPARTMENT');
        return;
      }
    }

    // ── Keyword classification ──────────────────────────────────────
    if (text && !ticket!.categoria) {
      const match = await classificarPorPalavrasChave(text);
      if (match) {
        await prisma.ticket.update({
          where: { id: ticket!.id },
          data: { categoria: match.categoria },
        });
        console.log(`[${provider}] Ticket ${ticket!.id} classificado como "${match.categoria}"`);
      }
    }

    // ── Queue: AI-powered description analysis ──────────────────────
    if (ticket!.etapa === 'fila' && ticket!.departamentoId && !ticket!.protocolo && text) {
      const textoLower = text.toLowerCase().trim();

      // Detect company/lab response
      if (!ticket!.clientId) {
        const ultimaMsgBot = await prisma.message.findFirst({
          where: { ticketId: ticket!.id, fromMe: true },
          orderBy: { createdAt: 'desc' },
        });
        const ultimaMsgTexto = (ultimaMsgBot?.content || '').toLowerCase();
        const perguntouEmpresa = ultimaMsgTexto.includes('laborat') ||
          ultimaMsgTexto.includes('clinica') ||
          ultimaMsgTexto.includes('clinica') ||
          ultimaMsgTexto.includes('hospital') ||
          ultimaMsgTexto.includes('empresa') ||
          ultimaMsgTexto.includes('unidade');

        const temPadraoExplicito = /(?:lab(?:orat[oó]rio)?|empresa|company|clinica|unidade)\s*:\s*(.+)/i.test(text);
        if (perguntouEmpresa && !temPadraoExplicito && text.length > 1 && text.length < 150) {
          const nomeEmpresa = text.trim();
          let client = await prisma.client.findFirst({
            where: {
              OR: [
                { razaoSocial: { contains: nomeEmpresa, mode: 'insensitive' } },
                { nomeFantasia: { contains: nomeEmpresa, mode: 'insensitive' } },
              ],
            },
          });
          if (!client) {
            client = await prisma.client.create({
              data: {
                razaoSocial: nomeEmpresa,
                nomeFantasia: nomeEmpresa,
                segmento: 'laboratorio',
                origem: 'whatsapp',
                status: 'ativo',
              },
            });
            console.log(`[${provider}] Novo cliente criado: "${nomeEmpresa}"`);
          }
          await prisma.ticket.update({
            where: { id: ticket!.id },
            data: { clientId: client.id },
          });

          const msgConfirmacao = `${ticket!.contactName || 'Cliente'}, empresa vinculada!\n\n*Laboratorio:* ${client.razaoSocial}`;
          const result = await sendMessage(chatId, msgConfirmacao);
          if (result?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: msgConfirmacao, source: 'bot', tipo: 'system' },
            });
          }

          const posicaoFila = await prisma.ticket.count({
            where: { etapa: 'fila', departamentoId: ticket!.departamentoId! },
          });
          const posicaoMsg = await montarPosicaoFilaComInfo(ticket!.contactName || 'cliente', posicaoFila, true, true);
          const posResult = await sendMessage(chatId, posicaoMsg);
          if (posResult?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: posicaoMsg, source: 'bot', tipo: 'system' },
            });
          }
          return;
        }
      }

      // Detect LABORATORY by pattern
      if (!ticket!.clientId) {
        const labMatch = text.match(/(?:lab(?:orat[oó]rio)?|empresa|company|clinica|unidade)\s*:\s*(.+)/i);
        if (labMatch) {
          const labNome = labMatch[1].trim();
          let client = await prisma.client.findFirst({
            where: {
              OR: [
                { razaoSocial: { contains: labNome, mode: 'insensitive' } },
                { nomeFantasia: { contains: labNome, mode: 'insensitive' } },
              ],
            },
          });
          if (!client) {
            client = await prisma.client.create({
              data: {
                razaoSocial: labNome,
                nomeFantasia: labNome,
                segmento: 'laboratorio',
                origem: 'whatsapp',
                status: 'ativo',
              },
            });
          }
          await prisma.ticket.update({
            where: { id: ticket!.id },
            data: { clientId: client.id },
          });

          const msgConfirmacao = `${ticket!.contactName || 'Cliente'}, empresa vinculada!\n\n*Laboratorio:* ${client.razaoSocial}`;
          const result = await sendMessage(chatId, msgConfirmacao);
          if (result?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: msgConfirmacao, source: 'bot', tipo: 'system' },
            });
          }

          const posicaoFila = await prisma.ticket.count({
            where: { etapa: 'fila', departamentoId: ticket!.departamentoId! },
          });
          const posicaoMsg = await montarPosicaoFilaComInfo(ticket!.contactName || 'cliente', posicaoFila, true, true);
          const posResult = await sendMessage(chatId, posicaoMsg);
          if (posResult?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: posicaoMsg, source: 'bot', tipo: 'system' },
            });
          }
          return;
        }
      }

      // AI description analysis
      if (!ticket!.assunto && text.length > 10) {
        try {
          const resultado = await processarDescricaoProblema(ticket!.id, text);
          const msgConfirmacao = await montarMensagemConfirmacao(ticket!.id, resultado.triagem, resultado.empresa);
          const result = await sendMessage(chatId, msgConfirmacao);
          if (result?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: msgConfirmacao, source: 'bot', tipo: 'system' },
            });
          }

          if (!resultado.empresa) {
            const msgEmpresa = `${ticket!.contactName || 'Cliente'}, de qual laboratorio, clinica ou hospital voce esta entrando em contato?`;
            const empresaResult = await sendMessage(chatId, msgEmpresa);
            if (empresaResult?.success) {
              await prisma.message.create({
                data: { ticketId: ticket!.id, fromMe: true, content: msgEmpresa, source: 'bot', tipo: 'system' },
              });
            }
          }

          const config = await getConfigAutoAtendimento();
          if (config.autoAtendimentoAtivo && config.maxInteracoesIa > 0) {
            const reutilizar = await respostaJaValidada(ticket!.id, text);
            if (reutilizar.podeReenviar && reutilizar.respostaFinal) {
              await enviarRespostaValidada(reutilizar.validacaoId!, sendMessage);
              console.log(`[${provider}] Resposta reutilizada para ticket ${ticket!.id}`);
            } else if (ticket!.iaMensagensEnviadas < config.maxInteracoesIa) {
              propostaRespostaIA(ticket!.id, text).catch((e) =>
                console.warn(`[${provider}] Falha ao gerar proposta IA:`, e?.message || e)
              );
            }
          }

          const posicaoFila = await prisma.ticket.count({
            where: { etapa: 'fila', departamentoId: ticket!.departamentoId! },
          });
          const posicaoMsg = await montarPosicaoFilaComInfo(
            ticket!.contactName || 'cliente',
            posicaoFila,
            true,
            !!ticket!.clientId || !!resultado.empresa?.clientId,
          );
          const posResult = await sendMessage(chatId, posicaoMsg);
          if (posResult?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: posicaoMsg, source: 'bot', tipo: 'system' },
            });
          }

          console.log(`[${provider}] Ticket ${ticket!.id} processado por IA`);
          return;
        } catch (e) {
          console.warn(`[${provider}] Erro IA:`, (e as Error).message);
        }
      }

      // Legacy: detect subject by pattern
      if (!ticket!.assunto) {
        const updateData: Record<string, any> = {};
        const assuntoMatch = text.match(/(?:assunto|motivo|sobre|problema|relato)\s*:\s*(.+)/i);
        if (assuntoMatch) {
          updateData.assunto = assuntoMatch[1].trim();
        } else if (!textoLower.includes('lab') && !textoLower.includes('empresa') && !textoLower.includes('company')) {
          const linhas = text.trim().split('\n');
          if (linhas.length === 1 && linhas[0].length <= 100) {
            updateData.assunto = linhas[0].trim();
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.ticket.update({
            where: { id: ticket!.id },
            data: updateData,
          });

          const msgConfirmacao = `${ticket!.contactName || 'Cliente'}, informacoes recebidas!\n\n*Assunto:* ${updateData.assunto}`;
          const result = await sendMessage(chatId, msgConfirmacao);
          if (result?.success) {
            await prisma.message.create({
              data: { ticketId: ticket!.id, fromMe: true, content: msgConfirmacao, source: 'bot', tipo: 'system' },
            });
          }
        }
      }

      // Always re-send queue position
      const posicaoFila = await prisma.ticket.count({
        where: { etapa: 'fila', departamentoId: ticket!.departamentoId! },
      });
      const posicaoMsg = await montarPosicaoFilaComInfo(
        ticket!.contactName || 'cliente',
        posicaoFila,
        !!ticket!.assunto,
        !!ticket!.clientId,
      );
      const posResult = await sendMessage(chatId, posicaoMsg);
      if (posResult?.success) {
        await prisma.message.create({
          data: { ticketId: ticket!.id, fromMe: true, content: posicaoMsg, source: 'bot', tipo: 'system' },
        });
      }

      return;
    }

    // ── Initial menu for new triagem tickets ────────────────────────
    if ((ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId) {
      const temAlgumaMsgDoBot = await prisma.message.count({
        where: { ticketId: ticket!.id, fromMe: true },
      });
      // Send menu if no bot messages yet, or if ticket was moved from aguardando_expediente (has only system messages)
      const temMsgNaoSistema = await prisma.message.count({
        where: { ticketId: ticket!.id, fromMe: true, tipo: { not: 'system' } },
      });
      if (temAlgumaMsgDoBot === 0 || temMsgNaoSistema === 0) {
        await enviarMenuInicial(ticket!.id).catch((e) =>
          console.error(`[${provider}] Erro ao enviar saudacao:`, e?.message || e)
        );
        setConversationState(phoneDigits, 'AWAITING_DEPARTMENT');
      }
      iniciarOuResetarTriagem(ticket!.id).catch((e) =>
        console.error(`[${provider}] Erro ao iniciar follow-up:`, e?.message || e)
      );
    }
  } finally {
    processingLocks.delete(chatId);
  }
}
