import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities, FILAS_PADRAO, SLA_PADRAO, CATEGORIAS_PADRAO } from '../modules/helpdesk/seed.service';

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
    it('CATEGORIAS_PADRAO contem 5 categorias', () => {
      expect(CATEGORIAS_PADRAO.length).toBe(5);
    });
  });
});
