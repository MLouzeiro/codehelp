import { describe, it, expect } from 'vitest';
import { extrairNotaAvaliacao } from '../modules/helpdesk/flow.service';
import { detectarOpcaoMenu } from '../modules/helpdesk/menu';

describe('Normalização de mensagens interativas', () => {
  describe('extrairNotaAvaliacao — IDs rating_N (lista interativa CSAT)', () => {
    it('extrai nota 1 a 5 a partir de rating_1..rating_5', () => {
      expect(extrairNotaAvaliacao('rating_1')).toBe(1);
      expect(extrairNotaAvaliacao('rating_2')).toBe(2);
      expect(extrairNotaAvaliacao('rating_3')).toBe(3);
      expect(extrairNotaAvaliacao('rating_4')).toBe(4);
      expect(extrairNotaAvaliacao('rating_5')).toBe(5);
    });

    it('extrai nota a partir do ID legado avaliacao_N', () => {
      expect(extrairNotaAvaliacao('avaliacao_3')).toBe(3);
      expect(extrairNotaAvaliacao('avaliacao_5')).toBe(5);
    });

    it('aceita numeros simples e textos com estrela/nota', () => {
      expect(extrairNotaAvaliacao('4')).toBe(4);
      expect(extrairNotaAvaliacao('3 - Bom')).toBe(3);
      expect(extrairNotaAvaliacao('⭐ 5')).toBe(5);
    });

    it('retorna null para valores fora do range 1-5', () => {
      expect(extrairNotaAvaliacao('rating_0')).toBeNull();
      expect(extrairNotaAvaliacao('rating_6')).toBeNull();
      expect(extrairNotaAvaliacao('dept_suporte')).toBeNull();
      expect(extrairNotaAvaliacao('')).toBeNull();
    });
  });

  describe('detectarOpcaoMenu — IDs dept_<slug> (lista interativa de departamentos)', () => {
    it('reconhece dept_<slug> como opcao de menu', () => {
      expect(detectarOpcaoMenu('dept_suporte-tecnico')).toBe('dept_suporte-tecnico');
      expect(detectarOpcaoMenu('dept_comercial')).toBe('dept_comercial');
      expect(detectarOpcaoMenu('dept_desenvolvimento')).toBe('dept_desenvolvimento');
      expect(detectarOpcaoMenu('dept_demandas-internas')).toBe('dept_demandas-internas');
    });

    it('reconhece dept_<id> (UUID) como opcao de menu', () => {
      const id = 'ab4a4a63-f85e-485d-9d20-669ed15a1e59';
      expect(detectarOpcaoMenu(`dept_${id}`)).toBe(`dept_${id}`);
    });

    it('mantem compatibilidade com numeros e nomes', () => {
      expect(detectarOpcaoMenu('2')).toBe('2');
      expect(detectarOpcaoMenu('Suporte Técnico')).toBe('Suporte Técnico');
    });

    it('nao trata textos longos como opcao de menu', () => {
      const descricaoProblema = 'Preciso de ajuda com um problema bem longo e detalhado que descreve uma situação complicada no sistema.';
      expect(detectarOpcaoMenu(descricaoProblema)).toBeNull();
    });
  });
});
