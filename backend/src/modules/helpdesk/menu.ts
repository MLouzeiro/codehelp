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

export async function montarBoasVindas(nome: string, now: Date = new Date()): Promise<string> {
  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  if (departamentos.length === 0) {
    return `Olá! ${getSaudacao(now)}, ${nome || 'cliente'} 👋\n\nNo momento não há departamentos disponíveis. Entre em contato com o administrador do sistema.`;
  }

  const opcoes = departamentos.map((d) => `• ${d.nome}`).join('\n');

  let baseMsg = `Olá! ${getSaudacao(now)}, ${nome || 'cliente'} 👋\n\nQue bom ter você por aqui!\n\nPor favor, selecione o departamento desejado:\n\n${opcoes}\n\nResponda com o *nome* do departamento.`;

  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (config?.mensagemBoasVindas) {
      baseMsg = interpolar(config.mensagemBoasVindas, {
        nome: nome || 'cliente',
        saudacao: getSaudacao(now),
        departamentos: opcoes,
      });
    }
  } catch {}

  // SEMPRE anexar a lista de departamentos se não estiver presente na mensagem
  if (!baseMsg.includes('•') && !baseMsg.includes('1️⃣')) {
    baseMsg += `\n\nPor favor, selecione o departamento desejado:\n\n${opcoes}\n\nResponda com o *nome* do departamento.`;
  }

  return baseMsg;
}

export async function montarOpcaoInvalida(nome: string): Promise<string> {
  const departamentos = await prisma.departamento.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  const nomes = departamentos.map((d) => `• ${d.nome}`).join('\n');
  const defaultMsg = `Hmm, não entendi sua resposta, ${nome || 'cliente'} 😅\n\nPor favor, responda com o *nome* do departamento desejado:\n\n${nomes}`;

  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if ((config as any)?.mensagemOpcaoInvalida) {
      return interpolar((config as any).mensagemOpcaoInvalida, {
        nome: nome || 'cliente',
        departamentos: departamentos.map((d) => `• ${d.nome}`).join('\n'),
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

  return `Perfeito, ${nome || 'cliente'}! ✅\nVocê selecionou *${deptNome}*.\n\n📝 Por favor, descreva detalhadamente seu problema ou solicitação. Quanto mais informações, melhor poderemos ajudá-lo.\n\nAguardamos sua mensagem!`;
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
