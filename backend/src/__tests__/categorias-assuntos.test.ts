import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  listarCategorias,
  listarAssuntos,
  criarCategoria,
  atualizarCategoria,
  inativarCategoria,
  excluirCategoria,
  criarAssunto,
  atualizarAssunto,
  inativarAssunto,
  getExigirClassificacao,
  setExigirClassificacao,
  aplicarClassificacao,
  sugerirClassificacao,
  validarClassificacaoObrigatoria,
} from '../modules/helpdesk/categorias.service';

let limpeza: {
  categoriaIds: string[];
  assuntoIds: string[];
  ticketIds: string[];
  auditIds: string[];
} = { categoriaIds: [], assuntoIds: [], ticketIds: [], auditIds: [] };

function sufixo() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function limparDados() {
  await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.message.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.aIClassification.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: limpeza.ticketIds } } });
  await prisma.assunto.deleteMany({ where: { id: { in: limpeza.assuntoIds } } });
  await prisma.categoria.deleteMany({ where: { id: { in: limpeza.categoriaIds } } });
  await prisma.auditLog.deleteMany({ where: { id: { in: limpeza.auditIds } } });
  await prisma.helpdeskConfig.deleteMany({ where: { slug: 'exigir_classificacao' } });
  limpeza = { categoriaIds: [], assuntoIds: [], ticketIds: [], auditIds: [] };
}

async function criarCategoriaTeste() {
  const cat = await criarCategoria({
    nome: `Impressoras ${sufixo()}`,
    descricao: 'Categoria de teste',
    cor: '#f97316',
    icone: 'printer',
  });
  limpeza.categoriaIds.push(cat.id);
  return cat;
}

async function criarAssuntoTeste(categoriaId: string) {
  const asst = await criarAssunto({
    nome: `Impressora nao imprime ${sufixo()}`,
    descricao: 'Assunto de teste',
    categoriaId,
    prioridadePadrao: 'alta',
    slaPadraoMin: 240,
  });
  limpeza.assuntoIds.push(asst.id);
  return asst;
}

async function criarTicketTeste(extra?: { categoriaId?: string; assuntoId?: string; categoria?: string; assunto?: string }) {
  const ticket = await prisma.ticket.create({
    data: {
      contactName: 'Contato Categoria',
      contactPhone: `55${Date.now().toString().slice(-10)}`,
      assunto: 'Impressora nao imprime etiquetas',
      status: 'aberto',
      etapa: 'fila',
      canal: 'whatsapp',
      ...extra,
    },
  });
  limpeza.ticketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  await limparDados();
});

afterEach(async () => {
  await limparDados();
});

afterAll(async () => {
  await limparDados();
  await prisma.$disconnect();
});

describe('Categorias e Assuntos — CRUD', () => {
  it('1. cria categoria com slug gerado', async () => {
    const cat = await criarCategoriaTeste();
    expect(cat.id).toBeTruthy();
    expect(cat.slug).toContain('impressoras');
    expect(cat.ativo).toBe(true);
    expect(cat.cor).toBe('#f97316');
  });

  it('2. rejeita categoria com nome duplicado', async () => {
    const cat = await criarCategoriaTeste();
    await expect(criarCategoria({ nome: cat.nome })).rejects.toThrow('Ja existe categoria');
  });

  it('3. edita categoria (nome/cor/icone/departamento)', async () => {
    const cat = await criarCategoriaTeste();
    const atualizada = await atualizarCategoria(cat.id, { nome: `Novo Nome ${sufixo()}`, cor: '#ef4444', icone: 'database' });
    expect(atualizada.cor).toBe('#ef4444');
    expect(atualizada.icone).toBe('database');
    expect(atualizada.slug).not.toBe(cat.slug);
  });

  it('4. inativa e reativa categoria', async () => {
    const cat = await criarCategoriaTeste();
    const inativa = await inativarCategoria(cat.id, false);
    expect(inativa.ativo).toBe(false);
    const reativa = await inativarCategoria(cat.id, true);
    expect(reativa.ativo).toBe(true);
  });

  it('5. categoria com historico nao pode ser excluida fisicamente', async () => {
    const cat = await criarCategoriaTeste();
    await criarAssuntoTeste(cat.id);
    await expect(excluirCategoria(cat.id)).rejects.toThrow('historico');
    const lista = await listarCategorias({ incluirInativos: true });
    expect(lista.some((c) => c.id === cat.id)).toBe(true);
  });

  it('6. cria assunto vinculado a categoria', async () => {
    const cat = await criarCategoriaTeste();
    const asst = await criarAssuntoTeste(cat.id);
    expect(asst.categoriaId).toBe(cat.id);
    expect(asst.prioridadePadrao).toBe('alta');
    expect(asst.slaPadraoMin).toBe(240);
    const lista = await listarAssuntos({ categoriaId: cat.id });
    expect(lista.some((a) => a.id === asst.id)).toBe(true);
  });

  it('7. rejeita assunto com categoria inexistente', async () => {
    await expect(
      criarAssunto({ nome: `Sem categoria ${sufixo()}`, categoriaId: 'id-inexistente' })
    ).rejects.toThrow('Categoria nao encontrada');
  });

  it('8. edita e inativa assunto', async () => {
    const cat = await criarCategoriaTeste();
    const asst = await criarAssuntoTeste(cat.id);
    const editado = await atualizarAssunto(asst.id, { prioridadePadrao: 'urgente', slaPadraoMin: 120 });
    expect(editado.prioridadePadrao).toBe('urgente');
    const inativo = await inativarAssunto(asst.id, false);
    expect(inativo.ativo).toBe(false);
  });

  it('9. listarCategorias inclui contagem de tickets e assuntos', async () => {
    const cat = await criarCategoriaTeste();
    await criarAssuntoTeste(cat.id);
    await criarTicketTeste({ categoriaId: cat.id });
    const lista = await listarCategorias({ incluirInativos: true });
    const alvo = lista.find((c) => c.id === cat.id);
    expect(alvo?._count?.assuntos).toBeGreaterThanOrEqual(1);
    expect(alvo?._count?.tickets).toBeGreaterThanOrEqual(1);
  });
});

describe('Categorias e Assuntos — classificacao de ticket', () => {
  it('10. aplica categoria+assunto no ticket e registra evento + auditoria', async () => {
    const cat = await criarCategoriaTeste();
    const asst = await criarAssuntoTeste(cat.id);
    const ticket = await criarTicketTeste();

    const result = await aplicarClassificacao({
      ticketId: ticket.id,
      categoriaId: cat.id,
      assuntoId: asst.id,
      usuarioId: null,
      motivo: 'Classificacao inicial',
      origem: 'manual',
      ip: '127.0.0.1',
    });

    const atualizado = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(atualizado?.categoriaId).toBe(cat.id);
    expect(atualizado?.assuntoId).toBe(asst.id);
    expect(atualizado?.assunto).toBe(asst.nome);
    expect(atualizado?.categoria).toBe(cat.nome);

    const evento = await prisma.ticketEvent.findFirst({ where: { ticketId: ticket.id, tipo: 'classificacao_alterada' } });
    expect(evento).toBeTruthy();
    expect(evento?.descricao).toContain('Categoria:');

    const audit = await prisma.auditLog.findFirst({ where: { entidadeId: ticket.id, acao: 'classificar_ticket' } });
    expect(audit).toBeTruthy();
    if (audit?.id) limpeza.auditIds.push(audit.id);
  });

  it('11. altera categoria/assunto mantendo historico (antes -> depois)', async () => {
    const cat1 = await criarCategoriaTeste();
    const cat2 = await criarCategoriaTeste();
    const asst1 = await criarAssuntoTeste(cat1.id);
    const asst2 = await criarAssuntoTeste(cat2.id);
    const ticket = await criarTicketTeste({ categoriaId: cat1.id, assuntoId: asst1.id, categoria: cat1.nome, assunto: asst1.nome });

    await aplicarClassificacao({
      ticketId: ticket.id,
      categoriaId: cat2.id,
      assuntoId: asst2.id,
      usuarioId: null,
      origem: 'manual',
    });

    const eventos = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id, tipo: 'classificacao_alterada' } });
    expect(eventos.length).toBeGreaterThanOrEqual(1);
    const dados = JSON.parse(eventos[eventos.length - 1].dados || '{}');
    expect(dados.categoriaAnterior).toBe(cat1.nome);
    expect(dados.categoriaNova).toBe(cat2.nome);
    expect(dados.assuntoAnterior).toBe(asst1.nome);
    expect(dados.assuntoNova).toBe(asst2.nome);
  });

  it('12. rejeita assunto de outra categoria', async () => {
    const cat1 = await criarCategoriaTeste();
    const cat2 = await criarCategoriaTeste();
    const asst1 = await criarAssuntoTeste(cat1.id);
    const ticket = await criarTicketTeste();
    await expect(
      aplicarClassificacao({ ticketId: ticket.id, categoriaId: cat2.id, assuntoId: asst1.id })
    ).rejects.toThrow('nao pertence');
  });

  it('13. aplica categoria a partir do assunto quando nao informada', async () => {
    const cat = await criarCategoriaTeste();
    const asst = await criarAssuntoTeste(cat.id);
    const ticket = await criarTicketTeste();
    await aplicarClassificacao({ ticketId: ticket.id, assuntoId: asst.id });
    const atualizado = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(atualizado?.categoriaId).toBe(cat.id);
  });

  it('14. sugestao IA fallback regex retorna categoria/assunto', async () => {
    const cat = await criarCategoria({ nome: `Zebra Imprimir Etiqueta ${sufixo()}`, icone: 'printer' });
    limpeza.categoriaIds.push(cat.id);
    const asst = await criarAssunto({ nome: `Etiqueta Zebra ${sufixo()}`, categoriaId: cat.id });
    limpeza.assuntoIds.push(asst.id);
    const ticket = await criarTicketTeste();
    await prisma.message.create({
      data: { ticketId: ticket.id, content: 'minha impressora zebra nao imprime etiqueta', fromMe: false },
    });

    const sugestao = await sugerirClassificacao(ticket.id);
    expect(sugestao.metodo).toBe('regex');
    expect(sugestao.confianca).toBeGreaterThan(0);
    expect(sugestao.categoriaId || sugestao.assuntoId).toBeTruthy();
  });
});

describe('Categorias e Assuntos — config e regras', () => {
  it('15. config exigir_classificacao on/off', async () => {
    expect(await getExigirClassificacao()).toBe(false);
    await setExigirClassificacao(true);
    expect(await getExigirClassificacao()).toBe(true);
    await setExigirClassificacao(false);
    expect(await getExigirClassificacao()).toBe(false);
  });

  it('16. validarClassificacaoObrigatoria bloqueia ticket sem categoria/assunto', async () => {
    const cat = await criarCategoriaTeste();
    const asst = await criarAssuntoTeste(cat.id);
    const semClassificacao = await criarTicketTeste();
    const comClassificacao = await criarTicketTeste({ categoriaId: cat.id, assuntoId: asst.id });

    await setExigirClassificacao(true);
    await expect(validarClassificacaoObrigatoria(semClassificacao)).rejects.toThrow('CLASSIFICACAO_OBRIGATORIA');
    await expect(validarClassificacaoObrigatoria(comClassificacao)).resolves.toBeUndefined();
    await setExigirClassificacao(false);
    await expect(validarClassificacaoObrigatoria(semClassificacao)).resolves.toBeUndefined();
  });
});