import prisma from '../../../config/database';
import { ensureHelpdeskConfigs } from '../../helpdesk/helpdesk.service';
import { iniciarOuResetarTriagem, enviarMenuInicial } from '../../helpdesk/triagem.service';
import { isHorarioAtendimento, getHorarioConfig } from '../../helpdesk/horario';
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

// ── Shared WhatsApp Message Handler ────────────────────────────────────
// Provider-agnostic bot/triage logic used by all WhatsApp backends.

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const processingLocks = new Set<string>();

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

  while (processingLocks.has(chatId)) await sleep(50);
  processingLocks.add(chatId);

  try {
    const horarioCfg = await getHorarioConfig();
    const horarioOk = isHorarioAtendimento(horarioCfg);

    // Find existing open ticket
    const jid = data.jid;
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

    if (ticket) {
      // Reopen closed ticket
      if (ticket.status === 'fechado') {
        ticket = await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'em_atendimento', etapa: 'triagem', departamentoId: null, dataFechamento: null },
        });
        await prisma.ticketStageEvent.create({
          data: {
            ticketId: ticket.id,
            etapaAnterior: 'concluido',
            etapaNova: 'triagem',
            origem: 'automatico',
          },
        });
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

      const created = await prisma.ticket.create({
        data: {
          contactName: resolvedContactName,
          contactPhone: phoneSemSufixo,
          contactJid: jid || null,
          status: 'aberto',
          etapa: 'triagem',
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
          etapaNova: 'triagem',
          origem: 'automatico',
        },
      });

      notificarAtendentesFila(created.id).catch((e) =>
        console.warn(`[${provider}] Falha ao notificar atendentes:`, e?.message || e)
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
    if (!horarioOk && ticket!.etapa === 'triagem' && !ticket!.protocolo && !ticket!.departamentoId) {
      const msgForaHorario = await montarForaHorario(ticket!.contactName || 'cliente');
      const result = await sendMessage(chatId, msgForaHorario);
      if (result?.success) {
        await prisma.message.create({
          data: { ticketId: ticket!.id, fromMe: true, content: msgForaHorario, source: 'bot', tipo: 'system' },
        });
      }
      return;
    }

    // ── Bot menu: department selection ──────────────────────────────
    if (text && (ticket!.etapa === 'triagem' || ticket!.etapa === 'fila') && !ticket!.protocolo && !ticket!.departamentoId) {
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
    if (ticket!.etapa === 'triagem' && !ticket!.protocolo && !ticket!.departamentoId) {
      const temAlgumaMsgDoBot = await prisma.message.count({
        where: { ticketId: ticket!.id, fromMe: true },
      });
      if (temAlgumaMsgDoBot === 0) {
        enviarMenuInicial(ticket!.id).catch((e) =>
          console.error(`[${provider}] Erro ao enviar saudacao:`, e?.message || e)
        );
      }
      iniciarOuResetarTriagem(ticket!.id).catch((e) =>
        console.error(`[${provider}] Erro ao iniciar follow-up:`, e?.message || e)
      );
    }
  } finally {
    processingLocks.delete(chatId);
  }
}
