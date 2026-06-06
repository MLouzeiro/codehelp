import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  criarKb,
  atualizarKb,
  deletarKb,
  publicarKb,
  marcarUtil,
  registrarVisualizacao,
  listarKb,
  getKb,
  getKbPorSlug,
  sugerirKbParaTicket,
  slugUnico,
} from '../modules/kb/kb.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('KB Service (Bloco 6)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('slugify / slugUnico', () => {
    it('gera slug a partir de titulo', async () => {
      const slug = await slugUnico('Como Resetar Senha do Sistema');
      expect(slug).toBe('como-resetar-senha-do-sistema');
    });

    it('adiciona sufixo numerico se slug ja existe', async () => {
      const kb = await criarKb({
        titulo: 'Teste Slug Duplicado',
        conteudo: 'conteudo teste',
      });
      const slug2 = await slugUnico('Teste Slug Duplicado');
      expect(slug2).not.toBe(kb.slug);
      expect(slug2.startsWith('teste-slug-duplicado')).toBe(true);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('ignora o proprio id quando verificando unicidade', async () => {
      const kb = await criarKb({ titulo: 'Mesmo Artigo', conteudo: 'x' });
      const slug = await slugUnico('Mesmo Artigo', kb.id);
      expect(slug).toBe(kb.slug);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });

  describe('criarKb', () => {
    it('cria artigo com dados minimos', async () => {
      const kb = await criarKb({
        titulo: 'Artigo Teste',
        conteudo: 'Conteudo do artigo teste',
      });
      expect(kb.id).toBeTruthy();
      expect(kb.titulo).toBe('Artigo Teste');
      expect(kb.publicado).toBe(false);
      expect(kb.visualizacoes).toBe(0);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('cria artigo com categoriaId e tags', async () => {
      const cat = await prisma.categoria.findUnique({ where: { slug: 'suporte_tecnico' } });
      const kb = await criarKb({
        titulo: 'Erro de Login',
        conteudo: 'Como resolver erro 401',
        categoriaId: cat!.id,
        tags: 'login,senha,erro',
        publicado: true,
      });
      expect(kb.categoriaId).toBe(cat!.id);
      expect(kb.tags).toBe('login,senha,erro');
      expect(kb.publicado).toBe(true);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });

  describe('atualizarKb', () => {
    it('atualiza apenas campos fornecidos', async () => {
      const kb = await criarKb({ titulo: 'Original', conteudo: 'Original' });
      const updated = await atualizarKb(kb.id, { titulo: 'Atualizado' });
      expect(updated.titulo).toBe('Atualizado');
      expect(updated.conteudo).toBe('Original');
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });

  describe('publicarKb', () => {
    it('altera estado publicado', async () => {
      const kb = await criarKb({ titulo: 'Rascunho', conteudo: 'x' });
      expect(kb.publicado).toBe(false);
      const pub = await publicarKb(kb.id, true);
      expect(pub.publicado).toBe(true);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });

  describe('marcarUtil / registrarVisualizacao', () => {
    it('incrementa contador util', async () => {
      const kb = await criarKb({ titulo: 'Contador Util', conteudo: 'x' });
      await marcarUtil(kb.id, true);
      await marcarUtil(kb.id, true);
      const r = await getKb(kb.id);
      expect(r!.util).toBe(2);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('incrementa contador inutil', async () => {
      const kb = await criarKb({ titulo: 'Contador Inutil', conteudo: 'x' });
      await marcarUtil(kb.id, false);
      const r = await getKb(kb.id);
      expect(r!.inutil).toBe(1);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('incrementa visualizacoes', async () => {
      const kb = await criarKb({ titulo: 'Views', conteudo: 'x' });
      await registrarVisualizacao(kb.id);
      await registrarVisualizacao(kb.id);
      await registrarVisualizacao(kb.id);
      const r = await getKb(kb.id);
      expect(r!.visualizacoes).toBe(3);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });

  describe('listarKb', () => {
    it('filtra por categoria', async () => {
      const cat = await prisma.categoria.findUnique({ where: { slug: 'financeiro' } });
      const k1 = await criarKb({ titulo: 'KB Fin 1', conteudo: 'x', categoriaId: cat!.id, publicado: true });
      const k2 = await criarKb({ titulo: 'KB Sup 1', conteudo: 'x' });
      const r = await listarKb({ categoriaId: cat!.id });
      expect(r.items.find((i) => i.id === k1.id)).toBeTruthy();
      expect(r.items.find((i) => i.id === k2.id)).toBeUndefined();
      await prisma.kBArticle.deleteMany({ where: { id: { in: [k1.id, k2.id] } } });
    });

    it('filtra por publicado', async () => {
      const pub = await criarKb({ titulo: 'Pub', conteudo: 'x', publicado: true });
      const ras = await criarKb({ titulo: 'Ras', conteudo: 'x', publicado: false });
      const r1 = await listarKb({ publicado: true });
      const r2 = await listarKb({ publicado: false });
      expect(r1.items.find((i) => i.id === pub.id)).toBeTruthy();
      expect(r1.items.find((i) => i.id === ras.id)).toBeUndefined();
      expect(r2.items.find((i) => i.id === ras.id)).toBeTruthy();
      await prisma.kBArticle.deleteMany({ where: { id: { in: [pub.id, ras.id] } } });
    });

    it('filtra por tag', async () => {
      const k1 = await criarKb({ titulo: 'Tag1', conteudo: 'x', tags: 'senha,login', publicado: true });
      const k2 = await criarKb({ titulo: 'Tag2', conteudo: 'x', tags: 'boleto', publicado: true });
      const r = await listarKb({ tag: 'senha' });
      expect(r.items.find((i) => i.id === k1.id)).toBeTruthy();
      expect(r.items.find((i) => i.id === k2.id)).toBeUndefined();
      await prisma.kBArticle.deleteMany({ where: { id: { in: [k1.id, k2.id] } } });
    });

    it('busca por texto em titulo/conteudo', async () => {
      const k1 = await criarKb({ titulo: 'Como resetar senha', conteudo: 'passo a passo', publicado: true });
      const k2 = await criarKb({ titulo: 'Boleto atrasado', conteudo: 'regularize', publicado: true });
      const r = await listarKb({ busca: 'resetar' });
      expect(r.items.find((i) => i.id === k1.id)).toBeTruthy();
      expect(r.items.find((i) => i.id === k2.id)).toBeUndefined();
      await prisma.kBArticle.deleteMany({ where: { id: { in: [k1.id, k2.id] } } });
    });
  });

  describe('sugerirKbParaTicket', () => {
    it('sugere artigos pela categoria do ticket', async () => {
      const cat = await prisma.categoria.findUnique({ where: { slug: 'financeiro' } });
      const kb = await criarKb({ titulo: 'Boleto e Cobranca', conteudo: 'instrucoes', categoriaId: cat!.id, publicado: true });
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `kb-sug-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Sug',
          contactPhone: '85999990020',
          categoriaId: cat!.id,
          status: 'aberto',
          etapa: 'fila',
        },
      });
      const sugestoes = await sugerirKbParaTicket(ticket.id);
      expect(sugestoes.find((s) => s.id === kb.id)).toBeTruthy();
      await prisma.ticket.delete({ where: { id: ticket.id } });
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('nao retorna artigos nao publicados', async () => {
      const cat = await prisma.categoria.findUnique({ where: { slug: 'financeiro' } });
      const kb = await criarKb({ titulo: 'Rascunho Sugestao', conteudo: 'x', categoriaId: cat!.id, publicado: false });
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `kb-sug2-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Sug2',
          contactPhone: '85999990021',
          categoriaId: cat!.id,
          status: 'aberto',
          etapa: 'fila',
        },
      });
      const sugestoes = await sugerirKbParaTicket(ticket.id);
      expect(sugestoes.find((s) => s.id === kb.id)).toBeUndefined();
      await prisma.ticket.delete({ where: { id: ticket.id } });
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });

    it('retorna array vazio para ticket inexistente', async () => {
      const sugestoes = await sugerirKbParaTicket('ticket-inexistente');
      expect(sugestoes).toEqual([]);
    });
  });

  describe('getKbPorSlug', () => {
    it('encontra artigo pelo slug', async () => {
      const kb = await criarKb({ titulo: 'Slug Test', conteudo: 'x' });
      const r = await getKbPorSlug(kb.slug);
      expect(r?.id).toBe(kb.id);
      await prisma.kBArticle.delete({ where: { id: kb.id } });
    });
  });
});
