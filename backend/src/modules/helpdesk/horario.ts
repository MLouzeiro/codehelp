import prisma from '../../config/database';
import { env } from '../../config/env';
import { ehFeriado } from '../feriados/feriados.service';

export interface HorarioConfig {
  horarioInicio: string;
  horarioFim: string;
  horarioSabadoInicio: string | null;
  horarioSabadoFim: string | null;
  diasAtendimento: number[];
  mensagemForaHorario: string;
}

const DEFAULTS: HorarioConfig = {
  horarioInicio: '07:00',
  horarioFim: '18:00',
  horarioSabadoInicio: '07:00',
  horarioSabadoFim: '12:00',
  diasAtendimento: [1, 2, 3, 4, 5, 6], // seg-sab
  mensagemForaHorario:
    'Olá! 👋\n\nNosso horário de atendimento é:\n' +
    '• Segunda a sexta: 07:00 às 18:00\n' +
    '• Sábado: 07:00 às 12:00\n\n' +
    'No momento estamos fora do expediente, mas deixamos seu contato registrado. ' +
    'Um atendente humano o responderá assim que o expediente iniciar. 🙏\n\n' +
    '⚡ *Dica:* Quando o expediente iniciar, enviaremos as opções de departamento para você escolher.',
};

export async function getHorarioConfig(): Promise<HorarioConfig> {
  try {
    const config = await prisma.helpdeskConfig.findFirst({ where: { slug: 'fila' } });
    if (!config) return DEFAULTS;
    return {
      horarioInicio: config.horarioInicio || DEFAULTS.horarioInicio,
      horarioFim: config.horarioFim || DEFAULTS.horarioFim,
      horarioSabadoInicio: config.horarioSabadoInicio || DEFAULTS.horarioSabadoInicio,
      horarioSabadoFim: config.horarioSabadoFim || DEFAULTS.horarioSabadoFim,
      diasAtendimento: (config.diasAtendimento || DEFAULTS.diasAtendimento.join(','))
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((n) => !isNaN(n)),
      mensagemForaHorario: config.mensagemForaHorario || DEFAULTS.mensagemForaHorario,
    };
  } catch {
    return DEFAULTS;
  }
}

// ── Timezone-aware helpers ─────────────────────────────────────────────
// Usa env.timezone (ex: America/Fortaleza) para não interpretar 22:00 local
// como outro horário por causa do fuso do servidor.
export interface TimeParts {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  weekday: number; // 0=domingo .. 6=sabado
  hours: number;
  minutes: number;
}

export function getTimeParts(now: Date = new Date(), timezone: string = env.timezone): TimeParts {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => (parts.find((p) => p.type === type)?.value || '').trim();
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
      year: parseInt(get('year'), 10) || now.getFullYear(),
      month: parseInt(get('month'), 10) || now.getMonth() + 1,
      day: parseInt(get('day'), 10) || now.getDate(),
      weekday: weekdayMap[get('weekday')] ?? now.getDay(),
      hours: parseInt(get('hour'), 10) || now.getHours(),
      minutes: parseInt(get('minute'), 10) || now.getMinutes(),
    };
  } catch {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      weekday: now.getDay(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
    };
  }
}

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

// Verifica horário/dia da semana levando em conta o timezone configurado.
// Sábado usa horarioSabadoInicio/horarioSabadoFim (se configurado).
// Não considera feriados — use isAtendimentoAberto para isso.
export function isHorarioAtendimento(config: HorarioConfig, now: Date = new Date()): boolean {
  const p = getTimeParts(now);
  if (!config.diasAtendimento.includes(p.weekday)) return false;

  // Sábado: usa horários específicos se configurados
  const isSabado = p.weekday === 6;
  let inicio: string;
  let fim: string;
  if (isSabado && config.horarioSabadoInicio && config.horarioSabadoFim) {
    inicio = config.horarioSabadoInicio;
    fim = config.horarioSabadoFim;
  } else {
    inicio = config.horarioInicio;
    fim = config.horarioFim;
  }

  const inicioParsed = parseHHMM(inicio);
  const fimParsed = parseHHMM(fim);
  const minutosAgora = p.hours * 60 + p.minutes;
  const minutosInicio = inicioParsed.h * 60 + inicioParsed.m;
  const minutosFim = fimParsed.h * 60 + fimParsed.m;
  return minutosAgora >= minutosInicio && minutosAgora < minutosFim;
}

// Horário + feriados (calendar da empresa). Use nos fluxos de ticket.
export async function isAtendimentoAberto(config: HorarioConfig, now: Date = new Date()): Promise<boolean> {
  if (!isHorarioAtendimento(config, now)) return false;
  try {
    const p = getTimeParts(now);
    const dataLocal = new Date(p.year, p.month - 1, p.day);
    return !(await ehFeriado(dataLocal));
  } catch {
    return true;
  }
}

export function getSaudacao(now: Date = new Date()): string {
  const p = getTimeParts(now);
  const h = p.hours;
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}