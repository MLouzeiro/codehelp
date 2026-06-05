import prisma from '../../config/database';
import { getSaudacao, getHorarioConfig } from './horario';

const DEFAULT_BOAS_VINDAS =
  'Ola, {{nome}}! {{saudacao}} 👋\n\nQue bom ter voce por aqui!\n\nComo podemos te ajudar hoje? Responda *apenas com o numero*:\n\n1️⃣ *Suporte tecnico*\n2️⃣ *Comercial / Orcamentos*\n\n Aguardamos sua resposta!';

const DEFAULT_ACK_SUPORTE =
  'Perfeito, {{nome}}! ✅\n\nVoce escolheu *Suporte Tecnico*. Um atendente humano ira abrir seu chamado em instantes.\n\nEnquanto isso, descreva com detalhes o que esta acontecendo para agilizarmos o atendimento. 🙏';

const DEFAULT_ACK_COMERCIAL =
  'Otimo, {{nome}}! ✅\n\nVoce escolheu *Comercial / Orcamentos*. Nossa equipe comercial ira abrir seu chamado em instantes.\n\nEnquanto isso, nos conte um pouco sobre o que precisa para agilizarmos o atendimento. 🙏';

const DEFAULT_OPCAO_INVALIDA =
  'Hmm, nao entendi sua resposta, {{nome}} 😅\n\nPor favor, responda *apenas* com:\n\n1️⃣ para *Suporte tecnico*\n2️⃣ para *Comercial / Orcamentos*';

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
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'triagem' } });
    if (config?.mensagemBoasVindas) template = config.mensagemBoasVindas;
  } catch {}
  return interpolar(template, {
    nome: nome || 'cliente',
    saudacao: getSaudacao(now),
  });
}

export async function montarAck(nome: string, opcao: OpcaoMenu): Promise<string> {
  let template = opcao === '1' ? DEFAULT_ACK_SUPORTE : DEFAULT_ACK_COMERCIAL;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'triagem' } });
    if (config) {
      if (opcao === '1' && (config as any).mensagemAckSuporte) template = (config as any).mensagemAckSuporte;
      if (opcao === '2' && (config as any).mensagemAckComercial) template = (config as any).mensagemAckComercial;
    }
  } catch {}
  return interpolar(template, { nome: nome || 'cliente' });
}

export async function montarOpcaoInvalida(nome: string): Promise<string> {
  let template = DEFAULT_OPCAO_INVALIDA;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'triagem' } });
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
