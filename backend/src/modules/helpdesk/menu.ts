import prisma from '../../config/database';
import { getSaudacao, getHorarioConfig } from './horario';

export type OpcaoMenu = string;

export function detectarOpcaoMenu(text: string): OpcaoMenu | null {
  const limpo = text.trim();
  if (!limpo) return null;
  // ID interativo de departamento: "dept_<slug>" / "dept_<id>" (lista interativa)
  if (/^dept_\S+/i.test(limpo)) return limpo;
  // Aceita tanto "1" como "1 - Suporte Técnico" (resposta de lista interativa)
  const match = limpo.match(/^(\d+)/);
  if (match) return match[1];
  // Aceita o NOME do departamento (ex: "suporte técnico", "financeiro") —
  // o resolverOpcaoMenu faz o matching por nome. Restrito a textos curtos
  // para não interpretar uma descrição de problema como opção de menu.
  if (limpo.length <= 80) return limpo;
  return null;
}

function interpolar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export const SEPARADOR_MENU = '━━━━━━━━━━━━━━━━━━';

const NUMEROS_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// Única fonte de formatação da lista numerada de departamentos.
// Reutilizada pelo menu de boas-vindas, mensagem de opção inválida e template {{departamentos}}.
export function formatarDepartamentosNumerados(departamentos: Array<{ nome: string; descricao?: string | null }>): string {
  return departamentos
    .map((d, i) => {
      const num = NUMEROS_EMOJI[i] ?? `${i + 1}.`;
      return `${num} *${d.nome}*${d.descricao ? `\n${d.descricao}` : ''}`;
    })
    .join('\n\n');
}

export async function montarBoasVindas(nome: string, now: Date = new Date()): Promise<{ descricao: string; fallbackTexto: string }> {
  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  const nomeFmt = nome || 'cliente';
  const saudacao = getSaudacao(now);

  if (departamentos.length === 0) {
    const msg = `Olá, ${nomeFmt}! 👋\n${saudacao}!\n\nNo momento não há departamentos disponíveis. Entre em contato com o administrador do sistema.`;
    return { descricao: msg, fallbackTexto: msg };
  }

  const lista = formatarDepartamentosNumerados(departamentos);

  // Mensagem completa padrão — saudação + departamentos numerados + instrução.
  // Usada tanto na descrição da lista interativa (evolution/cloud) quanto no
  // fallback de texto (Baileys/webjs). Mantém a opção de digitar o número.
  let descricao = `Olá, ${nomeFmt}! 👋\n${saudacao}!\n\nQue bom ter você por aqui! 😊\n\nComo podemos ajudar?\n\n🏢 *ESCOLHA O DEPARTAMENTO*\n\n${lista}\n\n${SEPARADOR_MENU}\n\n👉 *Digite o número da opção desejada.*\n\nExemplo:\n*1* para ${departamentos[0].nome}.`;

  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (config?.mensagemBoasVindas) {
      descricao = interpolar(config.mensagemBoasVindas, {
        nome: nomeFmt,
        saudacao,
        departamentos: lista,
        primeiro_departamento: departamentos[0].nome,
      })
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  } catch {}

  // Texto completo (fallback texto) — usado por providers sem lista interativa (Baileys/webjs).
  // Se o template já embutiu a lista ({{departamentos}}), não duplicar.
  const temLista = descricao.includes('🏢') || descricao.includes('ESCOLHA O DEPARTAMENTO') || descricao.includes('1️⃣') || descricao.includes('departamentos');
  const fallbackTexto = temLista
    ? descricao
    : `${descricao}\n\n🏢 *ESCOLHA O DEPARTAMENTO*\n\n${lista}\n\n${SEPARADOR_MENU}\n\n👉 *Digite o número da opção desejada.*\n\nExemplo:\n*1* para ${departamentos[0].nome}.`;

  return { descricao, fallbackTexto };
}

export async function montarOpcaoInvalida(nome: string): Promise<string> {
  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  const lista = formatarDepartamentosNumerados(departamentos);
  const defaultMsg = `⚠️ Não consegui identificar a opção.\n\nPor favor, escolha uma das opções abaixo:\n\n${lista}\n\n👉 Digite apenas o *número* da opção desejada.`;

  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if ((config as any)?.mensagemOpcaoInvalida) {
      return interpolar((config as any).mensagemOpcaoInvalida, {
        nome: nome || 'cliente',
        departamentos: lista,
      });
    }
  } catch {}

  return defaultMsg;
}

export async function resolverOpcaoMenu(opcao: string): Promise<{
  departamentoId: string;
  departamentoNome: string;
} | null> {
  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  const limpo = opcao.trim().toLowerCase();

  // ID interativo: dept_<slug> ou dept_<id>
  const deptIdMatch = limpo.match(/^dept_(.+)$/);
  if (deptIdMatch) {
    const ref = deptIdMatch[1].trim();
    const dept = departamentos.find(
      (d) => d.slug?.toLowerCase() === ref || d.id.toLowerCase() === ref
    );
    if (dept) return { departamentoId: dept.id, departamentoNome: dept.nome };
  }

  if (/^\d+$/.test(limpo)) {
    const idx = parseInt(limpo, 10) - 1;
    if (idx < 0 || idx >= departamentos.length) return null;
    const dept = departamentos[idx];
    return { departamentoId: dept.id, departamentoNome: dept.nome };
  }

  const match = departamentos.find(
    (d) => d.nome.toLowerCase().includes(limpo) || limpo.includes(d.nome.toLowerCase())
  );
  if (match) return { departamentoId: match.id, departamentoNome: match.nome };

  return null;
}

export async function montarAckDepartamento(nome: string, deptNome: string): Promise<string> {
  // Verificar se existe mensagem customizada no HelpdeskConfig
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'auto_atendimento' } });
    if ((config as any)?.mensagemDescricaoProblema) {
      return interpolar((config as any).mensagemDescricaoProblema, {
        nome: nome || 'cliente',
        departamento: deptNome,
      });
    }
  } catch {}

  return `✅ Perfeito, ${nome || 'cliente'}!\n\nVocê selecionou:\n🏢 *${deptNome}*\n\nAgora, por favor, descreva brevemente o que está acontecendo.\n\nQuanto mais detalhes você fornecer, mais rápido poderemos ajudar. 😊`;
}

export async function montarPosicaoFilaComInfo(nome: string, posicao: number, jaInformouAssunto: boolean, jaInformouLab: boolean): Promise<string> {
  const pendencias: string[] = [];
  if (!jaInformouAssunto) pendencias.push('📋 *Descrição do problema*');
  if (!jaInformouLab) pendencias.push('🏢 *Empresa/Laboratório*');

  let msg = `📋 Sua posição na fila é *${posicao}º*.\nAguarde um instante, por favor.`;

  if (pendencias.length > 0) {
    msg += `\n\n⚠️ Ainda faltam algumas informações:\n${pendencias.join('\n')}\n\nPor favor, envie os dados acima para que possamos dar andamento ao seu chamado.`;
  } else {
    msg += `\n\n✅ Informações completas! Um analista te atenderá em breve.`;
  }

  return msg;
}

export async function montarAckSuporte(nome: string): Promise<string> {
  const DEFAULT_ACK = 'Perfeito, {{nome}}! 🛠️\nVocê escolheu *Suporte*.\nDescreva seu problema que um analista técnico te atenderá em breve.';
  let template = DEFAULT_ACK;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (config?.mensagemAckSuporte) template = config.mensagemAckSuporte;
  } catch {}
  return interpolar(template, { nome: nome || 'cliente' });
}

export async function montarAckComercial(nome: string): Promise<string> {
  const DEFAULT_ACK = 'Ótimo, {{nome}}! 💼\nVocê escolheu *Comercial*.\nUm de nossos consultores entrará em contato com você em instantes.';
  let template = DEFAULT_ACK;
  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (config?.mensagemAckComercial) template = config.mensagemAckComercial;
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
