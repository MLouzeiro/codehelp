import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AuthRequest } from '../../shared/middleware/auth';

function generateTokens(user: { id: string; email: string; role: string }) {
  const accessOptions: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  const refreshOptions: SignOptions = { expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'] };
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    accessOptions
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    env.jwtRefreshSecret,
    refreshOptions
  );
  return { accessToken, refreshToken };
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const tokens = generateTokens(user);
    return res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isMaster: user.isMaster },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token obrigatório' });

    const decoded = jwt.verify(token, env.jwtRefreshSecret) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, active: true },
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const tokens = generateTokens(user);
    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  return res.json(req.user);
}

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { name, email, password, role, isMaster } = req.body;
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
        role: role || 'tecnico',
        phone: req.body.phone || null,
        isMaster: isMaster || false,
      },
      select: { id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true },
    });

    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, active, password, isMaster } = req.body;

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (active !== undefined) data.active = active;
    if (password) data.password = await bcrypt.hash(password, 12);
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (isMaster !== undefined) data.isMaster = isMaster;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true },
    });

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}
