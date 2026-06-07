import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { generateOsNumber, generateToken, addDays } from '../../shared/utils/helpers';
import { generatePdf } from './pdf.service';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';

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
        signature: true,
        attachments: true,
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
    const { clientId, tipoServico, descricaoServico, sistemasEnvolvidos, equipamentos, tecnicoResponsavelId, valorServico, dataPrevistaEntrega, ticketId, observacoes } = req.body;

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
    const count = await prisma.serviceOrder.count({
      where: { numeroOs: { startsWith: `OS-${year}-` } },
    });
    const numeroOs = generateOsNumber(year, count + 1);

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
      },
      include: { client: true, tecnicoResponsavel: { select: { name: true } } },
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
    if (updateData.dataPrevistaEntrega) updateData.dataPrevistaEntrega = new Date(updateData.dataPrevistaEntrega);

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
      data: { status },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar status da OS' });
  }
}

export async function sendForSignature(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: { client: true, signature: true },
    });
    if (!order) return res.status(404).json({ error: 'OS não encontrada' });
    if (order.signature) return res.status(400).json({ error: 'OS já possui assinatura' });
    if (order.status !== 'rascunho') return res.status(400).json({ error: 'OS precisa estar em rascunho' });

    const token = generateToken();
    const tokenExpiresAt = addDays(new Date(), 7);

    await prisma.signature.create({
      data: {
        orderId: order.id,
        tokenAssinatura: token,
        tokenExpiresAt,
        assinanteNome: '',
        assinanteCpf: '',
        assinanteCargo: '',
        assinaturaBase64: '',
      },
    });

    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'aguardando_assinatura' },
    });

    const signLink = `${process.env.APP_URL || 'http://localhost:3000'}/assinar/${token}`;

    const message = `Olá! 👋\n\nSegue o link para assinar a Ordem de Serviço nº ${order.numeroOs} da Codemed.\n\n🔗 ${signLink}\n\nO link expira em 7 dias.\n\nAtenciosamente,\nEquipe Codemed`;

    try {
      if (order.client.telefone) {
        const { success } = await sendWhatsAppMessage(order.client.telefone, message);
        if (!success) console.warn('WhatsApp send failed for OS signature link');
      }
    } catch (waError) {
      console.error('WhatsApp send error:', waError);
    }

    return res.json({ message: 'Link de assinatura enviado', token, signLink });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar para assinatura' });
  }
}

export async function getSignatureByToken(req: Request, res: Response) {
  try {
    const signature = await prisma.signature.findUnique({
      where: { tokenAssinatura: req.params.token },
      include: { order: { include: { client: true, tecnicoResponsavel: { select: { name: true } } } } },
    });
    if (!signature) return res.status(404).json({ error: 'Link de assinatura inválido' });
    if (new Date() > signature.tokenExpiresAt) return res.status(410).json({ error: 'Link de assinatura expirado' });
    if (signature.assinadoEm) return res.status(400).json({ error: 'OS já assinada anteriormente' });

    return res.json({
      token: signature.tokenAssinatura,
      order: {
        numeroOs: signature.order.numeroOs,
        tipoServico: signature.order.tipoServico,
        descricaoServico: signature.order.descricaoServico,
        valorServico: signature.order.valorServico,
        dataEmissao: signature.order.dataEmissao,
      },
      client: {
        razaoSocial: signature.order.client.razaoSocial,
        cnpjCpf: signature.order.client.cnpjCpf,
        telefone: signature.order.client.telefone,
      },
      tecnico: signature.order.tecnicoResponsavel.name,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

export async function signOrder(req: Request, res: Response) {
  try {
    const { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64 } = req.body;
    if (!assinanteNome || !assinanteCpf || !assinanteCargo || !assinaturaBase64) {
      return res.status(400).json({ error: 'Todos os campos de assinatura são obrigatórios' });
    }

    const signature = await prisma.signature.findUnique({
      where: { tokenAssinatura: req.params.token },
      include: { order: true },
    });
    if (!signature) return res.status(404).json({ error: 'Link de assinatura inválido' });
    if (new Date() > signature.tokenExpiresAt) return res.status(410).json({ error: 'Link de assinatura expirado' });
    if (signature.assinadoEm) return res.status(400).json({ error: 'OS já assinada anteriormente' });

    await prisma.signature.update({
      where: { id: signature.id },
      data: {
        assinanteNome,
        assinanteCpf,
        assinanteCargo,
        assinaturaBase64,
        ipAssinante: req.ip,
        userAgent: req.headers['user-agent'] || '',
        assinadoEm: new Date(),
      },
    });

    await prisma.serviceOrder.update({
      where: { id: signature.orderId },
      data: { status: 'assinada' },
    });

    const pdfPath = await generatePdf(signature.orderId);

    await prisma.signature.update({
      where: { id: signature.id },
      data: { pdfPath },
    });

    return res.json({ message: 'OS assinada com sucesso!', pdfPath });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao processar assinatura' });
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
