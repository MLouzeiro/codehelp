import prisma from '../../config/database';

export const TRIGGERS_VALIDOS = [
  'novo_ticket',
  'msg_recebida',
  'status_alterado',
  'sla_alerta',
  'csat_recebido',
] as const;

export type TriggerValido = typeof TRIGGERS_VALIDOS[number];

export const ACOES_VALIDAS = [
  'definir_categoria',
  'definir_prioridade',
  'atribuir_usuario',
  'mudar_etapa',
  'enviar_msg',
  'escalar_fila',
  'notificar',
  'adicionar_tag',
] as const;

export type AcaoValida = typeof ACOES_VALIDAS[number];

export const OPERADORES_COMPARACAO = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'] as const;
export type OperadorComparacao = typeof OPERADORES_COMPARACAO[number];

export interface RegraCondicao {
  campo: string;
  operador: OperadorComparacao;
  valor: any;
}

export interface RegraAcao {
  tipo: AcaoValida;
  parametros: Record<string, any>;
}

export interface RegraInput {
  nome: string;
  descricao?: string | null;
  trigger: TriggerValido;
  condicoes: RegraCondicao[];
  acoes: RegraAcao[];
  logicOperator?: 'all' | 'any';
  ativo?: boolean;
  ordem?: number;
  autorId?: string | null;
}

function comparar(a: any, op: OperadorComparacao, b: any): boolean {
  if (a == null) return op === 'neq' ? b != null : false;
  switch (op) {
    case 'eq': return a === b;
    case 'neq': return a !== b;
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'contains': return String(a).toLowerCase().includes(String(b).toLowerCase());
    case 'in': return Array.isArray(b) ? b.includes(a) : false;
    default: return false;
  }
}

function avaliarCondicoes(condicoes: RegraCondicao[], contexto: Record<string, any>, logic: 'all' | 'any'): boolean {
  if (condicoes.length === 0) return true;
  const resultados = condicoes.map((c) => comparar(contexto[c.campo], c.operador, c.valor));
  return logic === 'all' ? resultados.every(Boolean) : resultados.some(Boolean);
}

export interface ExecucaoResultado {
  regraId: string;
  regraNome: string;
  acoesExecutadas: Array<{ tipo: string; sucesso: boolean; erro?: string; resultado?: any }>;
}

export async function avaliarRegras(trigger: TriggerValido, contexto: Record<string, any>): Promise<ExecucaoResultado[]> {
  const regras = await prisma.automationRule.findMany({
    where: { trigger, ativo: true },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
  });
  const resultados: ExecucaoResultado[] = [];
  for (const regra of regras) {
    let condicoes: RegraCondicao[] = [];
    let acoes: RegraAcao[] = [];
    try {
      condicoes = JSON.parse(regra.condicoes);
    } catch (err) {
      console.warn(`[AUTOMATIONS] Falha ao parsear condicoes da regra ${regra.id}:`, err instanceof Error ? err.message : err);
    }
    try {
      acoes = JSON.parse(regra.acoes);
    } catch (err) {
      console.warn(`[AUTOMATIONS] Falha ao parsear acoes da regra ${regra.id}:`, err instanceof Error ? err.message : err);
    }
    const passa = avaliarCondicoes(condicoes, contexto, (regra.logicOperator as 'all' | 'any') || 'all');
    if (!passa) continue;
    const acoesExecutadas: ExecucaoResultado['acoesExecutadas'] = [];
    for (const acao of acoes) {
      const r = await executarAcao(acao, contexto);
      acoesExecutadas.push({ tipo: acao.tipo, ...r });
    }
    resultados.push({
      regraId: regra.id,
      regraNome: regra.nome,
      acoesExecutadas,
    });
  }
  return resultados;
}

async function executarAcao(acao: RegraAcao, contexto: Record<string, any>): Promise<{ sucesso: boolean; erro?: string; resultado?: any }> {
  try {
    const ticketId = contexto.ticketId;
    switch (acao.tipo) {
      case 'definir_categoria': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { categoria: acao.parametros.categoria },
        });
        return { sucesso: true };
      }
      case 'definir_prioridade': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { prioridade: acao.parametros.prioridade },
        });
        return { sucesso: true };
      }
      case 'atribuir_usuario': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { assigneeId: acao.parametros.usuarioId, usuarioId: acao.parametros.usuarioId },
        });
        return { sucesso: true };
      }
      case 'mudar_etapa': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { etapa: acao.parametros.etapa },
        });
        return { sucesso: true };
      }
      case 'escalar_fila': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        const { escalarTicket } = await import('../helpdesk/status.service');
        const result = await escalarTicket(
          ticketId,
          acao.parametros.filaId,
          acao.parametros.motivo || 'Escalonado por automacao'
        );
        return { sucesso: true, resultado: { filaNome: result.fila.nome } };
      }
      case 'notificar': {
        const destinatarioId = acao.parametros.usuarioId;
        if (!destinatarioId) return { sucesso: false, erro: 'usuarioId ausente' };
        await prisma.notificacao.create({
          data: {
            tipo: 'regra_executar',
            mensagem: acao.parametros.mensagem || 'Regra automatica executada',
            destinatarioId,
            ticketId: ticketId || null,
            dados: JSON.stringify(acao.parametros),
          },
        });
        return { sucesso: true };
      }
      case 'enviar_msg': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket || !ticket.contactPhone) return { sucesso: false, erro: 'sem telefone' };
        const { sendWhatsAppMessage } = await import('../integrations/whatsapp/whatsapp.service');
        const r = await sendWhatsAppMessage(ticket.contactPhone, acao.parametros.mensagem, (ticket as any).whatsappConnectionId || undefined, (ticket as any).contactJid || undefined);
        return { sucesso: r.success, erro: r.error };
      }
      case 'adicionar_tag': {
        if (!ticketId) return { sucesso: false, erro: 'ticketId ausente' };
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { sucesso: false, erro: 'ticket nao encontrado' };
        const tagsAtuais = (ticket as any).tags || '';
        const novaTag = acao.parametros.tag;
        if (tagsAtuais.includes(novaTag)) return { sucesso: true, resultado: { jaExistia: true } };
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { tags: tagsAtuais ? `${tagsAtuais},${novaTag}` : novaTag } as any,
        });
        return { sucesso: true };
      }
      default:
        return { sucesso: false, erro: `acao desconhecida: ${acao.tipo}` };
    }
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || String(err) };
  }
}

export async function criarRegra(input: RegraInput) {
  return prisma.automationRule.create({
    data: {
      nome: input.nome,
      descricao: input.descricao ?? null,
      trigger: input.trigger,
      condicoes: JSON.stringify(input.condicoes),
      acoes: JSON.stringify(input.acoes),
      logicOperator: input.logicOperator || 'all',
      ativo: input.ativo ?? true,
      ordem: input.ordem ?? 0,
      autorId: input.autorId ?? null,
    },
  });
}

export async function atualizarRegra(id: string, input: Partial<RegraInput>) {
  const data: any = {};
  if (input.nome !== undefined) data.nome = input.nome;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.trigger !== undefined) data.trigger = input.trigger;
  if (input.condicoes !== undefined) data.condicoes = JSON.stringify(input.condicoes);
  if (input.acoes !== undefined) data.acoes = JSON.stringify(input.acoes);
  if (input.logicOperator !== undefined) data.logicOperator = input.logicOperator;
  if (input.ativo !== undefined) data.ativo = input.ativo;
  if (input.ordem !== undefined) data.ordem = input.ordem;
  return prisma.automationRule.update({ where: { id }, data });
}

export async function deletarRegra(id: string) {
  return prisma.automationRule.delete({ where: { id } });
}

export async function listarRegras(filtros: { trigger?: string; ativo?: boolean } = {}) {
  const where: any = {};
  if (filtros.trigger) where.trigger = filtros.trigger;
  if (filtros.ativo !== undefined) where.ativo = filtros.ativo;
  return prisma.automationRule.findMany({
    where,
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getRegra(id: string) {
  return prisma.automationRule.findUnique({ where: { id } });
}
