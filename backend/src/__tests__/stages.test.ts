import { describe, it, expect, beforeEach, afterAll, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  listStages,
  getStageById,
  getStageBySlug,
  createStage,
  updateStage,
  reorderStages,
  deleteStage,
  restoreStage,
  etapaInicialSlug,
} from '../modules/helpdesk/stages.service';

const SLUGS_TESTE = ['teste-stg-a', 'teste-stg-b', 'teste-stg-c', 'teste-stg-d'];

beforeEach(async () => {
  await prisma.helpdeskConfig.deleteMany({ where: { slug: { in: SLUGS_TESTE } } });
});

afterAll(async () => {
  await prisma.helpdeskConfig.deleteMany({ where: { slug: { in: SLUGS_TESTE } } });
});

describe('Stages Service (Bloco 17)', () => {
  describe('listStages', () => {
    it('retorna apenas etapas ativas por padrao', async () => {
      await createStage({ slug: SLUGS_TESTE[0], nome: 'Ativa' });
      const d = await createStage({ slug: SLUGS_TESTE[1], nome: 'Depois desativada' });
      await deleteStage(d.id);
      const lista = await listStages();
      const slugs = lista.map((s) => s.slug);
      expect(slugs).toContain(SLUGS_TESTE[0]);
      expect(slugs).not.toContain(SLUGS_TESTE[1]);
    });

    it('inclui inativas quando includeInativas=true', async () => {
      await createStage({ slug: SLUGS_TESTE[0], nome: 'Ativa' });
      const d = await createStage({ slug: SLUGS_TESTE[1], nome: 'Inativa' });
      await deleteStage(d.id);
      const lista = await listStages({ includeInativas: true });
      const slugs = lista.map((s) => s.slug);
      expect(slugs).toContain(SLUGS_TESTE[0]);
      expect(slugs).toContain(SLUGS_TESTE[1]);
    });

    it('ordena por ordem ascendente', async () => {
      await createStage({ slug: SLUGS_TESTE[0], nome: 'A', ordem: 100 });
      await createStage({ slug: SLUGS_TESTE[1], nome: 'B', ordem: 50 });
      await createStage({ slug: SLUGS_TESTE[2], nome: 'C', ordem: 200 });
      const lista = await listStages();
      const idx = (slug: string) => lista.findIndex((s) => s.slug === slug);
      expect(idx(SLUGS_TESTE[1])).toBeLessThan(idx(SLUGS_TESTE[0]));
      expect(idx(SLUGS_TESTE[0])).toBeLessThan(idx(SLUGS_TESTE[2]));
    });
  });

  describe('createStage', () => {
    it('cria com dados minimos (slug + nome)', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Em Análise' });
      expect(s.id).toBeTruthy();
      expect(s.slug).toBe(SLUGS_TESTE[0]);
      expect(s.nome).toBe('Em Análise');
      expect(s.ativo).toBe(true);
      expect(s.etapaInicial).toBe(false);
    });

    it('rejeita slug vazio', async () => {
      await expect(createStage({ slug: '', nome: 'X' })).rejects.toThrow(/slug/i);
    });

    it('rejeita slug nao kebab-case (espacos, maiusculas, simbolos)', async () => {
      await expect(createStage({ slug: 'Em Análise!', nome: 'X' })).rejects.toThrow(/slug/i);
      await expect(createStage({ slug: 'UPPER', nome: 'X' })).rejects.toThrow(/slug/i);
    });

    it('aceita slug kebab-case valido', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Em Análise' });
      expect(s.slug).toBe(SLUGS_TESTE[0]);
    });

    it('rejeita slug duplicado', async () => {
      await createStage({ slug: SLUGS_TESTE[0], nome: 'A' });
      await expect(createStage({ slug: SLUGS_TESTE[0], nome: 'B' })).rejects.toThrow(/slug/i);
    });

    it('rejeita nome vazio', async () => {
      await expect(createStage({ slug: SLUGS_TESTE[0], nome: '' })).rejects.toThrow(/nome/i);
      await expect(createStage({ slug: SLUGS_TESTE[0], nome: '   ' })).rejects.toThrow(/nome/i);
    });

    it('cria com etapaInicial=true e desmarca a anterior', async () => {
      const nova = await createStage({ slug: SLUGS_TESTE[0], nome: 'Inicial Nova', etapaInicial: true });
      expect(nova.etapaInicial).toBe(true);
      const outraInicial = await prisma.helpdeskConfig.findFirst({
        where: { etapaInicial: true, NOT: { id: nova.id } },
      });
      expect(outraInicial).toBeNull();
      await updateStage(nova.id, { etapaInicial: false });
    });

    it('calcula ordem automaticamente quando nao informada', async () => {
      const max = await prisma.helpdeskConfig.aggregate({ _max: { ordem: true } });
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Auto ordem' });
      expect(s.ordem).toBe((max._max.ordem ?? -1) + 1);
    });

    it('aceita todos os campos extras', async () => {
      const s = await createStage({
        slug: SLUGS_TESTE[0],
        nome: 'Completa',
        descricao: 'Descricao longa',
        cor: '#ff00ff',
        icone: 'star',
        ordem: 999,
        autoMessage: 'Ola {{nome_contato}}',
        enviarAuto: true,
        notificarEquipe: true,
      });
      expect(s.descricao).toBe('Descricao longa');
      expect(s.cor).toBe('#ff00ff');
      expect(s.icone).toBe('star');
      expect(s.ordem).toBe(999);
      expect(s.enviarAuto).toBe(true);
      expect(s.autoMessage).toBe('Ola {{nome_contato}}');
    });
  });

  describe('updateStage', () => {
    it('atualiza campos parciais', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'A' });
      const upd = await updateStage(s.id, { nome: 'A renomeado', cor: '#00ff00' });
      expect(upd?.nome).toBe('A renomeado');
      expect(upd?.cor).toBe('#00ff00');
    });

    it('retorna null se nao existe', async () => {
      const r = await updateStage('id-inexistente-xyz', { nome: 'X' });
      expect(r).toBeNull();
    });

    it('rejeita nome vazio', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'A' });
      await expect(updateStage(s.id, { nome: '' })).rejects.toThrow(/nome/i);
    });

    it('atualizar etapaInicial=true desmarca a anterior', async () => {
      const a = await createStage({ slug: SLUGS_TESTE[0], nome: 'A', etapaInicial: true });
      const b = await createStage({ slug: SLUGS_TESTE[1], nome: 'B' });
      await updateStage(b.id, { etapaInicial: true });
      const a2 = await getStageById(a.id);
      const b2 = await getStageById(b.id);
      expect(a2?.etapaInicial).toBe(false);
      expect(b2?.etapaInicial).toBe(true);
      await updateStage(a.id, { etapaInicial: true });
      await updateStage(b.id, { etapaInicial: false });
    });
  });

  describe('reorderStages', () => {
    it('atualiza ordem em batch a partir do array de IDs', async () => {
      const a = await createStage({ slug: SLUGS_TESTE[0], nome: 'A' });
      const b = await createStage({ slug: SLUGS_TESTE[1], nome: 'B' });
      const c = await createStage({ slug: SLUGS_TESTE[2], nome: 'C' });
      await reorderStages([c.id, a.id, b.id]);
      const ra = await getStageById(a.id);
      const rb = await getStageById(b.id);
      const rc = await getStageById(c.id);
      expect(rc?.ordem).toBe(0);
      expect(ra?.ordem).toBe(1);
      expect(rb?.ordem).toBe(2);
    });
  });

  describe('deleteStage', () => {
    it('soft delete (ativo=false) quando ha tickets usando a etapa', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Com tickets' });
      const cliente = await prisma.client.create({ data: { razaoSocial: 'Cliente Teste Stage' } });
      await prisma.ticket.create({
        data: {
          clientId: cliente.id,
          contactName: 'Teste',
          contactPhone: '5585999990000',
          etapa: s.slug,
          status: 'aberto',
          canal: 'whatsapp',
        },
      });
      const r = await deleteStage(s.id);
      expect(r).toMatchObject({ ativo: false });
      const exists = await prisma.helpdeskConfig.findUnique({ where: { id: s.id } });
      expect(exists?.ativo).toBe(false);
      await prisma.ticket.deleteMany({ where: { clientId: cliente.id } });
      await prisma.client.delete({ where: { id: cliente.id } });
    });

    it('sempre faz soft delete (mesmo sem tickets) para permitir reativacao', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Vazia' });
      const r = await deleteStage(s.id);
      expect(r).toMatchObject({ ativo: false });
      const exists = await prisma.helpdeskConfig.findUnique({ where: { id: s.id } });
      expect(exists).not.toBeNull();
      expect(exists?.ativo).toBe(false);
    });

    it('rejeita desativar a etapa inicial', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Inicial', etapaInicial: true });
      await expect(deleteStage(s.id)).rejects.toThrow(/inicial/i);
      await updateStage(s.id, { etapaInicial: false });
    });
  });

  describe('restoreStage', () => {
    it('reativa etapa desativada (soft delete)', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'X' });
      const cliente = await prisma.client.create({ data: { razaoSocial: 'Cliente Teste Restore' } });
      await prisma.ticket.create({
        data: {
          clientId: cliente.id,
          contactName: 'Teste',
          contactPhone: '5585999990001',
          etapa: s.slug,
          status: 'aberto',
          canal: 'whatsapp',
        },
      });
      await deleteStage(s.id);
      const reativada = await restoreStage(s.id);
      expect(reativada.ativo).toBe(true);
      await prisma.ticket.deleteMany({ where: { clientId: cliente.id } });
      await prisma.client.delete({ where: { id: cliente.id } });
    });
  });

  describe('etapaInicialSlug', () => {
    it('retorna a slug da etapa com etapaInicial=true', async () => {
      const s = await createStage({ slug: SLUGS_TESTE[0], nome: 'Inicial Teste', etapaInicial: true });
      const slug = await etapaInicialSlug();
      expect(slug).toBe(SLUGS_TESTE[0]);
      await updateStage(s.id, { etapaInicial: false });
    });

    it('fallback para fila se nenhuma marcada', async () => {
      await prisma.helpdeskConfig.updateMany({ data: { etapaInicial: false } });
      const slug = await etapaInicialSlug();
      expect(slug).toBe('fila');
      const cfg = await prisma.helpdeskConfig.findFirst({ where: { slug: 'fila' } });
      if (cfg) await prisma.helpdeskConfig.update({ where: { id: cfg.id }, data: { etapaInicial: true } });
    });
  });
});
