import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AuthRequest } from '../../shared/middleware/auth';

function generateTokens(user: { id: string; email: string; role: string; sessionToken: string }) {
  const accessOptions: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  const refreshOptions: SignOptions = { expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'] };
  const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role, sessionToken: user.sessionToken }, env.jwtSecret, accessOptions);
  const refreshToken = jwt.sign({ id: user.id }, env.jwtRefreshSecret, refreshOptions);
  return { accessToken, refreshToken };
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const sessionToken = uuidv4();
    await prisma.user.update({ where: { id: user.id }, data: { sessionToken } });

    const tokens = generateTokens({ ...user, sessionToken });
    return res.json({
      ...tokens,
      sessionToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isMaster: user.isMaster, phone: user.phone },
    });
  } catch {
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken, sessionToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token é obrigatório' });

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inválido' });

    if (sessionToken && user.sessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Sessão encerrada em outro dispositivo' });
    }

    // NÃO rotacionar sessionToken no refresh — só no login.
    // Isso evita que um refresh em uma aba invalide o token de outra aba.
    const tokens = generateTokens({ ...user, sessionToken: user.sessionToken || '' });
    return res.json({ ...tokens, sessionToken: user.sessionToken });
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  return res.json({ user: req.user });
}

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true, createdAt: true,
        departamentos: {
          select: {
            departamento: { select: { id: true, slug: true, nome: true, cor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = users.map((u) => ({
      ...u,
      departamentos: u.departamentos.map((d) => d.departamento),
    }));
    return res.json(mapped);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { name, email, password, role, isMaster, departamentoIds } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email ja cadastrado' });

    // ── Seguranca: validacao de role ──────────────────────────────────
    const requestingUser = (req as AuthRequest).user;
    const roleHierarchy: Record<string, number> = {
      tecnico: 1,
      comercial: 2,
      gerente: 3,
      admin: 4,
    };
    const requesterLevel = roleHierarchy[requestingUser?.role || 'tecnico'] || 1;
    const requestedRole = role || 'tecnico';
    const requestedLevel = roleHierarchy[requestedRole] || 1;

    // Gerente so pode criar tecnicos e comerciais
    if (requesterLevel < roleHierarchy.admin && requestedLevel > requesterLevel) {
      return res.status(403).json({ error: `Voce nao pode criar usuarios com role "${requestedRole}". Roles permitidas: ${Object.entries(roleHierarchy).filter(([, v]) => v <= requesterLevel).map(([k]) => k).join(', ')}` });
    }

    // So admin/master pode criar admin
    if (requestedLevel >= roleHierarchy.admin && !requestingUser?.isMaster && requestingUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem criar outros administradores' });
    }

    // So master pode setar isMaster
    const canSetMaster = requestingUser?.isMaster || requestingUser?.role === 'admin';
    const finalIsMaster = canSetMaster && isMaster ? true : false;

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'tecnico',
        phone: req.body.phone || null,
        isMaster: finalIsMaster,
        ...(departamentoIds && departamentoIds.length > 0
          ? {
              departamentos: {
                create: departamentoIds.map((id: string) => ({ departamentoId: id })),
              },
            }
          : {}),
      },
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true,
        departamentos: { select: { departamento: { select: { id: true, slug: true, nome: true, cor: true } } } },
      },
    });

    return res.status(201).json({
      ...user,
      departamentos: user.departamentos.map((d) => d.departamento),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, active, password, isMaster, departamentoIds } = req.body;

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 12);
    if (req.body.phone !== undefined) data.phone = req.body.phone;

    // ── Seguranca: validacao de role ──────────────────────────────────
    const requestingUser = (req as AuthRequest).user;
    const roleHierarchy: Record<string, number> = {
      tecnico: 1,
      comercial: 2,
      gerente: 3,
      admin: 4,
    };
    const requesterLevel = roleHierarchy[requestingUser?.role || 'tecnico'] || 1;

    // Validar role
    if (role) {
      const requestedLevel = roleHierarchy[role] || 1;
      if (requesterLevel < roleHierarchy.admin && requestedLevel > requesterLevel) {
        return res.status(403).json({ error: `Voce nao pode atribuir role "${role}"` });
      }
      data.role = role;
    }

    // Validar active
    if (active !== undefined) {
      // So admin/master pode desativar/ativar usuarios
      if (requesterLevel < roleHierarchy.admin) {
        return res.status(403).json({ error: 'Apenas administradores podem ativar/desativar usuarios' });
      }
      data.active = active;
    }

    // Validar isMaster — so master pode alterar isMaster
    const canSetMaster = requestingUser?.isMaster || requestingUser?.role === 'admin';
    if (isMaster !== undefined && canSetMaster) {
      data.isMaster = isMaster;
    }

    // Atualizar departamentos (tabela pivo)
    if (departamentoIds !== undefined) {
      await prisma.userDepartamento.deleteMany({ where: { userId: id } });
      if (departamentoIds.length > 0) {
        await prisma.userDepartamento.createMany({
          data: departamentoIds.map((departamentoId: string) => ({ userId: id, departamentoId })),
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true,
        departamentos: { select: { departamento: { select: { id: true, slug: true, nome: true, cor: true } } } },
      },
    });

    return res.json({
      ...user,
      departamentos: user.departamentos.map((d) => d.departamento),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}
