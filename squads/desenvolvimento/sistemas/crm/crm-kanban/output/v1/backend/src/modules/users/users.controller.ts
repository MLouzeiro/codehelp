import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'vendedor',
        phone: phone || null,
      },
      select: { id: true, name: true, email: true, role: true, active: true, phone: true },
    });

    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, active, password, phone } = req.body;

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (active !== undefined) data.active = active;
    if (phone !== undefined) data.phone = phone;
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, phone: true },
    });

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    await prisma.client.updateMany({ where: { sellerId: id }, data: { sellerId: req.user!.id } });
    await prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
    await prisma.user.delete({ where: { id } });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
}
