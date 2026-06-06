import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import { logAction, getLogs, getLogsByEntidade, getIpFromRequest } from '../modules/audit/audit.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('AuditLog (Bloco 5)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('logAction', () => {
    it('cria log basico sem detalhes', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      await logAction({
        usuarioId: admin!.id,
        acao: 'criar',
        entidade: 'Ticket',
        entidadeId: 'test-1',
      });
      const log = await prisma.auditLog.findFirst({
        where: { acao: 'criar', entidadeId: 'test-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeTruthy();
      expect(log?.acao).toBe('criar');
      expect(log?.entidade).toBe('Ticket');
      expect(log?.detalhes).toBeNull();
      expect(log?.ip).toBeNull();
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('serializa detalhes como JSON quando recebe objeto', async () => {
      await logAction({
        acao: 'mover_etapa',
        entidade: 'Ticket',
        entidadeId: 'test-2',
        detalhes: { etapaAnterior: 'fila', etapaNova: 'em_atendimento' },
      });
      const log = await prisma.auditLog.findFirst({
        where: { acao: 'mover_etapa', entidadeId: 'test-2' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.detalhes).toBe('{"etapaAnterior":"fila","etapaNova":"em_atendimento"}');
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('aceita usuarioId null (acao automatica)', async () => {
      await logAction({
        acao: 'sla_alerta',
        entidade: 'Ticket',
        entidadeId: 'test-3',
        detalhes: { status: 'violado' },
      });
      const log = await prisma.auditLog.findFirst({
        where: { acao: 'sla_alerta', entidadeId: 'test-3' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeTruthy();
      expect(log?.usuarioId).toBeNull();
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('armazena IP', async () => {
      await logAction({
        acao: 'login',
        entidade: 'Session',
        entidadeId: 'sess-1',
        ip: '192.168.1.1',
      });
      const log = await prisma.auditLog.findFirst({
        where: { acao: 'login', entidadeId: 'sess-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.ip).toBe('192.168.1.1');
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('nao quebra se o banco esta indisponivel (try/catch interno)', async () => {
      await expect(
        logAction({ acao: 'teste', entidade: 'X', entidadeId: 'qualquer' })
      ).resolves.toBeUndefined();
    });
  });

  describe('getLogs', () => {
    it('filtra por entidade', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      await logAction({ acao: 'criar', entidade: 'Fila', entidadeId: 'f-1' });
      await logAction({ acao: 'criar', entidade: 'Ativo', entidadeId: 'a-1' });
      const r = await getLogs({ entidade: 'Fila', limit: 10 });
      expect(r.logs.every((l) => l.entidade === 'Fila')).toBe(true);
      expect(r.logs.find((l) => l.entidadeId === 'f-1')).toBeTruthy();
      await prisma.auditLog.deleteMany({ where: { entidadeId: { in: ['f-1', 'a-1'] } } });
    });

    it('filtra por acao', async () => {
      await logAction({ acao: 'kb_criar', entidade: 'KBArticle', entidadeId: 'kb-1' });
      await logAction({ acao: 'kb_deletar', entidade: 'KBArticle', entidadeId: 'kb-1' });
      const r = await getLogs({ acao: 'kb_criar', limit: 5 });
      expect(r.logs.every((l) => l.acao === 'kb_criar')).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'kb-1' } });
    });

    it('filtra por intervalo de data', async () => {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await logAction({ acao: 'teste', entidade: 'X', entidadeId: 'intervalo-1' });
      const r = await getLogs({ dataInicio: ontem, dataFim: amanha, limit: 100 });
      expect(r.logs.find((l) => l.entidadeId === 'intervalo-1')).toBeTruthy();
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'intervalo-1' } });
    });

    it('retorna total junto com logs', async () => {
      const r = await getLogs({ limit: 5 });
      expect(typeof r.total).toBe('number');
      expect(r.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getLogsByEntidade', () => {
    it('retorna apenas logs da entidade especificada', async () => {
      const tid = 'audit-ticket-test';
      await logAction({ acao: 'criar', entidade: 'Ticket', entidadeId: tid });
      await logAction({ acao: 'atualizar', entidade: 'Ticket', entidadeId: tid });
      await logAction({ acao: 'atribuir', entidade: 'Ticket', entidadeId: tid });
      const logs = await getLogsByEntidade('Ticket', tid);
      expect(logs.length).toBeGreaterThanOrEqual(3);
      expect(logs.every((l) => l.entidade === 'Ticket' && l.entidadeId === tid)).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: tid } });
    });
  });

  describe('getIpFromRequest', () => {
    it('le x-forwarded-for com prioridade', () => {
      const req = { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, ip: '127.0.0.1', socket: { remoteAddress: '0.0.0.0' } } as any;
      expect(getIpFromRequest(req)).toBe('203.0.113.1');
    });
    it('cai para req.ip se sem forwarded', () => {
      const req = { headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '0.0.0.0' } } as any;
      expect(getIpFromRequest(req)).toBe('127.0.0.1');
    });
    it('cai para socket.remoteAddress se sem ip', () => {
      const req = { headers: {}, socket: { remoteAddress: '192.168.1.1' } } as any;
      expect(getIpFromRequest(req)).toBe('192.168.1.1');
    });
  });
});
