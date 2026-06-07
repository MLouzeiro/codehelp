import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../config/database';
import {
  listarFeriados,
  obterFeriadoPorId,
  criarFeriado,
  atualizarFeriado,
  deletarFeriado,
  ehFeriado,
  seedFeriadosNacionais,
} from '../modules/feriados/feriados.service';

async function limparFeriados() {
  await prisma.feriado.deleteMany({});
}

describe('Feriados Service (E1 Triagem)', () => {
  beforeEach(async () => {
    await limparFeriados();
  });
  afterEach(async () => {
    await limparFeriados();
  });

  describe('listarFeriados', () => {
    it('retorna lista vazia quando nao ha feriados cadastrados', async () => {
      const result = await listarFeriados();
      expect(result).toEqual([]);
    });

    it('retorna apenas feriados ativos quando ativo=true', async () => {
      await prisma.feriado.create({
        data: { data: new Date('2026-12-25'), nome: 'Natal', tipo: 'nacional', ativo: true },
      });
      await prisma.feriado.create({
        data: { data: new Date('2026-11-02'), nome: 'Finados (antigo)', tipo: 'nacional', ativo: false },
      });
      const ativos = await listarFeriados(true);
      expect(ativos).toHaveLength(1);
      expect(ativos[0].nome).toBe('Natal');
    });

    it('retorna todos (ativos e inativos) quando ativo=false', async () => {
      await prisma.feriado.create({
        data: { data: new Date('2026-12-25'), nome: 'Natal', tipo: 'nacional', ativo: true },
      });
      await prisma.feriado.create({
        data: { data: new Date('2026-11-02'), nome: 'Finados', tipo: 'nacional', ativo: false },
      });
      const todos = await listarFeriados(false);
      expect(todos).toHaveLength(2);
    });

    it('ordena por data ascendente', async () => {
      await prisma.feriado.create({ data: { data: new Date('2026-12-25'), nome: 'Natal' } });
      await prisma.feriado.create({ data: { data: new Date('2026-01-01'), nome: 'Confraternizacao' } });
      const result = await listarFeriados();
      expect(result[0].nome).toBe('Confraternizacao');
      expect(result[1].nome).toBe('Natal');
    });
  });

  describe('obterFeriadoPorId', () => {
    it('retorna o feriado correto', async () => {
      const criado = await prisma.feriado.create({
        data: { data: new Date('2026-12-25'), nome: 'Natal' },
      });
      const result = await obterFeriadoPorId(criado.id);
      expect(result?.nome).toBe('Natal');
    });

    it('retorna null quando nao existe', async () => {
      const result = await obterFeriadoPorId('id-inexistente');
      expect(result).toBeNull();
    });
  });

  describe('criarFeriado', () => {
    it('cria feriado com data, nome e tipo', async () => {
      const result = await criarFeriado({
        data: new Date('2026-12-25'),
        nome: 'Natal',
        tipo: 'nacional',
      });
      expect(result.nome).toBe('Natal');
      expect(result.tipo).toBe('nacional');
      expect(result.ativo).toBe(true);
    });

    it('recorrente padrao e false', async () => {
      const result = await criarFeriado({ data: new Date('2026-04-21'), nome: 'Tiradentes' });
      expect(result.recorrente).toBe(false);
    });

    it('rejeita nome vazio', async () => {
      await expect(criarFeriado({ data: new Date('2026-12-25'), nome: '' })).rejects.toThrow(/nome/i);
    });

    it('rejeita data invalida', async () => {
      await expect(criarFeriado({ data: new Date('data-invalida'), nome: 'Teste' })).rejects.toThrow(/data/i);
    });
  });

  describe('atualizarFeriado', () => {
    it('atualiza nome', async () => {
      const criado = await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal' });
      const updated = await atualizarFeriado(criado.id, { nome: 'Natal (atualizado)' });
      expect(updated.nome).toBe('Natal (atualizado)');
    });

    it('atualiza ativo', async () => {
      const criado = await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal' });
      const updated = await atualizarFeriado(criado.id, { ativo: false });
      expect(updated.ativo).toBe(false);
    });

    it('lança erro se feriado nao existe', async () => {
      await expect(atualizarFeriado('id-inexistente', { nome: 'X' })).rejects.toThrow(/não encontrado/i);
    });
  });

  describe('deletarFeriado', () => {
    it('remove o feriado', async () => {
      const criado = await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal' });
      await deletarFeriado(criado.id);
      const result = await obterFeriadoPorId(criado.id);
      expect(result).toBeNull();
    });
  });

  describe('ehFeriado', () => {
    it('retorna true quando a data exata esta cadastrada', async () => {
      await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal', recorrente: false });
      expect(await ehFeriado(new Date('2026-12-25'))).toBe(true);
    });

    it('retorna false quando a data nao e feriado', async () => {
      await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal' });
      expect(await ehFeriado(new Date('2026-06-15'))).toBe(false);
    });

    it('retorna true em qualquer ano se recorrente=true', async () => {
      await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal', recorrente: true });
      expect(await ehFeriado(new Date('2027-12-25'))).toBe(true);
      expect(await ehFeriado(new Date('2030-12-25'))).toBe(true);
    });

    it('ignora feriados com ativo=false', async () => {
      await criarFeriado({ data: new Date('2026-12-25'), nome: 'Natal', ativo: false });
      expect(await ehFeriado(new Date('2026-12-25'))).toBe(false);
    });
  });

  describe('seedFeriadosNacionais', () => {
    it('insere os feriados nacionais padrao', async () => {
      const count = await seedFeriadosNacionais();
      expect(count).toBeGreaterThanOrEqual(8);
      const lista = await listarFeriados();
      const nomes = lista.map((f) => f.nome);
      expect(nomes).toContain('Confraternização Universal');
      expect(nomes).toContain('Natal');
    });

    it('idempotente: nao duplica se rodado 2x', async () => {
      await seedFeriadosNacionais();
      const count2 = await seedFeriadosNacionais();
      const total = await prisma.feriado.count();
      expect(count2).toBe(0);
      expect(total).toBeGreaterThanOrEqual(8);
    });
  });
});
