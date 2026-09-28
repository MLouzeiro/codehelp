import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDurationLong,
  formatDurationCompact,
  formatMinutesOriginal,
  formatDecimalHours,
  buildDuracaoTooltip,
  DURACAO_SEM_INFO,
} from '../shared/utils/duration';

describe('formatDuration — conversão minutos → humano', () => {
  const casos: Array<[number, string]> = [
    [0, '0 min'],
    [1, '1 min'],
    [5, '5 min'],
    [30, '30 min'],
    [45, '45 min'],
    [59, '59 min'],
    [60, '1h'],
    [61, '1h 1min'],
    [90, '1h 30min'],
    [120, '2h'],
    [180, '3h'],
    [480, '8h'],
    [600, '10h'],
    [1439, '23h 59min'],
    [1440, '1 dia'],
    [1441, '1 dia 1min'],
    [1500, '1 dia 1h'],
    [2000, '1 dia 9h 20min'],
    [2850, '1 dia 23h 30min'],
    [2880, '2 dias'],
    [3060, '2 dias 3h'],
    [3125, '2 dias 4h 5min'],
    [10000, '6 dias 22h 40min'],
    [12840, '8 dias 22h'],
  ];

  for (const [minutos, esperado] of casos) {
    it(`${minutos} → ${esperado}`, () => {
      expect(formatDuration(minutos)).toBe(esperado);
    });
  }
});

describe('formatDuration — casos especiais', () => {
  it('null/undefined/NaN/Infinity → Não informado', () => {
    expect(formatDuration(null)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(undefined)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(NaN)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(Infinity)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(-Infinity)).toBe(DURACAO_SEM_INFO);
  });

  it('negativos preservam o sinal', () => {
    expect(formatDuration(-90)).toBe('-1h 30min');
  });

  it('decimais são arredondados sem perder a ordem de grandeza', () => {
    expect(formatDuration(90.4)).toBe('1h 30min');
    expect(formatDuration(90.6)).toBe('1h 31min');
  });
});

describe('formatDurationLong — apresentação principal', () => {
  it('gera texto humano', () => {
    expect(formatDurationLong(12840)).toBe('8 dias e 22 horas');
    expect(formatDurationLong(1440)).toBe('1 dia');
    expect(formatDurationLong(480)).toBe('8 horas');
    expect(formatDurationLong(5)).toBe('5 min');
    expect(formatDurationLong(0)).toBe('0 min');
    expect(formatDurationLong(null)).toBe(DURACAO_SEM_INFO);
  });
});

describe('formatDurationCompact / formatMinutesOriginal / formatDecimalHours', () => {
  it('formato compacto para tabelas', () => {
    expect(formatDurationCompact(4785)).toBe('3d 7h 45min');
    expect(formatDurationCompact(41)).toBe('41min');
    expect(formatDurationCompact(1440)).toBe('1d');
    expect(formatDurationCompact(null)).toBe(DURACAO_SEM_INFO);
  });

  it('valor técnico original preservado', () => {
    expect(formatMinutesOriginal(12840)).toBe('12.840 minutos');
    expect(formatMinutesOriginal(1)).toBe('1 minuto');
    expect(formatMinutesOriginal(null)).toBe(DURACAO_SEM_INFO);
  });

  it('horas decimais para análise gerencial', () => {
    expect(formatDecimalHours(12840)).toBe('214 horas');
    expect(formatDecimalHours(90)).toBe('1,5 horas');
    expect(formatDecimalHours(null)).toBe(DURACAO_SEM_INFO);
  });
});

describe('buildDuracaoTooltip — explicação do indicador', () => {
  it('inclui definição, valor original e conversão', () => {
    const t = buildDuracaoTooltip('Tempo Total de Atendimento', 12840);
    expect(t).toContain('soma do tempo de atendimento dos chamados');
    expect(t).toContain('Valor original: 12.840 minutos');
    expect(t).toContain('Conversão: 8 dias e 22 horas');
  });
});
