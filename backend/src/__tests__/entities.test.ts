import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  ensureHelpdeskEntities,
  FILAS_PADRAO,
  SLA_PADRAO,
  CATEGORIAS_PADRAO,
  migrateCategoriaStringToFK,
} from '../modules/helpdesk/seed.service';

describe('Helpdesk Entities (Bloco 1)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('Filas', () => {
    it('cria filas padrao N1/N2/N3 na primeira execucao', async () => {
      const filas = await prisma.fila.findMany({ orderBy: { ordem: 'asc' } });
      expect(filas.length).toBeGreaterThanOrEqual(3);
      const slugs = filas.map((f) => f.slug);
      expect(slugs).toContain('n1');
      expect(slugs).toContain('n2');
      expect(slugs).toContain('n3');
    });

    it('filas tem nivel correto (N1/N2/N3)', async () => {
      const filas = await prisma.fila.findMany();
      const n1 = filas.find((f) => f.slug === 'n1');
      const n2 = filas.find((f) => f.slug === 'n2');
      const n3 = filas.find((f) => f.slug === 'n3');
      expect(n1?.nivel).toBe('N1');
      expect(n2?.nivel).toBe('N2');
      expect(n3?.nivel).toBe('N3');
    });

    it('filas tem SLA crescente (N1 < N2 < N3)', async () => {
      const filas = await prisma.fila.findMany();
      const n1 = filas.find((f) => f.slug === 'n1');
      const n2 = filas.find((f) => f.slug === 'n2');
      const n3 = filas.find((f) => f.slug === 'n3');
      expect(n1!.slaMinutos).toBeLessThan(n2!.slaMinutos);
      expect(n2!.slaMinutos).toBeLessThan(n3!.slaMinutos);
    });

    it('idempotente: rodar 2x nao duplica filas', async () => {
      await ensureHelpdeskEntities();
      const filas = await prisma.fila.findMany();
      const slugs = filas.map((f) => f.slug);
      const unicos = new Set(slugs);
      expect(unicos.size).toBe(slugs.length);
    });
  });

  describe('SLAConfigs', () => {
    it('cria SLAConfig para as 4 prioridades', async () => {
      const slas = await prisma.sLAConfig.findMany();
      const prioridades = slas.map((s) => s.prioridade).sort();
      expect(prioridades).toEqual(['alta', 'baixa', 'media', 'urgente']);
    });

    it('SLA urgente tem menor tempo de primeira resposta', async () => {
      const slas = await prisma.sLAConfig.findMany();
      const urgente = slas.find((s) => s.prioridade === 'urgente');
      const baixa = slas.find((s) => s.prioridade === 'baixa');
      expect(urgente!.slaMinutosPrimeiraResposta).toBeLessThan(baixa!.slaMinutosPrimeiraResposta);
      expect(urgente!.slaMinutosResolucao).toBeLessThan(baixa!.slaMinutosResolucao);
    });

    it('alertas 75% e 90% ativos por padrao', async () => {
      const slas = await prisma.sLAConfig.findMany();
      for (const sla of slas) {
        expect(sla.alerta75Porcento).toBe(true);
        expect(sla.alerta90Porcento).toBe(true);
      }
    });
  });

  describe('Categorias', () => {
    it('cria 5 categorias padrao', async () => {
      const cats = await prisma.categoria.findMany({ orderBy: { ordem: 'asc' } });
      expect(cats.length).toBeGreaterThanOrEqual(5);
      const slugs = cats.map((c) => c.slug);
      expect(slugs).toContain('suporte_tecnico');
      expect(slugs).toContain('financeiro');
      expect(slugs).toContain('comercial');
      expect(slugs).toContain('cancelamento');
      expect(slugs).toContain('outros');
    });

    it('categoria existe e pode ser usada em KBArticle', async () => {
      const cat = await prisma.categoria.findUnique({ where: { slug: 'suporte_tecnico' } });
      expect(cat).toBeTruthy();
      expect(cat?.ativo).toBe(true);
    });
  });

  describe('Constantes exportadas', () => {
    it('FILAS_PADRAO contem 3 filas', () => {
      expect(FILAS_PADRAO.length).toBe(3);
    });
    it('SLA_PADRAO contem 4 prioridades', () => {
      expect(SLA_PADRAO.length).toBe(4);
    });
    it('CATEGORIAS_PADRAO contem 11 categorias (inclui impressoras/banco/integracoes)', () => {
      expect(CATEGORIAS_PADRAO.length).toBe(11);
      const slugs = CATEGORIAS_PADRAO.map((c) => c.slug);
      expect(slugs).toContain('impressoras');
      expect(slugs).toContain('banco_de_dados');
      expect(slugs).toContain('integracoes');
    });
  });

  describe('Migracao categoria string -> FK (Bloco 2)', () => {
    it('cria categoria nova para slug desconhecido e seta categoriaId', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `test-mig-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Teste Migracao',
          contactPhone: '85999990001',
          categoria: 'categoria_rara_xyz',
          status: 'aberto',
          etapa: 'fila',
        },
      });
      expect(ticket.categoriaId).toBeNull();
      await migrateCategoriaStringToFK();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.categoriaId).toBeTruthy();
      const cat = await prisma.categoria.findUnique({ where: { slug: 'categoria_rara_xyz' } });
      expect(cat).toBeTruthy();
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it('reutiliza categoria existente para slug conhecido', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `test-mig-known-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Financeiro',
          contactPhone: '85999990002',
          categoria: 'financeiro',
          status: 'aberto',
          etapa: 'fila',
        },
      });
      await migrateCategoriaStringToFK();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      const catFin = await prisma.categoria.findUnique({ where: { slug: 'financeiro' } });
      expect(updated?.categoriaId).toBe(catFin?.id);
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it('idempotente: rodar 2x nao duplica nem corrompe', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `test-mig-idem-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Idempotente',
          contactPhone: '85999990003',
          categoria: 'suporte_tecnico',
          status: 'aberto',
          etapa: 'fila',
        },
      });
      await migrateCategoriaStringToFK();
      await migrateCategoriaStringToFK();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.categoriaId).toBeTruthy();
      const catCount = await prisma.categoria.count({ where: { slug: 'suporte_tecnico' } });
      expect(catCount).toBe(1);
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe('Novos campos do Ticket (Bloco 2)', () => {
    it('Ticket aceita idFila, categoriaId, ativoId, slaTotalMinutos, slaPausadoEm', async () => {
      const filaN1 = await prisma.fila.findUnique({ where: { slug: 'n1' } });
      const catSup = await prisma.categoria.findUnique({ where: { slug: 'suporte_tecnico' } });
      const cliente = await prisma.client.create({
        data: { razaoSocial: 'Empresa Teste SLA', segmento: 'laboratorio' },
      });
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `test-newfields-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente SLA',
          contactPhone: '85999990004',
          clientId: cliente.id,
          idFila: filaN1!.id,
          categoriaId: catSup!.id,
          slaTotalMinutos: 60,
          slaPausadoTotalMin: 0,
          status: 'aberto',
          etapa: 'fila',
        },
        include: { fila: true, categoriaRef: true, client: true },
      });
      expect(ticket.fila?.slug).toBe('n1');
      expect(ticket.categoriaRef?.slug).toBe('suporte_tecnico');
      expect(ticket.slaTotalMinutos).toBe(60);
      expect(ticket.slaPausadoTotalMin).toBe(0);
      expect(ticket.motivoStatus).toBeNull();
      expect(ticket.dataResolucao).toBeNull();
      expect(ticket.dataCSAT).toBeNull();
      await prisma.ticket.delete({ where: { id: ticket.id } });
      await prisma.client.delete({ where: { id: cliente.id } });
    });

    it('campos SLA podem ser atualizados (pausar/retomar)', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `test-sla-pause-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Pause',
          contactPhone: '85999990005',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          slaTotalMinutos: 60,
        },
      });
      const pausedAt = new Date();
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaPausadoEm: pausedAt },
      });
      expect(updated.slaPausadoEm).toBeInstanceOf(Date);
      const resumed = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaPausadoEm: null, slaPausadoTotalMin: { increment: 15 } },
      });
      expect(resumed.slaPausadoEm).toBeNull();
      expect(resumed.slaPausadoTotalMin).toBe(15);
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });
});
