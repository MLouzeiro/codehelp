import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../modules/users/users.controller';
import prisma from '../config/database';
import { AuthRequest } from '../shared/middleware/auth';

function mockReqRes(overrides?: Record<string, any>) {
  const req = { params: {}, query: {}, body: {}, user: { id: 'admin-id', name: 'Admin', email: 'admin@test.com', role: 'admin' }, ...overrides } as unknown as AuthRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

describe('Users Controller — Task 2.2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listUsers', () => {
    it('GET /api/users — deve listar todos os usuários com total', async () => {
      const mockUsers = [
        { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin', active: true, phone: null, avatar: null, password: 'hash', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Vendedor', email: 'vendedor@test.com', role: 'vendedor', active: true, phone: null, avatar: null, password: 'hash', createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const { req, res } = mockReqRes();
      await listUsers(req, res);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
      expect(res.json).toHaveBeenCalledWith({ users: mockUsers, total: 2 });
    });

    it('GET /api/users?active=true — deve filtrar por ativos', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const { req, res } = mockReqRes({ query: { active: 'true' } });
      await listUsers(req, res);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: true } })
      );
    });

    it('GET /api/users?active=false — deve filtrar por inativos', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const { req, res } = mockReqRes({ query: { active: 'false' } });
      await listUsers(req, res);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: false } })
      );
    });
  });

  describe('getUser', () => {
    it('GET /api/users/:id — deve retornar usuário por id', async () => {
      const mockUser = { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin', active: true, phone: null, avatar: null, password: 'hash', sessionToken: null, isMaster: false, createdAt: new Date(), updatedAt: new Date() };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const { req, res } = mockReqRes({ params: { id: '1' } });
      await getUser(req, res);

      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('GET /api/users/:id — deve retornar 404 se não encontrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { req, res } = mockReqRes({ params: { id: 'inexistente' } });
      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
    });
  });

  describe('createUser', () => {
    it('POST /api/users — admin cria usuário e retorna 201', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-id',
        name: 'Novo User',
        email: 'novo@test.com',
        role: 'vendedor',
        active: true,
        phone: null,
        avatar: null,
        password: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const { req, res } = mockReqRes({
        body: { name: 'Novo User', email: 'novo@test.com', password: '123456', role: 'vendedor' },
      });

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Novo User',
          email: 'novo@test.com',
          role: 'vendedor',
        })
      );
    });

    it('POST /api/users — deve retornar 400 se campos obrigatórios faltando', async () => {
      const { req, res } = mockReqRes({ body: { name: 'Sem email' } });
      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Nome, email e senha são obrigatórios' });
    });

    it('POST /api/users — deve retornar 400 se role for inválida', async () => {
      const { req, res } = mockReqRes({
        body: { name: 'Test', email: 'test@test.com', password: '123456', role: 'superadmin' },
      });

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Role inválida') })
      );
    });

    it('POST /api/users — deve retornar 409 se email já existir', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as any);

      const { req, res } = mockReqRes({
        body: { name: 'Test', email: 'existente@test.com', password: '123456', role: 'vendedor' },
      });

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email já cadastrado' });
    });

    it('POST /api/users — deve usar bcrypt cost 12', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({ id: '1', name: 'Test', email: 't@t.com', role: 'tecnico', active: true, phone: null, avatar: null, password: 'hash', createdAt: new Date(), updatedAt: new Date() } as any);

      const { req, res } = mockReqRes({
        body: { name: 'Test', email: 't@t.com', password: '123456', role: 'tecnico' },
      });

      await createUser(req, res);

      expect(hashSpy).toHaveBeenCalledWith('123456', 12);
    });
  });

  describe('updateUser', () => {
    it('PUT /api/users/:id — deve atualizar usuário', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: '1', name: 'Old', email: 'old@test.com', role: 'vendedor', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any);

      const updatedUser = { id: '1', name: 'Updated', email: 'old@test.com', role: 'admin', active: true, phone: null, avatar: null, password: 'hash', createdAt: new Date(), updatedAt: new Date() };
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { name: 'Updated', role: 'admin' },
      });

      await updateUser(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { name: 'Updated', role: 'admin' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    it('PUT /api/users/:id — deve fazer hash se nova senha fornecida', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: '1', name: 'Test', email: 'test@test.com', role: 'vendedor', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { password: 'nova-senha' },
      });

      await updateUser(req, res);

      expect(hashSpy).toHaveBeenCalledWith('nova-senha', 12);
    });

    it('PUT /api/users/:id — deve retornar 404 se não encontrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { req, res } = mockReqRes({
        params: { id: 'inexistente' },
        body: { name: 'Test' },
      });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
    });

    it('PUT /api/users/:id — deve retornar 409 se email já em uso', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ id: '1', name: 'User', email: 'user@test.com', role: 'vendedor', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any)
        .mockResolvedValueOnce({ id: '2', name: 'Outro', email: 'existente@test.com', role: 'admin', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any);

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { email: 'existente@test.com' },
      });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email já cadastrado' });
    });

    it('PUT /api/users/:id — deve validar role', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: '1', name: 'User', email: 'user@test.com', role: 'vendedor', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any);

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { role: 'superadmin' },
      });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Role inválida') })
      );
    });
  });

  describe('deleteUser (soft delete)', () => {
    it('DELETE /api/users/:id — deve desativar usuário (active: false) e retornar 204', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: '1', name: 'Test', email: 'test@test.com', role: 'vendedor', active: true, phone: null, createdAt: new Date(), updatedAt: new Date() } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const { req, res } = mockReqRes({ params: { id: '1' } });
      await deleteUser(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { active: false },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('DELETE /api/users/:id — deve retornar 404 se não encontrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { req, res } = mockReqRes({ params: { id: 'inexistente' } });
      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
    });
  });

  describe('Autorização — middleware', () => {
    it('rotas users usam authenticate + authorize("admin")', async () => {
      const { authenticate, authorize } = await import('../shared/middleware/auth');

      expect(authenticate).toBeDefined();
      expect(authorize).toBeDefined();

      const middleware = authorize('admin');
      const mockReq = { user: { role: 'vendedor' } } as AuthRequest;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Acesso não autorizado para este perfil' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('authorize("admin") deve permitir admin', async () => {
      const { authorize } = await import('../shared/middleware/auth');

      const middleware = authorize('admin');
      const mockReq = { user: { role: 'admin' } } as AuthRequest;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
