import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const { active } = req.query;

    const where: any = {};
    if (active === 'true') where.active = true;
    else if (active === 'false') where.active = false;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ users, total });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function getUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (!role) {
      return res.status(400).json({ error: 'Role é obrigatório' });
    }

    const rolesValidas = ['admin', 'gerente', 'vendedor', 'tecnico'];
    if (!rolesValidas.includes(role)) {
      return res.status(400).json({ error: `Role inválida. Valores aceitos: ${rolesValidas.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, phone: req.body.phone || null },
      select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, active, password, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }
    }

    if (role) {
      const rolesValidas = ['admin', 'gerente', 'vendedor', 'tecnico'];
      if (!rolesValidas.includes(role)) {
        return res.status(400).json({ error: `Role inválida. Valores aceitos: ${rolesValidas.join(', ')}` });
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (active !== undefined) data.active = active;
    if (phone !== undefined) data.phone = phone;
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true, updatedAt: true },
    });

    return res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
}
