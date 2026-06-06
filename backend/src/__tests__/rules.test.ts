import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('../config/database', () => ({
  default: {
    helpdeskRule: {
      findMany: mocks.findMany,
    },
  },
}));

import { classificarPorPalavrasChave, normalizarTexto } from '../modules/helpdesk/rules.service';

const REGRAS = [
  { id: 'r1', nome: 'Financeiro', categoria: 'financeiro', prioridade: 10, palavrasChave: 'boleto,fatura,pix,vencimento', ativo: true, ordem: 0 },
  { id: 'r2', nome: 'Suporte T\u00e9cnico', categoria: 'suporte_tecnico', prioridade: 20, palavrasChave: 'erro,nao funciona,bug,travando', ativo: true, ordem: 1 },
  { id: 'r3', nome: 'Comercial', categoria: 'comercial', prioridade: 30, palavrasChave: 'orcamento,proposta,plano,contratar', ativo: true, ordem: 2 },
];

describe('rules.service \u2014 classificarPorPalavrasChave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue(REGRAS);
  });

  it('retorna null para texto vazio ou muito curto', async () => {
    expect(await classificarPorPalavrasChave('')).toBeNull();
    expect(await classificarPorPalavrasChave('oi')).toBeNull();
    expect(await classificarPorPalavrasChave('  ')).toBeNull();
  });

  it('retorna null quando nao ha regras ativas', async () => {
    mocks.findMany.mockResolvedValue([]);
    expect(await classificarPorPalavrasChave('meu boleto venceu')).toBeNull();
  });

  it('classifica como financeiro quando contem "boleto"', async () => {
    const result = await classificarPorPalavrasChave('oi, preciso do meu boleto');
    expect(result).not.toBeNull();
    expect(result!.categoria).toBe('financeiro');
    expect(result!.regraNome).toBe('Financeiro');
    expect(result!.matchedKeyword).toBe('boleto');
  });

  it('classifica como suporte_tecnico quando contem "erro"', async () => {
    const result = await classificarPorPalavrasChave('estou com erro no sistema');
    expect(result).not.toBeNull();
    expect(result!.categoria).toBe('suporte_tecnico');
  });

  it('classifica como comercial quando contem "orcamento"', async () => {
    const result = await classificarPorPalavrasChave('gostaria de um orcamento');
    expect(result).not.toBeNull();
    expect(result!.categoria).toBe('comercial');
  });

  it('financeiro vence comercial quando ambos aparecem (prioridade menor)', async () => {
    const result = await classificarPorPalavrasChave('orcamento de boleto anual');
    expect(result).not.toBeNull();
    expect(result!.categoria).toBe('financeiro');
    expect(result!.prioridade).toBe(10);
  });

  it('e case-insensitive e ignora acentos', async () => {
    const r1 = await classificarPorPalavrasChave('BOLETO');
    expect(r1?.categoria).toBe('financeiro');
    const r2 = await classificarPorPalavrasChave('Erro no sistema');
    expect(r2?.categoria).toBe('suporte_tecnico');
    const r3 = await classificarPorPalavrasChave('or\u00e7amento especial');
    expect(r3?.categoria).toBe('comercial');
  });

  it('ignora palavras-chave muito curtas (< 3 chars)', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'r0', nome: 'Teste', categoria: 'outro', prioridade: 1, palavrasChave: 'a,de,em,erro,boleto', ativo: true, ordem: 0 },
    ]);
    const result = await classificarPorPalavrasChave('o sistema deu erro');
    expect(result?.categoria).toBe('outro');
    expect(result?.matchedKeyword).toBe('erro');
  });
});

describe('rules.service \u2014 normalizarTexto', () => {
  it('remove acentos e pontuacao, lowercase', () => {
    expect(normalizarTexto('Erro no Sistema!')).toBe('erro no sistema');
    expect(normalizarTexto('BOL\u00c3O VENCIDO')).toBe('bolao vencido');
    expect(normalizarTexto('Ol\u00e1, como vai?')).toBe('ola como vai');
  });
});
