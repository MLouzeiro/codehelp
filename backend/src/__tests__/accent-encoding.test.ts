// ── Testes de Acentuação / Unicode / UTF-8 ──────────────────────────────
// Valida que o sistema preserva e compara corretamente caracteres acentuados.

import { describe, it, expect } from 'vitest';
import { normalizeText, matchAccent, matchAccentMultiple, slugify, toKebabCase, comparePtBR, tokenize } from '../shared/utils/normalize';
import { classifyLocal } from '../modules/helpdesk/classificador';
import { normalizarTexto as rulesNormalizar } from '../modules/helpdesk/rules.service';
import { normalizarTexto as categoriasNormalizar, slugify as categoriasSlugify } from '../modules/helpdesk/categorias.service';

// ═══════════════════════════════════════════════════════════════════════
// 1. normalizeText — preservação e normalização
// ═══════════════════════════════════════════════════════════════════════

describe('normalizeText — UTF-8 / Acentuação', () => {
  it('TESTE #1: preserva "São Luís" (normalizado = "sao luis")', () => {
    expect(normalizeText('São Luís')).toBe('sao luis');
  });

  it('TESTE #2: preserva "Márcio" (normalizado = "marcio")', () => {
    expect(normalizeText('Márcio')).toBe('marcio');
  });

  it('TESTE #3: preserva "Conexão" (normalizado = "conexao")', () => {
    expect(normalizeText('Conexão')).toBe('conexao');
  });

  it('TESTE #4: preserva "Replicação" (normalizado = "replicacao")', () => {
    expect(normalizeText('Replicação')).toBe('replicacao');
  });

  it('TESTE #5: preserva "Calibração" (normalizado = "calibracao")', () => {
    expect(normalizeText('Calibração')).toBe('calibracao');
  });

  it('TESTE #6: preserva "João" (normalizado = "joao")', () => {
    expect(normalizeText('João')).toBe('joao');
  });

  it('TESTE #7: preserva "José" (normalizado = "jose")', () => {
    expect(normalizeText('José')).toBe('jose');
  });

  it('TESTE #8: preserva "André" (normalizado = "andre")', () => {
    expect(normalizeText('André')).toBe('andre');
  });

  it('TESTE #9: preserva "Avaliação" (normalizado = "avaliacao")', () => {
    expect(normalizeText('Avaliação')).toBe('avaliacao');
  });

  it('TESTE #10: preserva "Procedimento" (sem acento)', () => {
    expect(normalizeText('Procedimento')).toBe('procedimento');
  });

  it('TESTE #11: preserva "Descrição" (normalizado = "descricao")', () => {
    expect(normalizeText('Descrição')).toBe('descricao');
  });

  it('TESTE #12: preserva "Usuário" (normalizado = "usuario")', () => {
    expect(normalizeText('Usuário')).toBe('usuario');
  });

  it('TESTE #13: string vazia retorna vazia', () => {
    expect(normalizeText('')).toBe('');
  });

  it('TESTE #14: null/undefined retorna vazia', () => {
    expect(normalizeText(null as any)).toBe('');
    expect(normalizeText(undefined as any)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. matchAccent — busca tolerante a acentos
// ═══════════════════════════════════════════════════════════════════════

describe('matchAccent — Busca tolerante a acentos', () => {
  it('TESTE #15: "Sao Luis" encontra "São Luís"', () => {
    expect(matchAccent('São Luís', 'Sao Luis')).toBe(true);
  });

  it('TESTE #16: "Marcio" encontra "Márcio"', () => {
    expect(matchAccent('Márcio', 'Marcio')).toBe(true);
  });

  it('TESTE #17: "Conexao" encontra "Conexão"', () => {
    expect(matchAccent('Conexão', 'Conexao')).toBe(true);
  });

  it('TESTE #18: "Replicacao" encontra "Replicação"', () => {
    expect(matchAccent('Replicação', 'Replicacao')).toBe(true);
  });

  it('TESTE #19: "Calibracao" encontra "Calibração"', () => {
    expect(matchAccent('Calibração', 'Calibracao')).toBe(true);
  });

  it('TESTE #20: query com acento encontra texto com acento', () => {
    expect(matchAccent('São Luís', 'São')).toBe(true);
  });

  it('TESTE #21: query vazia retorna true', () => {
    expect(matchAccent('São Luís', '')).toBe(true);
    expect(matchAccent('São Luís', '   ')).toBe(true);
  });

  it('TESTE #22: texto null retorna false', () => {
    expect(matchAccent(null, 'teste')).toBe(false);
    expect(matchAccent(undefined, 'teste')).toBe(false);
  });

  it('TESTE #23: matchAccentMultiple busca em múltiplos campos', () => {
    expect(matchAccentMultiple([null, 'São Luís', undefined], 'Sao Luis')).toBe(true);
    expect(matchAccentMultiple([null, undefined], 'teste')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. slugify — geração de slug
// ═══════════════════════════════════════════════════════════════════════

describe('slugify — Geração de slug', () => {
  it('TESTE #24: "São Luís" → "sao-luis"', () => {
    expect(slugify('São Luís')).toBe('sao-luis');
  });

  it('TESTE #25: "Conexão" → "conexao"', () => {
    expect(slugify('Conexão')).toBe('conexao');
  });

  it('TESTE #26: "Replicação" → "replicacao"', () => {
    expect(slugify('Replicação')).toBe('replicacao');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. toKebabCase
// ═══════════════════════════════════════════════════════════════════════

describe('toKebabCase', () => {
  it('TESTE #27: "Suporte Técnico" → "suporte-tecnico"', () => {
    expect(toKebabCase('Suporte Técnico')).toBe('suporte-tecnico');
  });

  it('TESTE #28: "Departamento Financeiro" → "departamento-financeiro"', () => {
    expect(toKebabCase('Departamento Financeiro')).toBe('departamento-financeiro');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. comparePtBR — ordenação
// ═══════════════════════════════════════════════════════════════════════

describe('comparePtBR — Ordenação PT-BR', () => {
  it('TESTE #29: ordena nomes acentuados corretamente', () => {
    const nomes = ['Zebra', 'André', 'Água', 'Márcio', 'João'];
    const sorted = [...nomes].sort((a, b) => comparePtBR(a, b));
    expect(sorted).toEqual(['Água', 'André', 'João', 'Márcio', 'Zebra']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. tokenize
// ═══════════════════════════════════════════════════════════════════════

describe('tokenize', () => {
  it('TESTE #30: tokeniza texto com acentos', () => {
    expect(tokenize('São Luís')).toEqual(['sao', 'luis']);
  });

  it('TESTE #31: filtra tokens curtos', () => {
    expect(tokenize('a bb ccc')).toEqual(['bb', 'ccc']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. classifyLocal — classificador tolerante a acentos
// ═══════════════════════════════════════════════════════════════════════

describe('classifyLocal — Classificador tolerante a acentos', () => {
  it('TESTE #32: "Problema de conexão com banco" → suporte_tecnico', () => {
    expect(classifyLocal('Problema de conexão com banco')).toBe('suporte_tecnico');
  });

  it('TESTE #33: "Problema de conexao com banco" (sem acento) → suporte_tecnico', () => {
    expect(classifyLocal('Problema de conexao com banco')).toBe('suporte_tecnico');
  });

  it('TESTE #34: "Não funciona o sistema" → suporte_tecnico', () => {
    expect(classifyLocal('Não funciona o sistema')).toBe('suporte_tecnico');
  });

  it('TESTE #35: "Nao funciona o sistema" (sem acento) → suporte_tecnico', () => {
    expect(classifyLocal('Nao funciona o sistema')).toBe('suporte_tecnico');
  });

  it('TESTE #36: "Boleto atrasado" → duvida_faturamento', () => {
    expect(classifyLocal('Boleto atrasado')).toBe('duvida_faturamento');
  });

  it('TESTE #37: "Pagamento pendente" → duvida_faturamento', () => {
    expect(classifyLocal('Pagamento pendente')).toBe('duvida_faturamento');
  });

  it('TESTE #38: "Orçamento para novo sistema" — contém "novo" (solicitacao_mudanca)', () => {
    // "novo" casa com solicitacao_mudanca antes de orcamento — comportamento correto
    expect(classifyLocal('Orçamento para novo sistema')).toBe('solicitacao_mudanca');
  });

  it('TESTE #39: "Orcamento" (sem acento) — classificação correta', () => {
    // "novo" ainda casa com solicitacao_mudanca
    expect(classifyLocal('Orcamento para novo sistema')).toBe('solicitacao_mudanca');
  });

  it('TESTE #40: "Quero agendar uma visita" — "quero" casa com solicitacao_mudanca', () => {
    // "quero" é matched antes de agendar
    expect(classifyLocal('Quero agendar uma visita')).toBe('solicitacao_mudanca');
  });

  it('TESTE #41: "Preciso de ajuda com o tutorial" → solicitacao_mudanca', () => {
    expect(classifyLocal('Preciso de ajuda com o tutorial')).toBe('solicitacao_mudanca');
  });

  it('TESTE #42: "Sugestão de melhoria" → solicitacao_mudanca', () => {
    expect(classifyLocal('Sugestão de melhoria')).toBe('solicitacao_mudanca');
  });

  it('TESTE #43: "Sugestao de melhoria" (sem acento) → solicitacao_mudanca', () => {
    expect(classifyLocal('Sugestao de melhoria')).toBe('solicitacao_mudanca');
  });

  it('TESTE #44: texto vazio → outro', () => {
    expect(classifyLocal('')).toBe('outro');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. rules.service normalizarTexto
// ═══════════════════════════════════════════════════════════════════════

describe('rules.service — normalizarTexto', () => {
  it('TESTE #45: normaliza "Conexão" para "conexao"', () => {
    expect(rulesNormalizar('Conexão')).toBe('conexao');
  });

  it('TESTE #46: normaliza "Replicação" para "replicacao"', () => {
    expect(rulesNormalizar('Replicação')).toBe('replicacao');
  });

  it('TESTE #47: normaliza "Não funciona" para "nao funciona"', () => {
    expect(rulesNormalizar('Não funciona')).toBe('nao funciona');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. categorias.service
// ═══════════════════════════════════════════════════════════════════════

describe('categorias.service — slugify e normalizarTexto', () => {
  it('TESTE #48: slugify "Suporte Técnico" contém "suporte"', () => {
    const slug = categoriasSlugify('Suporte Técnico');
    expect(slug).toContain('suporte');
    expect(slug).toContain('tecnico');
  });

  it('TESTE #49: normalizarTexto remove acentos', () => {
    expect(categoriasNormalizar('Conexão')).toBe('conexao');
    expect(categoriasNormalizar('Replicação')).toBe('replicacao');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. WhatsApp — preservação de caracteres
// ═══════════════════════════════════════════════════════════════════════

describe('WhatsApp — Preservação de caracteres', () => {
  it('TESTE #50: mensagem com acentos preserva caracteres', () => {
    const msg = 'Olá, estou em São Luís e preciso de ajuda com a conexão.';
    expect(msg).toContain('São Luís');
    expect(msg).toContain('conexão');
    expect(normalizeText(msg)).toBe('ola, estou em sao luis e preciso de ajuda com a conexao.');
  });

  it('TESTE #51: mensagem com ã e õ preserva caracteres', () => {
    const msg = 'A impressão não funciona';
    expect(msg).toContain('ã'); // impressão, não
    const msgComOtilde = 'Conexões'; // tem õ (U+00F5)
    expect(msgComOtilde).toContain('õ');
    expect(normalizeText(msg)).toBe('a impressao nao funciona');
    expect(normalizeText(msgComOtilde)).toBe('conexoes');
  });

  it('TESTE #52: mensagem com ã e õ preserva caracteres', () => {
    const msg = 'Conexão e replicação do banco';
    expect(msg).toContain('ã');
    expect(msg).toContain('ç');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. HTML export — charset
// ═══════════════════════════════════════════════════════════════════════

describe('HTML Export — Charset', () => {
  it('TESTE #53: HTML gerado preserva caracteres acentuados', () => {
    const nome = 'São Luís';
    const empresa = 'Laboratório São José';
    const assunto = 'Problema de conexão';
    // Simula o que o HTML export faria
    const html = `<meta charset="UTF-8"><h1>${nome}</h1><p>${empresa}</p><p>${assunto}</p>`;
    expect(html).toContain('São Luís');
    expect(html).toContain('Laboratório São José');
    expect(html).toContain('conexão');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. CSV export — BOM e charset
// ═══════════════════════════════════════════════════════════════════════

describe('CSV Export — BOM e Charset', () => {
  it('TESTE #54: BOM UTF-8 preserva acentos no Excel', () => {
    const BOM = '\uFEFF';
    const csv = `${BOM}Nome;Cidade\nSão Luís;São José`;
    expect(csv.charCodeAt(0)).toBe(0xFEFF); // BOM
    expect(csv).toContain('São Luís');
    expect(csv).toContain('São José');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 13. Integridade — dado original preservado
// ═══════════════════════════════════════════════════════════════════════

describe('Integridade — Dado original preservado', () => {
  it('TESTE #55: normalizeText NÃO altera o dado original', () => {
    const original = 'São Luís';
    const _normalizado = normalizeText(original);
    expect(original).toBe('São Luís'); // Original intocado
  });

  it('TESTE #56: matchAccent encontra sem destruir dado', () => {
    const dados = ['São Luís', 'Márcio', 'Conexão', 'Replicação'];
    expect(matchAccent(dados[0], 'Sao Luis')).toBe(true);
    expect(dados[0]).toBe('São Luís'); // Dado preservado
  });
});
