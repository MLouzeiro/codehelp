import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  ensureHelpdeskConfigs,
  listEtapas,
  getEtapaConfig,
  sendStageAutoMessage,
  saveConversationSnapshot,
} from './helpdesk.service';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import { gerenciarPausaSlaPorEtapa } from './slaPausa.service';

export async function getKanban(req: AuthRequest, res: Response) {
  try {
    await ensureHelpdeskConfigs();
    const etapas = await listEtapas();
    const orderBy = (req.query.orderBy as string) || 'updatedAt_desc';
    const configFila = etapas.find((e) => e.slug === 'fila') as any;
    const ordenacaoFila = configFila?.ordenacaoFila || 'updatedAt_desc';

    const where: any = { status: { not: 'arquivado' } };
    if (req.user?.role === 'tecnico') {
      if (req.user.departamentoId) {
        // Tecnicos com departamento: veem seus tickets + fila do departamento + fila sem departamento
        where.OR = [
          { assigneeId: req.user.id },
          { etapa: 'fila', departamentoId: req.user.departamentoId, assigneeId: null },
          { etapa: 'fila', departamentoId: null, assigneeId: null },
        ];
      } else {
        // Tecnicos sem departamento: veem seus tickets + toda fila
        where.OR = [
          { assigneeId: req.user.id },
          { etapa: 'fila', assigneeId: null },
        ];
      }
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
      const sortKey = etapa.slug === 'fila' ? ordenacaoFila : orderBy;
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

export async function getStatusBoard(req: AuthRequest, res: Response) {
  try {
    const orderBy = (req.query.orderBy as string) || 'updatedAt_desc';
    const where: any = { status: { not: 'arquivado' } };
    if (req.user?.role === 'tecnico') {
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
      { slug: 'em_andamento', titulo: 'Em Atendimento', cor: '#10b981', icone: 'headphones' },
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
    const { nome, descricao, cor, icone, autoMessage, enviarAuto, notificarEquipe, ativo, ordem, ordenacaoFila, mensagemBoasVindas, mensagemForaHorario, horarioInicio, horarioFim, diasAtendimento, mensagemFollowup, tempoInatividadeMin, mensagemAckSuporte, mensagemAckComercial, mensagemOpcaoInvalida } = req.body;
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
    });
    return res.json(etapa);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar etapa' });
  }
}

export async function moveTicketEtapa(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { etapa, atribuirParaMim, observacao, clientId } = req.body;
    if (!etapa) return res.status(400).json({ error: 'Etapa é obrigatória' });

    const config = await getEtapaConfig(etapa);
    if (!config) return res.status(404).json({ error: 'Etapa não encontrada' });
    if (!config.ativo) return res.status(400).json({ error: 'Etapa desativada' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const etapaAnterior = ticket.etapa;
    const updateData: any = { etapa };
    if (atribuirParaMim && req.user) {
      updateData.assigneeId = req.user.id;
      updateData.usuarioId = req.user.id;
      if (!ticket.departamentoId && req.user.departamentoId) {
        updateData.departamentoId = req.user.departamentoId;
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
    }

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
    await logAction({
      usuarioId: req.user?.id,
      acao: 'atribuir',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { assigneeId: usuarioId || null },
      ip: getIpFromRequest(req),
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

    await logAction({
      usuarioId: req.user?.id,
      acao: clientId ? 'vincular_cliente' : 'desvincular_cliente',
      entidade: 'Ticket',
      entidadeId: id,
      detalhes: { clientIdAnterior: ticket.clientId, clientIdNovo: clientId || null },
      ip: getIpFromRequest(req),
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
      prisma.ticket.count({ where: { status: { in: ['aberto', 'em_andamento'] } } }),
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
          messages: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);
    return res.json({ ticket, stageEvents, snapshots });
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
