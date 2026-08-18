import prisma from '../../config/database';
import {
  generateProtocolo,
  sendWhatsAppMessage,
  sanitizePhoneNumber,
} from '../integrations/whatsapp/whatsapp.service';
import {
  ensureHelpdeskConfigs,
  getEtapaConfig,
  buildMessageVars,
  interpolate,
  sendStageAutoMessage,
} from './helpdesk.service';
import { montarBoasVindas } from './menu';

const timersAtivos = new Map<string, NodeJS.Timeout>();
const followupEnviado = new Set<string>();
const processando = new Set<string>();

function clearTimer(ticketId: string) {
  const t = timersAtivos.get(ticketId);
  if (t) {
    clearTimeout(t);
    timersAtivos.delete(ticketId);
  }
}

export function triagemJaIniciada(ticketId: string): boolean {
  return timersAtivos.has(ticketId) || processando.has(ticketId);
}

export function cancelarTriagem(ticketId: string) {
  clearTimer(ticketId);
  processando.delete(ticketId);
  followupEnviado.delete(ticketId);
}

export function triagemFollowupEnviado(ticketId: string): boolean {
  return followupEnviado.has(ticketId);
}

export async function enviarMenuInicial(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !ticket.contactPhone) {
    console.warn(`[Fila] Menu inicial: ticket ${ticketId} nao encontrado ou sem telefone`);
    return;
  }
  if ((ticket.etapa !== 'triagem' && ticket.etapa !== 'boas_vindas' && ticket.etapa !== 'fila') || ticket.departamentoId) {
    console.log(`[Fila] Menu inicial ignorado: ticket ${ticketId} etapa=${ticket.etapa} depto=${ticket.departamentoId}`);
    return;
  }

  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  if (departamentos.length === 0) {
    console.warn(`[Fila] Nenhum departamento ativo encontrado para ticket ${ticketId}`);
    return;
  }

  const { descricao, fallbackTexto } = await montarBoasVindas(ticket.contactName || 'cliente');

  const phone = sanitizePhoneNumber(ticket.contactPhone).replace(/@c\.us$/i, '');

  // Lista interativa (clickável) — departamentos do banco com rowId dept_<slug>.
  // O handler normaliza o clique via interactiveId → detectarOpcaoMenu.
  const { enviarListaInterativa } = await import('../integrations/whatsapp/whatsapp-message-service');

  const sections = [
    {
      title: 'Departamentos',
      rows: departamentos.map((d) => ({
        id: `dept_${(d as any).slug || d.id}`,
        title: d.nome,
        description: (d as any).descricao || undefined,
      })),
    },
  ];

  const result = await enviarListaInterativa(phone, {
    title: 'Selecione o departamento',
    description: descricao,
    sections,
    fallbackTexto,
    connectionId: (ticket as any).whatsappConnectionId || undefined,
    jid: ticket.contactJid || undefined,
  });

  if (result.success) {
    const conteudoRegistrado = result.usedFallback
      ? `[Bot] Menu de departamentos enviado (texto)\n\n${fallbackTexto}`
      : `[Bot] Menu de departamentos enviado (interativo)\n\n${descricao}\n\n${departamentos.map((d) => `• ${d.nome}`).join('\n')}`;
    await prisma.message.create({
      data: { ticketId, fromMe: true, content: conteudoRegistrado, source: 'bot', tipo: 'system' },
    });
    console.log(`[Fila] Menu de departamentos (${result.usedFallback ? 'texto/fallback' : 'interativo'}) enviado para ticket ${ticketId}`);
  } else {
    console.warn(`[Fila] Falha ao enviar menu para ticket ${ticketId}: ${result.error}`);
  }
}

export async function iniciarOuResetarTriagem(ticketId: string) {
  await ensureHelpdeskConfigs();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;
  if (ticket.protocolo || (ticket.etapa !== 'triagem' && ticket.etapa !== 'boas_vindas' && ticket.etapa !== 'fila')) {
    cancelarTriagem(ticketId);
    return;
  }

  clearTimer(ticketId);

  const config = await getEtapaConfig('fila');
  const minutos = config?.tempoInatividadeMin && config.tempoInatividadeMin > 0
    ? config.tempoInatividadeMin
    : 5;
  const ms = minutos * 60 * 1000;
  console.log(`[Fila] ticket=${ticketId} etapa=${ticket.etapa}, follow-up agendado em ${minutos}min`);

  const handle = setTimeout(async () => {
    timersAtivos.delete(ticketId);
    if (followupEnviado.has(ticketId)) return;
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t || t.protocolo || (t.etapa !== 'triagem' && t.etapa !== 'boas_vindas' && t.etapa !== 'fila') || t.status === 'fechado') return;
    await enviarFollowUp(ticketId);
  }, ms);

  timersAtivos.set(ticketId, handle);
}

export async function abrirChamadoPorAtendente(
  ticketId: string,
  atendenteId: string,
  dados: {
    assunto: string;
    categoria?: string;
    prioridade?: string;
    tipo?: string;
    observacoes?: string;
    clientId?: string;
    departamentoId?: string;
  }
) {
  if (processando.has(ticketId)) {
    return { ok: false, error: 'Ticket sendo processado, tente novamente' };
  }
  processando.add(ticketId);
  const MAX_RETRIES = 3;
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { ok: false, error: 'Ticket nao encontrado' };
    if (!dados.assunto || !dados.assunto.trim()) {
      return { ok: false, error: 'Assunto obrigatorio' };
    }

    let lastError: any = null;
    // O bot pode já ter gerado o protocolo na criação do chamado — reutiliza em vez de reclamar.
    const protocoloExistente = ticket.protocolo;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const protocolo = protocoloExistente || (await generateProtocolo());
        const etapaNova = 'em_atendimento';
        const updateData: any = {
          ...(protocoloExistente ? {} : { protocolo }),
          assunto: dados.assunto.trim(),
          categoria: dados.categoria || ticket.categoria,
          prioridade: dados.prioridade || ticket.prioridade || 'media',
          tipo: dados.tipo || ticket.tipo,
          observacoes: dados.observacoes?.trim() || ticket.observacoes,
          etapa: etapaNova,
          status: 'em_atendimento',
          assigneeId: atendenteId,
          dataInicioAtendimento: new Date(),
        };
        if (dados.clientId) {
          updateData.clientId = dados.clientId;
        }
        if (dados.departamentoId) {
          updateData.departamentoId = dados.departamentoId;
        } else if (!ticket.departamentoId) {
          // Se nao veio departamentoId do request, tentar pegar do atendente
          const atendente = await prisma.user.findUnique({
            where: { id: atendenteId },
            select: { departamentos: { select: { departamentoId: true }, take: 1 } },
          });
          const deptId = atendente?.departamentos?.[0]?.departamentoId;
          if (deptId) updateData.departamentoId = deptId;
        }
        const updated = await prisma.ticket.update({
          where: { id: ticketId },
          data: updateData,
        });

        if (dados.clientId && ticket.contactPhone) {
          const phoneNorm = ticket.contactPhone.replace(/\D/g, '');
          const existente = await prisma.colaborador.findFirst({
            where: {
              clientId: dados.clientId,
              OR: [
                { telefone: { contains: phoneNorm } },
                { whatsapp: { contains: phoneNorm } },
              ],
            },
          });
          if (!existente) {
            await prisma.colaborador.create({
              data: {
                clientId: dados.clientId,
                nome: ticket.contactName || 'Contato WhatsApp',
                telefone: ticket.contactPhone,
                whatsapp: ticket.contactPhone,
                principal: false,
              },
            });
          }
        }
        await prisma.ticketStageEvent.create({
          data: {
            ticketId,
            etapaAnterior: ticket.etapa || 'fila',
            etapaNova,
            origem: 'manual',
            mensagemEnviada: true,
            usuarioId: atendenteId,
          },
        });
        clearTimer(ticketId);
        followupEnviado.delete(ticketId);
        sendStageAutoMessage(ticketId, etapaNova).catch((e) =>
          console.warn('[Fila] Falha ao enviar autoMessage em_atendimento:', e?.message || e)
        );
        console.log(`[Fila] Chamado aberto, ticket ${ticketId} protocolo ${protocolo}`);
        return { ok: true, ticket: updated };
      } catch (err: any) {
        lastError = err;
        if (err?.code === 'P2002' && err?.meta?.target?.includes('protocolo')) {
          console.warn(`[Fila] P2002 protocolo duplicado, tentativa ${attempt + 1}/${MAX_RETRIES}`);
          continue;
        }
        throw err;
      }
    }
    console.error('[Fila] Todas as tentativas de gerar protocolo falharam:', lastError?.message || lastError);
    return { ok: false, error: 'Falha ao gerar protocolo, tente novamente' };
  } catch (err: any) {
    console.error('[Fila] Erro ao abrir chamado:', err?.message || err);
    return { ok: false, error: 'Erro ao abrir chamado' };
  } finally {
    processando.delete(ticketId);
  }
}

export async function transferirTicket(
  ticketId: string,
  deUsuarioId: string,
  paraUsuarioId: string,
  motivo?: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: 'Ticket nao encontrado' };
  if (!ticket.protocolo) return { ok: false, error: 'Ticket ainda nao foi triado' };

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId: paraUsuarioId },
  });
  await prisma.ticketStageEvent.create({
    data: {
      ticketId,
      etapaAnterior: ticket.etapa,
      etapaNova: ticket.etapa,
      origem: 'transferencia',
      usuarioId: deUsuarioId,
      mensagemAutomatica: motivo || `Transferido de ${deUsuarioId} para ${paraUsuarioId}`,
    },
  });
  return { ok: true, ticket: updated };
}

async function enviarFollowUp(ticketId: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { client: true },
    });
    if (!ticket || !ticket.contactPhone || ticket.protocolo || ticket.status === 'fechado') return;
    if (ticket.etapa !== 'fila') return;

    const config = await getEtapaConfig('fila');
    const template = config?.mensagemFollowup;
    if (!template) return;

    const vars = buildMessageVars({
      contactName: ticket.contactName,
      clientName: ticket.client?.razaoSocial,
    });
    let mensagem = interpolate(template, vars);

    // Adicionar posicao na fila e informacoes pendentes
    if (ticket.departamentoId) {
      const { calcularPosicaoFila } = await import('./fila.service');
      const posicao = await calcularPosicaoFila(ticket.departamentoId);
      const { montarPosicaoFilaComInfo } = await import('./menu');
      const posMsg = await montarPosicaoFilaComInfo(
        ticket.contactName || 'cliente',
        posicao,
        !!ticket.assunto,
        !!ticket.clientId,
      );
      mensagem = `${mensagem}\n\n${posMsg}`;
    }

    const phone = sanitizePhoneNumber(ticket.contactPhone).replace(/@c\.us$/i, '');
    const result = await sendWhatsAppMessage(phone, mensagem, undefined, ticket.contactJid || undefined);
    if (result.success) {
      await prisma.message.create({
        data: { ticketId, fromMe: true, content: mensagem, source: 'bot' },
      });
      followupEnviado.add(ticketId);
      console.log(`[Fila] Follow-up enviado para ticket ${ticketId}`);
    }
  } catch (err: any) {
    console.error('[Fila] Erro ao enviar follow-up:', err?.message || err);
  }
}
