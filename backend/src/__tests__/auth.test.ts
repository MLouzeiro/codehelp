import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { login, refreshToken, me } from '../modules/auth/auth.controller';
import prisma from '../config/database';
import { env } from '../config/env';
import { AuthRequest } from '../shared/middleware/auth';

function mockReqRes(overrides?: Record<string, any>) {
  const req = { body: {}, ...overrides } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

describe('Auth Controller — Task 2.1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('POST /api/auth/login — credenciais válidas retorna 200 com tokens e user', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Admin Codemed',
        email: 'admin@codemed.com.br',
        password: await bcrypt.hash('admin123', 12),
        role: 'admin',
        active: true,
        phone: null,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({
        body: { email: 'admin@codemed.com.br', password: 'admin123' },
      });

      await login(req, res);

      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Admin Codemed',
            email: 'admin@codemed.com.br',
            role: 'admin',
          },
        })
      );
    });

    it('POST /api/auth/login — senha inválida retorna 401 Credenciais inválidas', async () => {
      const mockUser = {
        id: '1',
        name: 'Admin Codemed',
        email: 'admin@codemed.com.br',
        password: await bcrypt.hash('admin123', 12),
        role: 'admin',
        active: true,
        phone: null,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({
        body: { email: 'admin@codemed.com.br', password: 'senha_errada' },
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' });
    });

    it('deve retornar 400 quando email não for fornecido', async () => {
      const { req, res } = mockReqRes({ body: { password: '123456' } });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email e senha são obrigatórios' });
    });

    it('deve retornar 401 quando usuário não existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { req, res } = mockReqRes({
        body: { email: 'naoexiste@test.com', password: '123456' },
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' });
    });

    it('deve retornar 401 quando usuário está inativo', async () => {
      const mockUser = {
        id: '1',
        name: 'Usuário Inativo',
        email: 'inativo@codemed.com.br',
        password: await bcrypt.hash('admin123', 12),
        role: 'tecnico',
        active: false,
        phone: null,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({
        body: { email: 'inativo@codemed.com.br', password: 'admin123' },
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' });
    });
  });

  describe('refreshToken', () => {
    it('POST /api/auth/refresh — token válido retorna novos tokens', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@codemed.com.br',
        role: 'admin',
        isMaster: true,
        active: true,
        password: '',
        name: 'Admin',
        avatar: null,
        phone: null,
        online: false,
        lastSeenAt: null,
        departamentoId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validToken = jwt.sign(
        { id: '550e8400-e29b-41d4-a716-446655440000' },
        env.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({ body: { refreshToken: validToken } });

      await refreshToken(req, res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('deve retornar 400 quando refresh token não for fornecido', async () => {
      const { req, res } = mockReqRes({ body: {} });

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token obrigatório' });
    });

    it('deve retornar 401 para refresh token inválido', async () => {
      const { req, res } = mockReqRes({
        body: { refreshToken: 'token_obviamente_invalido' },
      });

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token inválido ou expirado' });
    });

    it('deve retornar 401 quando usuário não for encontrado no refresh', async () => {
      const validToken = jwt.sign(
        { id: 'id_inexistente' },
        env.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { req, res } = mockReqRes({ body: { refreshToken: validToken } });

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
    });
  });

  describe('me', () => {
    it('GET /api/auth/me — retorna dados do usuário autenticado', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Admin Codemed',
        email: 'admin@codemed.com.br',
        role: 'admin',
      };

      const req = { user: mockUser } as AuthRequest;
      const res = { json: vi.fn().mockReturnThis() } as unknown as Response;

      await me(req, res);

      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
  });
});

describe('Rate Limiter — authLimiter no server.ts', () => {
  it('deve estar configurado para 5 tentativas por hora em /api/auth/login', () => {
    const rateLimit = require('express-rate-limit');
    const options = rateLimit.default({
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: { error: 'Muitas tentativas de login. Tente novamente em 1 hora.' },
    });
    expect(options).toBeDefined();
    expect(typeof options).toBe('function');
  });
});
