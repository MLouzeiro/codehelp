import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAction, getIpFromRequest } from '../audit/audit.service';

export async function getChecklist(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const items = await prisma.ticketChecklist.findMany({
      where: { ticketId },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
      },
      orderBy: { ordem: 'asc' },
    });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar checklist' });
  }
}

export async function addChecklistItem(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { titulo, ordem } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ error: 'titulo é obrigatório' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const maxOrdem = await prisma.ticketChecklist.aggregate({
      where: { ticketId },
      _max: { ordem: true },
    });

    const item = await prisma.ticketChecklist.create({
      data: {
        ticketId,
        titulo: titulo.trim(),
        ordem: ordem ?? (maxOrdem._max.ordem ?? -1) + 1,
        responsavelId: req.user?.id || null,
      },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
      },
    });

    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar',
      entidade: 'TicketChecklist',
      entidadeId: item.id,
      detalhes: { ticketId, titulo: item.titulo, ordem: item.ordem },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });

    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao adicionar item ao checklist' });
  }
}

export async function toggleChecklistItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const item = await prisma.ticketChecklist.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const updated = await prisma.ticketChecklist.update({
      where: { id },
      data: { concluida: !item.concluida },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
      },
    });

    await logAction({
      usuarioId: req.user?.id,
      acao: 'atualizar',
      entidade: 'TicketChecklist',
      entidadeId: id,
      detalhes: { ticketId: item.ticketId, concluida: updated.concluida },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao alternar item do checklist' });
  }
}

export async function updateChecklistItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { titulo, ordem } = req.body;

    const item = await prisma.ticketChecklist.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const data: any = {};
    if (titulo !== undefined) data.titulo = titulo.trim();
    if (ordem !== undefined) data.ordem = ordem;
    data.updatedAt = new Date();

    const updated = await prisma.ticketChecklist.update({
      where: { id },
      data,
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
      },
    });

    await logAction({
      usuarioId: req.user?.id,
      acao: 'atualizar',
      entidade: 'TicketChecklist',
      entidadeId: id,
      detalhes: { ticketId: item.ticketId, campos: Object.keys(data).filter((k) => k !== 'updatedAt') },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar item do checklist' });
  }
}

export async function deleteChecklistItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const item = await prisma.ticketChecklist.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    await prisma.ticketChecklist.delete({ where: { id } });

    await logAction({
      usuarioId: req.user?.id,
      acao: 'deletar',
      entidade: 'TicketChecklist',
      entidadeId: id,
      detalhes: { ticketId: item.ticketId, titulo: item.titulo },
      ip: getIpFromRequest(req),
      severity: 'media',
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar item do checklist' });
  }
}

export async function reorderChecklist(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items é obrigatório e deve ser um array não vazio' });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const updates = items.map((item: { id: string; ordem: number }) =>
      prisma.ticketChecklist.update({
        where: { id: item.id },
        data: { ordem: item.ordem },
      })
    );

    await prisma.$transaction(updates);

    await logAction({
      usuarioId: req.user?.id,
      acao: 'atualizar',
      entidade: 'TicketChecklist',
      entidadeId: ticketId,
      detalhes: { ticketId, ordem: items.map((i: any) => i.id) },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });

    const reordered = await prisma.ticketChecklist.findMany({
      where: { ticketId },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
      },
      orderBy: { ordem: 'asc' },
    });

    return res.json(reordered);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao reordenar checklist' });
  }
}
