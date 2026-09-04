import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  ensureHelpdeskConfigs,
  listEtapas,
  getEtapaConfig,
  sendStageAutoMessage,
  saveConversationSnapshot,
  updateClientStatusCounters,
  getTicketTags,
  addTicketTag,
  removeTicketTag,
  setTicketTags,
} from './helpdesk.service';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import { gerenciarPausaSlaPorEtapa } from './slaPausa.service';
import { calcularPosicaoFila, recalcularFilaDepartamento } from './fila.service';
import { normalizeRole } from '../auth/rbac';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
import { notificarAtendentesFila } from '../alerts/alerts.service';
import { calcularFCR, metricasFCR } from './fcr.service';
import { criarKanbanTaskDeTicket, tempoPorDepartamento } from './department-integration.service';
import { validarClassificacaoObrigatoria } from './categorias.service';

const PRIORIDADE_ORDEM: Record<string, number> = {
  urgente: 0,
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export async function getKanban(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    await ensureHelpdeskConfigs();
    const allEtapas = await listEtapas();
    const etapas = allEtapas.filter((e) => e.ativo);
    const orderBy = (req.query.orderBy as string) || 'updatedAt_desc';
    const configFila = etapas.find((e) => e.slug === 'fila') as any;
    const ordenacaoFila = configFila?.ordenacaoFila || 'updatedAt_desc';

    const where: any = { status: { not: 'arquivado' } };

    if (normalizeRole(req.user.role) === 'agente') {
      const deptIds = req.user.departamentos.map((d) => d.id);
      if (deptIds.length > 0) {
        // Tecnicos: triagem + fila do seu setor + fila sem depto + aguardando
        // expediente (fora do horário) + seus tickets
        where.OR = [
          { etapa: 'triagem' },
          { etapa: 'aguardando_expediente', assigneeId: null },
          { etapa: 'fila', departamentoId: { in: deptIds }, assigneeId: null },
          { etapa: 'fila', departamentoId: null, assigneeId: null },
          { assigneeId: req.user.id },
        ];
      } else {
        where.OR = [
          { etapa: 'triagem' },
          { etapa: 'aguardando_expediente', assigneeId: null },
          { etapa: 'fila', assigneeId: null },
          { assigneeId: req.user.id },
        ];
      }
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true } },
        assignee: { select: { id: true, name: true, email: true } },
        departamento: { select: { id: true, nome: true, slug: true, cor: true } },
        channel: { select: { id: true, nome: true, tipo: true, slug: true, cor: true, avatar: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true, orders: true, checklists: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const sortBy = (a: any, b: any, key: string): number => {
      if (key === 'dataAbertura_asc') return new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime();
      if (key === 'dataAbertura_desc') return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
      if (key === 'updatedAt_asc') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (key === 'contactName_asc') return (a.contactName || '').localeCompare(b.contactName || '');
      if (key === 'contactName_desc') return (b.contactName || '').localeCompare(a.contactName || '');
      if (key === 'lastMessage_desc') {
        const at = a.messages?.[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : 0;
        const bt = b.messages?.[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : 0;
        return bt - at;
      }
      if (key === 'lastMessageCliente_desc') {
        const at = (a as any).lastClienteAt || 0;
        const bt = (b as any).lastClienteAt || 0;
        return bt - at;
      }
      if (key === 'fifo') {
        const aPri = PRIORIDADE_ORDEM[a.prioridade || 'media'] ?? 2;
        const bPri = PRIORIDADE_ORDEM[b.prioridade || 'media'] ?? 2;
        if (aPri !== bPri) return aPri - bPri;
        const aFila = a.filaOrder ?? 999999;
        const bFila = b.filaOrder ?? 999999;
        if (aFila !== bFila) return aFila - bFila;
        return new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    };

    if (orderBy === 'lastMessageCliente_desc') {
      await Promise.all(
        tickets.map(async (t) => {
          const last = await prisma.message.findFirst({
            where: { ticketId: t.id, fromMe: false },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          (t as any).lastClienteAt = last?.createdAt ? new Date(last.createdAt).getTime() : 0;
        })
      );
    }

    const board: Record<string, any> = {};
    const contagemEtapas: Record<string, number> = {};
    for (const etapa of etapas) {
      let items = tickets
        .filter((t) => t.etapa === etapa.slug)
        .map((t) => ({
          ...t,
          lastMessage: t.messages?.[0] || null,
        }));
      const sortKey = etapa.slug === 'fila' ? 'fifo' : orderBy;
      items = items.sort((a, b) => sortBy(a, b, sortKey));
      board[etapa.slug] = {
        id: etapa.id,
        slug: etapa.slug,
        title: etapa.nome,
        descricao: etapa.descricao,
        cor: etapa.cor,
        icone: etapa.icone,
        enviarAuto: etapa.enviarAuto,
        items,
        total: items.length,
      };
      contagemEtapas[etapa.slug] = items.length;
    }
    return res.json({ board, etapas, contagemEtapas });
  } catch (error) {
    console.error('Erro ao carregar kanban helpdesk:', error);
    return res.status(500).json({ error: 'Erro ao carregar kanban' });
  }
}

export async function triageTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { departamentoId, prioridade, observacoes } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!departamentoId) return res.status(400).json({ error: 'departamentoId obrigatório' });

    const dept = await prisma.departamento.findUnique({ where: { id: departamentoId } });
    if (!dept || !dept.ativo) return res.status(400).json({ error: 'Departamento inválido' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    if (ticket.etapa !== 'triagem') return res.status(400).json({ error: 'Ticket não está na triagem' });

    const filaOrder = await calcularPosicaoFila(departamentoId);

    const updateData: any = {
      departamentoId,
      etapa: 'fila',
      filaOrder,
      triagemFeitaPorId: req.user.id,
      triagemEm: new Date(),
    };
    if (prioridade) updateData.prioridade = prioridade;
    if (observacoes) updateData.observacoes = observacoes;

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    await prisma.ticketStageEvent.create({
      data: {
        ticketId: id,
        etapaAnterior: 'triagem',
        etapaNova: 'fila',
        origem: 'manual',
        usuarioId: req.user.id,
      },
    });

    await updateClientStatusCounters(id);

    await logAction({
      usuarioId: req.user.id,
      acao: 'mover_etapa',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { etapaAnterior: 'triagem', etapaNova: 'fila', departamentoId, filaOrder, prioridade, observacoes },
      ip: getIpFromRequest(req),
      severity: 'baixa',
      clienteId: ticket.clientId,
    });

    if (ticket.contactPhone) {
      const clientName = ticket.contactName ? ticket.contactName.split(' ')[0] : 'Cliente';
      const { montarPosicaoFilaComInfo } = await import('./menu');
      const posMsg = await montarPosicaoFilaComInfo(clientName, filaOrder, false, false);
      await sendWhatsAppMessage(ticket.contactPhone, `${clientName}, obrigado por aguardar! Sua demanda foi direcionada ao departamento *${dept.nome}* e já está na fila de atendimento. 🏢\n\n${posMsg}`, (ticket as any).whatsappConnectionId || undefined, ticket.contactJid || undefined).catch(() => {});
    }

    return res.json({ message: 'Ticket direcionado para a fila', ticket: updated, posicaoNaFila: filaOrder });
  } catch (error: any) {
    console.error('[Triagem] Erro:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao direcionar ticket' });
  }
}

export async function assumeTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    if (ticket.etapa !== 'fila') return res.status(400).json({ error: 'Ticket não está na fila' });

    const updateData: any = {
      assigneeId: req.user.id,
      usuarioId: req.user.id,
      assumedAt: new Date(),
      filaOrder: null,
    };

    if (!ticket.departamentoId && req.user.departamentos.length > 0) {
      updateData.departamentoId = req.user.departamentos[0].id;
    }

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    const deptRecalc = updateData.departamentoId || ticket.departamentoId || null;
    await recalcularFilaDepartamento(deptRecalc);

    await prisma.ticketStageEvent.create({
      data: {
        ticketId: id,
        etapaAnterior: 'fila',
        etapaNova: 'em_atendimento',
        origem: 'manual',
        usuarioId: req.user.id,
      },
    });

    await updateClientStatusCounters(id);

    await logAction({
      usuarioId: req.user.id,
      acao: 'atribuir',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { etapaAnterior: 'fila', etapaNova: 'em_atendimento', assigneeId: req.user.id },
      ip: getIpFromRequest(req),
      severity: 'baixa',
      clienteId: ticket.clientId,
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('[Helpdesk] Erro no getKanban:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao buscar kanban' });
  }
}

export async function getStatusBoard(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    const orderBy = (req.query.orderBy as string) || 'updatedAt_desc';
    const where: any = { status: { not: 'arquivado' } };
    if (normalizeRole(req.user.role) === 'agente') {
      where.OR = [{ assigneeId: req.user.id }, { assigneeId: null }];
    }
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true } },
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true, orders: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const STATUS_COLUNAS: Array<{ slug: string; titulo: string; cor: string; icone: string }> = [
      { slug: 'aberto', titulo: 'Aberto', cor: '#3b82f6', icone: 'inbox' },
      { slug: 'em_atendimento', titulo: 'Em Atendimento', cor: '#10b981', icone: 'headphones' },
      { slug: 'pendente', titulo: 'Pendente', cor: '#f59e0b', icone: 'clock' },
      { slug: 'escalonado', titulo: 'Escalonado', cor: '#ef4444', icone: 'arrow-up-circle' },
      { slug: 'resolvido', titulo: 'Resolvido', cor: '#22c55e', icone: 'check-circle' },
      { slug: 'fechado', titulo: 'Fechado', cor: '#6b7280', icone: 'archive' },
      { slug: 'cancelado', titulo: 'Cancelado', cor: '#9ca3af', icone: 'x-circle' },
    ];
    const board: Record<string, any> = {};
    for (const col of STATUS_COLUNAS) {
      const items = tickets
        .filter((t) => t.status === col.slug)
        .map((t) => ({
          id: t.id,
          protocolo: t.protocolo,
          contactName: t.contactName,
          contactPhone: t.contactPhone,
          assunto: t.assunto,
          categoria: t.categoria,
          prioridade: t.prioridade,
          status: t.status,
          etapa: t.etapa,
          assignee: t.assignee,
          client: t.client,
          dataAbertura: t.dataAbertura,
          updatedAt: t.updatedAt,
          lastMessage: t.messages?.[0] || null,
          _count: t._count,
        }));
      board[col.slug] = {
        slug: col.slug,
        title: col.titulo,
        cor: col.cor,
        icone: col.icone,
        items,
        total: items.length,
      };
    }
    return res.json({ board, colunas: STATUS_COLUNAS });
  } catch (error) {
    console.error('Erro ao carregar status board:', error);
    return res.status(500).json({ error: 'Erro ao carregar board' });
  }
}

export async function getEtapas(req: AuthRequest, res: Response) {
  try {
    await ensureHelpdeskConfigs();
    const etapas = await listEtapas();
    return res.json(etapas);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar etapas' });
  }
}

export async function updateEtapaConfig(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, descricao, cor, icone, autoMessage, enviarAuto, notificarEquipe, ativo, ordem, ordenacaoFila, mensagemBoasVindas, mensagemForaHorario, horarioInicio, horarioFim, horarioSabadoInicio, horarioSabadoFim, diasAtendimento, mensagemFollowup, tempoInatividadeMin, mensagemAckSuporte, mensagemAckComercial, mensagemOpcaoInvalida } = req.body;
    const data: any = {};
    if (nome !== undefined) data.nome = nome;
    if (descricao !== undefined) data.descricao = descricao;
    if (cor !== undefined) data.cor = cor;
    if (icone !== undefined) data.icone = icone;
    if (autoMessage !== undefined) data.autoMessage = autoMessage;
    if (enviarAuto !== undefined) data.enviarAuto = enviarAuto;
    if (notificarEquipe !== undefined) data.notificarEquipe = notificarEquipe;
    if (ativo !== undefined) data.ativo = ativo;
    if (ordem !== undefined) data.ordem = ordem;
    if (ordenacaoFila !== undefined) data.ordenacaoFila = ordenacaoFila;
    if (mensagemBoasVindas !== undefined) data.mensagemBoasVindas = mensagemBoasVindas;
    if (mensagemForaHorario !== undefined) data.mensagemForaHorario = mensagemForaHorario;
    if (horarioInicio !== undefined) data.horarioInicio = horarioInicio;
    if (horarioFim !== undefined) data.horarioFim = horarioFim;
    if (horarioSabadoInicio !== undefined) data.horarioSabadoInicio = horarioSabadoInicio;
    if (horarioSabadoFim !== undefined) data.horarioSabadoFim = horarioSabadoFim;
    if (diasAtendimento !== undefined) data.diasAtendimento = diasAtendimento;
    if (mensagemFollowup !== undefined) data.mensagemFollowup = mensagemFollowup;
    if (tempoInatividadeMin !== undefined) data.tempoInatividadeMin = tempoInatividadeMin;
    if (mensagemAckSuporte !== undefined) data.mensagemAckSuporte = mensagemAckSuporte;
    if (mensagemAckComercial !== undefined) data.mensagemAckComercial = mensagemAckComercial;
    if (mensagemOpcaoInvalida !== undefined) data.mensagemOpcaoInvalida = mensagemOpcaoInvalida;
    data.updatedAt = new Date();
    const etapa = await prisma.helpdeskConfig.update({ where: { id }, data });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'config_alterada',
      entidade: 'HelpdeskConfig',
      entidadeId: id,
      detalhes: { campos: Object.keys(data) },
      ip: getIpFromRequest(req),
      severity: 'media',
    });

    await updateClientStatusCounters(id);

    return res.json(etapa);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar etapa' });
  }
}

export async function moveTicketEtapa(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { etapa, atribuirParaMim, observacao, clientId, prazoEntrega, semPrazo, horasDesenvolvimento } = req.body;
    if (!etapa) return res.status(400).json({ error: 'Etapa é obrigatória' });

    const config = await getEtapaConfig(etapa);
    if (!config) return res.status(404).json({ error: 'Etapa não encontrada' });
    if (!config.ativo) return res.status(400).json({ error: 'Etapa desativada' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    if (etapa === 'concluido' && req.user?.role !== 'admin') {
      try {
        await validarClassificacaoObrigatoria(ticket);
      } catch (e: any) {
        if (e?.message?.includes('CLASSIFICACAO_OBRIGATORIA')) {
          return res.status(400).json({ error: e.message.replace('CLASSIFICACAO_OBRIGATORIA: ', '') });
        }
        throw e;
      }
    }

    const etapaAnterior = ticket.etapa;
    const updateData: any = { etapa };
    if (atribuirParaMim && req.user) {
      updateData.assigneeId = req.user.id;
      updateData.usuarioId = req.user.id;
      if (!ticket.departamentoId && req.user.departamentos.length > 0) {
        updateData.departamentoId = req.user.departamentos[0].id;
      }
    }
    if (clientId !== undefined) {
      updateData.clientId = clientId || null;
    }
    if (etapa === 'em_atendimento' && !ticket.dataInicioAtendimento) {
      updateData.dataInicioAtendimento = new Date();
    }
    if (etapa === 'concluido') {
      updateData.dataFechamento = new Date();
      updateData.dataConclusao = new Date();
      updateData.status = 'fechado';
    }
    if (etapa === 'descartado') {
      updateData.dataConclusao = new Date();
      updateData.status = 'cancelado';
    }
    if (etapa === 'em_atendimento' && req.user) {
      updateData.lastAgentMessageAt = new Date();
    }
    if (etapa === 'em_atendimento' && etapaAnterior !== 'em_atendimento') {
      updateData.filaOrder = null;
    }
    if (prazoEntrega !== undefined) updateData.prazoEntrega = prazoEntrega ? new Date(prazoEntrega) : null;
    if (semPrazo !== undefined) updateData.semPrazo = !!semPrazo;
    if (horasDesenvolvimento !== undefined) updateData.horasDesenvolvimento = horasDesenvolvimento !== null ? Number(horasDesenvolvimento) : null;
    if (etapa === 'fila' && etapaAnterior !== 'fila') {
      const deptId = updateData.departamentoId || ticket.departamentoId || null;
      if (deptId) {
        updateData.filaOrder = await calcularPosicaoFila(deptId);
      }
    }

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    if (clientId && ticket.contactPhone && etapa === 'em_atendimento') {
      const phoneNorm = ticket.contactPhone.replace(/\D/g, '');
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
            nome: ticket.contactName || 'Contato WhatsApp',
            telefone: ticket.contactPhone,
            whatsapp: ticket.contactPhone,
            principal: false,
          },
        });
      }
    }

    await gerenciarPausaSlaPorEtapa(id, etapa, etapaAnterior, req.user?.id, getIpFromRequest(req));

    await prisma.ticketStageEvent.create({
      data: {
        ticketId: id,
        etapaAnterior,
        etapaNova: etapa,
        origem: req.user ? 'manual' : 'automatico',
        usuarioId: req.user?.id,
      },
    });

    let autoMessageResult: any = { sent: false };
    if (etapaAnterior !== etapa) {
      autoMessageResult = await sendStageAutoMessage(id, etapa);
      if (autoMessageResult.sent) {
        await prisma.ticketStageEvent.updateMany({
          where: { ticketId: id, etapaNova: etapa, etapaAnterior },
          data: { mensagemEnviada: true, mensagemAutomatica: 'enviada' },
        });
      }
    }

    if (etapa === 'fila' && etapaAnterior !== 'fila') {
      notificarAtendentesFila(id, updated.departamentoId).catch((e) =>
        console.warn('[Helpdesk] Falha ao notificar atendentes sobre fila:', e?.message || e)
      );
    }

    if (observacao) {
      await prisma.message.create({
        data: {
          ticketId: id,
          fromMe: true,
          content: `[INTERNO] ${observacao}`,
        },
      });
    }

    if (etapa === 'concluido') {
      await saveConversationSnapshot(id, etapa, req.user?.id || 'sistema');

      // Fluxo de encerramento: a mensagem de encerramento (sendStageAutoMessage,
      // executada acima) já foi enviada; dispara a CONFIRMAÇÃO DE RESOLUÇÃO
      // (SIM/NÃO) de forma idempotente — a avaliação só sai após o SIM (ou após
      // a descrição no caso de NÃO).
      try {
        const { iniciarConfirmacaoResolucao } = await import('../helpdesk/flow.service');
        const iniciou = await iniciarConfirmacaoResolucao(id);
        console.log(`[TICKET] ticketId=${id} event=ENCERRAMENTO_FLUXO confirmacao=${iniciou ? 'enviada/aguardando' : 'ja_respondida'}`);
      } catch (e: any) {
        console.error(`[TICKET] ticketId=${id} event=ENCERRAMENTO_FLUXO_ERRO error=${e?.message}`, e);
      }
    }

    await updateClientStatusCounters(id);

    const acaoLog =
      etapa === 'concluido' ? 'concluir' :
      etapa === 'descartado' ? 'descartar' :
      'mover_etapa';
    await logAction({
      usuarioId: req.user?.id,
      acao: acaoLog,
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { etapaAnterior, etapaNova: etapa, atribuirParaMim, autoMessageEnviada: autoMessageResult.sent },
      ip: getIpFromRequest(req),
      severity: etapa === 'concluido' ? 'baixa' : etapa === 'descartado' ? 'media' : 'baixa',
      clienteId: ticket.clientId,
    });

    return res.json({ ticket: updated, autoMessage: autoMessageResult });
  } catch (error) {
    console.error('Erro ao mover ticket:', error);
    return res.status(500).json({ error: 'Erro ao mover ticket' });
  }
}

export async function atribuirTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { usuarioId } = req.body;
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        assigneeId: usuarioId || null,
        usuarioId: usuarioId || req.user?.id,
      },
    });
    await updateClientStatusCounters(id);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'atribuir',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { assigneeId: usuarioId || null },
      ip: getIpFromRequest(req),
      severity: 'baixa',
      clienteId: ticket.clientId,
    });
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atribuir ticket' });
  }
}

export async function updateTicketClient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { clientId } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, clientId: true } });
    if (!ticket) return res.status(404).json({ error: 'Ticket nao encontrado' });

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { clientId: clientId || null },
      include: { client: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
    });

    await updateClientStatusCounters(id);

    await logAction({
      usuarioId: req.user?.id,
      acao: clientId ? 'vincular_cliente' : 'desvincular_cliente',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { clientIdAnterior: ticket.clientId, clientIdNovo: clientId || null },
      ip: getIpFromRequest(req),
      severity: 'media',
      clienteId: clientId || ticket.clientId,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente do ticket' });
  }
}

export async function getDashboard(req: AuthRequest, res: Response) {
  try {
    await ensureHelpdeskConfigs();
    const etapas = await listEtapas();
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    const [ticketsPorEtapa, emAtendimento, filaEspera, concluidosHoje, totalAbertos, ultimosMovimentos, agentes, temposPorEtapa] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['etapa'],
        _count: { _all: true },
        where: { status: { not: 'arquivado' } },
      }),
      prisma.ticket.findMany({
        where: { etapa: 'em_atendimento' },
        include: {
          client: { select: { razaoSocial: true, nomeFantasia: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dataInicioAtendimento: 'asc' },
      }),
      prisma.ticket.count({ where: { etapa: 'fila' } }),
      prisma.ticket.count({
        where: { etapa: 'concluido', dataFechamento: { gte: inicioDia } },
      }),
      prisma.ticket.count({ where: { status: { in: ['aberto', 'em_atendimento'] } } }),
      prisma.ticketStageEvent.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: { select: { id: true, protocolo: true, contactName: true, contactPhone: true, client: { select: { razaoSocial: true } } } },
          usuario: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: { in: ['tecnico', 'gerente', 'admin'] }, active: true },
        select: {
          id: true, name: true, email: true, role: true, online: true, lastSeenAt: true,
          _count: {
            select: {
              ticketsAtendidos: { where: { etapa: { in: ['em_atendimento', 'aguardando_os', 'aguardando_cliente'] } } },
            },
          },
          ticketsAtendidos: {
            where: { etapa: { in: ['em_atendimento', 'aguardando_os', 'aguardando_cliente'] } },
            select: {
              id: true, protocolo: true, assunto: true, contactName: true, etapa: true,
              prioridade: true, dataInicioAtendimento: true, dataAbertura: true, categoria: true,
              client: { select: { razaoSocial: true, nomeFantasia: true } },
            },
            orderBy: { dataAbertura: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.ticket.findMany({
        where: { dataInicioAtendimento: { not: null }, dataFechamento: { not: null } },
        select: { dataInicioAtendimento: true, dataFechamento: true },
        take: 50,
        orderBy: { dataFechamento: 'desc' },
      }),
    ]);

    const contagemEtapas: Record<string, number> = {};
    for (const e of etapas) contagemEtapas[e.slug] = 0;
    for (const item of ticketsPorEtapa) {
      contagemEtapas[item.etapa] = (contagemEtapas[item.etapa] || 0) + item._count._all;
    }

    let tempoMedioAtendimentoMin = 0;
    if (temposPorEtapa.length > 0) {
      const soma = temposPorEtapa.reduce((acc, t) => {
        const ms = (t.dataFechamento as Date).getTime() - (t.dataInicioAtendimento as Date).getTime();
        return acc + ms;
      }, 0);
      tempoMedioAtendimentoMin = Math.round(soma / temposPorEtapa.length / 60000);
    }

    return res.json({
      atualizadoEm: agora.toISOString(),
      etapas: etapas.map((e) => ({ ...e, total: contagemEtapas[e.slug] || 0 })),
      contagemEtapas,
      emAtendimento: emAtendimento.map((t) => ({
        id: t.id,
        protocolo: t.protocolo,
        contactName: t.contactName,
        cliente: t.client?.razaoSocial || t.client?.nomeFantasia || null,
        assignee: t.assignee,
        emAtendimentoDesde: t.dataInicioAtendimento,
        tempoDecorridoMin: t.dataInicioAtendimento
          ? Math.floor((agora.getTime() - t.dataInicioAtendimento.getTime()) / 60000)
          : 0,
      })),
      filaEspera,
      concluidosHoje,
      totalAbertos,
      tempoMedioAtendimentoMin,
      ultimosMovimentos,
      agentes: agentes.map((a) => ({
        ...a,
        emAtendimento: a._count.ticketsAtendidos,
        tickets: a.ticketsAtendidos.map((t) => ({
          id: t.id,
          protocolo: t.protocolo,
          assunto: t.assunto,
          contactName: t.contactName,
          cliente: t.client?.razaoSocial || t.client?.nomeFantasia || null,
          etapa: t.etapa,
          prioridade: t.prioridade,
          categoria: t.categoria,
          dataAbertura: t.dataAbertura,
          tempoDecorridoMin: t.dataInicioAtendimento
            ? Math.floor((agora.getTime() - t.dataInicioAtendimento.getTime()) / 60000)
            : Math.floor((agora.getTime() - t.dataAbertura.getTime()) / 60000),
        })),
      })),
    });
  } catch (error) {
    console.error('Erro no dashboard helpdesk:', error);
    return res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
}

export async function getTicketHistory(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const [stageEvents, snapshots, ticket] = await Promise.all([
      prisma.ticketStageEvent.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        include: { usuario: { select: { id: true, name: true } } },
      }),
      prisma.ticketHistory.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.findUnique({
        where: { id },
        include: {
          client: true,
          assignee: { select: { id: true, name: true, email: true } },
          departamento: { select: { id: true, nome: true, cor: true, slug: true } },
          messages: { orderBy: { createdAt: 'asc' } },
          channel: true,
          csatResposta: { select: { nota: true, respondidoEm: true } },
          metrics: true,
        },
      }),
    ]);

    // Buscar histórico de tickets anteriores do mesmo contato
    let historicoContato: any[] = [];
    if (ticket?.contactPhone) {
      const phoneDigits = ticket.contactPhone.replace(/[^\d]/g, '');
      const phoneLookup = phoneDigits.slice(-11);
      historicoContato = await prisma.ticket.findMany({
        where: {
          id: { not: id },
          OR: [
            { contactPhone: { contains: phoneLookup } },
          ],
        },
        select: {
          id: true,
          protocolo: true,
          assunto: true,
          status: true,
          etapa: true,
          prioridade: true,
          createdAt: true,
          dataFechamento: true,
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    return res.json({ ticket, stageEvents, snapshots, historicoContato });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}

export async function setAgentPresence(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { online } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        online: !!online,
        lastSeenAt: new Date(),
      },
    });
    return res.json({ success: true, online: !!online });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar presença' });
  }
}

export async function getTickets(req: AuthRequest, res: Response) {
  try {
    const { etapa, assigneeId, limit = '50' } = req.query;
    const where: any = { status: { not: 'arquivado' } };
    if (etapa) where.etapa = etapa;
    if (assigneeId) where.assigneeId = assigneeId;
    if (req.user?.role === 'tecnico' && !assigneeId) {
      where.OR = [{ assigneeId: req.user.id }, { assigneeId: null }];
    }
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { messages: true, orders: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit as string, 10),
    });
    return res.json({ tickets });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar tickets' });
  }
}

export async function getTicketPosition(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const posicao = await calcularPosicaoFila(ticket.departamentoId || null);

    const slaConfig = await prisma.sLAConfig.findFirst({
      where: { prioridade: ticket.prioridade || 'media' },
    });

    const totalNaFila = await prisma.ticket.count({
      where: { etapa: 'fila', departamentoId: ticket.departamentoId || undefined },
    });

    const slaMinutos = slaConfig?.slaMinutosResolucao || 240;
    const tempoMedioChamadas = totalNaFila > 1 ? Math.floor(slaMinutos / Math.max(totalNaFila, 1)) : 0;
    const tempoEstimadoMin = Math.max(0, (posicao - 1) * tempoMedioChamadas);

    return res.json({
      ticketId: id,
      protocolo: ticket.protocolo,
      etapa: ticket.etapa,
      prioridade: ticket.prioridade,
      posicao,
      totalNaFila,
      tempoEstimadoMin,
      slaMinutos,
    });
  } catch (error) {
    console.error('Erro ao calcular posição:', error);
    return res.status(500).json({ error: 'Erro ao calcular posição' });
  }
}

export async function recalcQueue(req: AuthRequest, res: Response) {
  try {
    const { departamentoId } = req.query;
    const total = await recalcularFilaDepartamento(
      departamentoId ? String(departamentoId) : null
    );
    return res.json({ total, message: `${total} tickets reordenados na fila` });
  } catch (error) {
    console.error('Erro ao recalcular fila:', error);
    return res.status(500).json({ error: 'Erro ao recalcular fila' });
  }
}

// ── GET /tickets/:id/analytics ──────────────────────────────────
export async function getTicketAnalytics(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const agora = new Date();

    const [ticket, messages, stageEvents] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id },
        select: {
          id: true, dataAbertura: true, dataInicioAtendimento: true, dataFechamento: true,
          dataPrimeiraResposta: true, dataResolucao: true,
          slaPausadoTotalMin: true, etapa: true, status: true, prioridade: true,
          resolvidoPorIa: true, iaMensagensEnviadas: true,
          iaClassificacao: true, iaResumoProblema: true, iaNotaEncerramento: true,
          iaAvaliacaoQualidade: true,
        },
      }),
      prisma.message.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, fromMe: true, tipo: true, source: true, createdAt: true },
      }),
      prisma.ticketStageEvent.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        select: { etapaAnterior: true, etapaNova: true, createdAt: true },
      }),
    ]);

    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    // ── Tempo de vida (abertura ate agora ou fechamento) ──
    const fimReferencia = ticket.dataFechamento || agora;
    const tempoTotalMin = Math.max(0, Math.round((fimReferencia.getTime() - new Date(ticket.dataAbertura).getTime()) / 60000));

    // ── Tempo de primeira resposta ──
    let tempoPrimeiraRespostaMin: number | null = null;
    if (ticket.dataPrimeiraResposta) {
      tempoPrimeiraRespostaMin = Math.max(0, Math.round(
        (new Date(ticket.dataPrimeiraResposta).getTime() - new Date(ticket.dataAbertura).getTime()) / 60000
      ));
    } else {
      // Calcular da primeira mensagem fromMe
      const primeiraResposta = messages.find((m) => m.fromMe);
      if (primeiraResposta) {
        tempoPrimeiraRespostaMin = Math.max(0, Math.round(
          (new Date(primeiraResposta.createdAt).getTime() - new Date(ticket.dataAbertura).getTime()) / 60000
        ));
      }
    }

    // ── Tempo em atendimento ──
    let tempoEmAtendimentoMin = 0;
    if (ticket.etapa === 'em_atendimento' && ticket.dataInicioAtendimento) {
      tempoEmAtendimentoMin = Math.max(0, Math.round(
        (agora.getTime() - new Date(ticket.dataInicioAtendimento).getTime()) / 60000
      ));
    } else if (ticket.dataInicioAtendimento && ticket.dataFechamento) {
      tempoEmAtendimentoMin = Math.max(0, Math.round(
        (new Date(ticket.dataFechamento).getTime() - new Date(ticket.dataInicioAtendimento).getTime()) / 60000
      ));
    }

    // ── Tempo aguardando cliente ──
    let tempoAguardandoClienteMin = 0;
    const eventosAguardando = stageEvents.filter((e) => e.etapaNova === 'aguardando_cliente');
    for (const evt of eventosAguardando) {
      const proximoEvento = stageEvents.find(
        (e) => e.createdAt > evt.createdAt && e.etapaAnterior === 'aguardando_cliente'
      );
      const fim = proximoEvento?.createdAt || agora;
      tempoAguardandoClienteMin += Math.max(0, Math.round(
        (new Date(fim).getTime() - new Date(evt.createdAt).getTime()) / 60000
      ));
    }

    // ── Distribuicao de mensagens ──
    const msgsCliente = messages.filter((m) => !m.fromMe).length;
    const msgsAgente = messages.filter((m) => m.fromMe && m.source !== 'bot' && m.source !== 'sistema').length;
    const msgsBot = messages.filter((m) => m.fromMe && (m.source === 'bot' || m.source === 'sistema')).length;
    const totalMensagens = messages.length;

    // ── Tempo medio de resposta do agente ──
    let tempoMedioRespostaMin = 0;
    const temposResposta: number[] = [];
    let ultimoHorarioCliente: Date | null = null;
    for (const msg of messages) {
      if (!msg.fromMe) {
        ultimoHorarioCliente = new Date(msg.createdAt);
      } else if (ultimoHorarioCliente && msg.source !== 'bot' && msg.source !== 'sistema') {
        const diff = Math.round((new Date(msg.createdAt).getTime() - ultimoHorarioCliente.getTime()) / 60000);
        if (diff >= 0 && diff < 1440) temposResposta.push(diff); // ignorar gaps > 24h
        ultimoHorarioCliente = null;
      }
    }
    if (temposResposta.length > 0) {
      tempoMedioRespostaMin = Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length);
    }

    return res.json({
      ticketId: id,
      tempoTotalMin,
      tempoPrimeiraRespostaMin,
      tempoEmAtendimentoMin,
      tempoAguardandoClienteMin,
      tempoMedioRespostaMin,
      distribuicaoMensagens: {
        total: totalMensagens,
        cliente: msgsCliente,
        agente: msgsAgente,
        bot: msgsBot,
      },
      resolvidoPorIa: ticket.resolvidoPorIa,
      iaMensagensEnviadas: ticket.iaMensagensEnviadas,
      classificacaoIa: ticket.iaClassificacao ? JSON.parse(ticket.iaClassificacao) : null,
      resumoIa: ticket.iaResumoProblema,
      notaEncerramentoIa: ticket.iaNotaEncerramento,
      avaliacaoIa: ticket.iaAvaliacaoQualidade ? JSON.parse(ticket.iaAvaliacaoQualidade) : null,
    });
  } catch (error) {
    console.error('Erro ao calcular analytics do ticket:', error);
    return res.status(500).json({ error: 'Erro ao calcular analytics' });
  }
}

export async function getTicketTagsController(req: AuthRequest, res: Response) {
  try {
    const tags = await getTicketTags(req.params.id);
    return res.json(tags);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao buscar tags' });
  }
}

export async function addTicketTagController(req: AuthRequest, res: Response) {
  try {
    const tags = await addTicketTag(req.params.id, req.body.tag);
    return res.json(tags);
  } catch (error: any) {
    if (error.message?.includes('não encontrado') || error.message?.includes('vazia')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao adicionar tag' });
  }
}

export async function removeTicketTagController(req: AuthRequest, res: Response) {
  try {
    const tags = await removeTicketTag(req.params.id, req.params.tag);
    return res.json(tags);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao remover tag' });
  }
}

export async function setTicketTagsController(req: AuthRequest, res: Response) {
  try {
    const tags = await setTicketTags(req.params.id, req.body.tags);
    return res.json(tags);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao definir tags' });
  }
}

export async function getTicketFCR(req: AuthRequest, res: Response) {
  try {
    const fcr = await calcularFCR(req.params.id);
    if (!fcr) return res.status(404).json({ error: 'Ticket não encontrado' });
    return res.json(fcr);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular FCR' });
  }
}

export async function getMetricasFCR(req: AuthRequest, res: Response) {
  try {
    const { inicio, fim } = req.query;
    const metricas = await metricasFCR({
      inicio: inicio ? new Date(inicio as string) : undefined,
      fim: fim ? new Date(fim as string) : undefined,
    });
    return res.json(metricas);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular métricas FCR' });
  }
}

export async function getTicketDepartmentTime(req: AuthRequest, res: Response) {
  try {
    const tempos = await tempoPorDepartamento(req.params.id);
    return res.json(tempos);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar tempo por departamento' });
  }
}

export async function criarKanbanTaskHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { departamentoId, titulo, descricao, prioridade, responsavelId, prazoEntrega } = req.body;
    if (!departamentoId) return res.status(400).json({ error: 'departamentoId obrigatório' });

    const kanbanTask = await criarKanbanTaskDeTicket({
      ticketId: id,
      departamentoId,
      titulo: titulo || `Ticket #${id.slice(0, 8)}`,
      descricao,
      prioridade,
      responsavelId,
      prazoEntrega: prazoEntrega ? new Date(prazoEntrega) : undefined,
    });

    if (!kanbanTask) return res.status(400).json({ error: 'Não foi possível criar tarefa no Kanban' });

    // Time tracking: inicia contagem automaticamente ao criar tarefa no ticket
    try {
      const { startTimer, inferirTipoDeDepartamento } = await import('../timetracking/timetracking.service');
      const ticketCtx = await prisma.ticket.findUnique({
        where: { id },
        select: { clientId: true, departamentoId: true },
      });
      const deptCtx = await prisma.departamento.findUnique({
        where: { id: departamentoId },
        select: { slug: true, nome: true },
      });
      await startTimer({
        usuarioId: responsavelId || req.user?.id,
        ticketId: id,
        tarefaId: kanbanTask.id,
        setorId: departamentoId,
        clienteId: ticketCtx?.clientId || undefined,
        tipo: inferirTipoDeDepartamento(deptCtx?.slug || deptCtx?.nome || undefined),
        descricao: `Tarefa: ${titulo || kanbanTask.titulo}`,
        tags: ['auto'],
      });
    } catch (err: any) {
      console.warn(`[TimeTracking] Falha ao iniciar timer automatico da tarefa ${kanbanTask.id}:`, err?.message);
    }

    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_kanban_task',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { kanbanTaskId: kanbanTask.id, departamentoId },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });

    return res.json(kanbanTask);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar tarefa Kanban' });
  }
}

export async function getDetailedDashboard(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, status, etapa } = req.query;

    const where: any = { status: { not: 'arquivado' } };
    if (dataInicio && dataFim) {
      where.dataAbertura = { gte: new Date(dataInicio as string), lte: new Date(dataFim as string) };
    }
    if (status) where.status = status as string;
    if (etapa) where.etapa = etapa as string;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        assignee: { select: { id: true, name: true, email: true } },
        departamento: { select: { id: true, nome: true, cor: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true, orders: true, checklists: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const agora = new Date();
    const result = tickets.map(t => {
      const tempoAberturaMin = Math.floor((agora.getTime() - new Date(t.dataAbertura).getTime()) / 60000);
      return {
        id: t.id,
        protocolo: t.protocolo,
        contactName: t.contactName,
        assunto: t.assunto,
        categoria: t.categoria,
        etapa: t.etapa,
        status: t.status,
        prioridade: t.prioridade,
        cliente: t.client?.razaoSocial || t.client?.nomeFantasia || null,
        assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
        departamento: t.departamento ? { id: t.departamento.id, nome: t.departamento.nome, cor: t.departamento.cor } : null,
        dataAbertura: t.dataAbertura,
        dataInicioAtendimento: t.dataInicioAtendimento,
        dataFechamento: t.dataFechamento,
        tempoAberturaMin,
        ultimaMensagem: t.messages[0]?.content?.substring(0, 120) || null,
        totalMensagens: t._count.messages,
        totalOrdens: t._count.orders,
      };
    });

    const porEtapa: Record<string, any[]> = {};
    const porStatus: Record<string, any[]> = {};
    for (const t of result) {
      if (!porEtapa[t.etapa]) porEtapa[t.etapa] = [];
      porEtapa[t.etapa].push(t);
      if (!porStatus[t.status]) porStatus[t.status] = [];
      porStatus[t.status].push(t);
    }

    return res.json({
      total: result.length,
      tickets: result,
      porEtapa,
      porStatus,
    });
  } catch (error) {
    console.error('Erro no dashboard detalhado:', error);
    return res.status(500).json({ error: 'Erro ao carregar dashboard detalhado' });
  }
}

export async function getAgentAuditHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const { getAgentPerformance } = await import('./ai-audit.service');
    const result = await getAgentPerformance(
      dataInicio as string | undefined,
      dataFim as string | undefined
    );
    return res.json(result);
  } catch (error) {
    console.error('Erro na auditoria de agentes:', error);
    return res.status(500).json({ error: 'Erro ao auditar agentes' });
  }
}
