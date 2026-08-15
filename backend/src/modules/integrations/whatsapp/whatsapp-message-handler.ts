import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { ensureHelpdeskConfigs } from '../../helpdesk/helpdesk.service';
import { iniciarOuResetarTriagem, enviarMenuInicial } from '../../helpdesk/triagem.service';
import { getHorarioConfig, isAtendimentoAberto } from '../../helpdesk/horario';
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
import { processarDescricaoProblema, montarMensagemConfirmacao, analisarDescricaoProblema } from '../../ai/aiTriage.service';
import { getConfigAutoAtendimento, propostaRespostaIA, enviarRespostaValidada, respostaJaValidada } from '../../ai/aiValidation.service';
import {
  buscarTicketAtivo,
  buscarCsatPendente,
  buscarConfirmacaoPendente,
  processarRespostaEncerramento,
  finalizeTicketAfterEvaluation,
  abandonarAvaliacaoPendente,
  cancelarAvaliacoesNaoEnviadas,
  extrairNotaAvaliacao,
  enviarMensagemObrigadoAvaliacao,
} from '../../helpdesk/flow.service';

// ── Shared WhatsApp Message Handler ────────────────────────────────────
// Provider-agnostic bot/triage logic used by all WhatsApp backends.
//
// Máquina de estados (fonte de verdade no banco):
//   Ticket: status/etapa/evaluationStatus
//   Avaliação: CSATResposta (respondidoEm/enviadoEm) + evaluationStatus
//   Bot (in-memory, auxiliar): IDLE / AWAITING_DEPARTMENT / AWAITING_CSAT
//
// Regra central: ticket fechado NUNCA é reaberto por nova mensagem.
// Nova mensagem sem ticket ativo → novo chamado (ou resposta de avaliação pendente).

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const processingLocks = new Set<string>();
const PROCESSING_LOCK_TIMEOUT_MS = 30_000; // 30 segundos

// Dedupe de webhooks/eventos repetidos (idempotência de cliques)
const recentMessageIds = new Map<string, number>();
const MESSAGE_ID_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ── Conversation State Machine (auxiliar, em memória) ─────────────────
type ConversationState = 'IDLE' | 'AWAITING_CSAT' | 'AWAITING_DEPARTMENT' | 'AWAITING_COMPANY' | 'AWAITING_DESCRIPTION';
const conversationStates = new Map<string, ConversationState>();
const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const stateTimestamps = new Map<string, number>();

// Candidatos de empresa exibidos ao cliente (aguardando escolha por número/nome).
// Auxiliar de curta duração — a fonte de verdade do passo do bot é Ticket.botFluxo.
const pendingCompanyCandidates = new Map<string, Array<{ id: string; razaoSocial: string }>>();
const pendingCompanyTimestamps = new Map<string, number>();
const PENDING_COMPANY_TTL_MS = 10 * 60 * 1000; // 10 minutos

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

// ── Fluxo determinístico pós-departamento ────────────────────────────────
// Estado persistido em Ticket.botFluxo (fonte de verdade no banco):
//   awaiting_company      → cliente precisa informar o nome da empresa
//   awaiting_description  → cliente precisa descrever o problema
// O fluxo legado (sem botFluxo) permanece intacto abaixo na seção 9.

// Vincula (ou cria) o Colaborador do telefone ao Client confirmado pelo bot.
async function vincularColaboradorTelefone(
  contactPhone: string | null | undefined,
  contactName: string | null | undefined,
  clientId: string,
): Promise<void> {
  if (!contactPhone) return;
  const phoneNorm = contactPhone.replace(/[^\d]/g, '');
  const existente = await prisma.colaborador.findFirst({
    where: {
      clientId,
      OR: [
        { telefone: { contains: phoneNorm } },
        { whatsapp: { contains: phoneNorm } },
      ],
    },
  });
  if (!existente) {
    await prisma.colaborador.create({
      data: {
        clientId,
        nome: contactName || 'Contato WhatsApp',
        telefone: contactPhone,
        whatsapp: contactPhone,
        principal: false,
      },
    });
  }
}

// Confirma a empresa escolhida, vincula ao ticket/colaborador e pede a descrição.
async function confirmarEmpresaTicket(
  ticket: any,
  clientId: string,
  razaoSocial: string,
  chatId: string,
  sendMessage: SendMessageFn,
  provider: string,
): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { clientId, botFluxo: 'awaiting_description' },
  });
  await vincularColaboradorTelefone(ticket.contactPhone, ticket.contactName, clientId);

  // Timeline/indicadores: empresa identificada na conversa.
  await prisma.ticketStageEvent.create({
    data: {
      ticketId: ticket.id,
      etapaAnterior: 'fila',
      etapaNova: 'fila',
      origem: 'automatico',
      mensagemAutomatica: `Empresa identificada: "${razaoSocial}"`,
    },
  }).catch(() => undefined);

  console.log(`[BOT FLOW] ticketId=${ticket.id} state=AWAITING_COMPANY companyId=${clientId} nextState=AWAITING_DESCRIPTION`);

  const msg = `${ticket.contactName || 'Cliente'}, empresa confirmada! ✅\n\n*Empresa:* ${razaoSocial}\n\n📝 Agora, por favor, *descreva detalhadamente* seu problema ou solicitação. Quanto mais informações, melhor poderemos ajudá-lo.`;
  const result = await sendMessage(chatId, msg);
  if (result?.success) {
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: msg, source: 'bot', tipo: 'system' },
    });
  }
  console.log(`[${provider}] Empresa "${razaoSocial}" vinculada ao ticket ${ticket.id}`);
}

function getPendingCompanyCandidates(phoneDigits: string) {
  const key = phoneDigits.slice(-11);
  const ts = pendingCompanyTimestamps.get(key) || 0;
  if (Date.now() - ts > PENDING_COMPANY_TTL_MS) {
    pendingCompanyCandidates.delete(key);
    pendingCompanyTimestamps.delete(key);
    return undefined;
  }
  return pendingCompanyCandidates.get(key);
}

// Cliente informou/confirmou o nome da empresa (botFluxo = awaiting_company).
async function processarNomeEmpresaBot(
  ticket: any,
  phoneDigits: string,
  chatId: string,
  text: string,
  sendMessage: SendMessageFn,
  provider: string,
): Promise<void> {
  const key = phoneDigits.slice(-11);
  const nomeEmpresa = text.trim();

  const rePerguntaEmpresa = () =>
    `${ticket.contactName || 'Cliente'}, confira o *nome do seu laboratório, clínica ou hospital* e envie novamente:\n\n(Ex.: "Lab Central" ou "Hospital São Lucas")`;

  // Cliente escolheu por número na lista de candidatos exibida antes
  const candidatos = getPendingCompanyCandidates(phoneDigits);
  const numero = /^(\d+)$/.exec(nomeEmpresa);
  if (numero && candidatos && candidatos.length > 0) {
    const idx = parseInt(numero[1], 10) - 1;
    if (idx >= 0 && idx < candidatos.length) {
      pendingCompanyCandidates.delete(key);
      pendingCompanyTimestamps.delete(key);
      await confirmarEmpresaTicket(ticket, candidatos[idx].id, candidatos[idx].razaoSocial, chatId, sendMessage, provider);
      setConversationState(phoneDigits, 'AWAITING_DESCRIPTION');
      return;
    }
  }

  if (!nomeEmpresa || nomeEmpresa.length > 120) {
    pendingCompanyCandidates.delete(key);
    pendingCompanyTimestamps.delete(key);
    const msg = rePerguntaEmpresa();
    const result = await sendMessage(chatId, msg);
    if (result?.success) {
      await prisma.message.create({
        data: { ticketId: ticket.id, fromMe: true, content: msg, source: 'bot', tipo: 'system' },
      });
    }
    return;
  }

  const matches = await prisma.client.findMany({
    where: {
      OR: [
        { razaoSocial: { contains: nomeEmpresa, mode: 'insensitive' } },
        { nomeFantasia: { contains: nomeEmpresa, mode: 'insensitive' } },
      ],
    },
    orderBy: { razaoSocial: 'asc' },
    take: 5,
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  });

  const nomeLower = nomeEmpresa.toLowerCase();
  const exato = matches.find(
    (c) => c.razaoSocial.toLowerCase() === nomeLower || (c.nomeFantasia || '').toLowerCase() === nomeLower,
  );

  if (exato || matches.length === 1) {
    const escolhido = exato || matches[0];
    pendingCompanyCandidates.delete(key);
    pendingCompanyTimestamps.delete(key);
    await confirmarEmpresaTicket(ticket, escolhido.id, escolhido.razaoSocial, chatId, sendMessage, provider);
    setConversationState(phoneDigits, 'AWAITING_DESCRIPTION');
    return;
  }

  if (matches.length > 1) {
    // Apresenta opções numeradas e aguarda o cliente escolher (por número ou nome)
    pendingCompanyCandidates.set(key, matches);
    pendingCompanyTimestamps.set(key, Date.now());
    const opcoes = matches.map((c, i) => `${i + 1} - ${c.razaoSocial}`).join('\n');
    const msg = `Encontrei mais de uma empresa com esse nome em nosso sistema. Qual delas?\n\n${opcoes}\n\nResponda com o *número* da opção desejada.`;
    const result = await sendMessage(chatId, msg);
    if (result?.success) {
      await prisma.message.create({
        data: { ticketId: ticket.id, fromMe: true, content: msg, source: 'bot', tipo: 'system' },
      });
    }
    return;
  }

  // Nenhuma empresa encontrada → NÃO cria vínculo automático nem inventa dados
  pendingCompanyCandidates.delete(key);
  pendingCompanyTimestamps.delete(key);
  const msg = `Não localizamos a empresa *"${nomeEmpresa}"* em nosso sistema.\n\n${rePerguntaEmpresa()}`;
  const result = await sendMessage(chatId, msg);
  if (result?.success) {
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: msg, source: 'bot', tipo: 'system' },
    });
  }
}

// Cliente descreveu o problema (botFluxo = awaiting_description).
async function processarDescricaoBot(
  ticket: any,
  phoneDigits: string,
  chatId: string,
  text: string,
  sendMessage: SendMessageFn,
  provider: string,
): Promise<void> {
  // Classifica assunto/categoria/prioridade com regras existentes (IA + fallback local)
  const triagem = await analisarDescricaoProblema(ticket.id, text);
  const assuntoFinal = (triagem.assunto || '').trim() || 'Sem assunto';

  const updateData: Record<string, any> = { assunto: assuntoFinal, botFluxo: null };
  if (triagem.categoria) updateData.categoria = triagem.categoria;
  if (triagem.prioridade) updateData.prioridade = triagem.prioridade;
  if (!ticket.observacoes && text) updateData.observacoes = text.trim();

  // Protocolo na criação do chamado (gera apenas se ainda não existir; lock do sistema já serializa).
  let protocolo = ticket.protocolo;
  if (!protocolo) {
    const { generateProtocolo } = await import('./whatsapp.service');
    for (let attempt = 0; attempt < 3; attempt++) {
      protocolo = await generateProtocolo();
      try {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { protocolo } });
        break;
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('protocolo') && attempt < 2) continue;
        throw err;
      }
    }
  }

  await prisma.ticket.update({ where: { id: ticket.id }, data: updateData });

  // Timeline/indicadores: descrição recebida e assunto identificado.
  await prisma.ticketStageEvent.create({
    data: {
      ticketId: ticket.id,
      etapaAnterior: 'fila',
      etapaNova: 'fila',
      origem: 'automatico',
      mensagemAutomatica: `Descrição recebida; assunto identificado: "${assuntoFinal}"`,
    },
  }).catch(() => undefined);

  console.log(`[BOT FLOW] ticketId=${ticket.id} state=AWAITING_DESCRIPTION incomingMessage="${text.slice(0, 80)}" nextState=QUEUED subject="${assuntoFinal}"`);
  console.log(`[TICKET] ticketId=${ticket.id} department=${ticket.departamentoId} protocolo=${protocolo} company=${ticket.clientId || 'n/a'} queue=fila status=aberto`);

  const msgConfirmacao = `${ticket.contactName || 'Cliente'}, seu atendimento foi registrado com sucesso! ✅\n\n*Protocolo:* #${protocolo}\n*Assunto:* ${assuntoFinal}\n\nSeu chamado foi encaminhado para a fila do departamento. Em breve um analista dará continuidade ao atendimento.`;
  const result = await sendMessage(chatId, msgConfirmacao);
  if (result?.success) {
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: msgConfirmacao, source: 'bot', tipo: 'system' },
    });
  }

  const posicaoFila = await prisma.ticket.count({
    where: { etapa: 'fila', departamentoId: ticket.departamentoId },
  });
  const posicaoMsg = await montarPosicaoFilaComInfo(
    ticket.contactName || 'cliente',
    posicaoFila,
    true,
    !!ticket.clientId,
  );
  const posResult = await sendMessage(chatId, posicaoMsg);
  if (posResult?.success) {
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: posicaoMsg, source: 'bot', tipo: 'system' },
    });
  }

  setConversationState(phoneDigits, 'IDLE');
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
  /** ID de botão/lista selecionado pelo cliente (interactiveId normalizado). */
  interactiveId?: string;
  /** ID único da mensagem no provider (para dedupe de webhooks duplicados). */
  messageId?: string;
}

export interface SendMessageFn {
  (to: string, message: string): Promise<{ success: boolean; error?: string }>;
}

export async function processIncomingMessageHandler(
  data: IncomingMessageData,
  sendMessage: SendMessageFn,
): Promise<void> {
  const { phone, contactName, mediaUrl, mimeType, connectionId, provider } = data;

  if (!phone) return;

  const chatId = phone.replace(/@c\.us$/i, '');
  const phoneDigits = chatId.replace(/[^\d]/g, '');
  const phoneSemSufixo = phoneDigits;
  const text = data.interactiveId || data.text || '';

  // Idempotência: ignora webhooks/eventos duplicados
  if (data.messageId) {
    const last = recentMessageIds.get(data.messageId);
    if (last && Date.now() - last < MESSAGE_ID_TTL_MS) {
      console.log(`[WhatsApp] Evento duplicado ignorado messageId=${data.messageId} provider=${provider}`);
      return;
    }
    recentMessageIds.set(data.messageId, Date.now());
  }

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
    // ── 0) Resposta de aprovação via WhatsApp (NÃO cria ticket) ───────
    const { processarRespostaAprovacaoWhatsApp } = await import('../../aprovacoes/aprovacao.service');
    const respAprov = await processarRespostaAprovacaoWhatsApp({
      phoneDigits,
      interactiveId: data.interactiveId,
      text: data.text,
    });
    if (respAprov.tratado) {
      const msgAprov = respAprov.aprovacaoId
        ? respAprov.decidido === undefined
          ? '⚠️ A aprovação expirou e foi cancelada.'
          : respAprov.decidido
            ? '✅ Aprovação registrada com sucesso!'
            : '❌ Aprovação rejeitada.'
        : '';
      await sendMessage(chatId, msgAprov).catch(() => {});
      console.log(`[APROVACAO] phone=${phoneDigits} event=RESPONDIDA aprovacaoId=${respAprov.aprovacaoId} decidido=${respAprov.decidido} — nenhum ticket criado`);
      return;
    }

    const horarioCfg = await getHorarioConfig();
    const atendimentoAberto = await isAtendimentoAberto(horarioCfg);

    // ── 1) Resolver ticket ativo (fonte de verdade: banco) ───────────
    // Ticket fechado/cancelado NÃO é ativo — nova mensagem não o reabre.
    let ticket = await buscarTicketAtivo(phoneSemSufixo, jid);
    console.log(`[TICKET_LOOKUP] phone=${phoneSemSufixo} event=RESULT ticketId=${ticket?.id || 'nenhum'}`);

    if (!ticket) {
      // ── 2) Sem ticket ativo → confirmar resolução pendente / avaliação ──
      // Confirmação de resolução (após encerrar, antes da avaliação): interceita
      // a resposta SIM/NÃO/descrição ANTES de criar novo ticket (ZERO ticket novo).
      const confirmacaoPendente = await buscarConfirmacaoPendente(phoneDigits, jid);
      if (confirmacaoPendente) {
        const r = await processarRespostaEncerramento(phoneDigits, confirmacaoPendente, text);
        console.log(
          `[CONFIRMACAO_RESOLUCAO] phone=${phoneDigits} ticketId=${confirmacaoPendente.id} ` +
          `event=RESPONDIDA ok=${r.ok} semResolucao=${!!r.semResolucao} aguardandoDescricao=${!!r.aguardandoDescricao} invalida=${!!r.respostaInvalida}`,
        );
        return;
      }

      const notaResposta = extrairNotaAvaliacao(text);
      const csatPendente = await buscarCsatPendente(phoneDigits, jid);

      if (csatPendente) {
        if (notaResposta !== null) {
          // Cliente respondeu a avaliação → registra, encerra definitivo, limpa estado
          console.log(`[EVALUATION_RESPONSE] phone=${phoneDigits} event=RESPONDIDA nota=${notaResposta} ticketId=${csatPendente.ticket.id}`);
          const resultado = await finalizeTicketAfterEvaluation(phoneDigits, csatPendente.csat, notaResposta);
          if (resultado.ok) {
            await enviarMensagemObrigadoAvaliacao(chatId, sendMessage);
          }
          return;
        }

        // Mensagem NÃO é avaliação → não prender o cliente. Abandona a avaliação
        // pendente (marca cancelada) e segue para criar um novo chamado.
        console.log(`[WhatsApp] Avaliação pendente ignorada (mensagem não é resposta) — criando novo ticket`);
        await abandonarAvaliacaoPendente(phoneDigits, csatPendente.csat);
      }

      // Cancelar avaliações criadas mas nunca enviadas (evita retry tardio de chamado antigo)
      await cancelarAvaliacoesNaoEnviadas(phoneDigits, jid);

      // ── 3) Criar novo ticket ────────────────────────────────────────
      let client = null;
      if (phoneDigits) {
        client = await prisma.client.findFirst({
          where: { telefone: { contains: phoneDigits } },
        });
        if (!client) {
          const colaborador = await prisma.colaborador.findFirst({
            where: {
              OR: [
                { telefone: { contains: phoneDigits } },
                { whatsapp: { contains: phoneDigits } },
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

      const etapaInicial = atendimentoAberto ? await etapaInicialSlug() : 'aguardando_expediente';

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
      console.log(`[NEW_TICKET] ticketId=${created.id} customerPhone=${phoneSemSufixo} event=CREATED etapa=${etapaInicial}`);

      await prisma.ticketStageEvent.create({
        data: {
          ticketId: created.id,
          etapaAnterior: 'novo',
          etapaNova: etapaInicial,
          origem: 'automatico',
        },
      });

      const { avaliarRegras } = await import('../../automations/automations.service');
      avaliarRegras('novo_ticket', { ticketId: created.id }).catch((e) =>
        console.warn(`[${provider}] Falha ao avaliar regras novo_ticket:`, e?.message || e)
      );
    }

    // ── 4) Salvar mensagem recebida ───────────────────────────────────
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

    // ── 5) Business hours check ───────────────────────────────────────
    if (!atendimentoAberto && (ticket!.etapa === 'aguardando_expediente' || ((ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId))) {
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

    // ── 6) Send initial menu if needed (BEFORE department selection) ──
    const needsMenu = (ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId;
    if (needsMenu) {
      // Don't send menu if this ticket was reopened after CSAT response
      const jaTemCsatMenu = await prisma.cSATResposta.findUnique({ where: { ticketId: ticket!.id } });
      if (jaTemCsatMenu) {
        console.log(`[WhatsApp] Ticket ${ticket!.id} ja tem CSAT, ignorando menu`);
      } else {
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
    }

    // ── 7) Bot menu: department selection ─────────────────────────────
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

        // Fluxo determinístico pós-departamento: se o contato já está vinculado
        // a uma empresa (Client) no CRM → pedir descrição. Caso contrário,
        // perguntar o nome da empresa ANTES da descrição (sem criar vínculo).
        const temEmpresaVinculada = !!ticket!.clientId;

        await prisma.ticket.update({
          where: { id: ticket!.id },
          data: {
            departamentoId: deptInfo.departamentoId,
            etapa: 'fila',
            botFluxo: temEmpresaVinculada ? 'awaiting_description' : 'awaiting_company',
          },
        });

        notificarAtendentesFila(ticket!.id, deptInfo.departamentoId).catch((e) =>
          console.warn(`[${provider}] Falha ao notificar atendentes:`, e?.message || e)
        );

        const proximaMsg = temEmpresaVinculada
          ? await montarAckDepartamento(ticket!.contactName || 'cliente', deptInfo.departamentoNome)
          : `${ticket!.contactName || 'Cliente'}, por favor, informe o *nome do seu laboratório, clínica ou hospital* para vincularmos seu atendimento:\n\n(Ex.: "Lab Central" ou "Hospital São Lucas")`;
        const result = await sendMessage(chatId, proximaMsg);
        if (result?.success) {
          await prisma.message.create({
            data: { ticketId: ticket!.id, fromMe: true, content: proximaMsg, source: 'bot', tipo: 'system' },
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
        setConversationState(phoneDigits, temEmpresaVinculada ? 'AWAITING_DESCRIPTION' : 'AWAITING_COMPANY');
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

    // ── 8) Keyword classification ─────────────────────────────────────
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

    // ── 9) Queue: AI-powered description analysis ─────────────────────
    if (ticket!.etapa === 'fila' && ticket!.departamentoId && !ticket!.protocolo && text) {
      // ── 9.1) Fluxo determinístico: aguardando nome da empresa ────────
      if (ticket!.botFluxo === 'awaiting_company') {
        await processarNomeEmpresaBot(ticket!, phoneDigits, chatId, text, sendMessage, provider);
        return;
      }

      // ── 9.2) Fluxo determinístico: aguardando descrição do problema ──
      if (ticket!.botFluxo === 'awaiting_description') {
        await processarDescricaoBot(ticket!, phoneDigits, chatId, text, sendMessage, provider);
        return;
      }

      // ── Fluxo legado (sem botFluxo persistido) — comportamento original ──
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

    // ── 10) Initial menu for new triagem tickets ──────────────────────
    if ((ticket!.etapa === 'triagem' || ticket!.etapa === 'boas_vindas' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId) {
      // Don't send menu if this ticket was reopened after CSAT response
      const jaTemCsat = await prisma.cSATResposta.findUnique({ where: { ticketId: ticket!.id } });
      if (jaTemCsat) {
        console.log(`[WhatsApp] Ticket ${ticket!.id} ja tem CSAT, nao enviando menu`);
        return;
      }
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
