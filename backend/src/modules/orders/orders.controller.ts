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
  listOrderItems,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
} from './orders.service';
import {
  enviarLinkAssinatura,
  reenviarLinkAssinatura,
  cancelarSolicitacaoAssinatura,
  obterDadosAssinatura,
  registrarAssinatura,
  registrarAssinaturaSemDesenho,
  recusarAssinatura,
  resolverTelefoneParaAssinatura,
  normalizePhoneForWhatsApp,
  formatPhoneForDisplay,
} from './orders-signature.service';
import { generateOrderPdf } from './pdf.service';
import { sendWhatsAppDocument } from '../integrations/whatsapp/whatsapp.service';

// Helper: check if user is admin (can see all organizations)
function isAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.isMaster === true;
}

export async function listOrders(req: AuthRequest, res: Response) {
  try {
    const { status, clientId, page = '1', limit = '20' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (req.user?.role === 'tecnico') where.tecnicoResponsavelId = req.user.id;

    // Multi-tenant: non-admin users only see orders from their organization
    if (!isAdmin(req.user) && req.user?.organizationId) {
      where.client = { organizationId: req.user.organizationId };
    }

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
        items: true,
        ticket: { select: { id: true, protocolo: true, assunto: true } },
        layout: { select: { id: true, nome: true, tipo: true, padrao: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });

    // Multi-tenant: non-admin users can only see orders from their organization
    if (!isAdmin(req.user) && req.user?.organizationId && order.client?.organizationId !== req.user.organizationId) {
      return res.status(404).json({ error: 'OS não encontrada' });
    }

    return res.json({ ...order, sistemasEnvolvidos: JSON.parse(order.sistemasEnvolvidos || '[]') });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar OS' });
  }
}

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const { clientId, tipoServico, descricaoServico, sistemasEnvolvidos, equipamentos, tecnicoResponsavelId, valorServico, dataPrevistaEntrega, ticketId, observacoes, tipoImplantacao, precoImplantacao, horasDev, horasSuporte, layoutId } = req.body;

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
        layoutId: layoutId || null,
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

    const raw = req.body;
    const allowedFields = [
      'titulo', 'descricao', 'clientId', 'tipoServico', 'status',
      'sistemasEnvolvidos', 'valorServico', 'dataPrevistaEntrega',
      'contatoId', 'telefonePreview', 'tipoImplantacao', 'precoImplantacao',
      'horasDev', 'horasSuporte', 'dataInicioImplantacao', 'dataFimImplantacao',
    ];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (raw[field] !== undefined) updateData[field] = raw[field];
    }
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
      return res.status(statusCode).json({
        error: result.error,
        code: result.code,
        telefoneFormatado: result.telefoneFormatado || null,
        origem: result.origem || null,
        ...(result.signLink ? { signLink: result.signLink, token: result.token } : {}),
      });
    }
    return res.json({
      success: true,
      message: 'Link de assinatura enviado com sucesso',
      token: result.token,
      signLink: result.signLink,
      messageId: result.messageId,
      provider: result.provider,
      telefone: result.telefone,
      telefoneFormatado: result.telefoneFormatado || null,
      origem: result.origem || null,
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
      return res.status(statusCode).json({
        error: result.error,
        code: result.code,
        telefoneFormatado: result.telefoneFormatado || null,
        origem: result.origem || null,
        ...(result.signLink ? { signLink: result.signLink, token: result.token } : {}),
      });
    }
    return res.json({
      success: true,
      message: 'Link de assinatura reenviado com sucesso',
      token: result.token,
      signLink: result.signLink,
      messageId: result.messageId,
      provider: result.provider,
      telefone: result.telefone,
      telefoneFormatado: result.telefoneFormatado || null,
      origem: result.origem || null,
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
    const { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64, timezone } = req.body;
    const result = await registrarAssinatura(
      req.params.token,
      { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64, timezone },
      req.ip,
      req.headers['user-agent'] || '',
    );
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }

    return res.json({
      message: result.message,
      pdfPath: result.pdfPath ?? null,
      signatureIdentifier: result.signatureIdentifier ?? null,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao processar assinatura:', error);
    return res.status(500).json({ error: 'Erro ao processar assinatura' });
  }
}

export async function signOrderWithoutSignature(req: Request, res: Response) {
  try {
    const { assinanteNome, assinanteCpf, assinanteCargo, timezone } = req.body;
    const result = await registrarAssinaturaSemDesenho(
      req.params.token,
      { assinanteNome, assinanteCpf, assinanteCargo, timezone },
      req.ip,
      req.headers['user-agent'] || '',
    );
    if (!result.ok) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }
    return res.json({
      message: result.message,
      pdfPath: result.pdfPath ?? null,
      signatureIdentifier: result.signatureIdentifier ?? null,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao processar assinatura sem desenho:', error);
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
      select: { id: true, numeroOs: true },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });

    const layoutId = req.query.layoutId as string | undefined;
    const filepath = await generateOrderPdf(order.id, layoutId || undefined);
    const filename = `${order.numeroOs.replace(/\//g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(filepath);
  } catch (error: any) {
    console.error('[OS PDF] Erro ao gerar PDF:', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível gerar o PDF da Ordem de Serviço. Tente novamente.' });
  }
}

// ── Itens da OS ───────────────────────────────────────────────────────

export async function listOrderItemsHandler(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });
    const items = await listOrderItems(req.params.id);
    const total = items.reduce((sum, item) => sum + (item.valorTotal || 0), 0);
    return res.json({ items, total });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar itens da OS' });
  }
}

export async function createOrderItemHandler(req: AuthRequest, res: Response) {
  try {
    const { descricao, tipo, quantidade, valorUnitario, valorTotal, observacoes } = req.body;
    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ error: 'Descrição do item é obrigatória' });
    }
    const item = await createOrderItem({
      orderId: req.params.id,
      descricao: descricao.trim(),
      tipo,
      quantidade,
      valorUnitario: valorUnitario ? parseFloat(valorUnitario) : null,
      valorTotal: valorTotal ? parseFloat(valorTotal) : null,
      observacoes,
    });
    return res.status(201).json(item);
  } catch (error: any) {
    if (error.message?.includes('OS finalizada') || error.message?.includes('OS não encontrada')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao criar item da OS' });
  }
}

export async function updateOrderItemHandler(req: AuthRequest, res: Response) {
  try {
    const { descricao, tipo, quantidade, valorUnitario, valorTotal, observacoes } = req.body;
    const item = await updateOrderItem(req.params.itemId, {
      descricao: descricao?.trim(),
      tipo,
      quantidade,
      valorUnitario: valorUnitario !== undefined ? (valorUnitario ? parseFloat(valorUnitario) : null) : undefined,
      valorTotal: valorTotal !== undefined ? (valorTotal ? parseFloat(valorTotal) : null) : undefined,
      observacoes,
    });
    return res.json(item);
  } catch (error: any) {
    if (error.message?.includes('não encontrado') || error.message?.includes('OS finalizada')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao atualizar item da OS' });
  }
}

export async function deleteOrderItemHandler(req: AuthRequest, res: Response) {
  try {
    await deleteOrderItem(req.params.itemId);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrado') || error.message?.includes('OS finalizada')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao deletar item da OS' });
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

/**
 * Preview do telefone resolvido para envio de assinatura.
 * Retorna o telefone encontrado, a origem e o nome do contato.
 * Nao envia mensagem — apenas mostra ao usuario para confirmacao.
 */
export async function previewSignaturePhone(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        client: { include: { colaboradores: { where: { ativo: true } } } },
        ticket: { select: { id: true, protocolo: true, contactPhone: true, contactName: true, whatsappConnectionId: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'OS nao encontrada' });

    const resolucao = await resolverTelefoneParaAssinatura(order);
    return res.json({
      telefone: resolucao.telefone,
      telefoneFormatado: resolucao.telefoneFormatado,
      origem: resolucao.origem,
      contatoNome: resolucao.contatoNome,
      hasTicket: resolucao.hasTicket,
      ticketProtocolo: order.ticket?.protocolo || null,
      ticketContactPhone: order.ticket?.contactPhone || null,
      clienteNome: order.client?.razaoSocial || order.client?.nomeFantasia || null,
      hasManualPhone: !!order.telefoneManual,
      telefoneManual: order.telefoneManual || null,
      jid: resolucao.jid || null,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao prever telefone:', error);
    return res.status(500).json({ error: 'Erro ao resolver telefone para assinatura' });
  }
}

/**
 * Define o telefone manual para a OS e opcionalmente salva no cliente.
 * Aceita body: { telefone: string, salvarNoCliente?: boolean }
 */
export async function setManualPhone(req: AuthRequest, res: Response) {
  try {
    const { telefone, salvarNoCliente } = req.body;
    if (!telefone || typeof telefone !== 'string') {
      return res.status(400).json({ error: 'Campo "telefone" e obrigatorio' });
    }

    const digits = normalizePhoneForWhatsApp(telefone);
    if (!digits) {
      return res.status(400).json({
        error: 'Numero invalido para WhatsApp. Informe um numero com DDD (ex: 11999998888).',
        telefoneFormatado: formatPhoneForDisplay(telefone) || telefone,
      });
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: { client: true, ticket: { select: { id: true } } },
    });
    if (!order) return res.status(404).json({ error: 'OS nao encontrada' });

    // REGRA: OS com ticket NAO permite telefone manual — o contato vem do chamado
    if (order.ticketId && order.ticket) {
      return res.status(400).json({
        error: 'Esta OS foi originada de um ticket. O WhatsApp e automaticamente o contato que abriu o chamado.',
      });
    }

    // Atualizar telefoneManual na OS
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { telefoneManual: digits },
    });

    // Opcionalmente salvar no cliente
    let clienteAtualizado = false;
    if (salvarNoCliente && order.clientId) {
      await prisma.client.update({
        where: { id: order.clientId },
        data: { telefone: digits },
      });
      clienteAtualizado = true;
    }

    console.log(`[OS SIGNATURE] Telefone manual definido. OS=${order.numeroOs} telefone=${digits} salvarNoCliente=${salvarNoCliente || false}`);

    return res.json({
      success: true,
      message: clienteAtualizado
        ? `Telefone ${formatPhoneForDisplay(digits)} salvo na OS e no cadastro do cliente.`
        : `Telefone ${formatPhoneForDisplay(digits)} salvo na OS.`,
      telefone: digits,
      telefoneFormatado: formatPhoneForDisplay(digits),
      origem: 'manual',
      clienteAtualizado,
    });
  } catch (error) {
    console.error('[OS SIGNATURE] Erro ao definir telefone manual:', error);
    return res.status(500).json({ error: 'Erro ao salvar telefone manual' });
  }
}

/**
 * Envia a OS para o cliente via WhatsApp.
 * Gera o PDF atualizado e envia como documento.
 */
export async function sendOsToClient(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        ticket: { select: { id: true, protocolo: true, contactPhone: true, contactName: true, whatsappConnectionId: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });
    if (!order.client) return res.status(400).json({ error: 'OS não possui cliente vinculado' });

    // Resolver telefone (mesma logica da assinatura)
    const contato = await resolverTelefoneParaAssinatura(order);
    const val = normalizePhoneForWhatsApp(contato.telefone) || contato.jid || null;

    if (!val) {
      return res.status(400).json({
        error: 'Cliente não possui telefone/WhatsApp cadastrado.',
        code: 'SEM_TELEFONE',
        telefoneFormatado: contato.telefoneFormatado,
        origem: contato.origem,
      });
    }

    // Gerar PDF atualizado
    let pdfPath: string;
    try {
      pdfPath = await generateOrderPdf(order.id);
    } catch (pdfErr: any) {
      console.error('[OS SEND] Erro ao gerar PDF:', pdfErr?.message || pdfErr);
      return res.status(500).json({ error: 'Não foi possível gerar o PDF da Ordem de Serviço. Tente novamente.' });
    }

    // Converter PDF para base64
    const fs = require('fs');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    // Montar mensagem
    const nomeCliente = order.client.nomeFantasia || order.client.razaoSocial;
    const mensagem = [
      `Olá, ${nomeCliente}!`,
      ``,
      `Segue a Ordem de Serviço nº ${order.numeroOs} referente ao seu atendimento.`,
      ``,
      `Em caso de dúvidas, estamos à disposição.`,
      ``,
      `Atenciosamente,`,
      `Equipe Codemed`,
    ].join('\n');

    const connectionId = order.ticket?.whatsappConnectionId || undefined;
    const fileName = `${order.numeroOs.replace(/\//g, '-')}.pdf`;

    // Enviar via WhatsApp
    const resultado = await sendWhatsAppDocument(
      contato.telefone || '',
      pdfBase64,
      fileName,
      mensagem,
      connectionId,
      contato.jid || undefined,
    );

    if (!resultado.success) {
      console.error('[OS SEND] Falha no envio:', resultado.error);
      return res.status(502).json({
        error: 'Não foi possível enviar a Ordem de Serviço. Verifique a conexão do WhatsApp e tente novamente.',
        detail: resultado.error,
      });
    }

    console.log(`[OS SEND] OS enviada com sucesso. OS=${order.numeroOs} para=${contato.telefone || contato.jid} provider=${connectionId || 'legado'}`);

    return res.json({
      success: true,
      message: 'Ordem de Serviço enviada com sucesso para o cliente.',
      telefone: contato.telefoneFormatado || contato.telefone || contato.jid,
      origem: contato.origem,
      contatoNome: contato.contatoNome || nomeCliente,
      messageId: resultado.messageId,
    });
  } catch (error: any) {
    console.error('[OS SEND] Erro ao enviar OS para cliente:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao enviar Ordem de Serviço para o cliente' });
  }
}
