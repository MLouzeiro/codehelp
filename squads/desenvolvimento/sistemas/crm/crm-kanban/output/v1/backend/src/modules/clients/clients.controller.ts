import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export async function listClients(req: AuthRequest, res: Response) {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (req.user?.role === 'vendedor') {
      where.sellerId = req.user.id;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { seller: { select: { id: true, name: true } } },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    return res.json({ clients, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

export async function getClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { seller: { select: { id: true, name: true } } },
    });

    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    if (req.user?.role === 'vendedor' && client.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para ver este cliente' });
    }

    return res.json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
}

export async function createClient(req: AuthRequest, res: Response) {
  try {
    const { name, email, phone, company, sellerId } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        company,
        sellerId: sellerId || req.user!.id,
      },
    });

    return res.status(201).json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar cliente' });
  }
}

export async function updateClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    if (req.user?.role === 'vendedor' && client.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este cliente' });
    }

    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    await prisma.client.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar cliente' });
  }
}
