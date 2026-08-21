import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { generateOsNumber } from '../../shared/utils/helpers';
import {
  registrarStatusEvent,
  listOrderTimeline,
  createOrderFromTicket as createOrderFromTicketService,
  getOrdersDashboard as getOrdersDashboardService,
  listOrdersForReport,
  exportOrdersCsv,
} from './orders.service';
import {
  enviarLinkAssinatura,
  reenviarLinkAssinatura,
  cancelarSolicitacaoAssinatura,
  obterDadosAssinatura,
  registrarAssinatura,
  recusarAssinatura,
} from './orders-signature.service';

export async function listOrders(req: AuthRequest, res: Response) {
  try {
    const { status, clientId, page = '1', limit = '20' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (req.user?.role === 'tecnico') where.tecnicoResponsavelId = req.user.id;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [orders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        include: {
          client: { select: { razaoSocial: true, nomeFantasia: true } },
          tecnicoResponsavel: { select: { name: true } },
          signature: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.serviceOrder.count({ where }),
    ]);
    const ordersParsed = orders.map((o) => ({ ...o, sistemasEnvolvidos: JSON.parse(o.sistemasEnvolvidos || '[]') }));
    return res.json({ orders: ordersParsed, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar OS' });
  }
}

export async function getOrder(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        tecnicoResponsavel: { select: { id: true, name: true, email: true } },
        criadoPor: { select: { name: true } },
        signature: { include: { signatureAttempts: { orderBy: { dataHora: 'desc' } } } },
        attachments: true,
        ticket: { select: { id: true, protocolo: true, assunto: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });
    return res.json({ ...order, sistemasEnvolvidos: JSON.parse(order.sistemasEnvolvidos || '[]') });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar OS' });
  }
}

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const { clientId, tipoServico, descricaoServico, sistemasEnvolvidos, equipamentos, tecnicoResponsavelId, valorServico, dataPrevistaEntrega, ticketId, observacoes, tipoImplantacao, precoImplantacao, horasDev, horasSuporte } = req.body;

    if (!clientId || !tipoServico) {
      return res.status(400).json({ error: 'Cliente e tipo de serviço são obrigatórios' });
    }

    const tecnicoId = tecnicoResponsavelId || req.user!.id;
    const [clienteExiste, tecnicoExiste] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: tecnicoId }, select: { id: true } }),
    ]);
    if (!clienteExiste) {
      return res.status(400).json({ error: 'Cliente não encontrado. Recarregue a lista e selecione novamente.' });
    }
    if (!tecnicoExiste) {
      return res.status(400).json({ error: 'Técnico responsável não encontrado.' });
    }

    const year = new Date().getFullYear();
    let numeroOs = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await prisma.serviceOrder.count({
        where: { numeroOs: { startsWith: `OS-${year}-` } },
      });
      numeroOs = generateOsNumber(year, count + 1);
      const existing = await prisma.serviceOrder.findUnique({ where: { numeroOs } });
      if (!existing) break;
      await new Promise(r => setTimeout(r, 50));
    }

    const order = await prisma.serviceOrder.create({
      data: {
        numeroOs,
        clientId,
        tipoServico,
        descricaoServico,
        sistemasEnvolvidos: JSON.stringify(sistemasEnvolvidos || []),
        equipamentos,
        tecnicoResponsavelId: tecnicoId,
        valorServico: valorServico ? parseFloat(valorServico) : null,
        dataPrevistaEntrega: dataPrevistaEntrega ? new Date(dataPrevistaEntrega) : null,
        ticketId,
        observacoes,
        criadoPorId: req.user!.id,
        status: 'rascunho',
        tipoImplantacao: tipoImplantacao || null,
        precoImplantacao: precoImplantacao ? parseFloat(precoImplantacao) : 0,
        horasDev: horasDev ? parseFloat(horasDev) : 0,
        horasSuporte: horasSuporte ? parseFloat(horasSuporte) : 0,
      },
      include: { client: true, tecnicoResponsavel: { select: { name: true } } },
    });

    await registrarStatusEvent({
      orderId: order.id,
      statusNovo: 'rascunho',
      statusAnterior: null,
      usuarioId: req.user!.id,
      origem: 'manual',
      observacao: 'OS criada',
    });

    return res.status(201).json(order);
  } catch (error: any) {
    if (error?.code === 'P2003') {
      const field = error?.meta?.field_name || 'referência';
      return res.status(400).json({ error: `Referência inválida em ${field}. Recarregue os dados e tente novamente.` });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Registro relacionado não encontrado.' });
    }
    console.error('Erro ao criar OS:', error);
    return res.status(500).json({ error: 'Erro ao criar OS' });
  }
}

export async function updateOrder(req: AuthRequest, res: Response) {
  try {
    const existing = await prisma.serviceOrder.findUnique({ where: { id: req.params.id }, include: { signature: true } });
    if (!existing) return res.status(404).json({ error: 'OS não encontrada' });
    if (existing.signature) return res.status(400).json({ error: 'OS já assinada não pode ser editada' });
    if (existing.status === 'cancelada') return res.status(400).json({ error: 'OS cancelada não pode ser editada' });

    const updateData = { ...req.body };
    if (updateData.sistemasEnvolvidos && Array.isArray(updateData.sistemasEnvolvidos)) {
      updateData.sistemasEnvolvidos = JSON.stringify(updateData.sistemasEnvolvidos);
    }
    if (updateData.valorServico) updateData.valorServico = parseFloat(updateData.valorServico);
    if (updateData.precoImplantacao) updateData.precoImplantacao = parseFloat(updateData.precoImplantacao);
    if (updateData.horasDev) updateData.horasDev = parseFloat(updateData.horasDev);
    if (updateData.horasSuporte) updateData.horasSuporte = parseFloat(updateData.horasSuporte);
    if (updateData.dataPrevistaEntrega) updateData.dataPrevistaEntrega = new Date(updateData.dataPrevistaEntrega);
    if (updateData.dataInicioImplantacao) updateData.dataInicioImplantacao = new Date(updateData.dataInicioImplantacao);
    if (updateData.dataFimImplantacao) updateData.dataFimImplantacao = new Date(updateData.dataFimImplantacao);

    const order = await prisma.serviceOrder.update({
      where: { id: req.params.id },
      data: updateData,
    });
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar OS' });
  }
}

export async function deleteOrder(req: AuthRequest, res: Response) {
  try {
    await prisma.serviceOrder.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar OS' });
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response) {
  try {
    const { status } = req.body;
    const validStatuses = ['rascunho', 'aguardando_assinatura', 'assinada', 'em_execucao', 'concluida', 'cancelada'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: { signature: true },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });

    if (order.signature?.assinadoEm && status !== 'cancelada') {
      return res.status(400).json({ error: 'OS assinada não pode mudar de status' });
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'concluida' ? { dataConclusao: new Date() } : {}),
      },
    });

    await registrarStatusEvent({
      orderId: req.params.id,
      statusNovo: status,
      statusAnterior: order.status,
      usuarioId: req.user!.id,
      origem: 'manual',
      observacao: req.body.observacao || null,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar status da OS' });
  }
}

export async function sendForSignature(req: AuthRequest, res: Response) {
  try {
    const result = await enviarLinkAssinatura(req.params.id, req.user!.id);
    if (!result.ok) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ error: result.error, code: result.code, ...(result.signLink ? { signLink: result.signLink, token: result.token } : {}) });
    }
    return res.json({
      success: true,
      message: 'Link de assinatura enviado',
      token: result.token,
      signLink: result.signLink,
      messageId: result.messageId,
      provider: result.provider,
      telefone: result.telefone,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao enviar para assinatura:', error);
    return res.status(500).json({ error: 'Erro ao enviar para assinatura' });
  }
}

export async function resendSignature(req: AuthRequest, res: Response) {
  try {
    const result = await reenviarLinkAssinatura(req.params.id, req.user!.id);
    if (!result.ok) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({ error: result.error, code: result.code, ...(result.signLink ? { signLink: result.signLink, token: result.token } : {}) });
    }
    return res.json({
      success: true,
      message: 'Link de assinatura reenviado',
      token: result.token,
      signLink: result.signLink,
      messageId: result.messageId,
      provider: result.provider,
      telefone: result.telefone,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao reenviar para assinatura:', error);
    return res.status(500).json({ error: 'Erro ao reenviar para assinatura' });
  }
}

export async function cancelSignatureRequest(req: AuthRequest, res: Response) {
  try {
    const result = await cancelarSolicitacaoAssinatura(req.params.id, req.user!.id);
    if (!result.ok) {
      return res.status(result.statusCode || 400).json({ error: result.error, code: result.code });
    }
    return res.json({ success: true, message: 'Solicitação de assinatura cancelada' });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao cancelar solicitação:', error);
    return res.status(500).json({ error: 'Erro ao cancelar solicitação de assinatura' });
  }
}

export async function getSignatureByToken(req: Request, res: Response) {
  try {
    const result = await obterDadosAssinatura(req.params.token);
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao buscar dados da assinatura:', error);
    return res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

export async function signOrder(req: Request, res: Response) {
  try {
    const { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64 } = req.body;
    const result = await registrarAssinatura(
      req.params.token,
      { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64 },
      req.ip,
      req.headers['user-agent'] || '',
    );
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }
    return res.json({ message: result.message, pdfPath: (result as any).pdfPath ?? null });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao processar assinatura:', error);
    return res.status(500).json({ error: 'Erro ao processar assinatura' });
  }
}

export async function refuseSignature(req: Request, res: Response) {
  try {
    const { motivo } = req.body;
    const result = await recusarAssinatura(req.params.token, motivo, req.ip);
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }
    return res.json({ message: result.message });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao processar recusa:', error);
    return res.status(500).json({ error: 'Erro ao processar recusa' });
  }
}

export async function getPdfOrder(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: { signature: true },
    });
    if (!order || !order.signature?.pdfPath) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.resolve(order.signature.pdfPath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Arquivo PDF não encontrado' });
    return res.sendFile(fullPath);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar PDF' });
  }
}

// ── OS no Helpdesk (timeline, ticket, dashboard, export) ───────────────

export async function getOrderTimeline(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });
    const timeline = await listOrderTimeline(order.id);
    return res.json({ timeline });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar timeline da OS' });
  }
}

export async function listOrdersByTicket(req: AuthRequest, res: Response) {
  try {
    const orders = await prisma.serviceOrder.findMany({
      where: { ticketId: req.params.ticketId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        tecnicoResponsavel: { select: { id: true, name: true } },
        signature: { select: { assinadoEm: true, assinanteNome: true } },
      },
    });
    return res.json({ orders: orders.map((o) => ({ ...o, sistemasEnvolvidos: JSON.parse(o.sistemasEnvolvidos || '[]') })) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar OS do ticket' });
  }
}

export async function createOrderFromTicket(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Não autenticado' });
    const order = await createOrderFromTicketService(req.params.ticketId, req.user.id);
    return res.status(201).json(order);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Erro ao criar OS a partir do ticket' });
  }
}

export async function getOrdersDashboard(req: AuthRequest, res: Response) {
  try {
    const { status, tipoServico, clientId, tecnicoResponsavelId, ticketId, dataDe, dataAte } = req.query;
    const dashboard = await getOrdersDashboardService({
      status: status as string | undefined,
      tipoServico: tipoServico as string | undefined,
      clientId: clientId as string | undefined,
      tecnicoResponsavelId: tecnicoResponsavelId as string | undefined,
      ticketId: ticketId as string | undefined,
      dataDe: dataDe as string | undefined,
      dataAte: dataAte as string | undefined,
    });
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar relatório de OS' });
  }
}

export async function exportOrdersCsvHandler(req: AuthRequest, res: Response) {
  try {
    const { status, tipoServico, clientId, tecnicoResponsavelId, ticketId, dataDe, dataAte } = req.query;
    const orders = await listOrdersForReport({
      status: status as string | undefined,
      tipoServico: tipoServico as string | undefined,
      clientId: clientId as string | undefined,
      tecnicoResponsavelId: tecnicoResponsavelId as string | undefined,
      ticketId: ticketId as string | undefined,
      dataDe: dataDe as string | undefined,
      dataAte: dataAte as string | undefined,
    });
    const csv = exportOrdersCsv(orders);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ordens-servico-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao exportar OS' });
  }
}
