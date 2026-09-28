/**
 * Função central de formatação de duração (minutos → texto humano).
 *
 * Regras:
 * - A fonte matemática continua sendo MINUTOS (banco/API inalterados).
 * - 60 min = 1h, 1440 min = 1 dia (duração cronológica, 1 dia = 24h).
 * - Nunca arredonda de forma que altere o valor real (usa arredondamento para o minuto mais próximo).
 * - Nunca exibe NaN, Infinity ou undefined na interface.
 *
 * Exemplos:
 * 5 → "5 min" | 60 → "1h" | 90 → "1h 30min" | 1440 → "1 dia"
 * 1500 → "1 dia 1h" | 2850 → "1 dia 23h 30min" | 12840 → "8 dias 22h"
 */

const MINUTOS_POR_DIA = 1440;

export const DURACAO_SEM_INFO = 'Não informado';

function normalizar(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function partes(value: number): { dias: number; horas: number; mins: number } {
  const abs = Math.abs(value);
  return {
    dias: Math.floor(abs / MINUTOS_POR_DIA),
    horas: Math.floor((abs % MINUTOS_POR_DIA) / 60),
    mins: abs % 60,
  };
}

/**
 * Formato inteligente (padrão).
 * 0 → "0 min" | 5 → "5 min" | 90 → "1h 30min" | 12840 → "8 dias 22h"
 */
export function formatDuration(minutes: number | null | undefined): string {
  const m = normalizar(minutes);
  if (m === null) return DURACAO_SEM_INFO;
  if (m < 0) return `-${formatDuration(-m)}`;
  if (m === 0) return '0 min';

  const { dias, horas, mins } = partes(m);
  const out: string[] = [];
  if (dias > 0) out.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  if (horas > 0) out.push(`${horas}h`);
  if (mins > 0) out.push(dias > 0 || horas > 0 ? `${mins}min` : `${mins} min`);
  return out.length > 0 ? out.join(' ') : '0 min';
}

/**
 * Formato extenso (valor principal de card / indicador).
 * 12840 → "8 dias e 22 horas" | 480 → "8 horas" | 90 → "1 hora e 30 minutos"
 * 5 → "5 min" | 0 → "0 min"
 */
export function formatDurationLong(minutes: number | null | undefined): string {
  const m = normalizar(minutes);
  if (m === null) return DURACAO_SEM_INFO;
  if (m < 0) return `-${formatDurationLong(-m)}`;
  if (m === 0) return '0 min';
  if (m < 60) return `${m} min`;

  const { dias, horas, mins } = partes(m);
  const out: string[] = [];
  if (dias > 0) out.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  if (horas > 0) out.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`);
  if (mins > 0) out.push(`${mins} ${mins === 1 ? 'minuto' : 'minutos'}`);
  if (out.length === 0) return '0 min';
  if (out.length === 1) return out[0];
  if (out.length === 2) return `${out[0]} e ${out[1]}`;
  return `${out.slice(0, -1).join(', ')} e ${out[out.length - 1]}`;
}

/**
 * Formato compacto para tabelas.
 * 4785 → "3d 7h 25min" | 41 → "41min" | 1440 → "1d"
 */
export function formatDurationCompact(minutes: number | null | undefined): string {
  const m = normalizar(minutes);
  if (m === null) return DURACAO_SEM_INFO;
  if (m < 0) return `-${formatDurationCompact(-m)}`;
  if (m === 0) return '0min';

  const { dias, horas, mins } = partes(m);
  const out: string[] = [];
  if (dias > 0) out.push(`${dias}d`);
  if (horas > 0) out.push(`${horas}h`);
  if (mins > 0) out.push(`${mins}min`);
  return out.length > 0 ? out.join(' ') : '0min';
}

/**
 * Valor técnico original preservado, com separador de milhar pt-BR.
 * 12840 → "12.840 minutos"
 */
export function formatMinutesOriginal(minutes: number | null | undefined): string {
  const m = normalizar(minutes);
  if (m === null) return DURACAO_SEM_INFO;
  const abs = Math.abs(m);
  const texto = `${abs.toLocaleString('pt-BR')} ${abs === 1 ? 'minuto' : 'minutos'}`;
  return m < 0 ? `-${texto}` : texto;
}

/**
 * Horas decimais (informação secundária para análise gerencial).
 * 12840 → "214 horas" | 90 → "1,5 horas"
 */
export function formatDecimalHours(minutes: number | null | undefined): string {
  const m = normalizar(minutes);
  if (m === null) return DURACAO_SEM_INFO;
  const horas = m / 60;
  const texto = horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${texto} ${Math.abs(horas) === 1 ? 'hora' : 'horas'}`;
}

/**
 * Tooltip explicativo do indicador de tempo total.
 * Inclui definição, valor original em minutos e conversão humana.
 */
export function buildDuracaoTooltip(label: string, minutes: number | null | undefined): string {
  const definicao = `${label} representa a soma do tempo de atendimento dos chamados considerados no período selecionado.`;
  const m = normalizar(minutes);
  if (m === null) return `${definicao}\nValor original: ${DURACAO_SEM_INFO}`;
  return [
    definicao,
    `Valor original: ${formatMinutesOriginal(m)}`,
    `Conversão: ${formatDurationLong(m)}`,
    `Horas decimais: ${formatDecimalHours(m)}`,
  ].join('\n');
}
