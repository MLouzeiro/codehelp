import prisma from '../../config/database';
import { getSaudacao, getHorarioConfig } from './horario';

const DEFAULT_BOAS_VINDAS =
  'Ola!! {{nome}} {{saudacao}} 👋\n\nQue bom ter voce por aqui!\n\nComo podemos te ajudar hoje? Descreva por aqui mesmo que um de nossos analistas te atendera em instantes.';

const DEFAULT_OPCAO_INVALIDA =
  'Hmm, nao entendi sua resposta, {{nome}} 😅\n\nPor favor, descreva com mais detalhes o que voce precisa.';

export type OpcaoMenu = '1' | '2';

export function detectarOpcaoMenu(text: string): OpcaoMenu | null {
  const limpo = text.trim().replace(/[^12]/g, '');
  if (limpo === '1' || limpo === '2') return limpo as OpcaoMenu;
  return null;
}

function interpolar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export async function montarBoasVindas(nome: string, now: Date = new Date()): Promise<string> {
  let template = DEFAULT_BOAS_VINDAS;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (config?.mensagemBoasVindas) template = config.mensagemBoasVindas;
  } catch {}
  return interpolar(template, {
    nome: nome || 'cliente',
    saudacao: getSaudacao(now),
  });
}

export async function montarOpcaoInvalida(nome: string): Promise<string> {
  let template = DEFAULT_OPCAO_INVALIDA;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if ((config as any)?.mensagemOpcaoInvalida) template = (config as any).mensagemOpcaoInvalida;
  } catch {}
  return interpolar(template, { nome: nome || 'cliente' });
}

export async function montarForaHorario(nome: string): Promise<string> {
  const cfg = await getHorarioConfig();
  return interpolar(cfg.mensagemForaHorario, {
    nome: nome || 'cliente',
    saudacao: getSaudacao(),
  });
}
