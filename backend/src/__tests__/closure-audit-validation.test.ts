import { describe, it, expect } from 'vitest';
import { parseFiltro } from '../modules/helpdesk/closureAudit.controller';

function makeReq(query: Record<string, any>): any {
  return { query };
}

describe('Segurança/validação closure-audit (FASE 12 — Fase F, TESTE #34)', () => {
  it('parseFiltro aceita filtros válidos e converte datas', () => {
    const f = parseFiltro(makeReq({
      dataInicio: '2026-08-01',
      dataFim: '2026-08-15',
      assigneeId: 'user-1',
      clienteId: 'cli-1',
      limit: '50',
    }));
    expect(f.dataInicio).toBeInstanceOf(Date);
    expect(f.dataFim).toBeInstanceOf(Date);
    expect(f.assigneeId).toBe('user-1');
    expect(f.clienteId).toBe('cli-1');
    expect(f.limit).toBe(50);
  });

  it('rejeita dataInicio inválida', () => {
    expect(() => parseFiltro(makeReq({ dataInicio: 'invalida' }))).toThrow(/dataInicio/);
  });

  it('rejeita dataFim inválida', () => {
    expect(() => parseFiltro(makeReq({ dataFim: 'not-a-date' }))).toThrow(/dataFim/);
  });

  it('rejeita limit fora do intervalo 1..1000', () => {
    expect(() => parseFiltro(makeReq({ limit: '0' }))).toThrow(/limit/);
    expect(() => parseFiltro(makeReq({ limit: '1001' }))).toThrow(/limit/);
    expect(() => parseFiltro(makeReq({ limit: 'abc' }))).toThrow(/limit/);
  });

  it('aceita limite 1 e 1000', () => {
    expect(parseFiltro(makeReq({ limit: '1' })).limit).toBe(1);
    expect(parseFiltro(makeReq({ limit: '1000' })).limit).toBe(1000);
  });

  it('retorna campos undefined quando não informados', () => {
    const f = parseFiltro(makeReq({}));
    expect(f.dataInicio).toBeUndefined();
    expect(f.limit).toBeUndefined();
    expect(f.assigneeId).toBeUndefined();
  });
});