import prisma from '../../config/database';

export interface HorarioConfig {
  horarioInicio: string;
  horarioFim: string;
  diasAtendimento: number[];
  mensagemForaHorario: string;
}

const DEFAULTS: HorarioConfig = {
  horarioInicio: '08:00',
  horarioFim: '18:00',
  diasAtendimento: [1, 2, 3, 4, 5],
  mensagemForaHorario:
    'Ola! Nosso horario de atendimento e de segunda a sexta, das 08:00 as 18:00. ' +
    'Deixamos seu contato registrado e um atendente human o respondera assim que possivel. 🙏',
};

export async function getHorarioConfig(): Promise<HorarioConfig> {
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (!config) return DEFAULTS;
    return {
      horarioInicio: config.horarioInicio || DEFAULTS.horarioInicio,
      horarioFim: config.horarioFim || DEFAULTS.horarioFim,
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

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

export function isHorarioAtendimento(config: HorarioConfig, now: Date = new Date()): boolean {
  const dia = now.getDay();
  if (!config.diasAtendimento.includes(dia)) return false;
  const inicio = parseHHMM(config.horarioInicio);
  const fim = parseHHMM(config.horarioFim);
  const minutosAgora = now.getHours() * 60 + now.getMinutes();
  const minutosInicio = inicio.h * 60 + inicio.m;
  const minutosFim = fim.h * 60 + fim.m;
  return minutosAgora >= minutosInicio && minutosAgora < minutosFim;
}

export function getSaudacao(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
