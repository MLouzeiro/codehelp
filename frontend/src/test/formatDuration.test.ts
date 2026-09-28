import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDurationLong,
  formatDurationCompact,
  formatMinutesOriginal,
  formatDecimalHours,
  buildDuracaoTooltip,
  DURACAO_SEM_INFO,
} from '../lib/formatDuration';

describe('formatDuration — exemplos do documento', () => {
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
  it('null e undefined → Não informado', () => {
    expect(formatDuration(null)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(undefined)).toBe(DURACAO_SEM_INFO);
  });

  it('NaN e Infinity → Não informado', () => {
    expect(formatDuration(NaN)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(Infinity)).toBe(DURACAO_SEM_INFO);
    expect(formatDuration(-Infinity)).toBe(DURACAO_SEM_INFO);
  });

  it('negativos mantêm o sinal', () => {
    expect(formatDuration(-90)).toBe('-1h 30min');
    expect(formatDuration(-5)).toBe('-5 min');
  });

  it('decimais são arredondados para o minuto mais próximo', () => {
    expect(formatDuration(90.4)).toBe('1h 30min');
    expect(formatDuration(90.6)).toBe('1h 31min');
  });

  it('valores muito grandes não quebram', () => {
    expect(formatDuration(525600)).toBe('365 dias');
  });
});

describe('formatDurationLong — valor principal do card', () => {
  it('converte para linguagem humana', () => {
    expect(formatDurationLong(12840)).toBe('8 dias e 22 horas');
    expect(formatDurationLong(1440)).toBe('1 dia');
    expect(formatDurationLong(1500)).toBe('1 dia e 1 hora');
    expect(formatDurationLong(3125)).toBe('2 dias, 4 horas e 5 minutos');
    expect(formatDurationLong(480)).toBe('8 horas');
    expect(formatDurationLong(90)).toBe('1 hora e 30 minutos');
    expect(formatDurationLong(5)).toBe('5 min');
    expect(formatDurationLong(0)).toBe('0 min');
    expect(formatDurationLong(null)).toBe(DURACAO_SEM_INFO);
    expect(formatDurationLong(NaN)).toBe(DURACAO_SEM_INFO);
  });
});

describe('formatDurationCompact — tabelas', () => {
  it('gera formato curto', () => {
    // 4785 min = 3*1440 + 7*60 + 45 (o exemplo do documento dizia 7h25min, mas 4785 = 3d 7h 45min)
    expect(formatDurationCompact(4785)).toBe('3d 7h 45min');
    expect(formatDurationCompact(41)).toBe('41min');
    expect(formatDurationCompact(1440)).toBe('1d');
    expect(formatDurationCompact(0)).toBe('0min');
    expect(formatDurationCompact(null)).toBe(DURACAO_SEM_INFO);
  });
});

describe('formatMinutesOriginal — valor técnico preservado', () => {
  it('mantém o valor original com separador pt-BR', () => {
    expect(formatMinutesOriginal(12840)).toBe('12.840 minutos');
    expect(formatMinutesOriginal(4785)).toBe('4.785 minutos');
    expect(formatMinutesOriginal(1)).toBe('1 minuto');
    expect(formatMinutesOriginal(0)).toBe('0 minutos');
    expect(formatMinutesOriginal(null)).toBe(DURACAO_SEM_INFO);
  });
});

describe('formatDecimalHours — horas decimais', () => {
  it('converte minutos em horas decimais', () => {
    expect(formatDecimalHours(12840)).toBe('214 horas');
    expect(formatDecimalHours(90)).toBe('1,5 horas');
    expect(formatDecimalHours(60)).toBe('1 hora');
    expect(formatDecimalHours(0)).toBe('0 horas');
    expect(formatDecimalHours(null)).toBe(DURACAO_SEM_INFO);
  });
});

describe('buildDuracaoTooltip — explicação do indicador', () => {
  it('inclui definição, valor original e conversão', () => {
    const tooltip = buildDuracaoTooltip('Tempo Total de Atendimento', 12840);
    expect(tooltip).toContain('soma do tempo de atendimento dos chamados');
    expect(tooltip).toContain('Valor original: 12.840 minutos');
    expect(tooltip).toContain('Conversão: 8 dias e 22 horas');
    expect(tooltip).toContain('Horas decimais: 214 horas');
  });

  it('sem informação não gera NaN', () => {
    const tooltip = buildDuracaoTooltip('Tempo Total de Atendimento', null);
    expect(tooltip).not.toContain('NaN');
    expect(tooltip).toContain(DURACAO_SEM_INFO);
  });
});

describe('consistência — o valor original nunca é perdido', () => {
  it('conversão é matemática e reversível (minutos = dias*1440 + h*60 + min)', () => {
    const valores = [5, 60, 90, 1440, 1500, 2000, 2850, 2880, 10000, 12840];
    for (const v of valores) {
      const texto = formatDuration(v);
      const dias = /(\d+) dias?/.exec(texto);
      const horas = /(\d+)h/.exec(texto);
      const mins = /(\d+)\s*min/.exec(texto);
      const total =
        (dias ? parseInt(dias[1], 10) * 1440 : 0) +
        (horas ? parseInt(horas[1], 10) * 60 : 0) +
        (mins ? parseInt(mins[1], 10) : 0);
      expect(total).toBe(v);
    }
  });
});
