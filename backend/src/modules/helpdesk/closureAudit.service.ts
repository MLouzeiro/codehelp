import prisma from '../../config/database';
import { callClaude, hasClaude } from '../../shared/aiClient';
import { WHERE_TICKET_RESOLVIDO } from '../helpdesk/constants';

// ── Interfaces ─────────────────────────────────────────────────

export interface AuditoriaEncerramento {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assigneeName: string | null;
  dataFechamento: Date | null;
  tipo: 'encerramento_prematuro' | 'resolucao_real' | 'reabertura' | 'sem_dados';
  diagnostico: string;
  detalhes: string[];
  nota: number; // 0-10 (10 = encerramento perfeito)
  recomendaReabertura: boolean;
  clienteVoltou: boolean;
  mensagensAposEncerramento: number;
  csatNota: number | null;
  csatRespondido: boolean;
  analiseIa: boolean;
  ticketReaberturaId: string | null;
}

interface MensagemResumo {
  fromMe: boolean;
  content: string;
  sentAt: Date;
}

// ── Helpers ─────────────────────────────────────────────────────

function ultimaMensagemCliente(mensagens: MensagemResumo[]): string {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    if (!mensagens[i].fromMe) return mensagens[i].content || '';
  }
  return '';
}

function ultimaMensagemAgente(mensagens: MensagemResumo[]): string {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    if (mensagens[i].fromMe) return mensagens[i].content || '';
  }
  return '';
}

function pareceConfirmacaoResolucao(texto: string): boolean {
  const t = (texto || '').toLowerCase();
  return [
    'obrigado', 'resolvido', 'resolvida', 'funcionou', 'deu certo', 'agora foi',
    'tudo certo', 'perfeito', 'ótimo', 'otimo', 'excelente', 'pode fechar',
    'ta ok', 'está ok', 'resolvido sim', 'sim resolveu', 'consegui', 'tá certo',
  ].some(k => t.includes(k));
}

function pareceInsatisfacao(texto: string): boolean {
  const t = (texto || '').toLowerCase();
  return [
    'nao resolveu', 'não resolveu', 'continua', 'ainda esta', 'ainda está', 'mesmo problema',
    'nao funcionou', 'não funcionou', 'piorou', 'nada feito', 'não adiantou', 'nao adiantou',
    'que absurdo', 'horrivel', 'pessimo', 'ruim', 'insatisfeito', 'raiva', 'chateado',
  ].some(k => t.includes(k));
}

// ── Diagnóstico por regras (fallback sem IA) ───────────────────

function diagnosticarPorRegras(
  mensagens: MensagemResumo[],
  csatNota: number | null,
  csatRespondido: boolean,
  mensagensAposEncerramento: number
): Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura' | 'analiseIa'> {
  const detalhes: string[] = [];
  const ultCliente = ultimaMensagemCliente(mensagens);
  const ultAgente = ultimaMensagemAgente(mensagens);

  // 1) Reabertura: cliente voltou com mensagens após o encerramento
  if (mensagensAposEncerramento > 0) {
    detalhes.push(`Cliente enviou ${mensagensAposEncerramento} mensagem(ns) após o encerramento.`);
    return {
      tipo: 'reabertura',
      diagnostico: 'O cliente voltou após o encerramento, sugerindo que o problema não foi totalmente resolvido ou surgiu novo chamado.',
      detalhes,
      nota: 3,
      recomendaReabertura: true,
      analiseIa: false,
    };
  }

  // 2) CSAT baixo
  if (csatRespondido && csatNota !== null && csatNota <= 2) {
    detalhes.push(`CSAT respondido com nota ${csatNota}/5.`);
    return {
      tipo: 'encerramento_prematuro',
      diagnostico: 'Cliente avaliou o atendimento de forma negativa após o encerramento.',
      detalhes,
      nota: 2,
      recomendaReabertura: true,
      analiseIa: false,
    };
  }

  // 3) Cliente demonstra insatisfação na última mensagem
  if (pareceInsatisfacao(ultCliente)) {
    detalhes.push(`Última mensagem do cliente sugere insatisfação: "${ultCliente.slice(0, 80)}".`);
    return {
      tipo: 'encerramento_prematuro',
      diagnostico: 'A última interação do cliente indica que o problema não foi resolvido.',
      detalhes,
      nota: 2,
      recomendaReabertura: true,
      analiseIa: false,
    };
  }

  // 4) Cliente confirmou resolução
  if (pareceConfirmacaoResolucao(ultCliente)) {
    detalhes.push(`Cliente confirmou a resolução: "${ultCliente.slice(0, 80)}".`);
    return {
      tipo: 'resolucao_real',
      diagnostico: 'O cliente confirmou a resolução na última interação.',
      detalhes,
      nota: 9,
      recomendaReabertura: false,
      analiseIa: false,
    };
  }

  // 5) CSAT bom
  if (csatRespondido && csatNota !== null && csatNota >= 4) {
    detalhes.push(`CSAT respondido com nota ${csatNota}/5.`);
    return {
      tipo: 'resolucao_real',
      diagnostico: 'Cliente avaliou o atendimento de forma positiva.',
      detalhes,
      nota: 8,
      recomendaReabertura: false,
      analiseIa: false,
    };
  }

  // 6) Sem confirmação clara e sem CSAT
  if (!ultCliente) {
    detalhes.push('Nenhuma mensagem do cliente registrada no ticket.');
    return {
      tipo: 'encerramento_prematuro',
      diagnostico: 'O ticket foi encerrado sem mensagem do cliente confirmando a resolução.',
      detalhes,
      nota: 4,
      recomendaReabertura: true,
      analiseIa: false,
    };
  }

  detalhes.push(`Última mensagem do cliente: "${ultCliente.slice(0, 80)}".`);
  if (ultAgente) detalhes.push(`Última mensagem do agente: "${ultAgente.slice(0, 80)}".`);
  detalhes.push('Sem confirmação explícita de resolução — encerramento sem validação do cliente.');
  return {
    tipo: 'encerramento_prematuro',
    diagnostico: 'O ticket foi encerrado sem confirmação explícita de resolução pelo cliente.',
    detalhes,
    nota: 5,
    recomendaReabertura: true,
    analiseIa: false,
  };
}

// ── Análise IA ──────────────────────────────────────────────────

async function diagnosticarComIa(
  mensagens: MensagemResumo[],
  csatNota: number | null,
  csatRespondido: boolean,
  mensagensAposEncerramento: number,
  regras: Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura'>
): Promise<Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura' | 'analiseIa'>> {
  if (!hasClaude()) return { ...regras, analiseIa: false };

  const conversa = mensagens.slice(-12).map(m =>
    `${m.fromMe ? 'ATENDENTE' : 'CLIENTE'}: ${m.content || '(vazio)'}`
  ).join('\n');

  const prompt = `Você é um auditor de qualidade de um helpdesk. Analise um ticket ENCERRADO e classifique o encerramento.

CONVERSA (últimas mensagens):
${conversa || '(sem mensagens)'}

CSAT: ${csatRespondido ? `${csatNota}/5` : 'não respondido'}
Mensagens do cliente após o encerramento: ${mensagensAposEncerramento}

Classifique o tipo de encerramento:
- "encerramento_prematuro": ticket fechado sem o cliente confirmar resolução, ou com sinais de insatisfação, ou sem resposta final do cliente.
- "resolucao_real": o cliente confirmou ou demonstrou que o problema foi resolvido.
- "reabertura": o cliente voltou após o encerramento (novo ticket ou mensagens).

Retorne APENAS JSON válido:
{
  "tipo": "<encerramento_prematuro|resolucao_real|reabertura>",
  "diagnostico": "<1 frase>",
  "detalhes": ["<array de evidências>"],
  "nota": <0-10>,
  "recomendaReabertura": <boolean>
}`;

  try {
    const text = await callClaude(prompt, 600);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON inválido');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      tipo: parsed.tipo || regras.tipo,
      diagnostico: parsed.diagnostico || regras.diagnostico,
      detalhes: Array.isArray(parsed.detalhes) ? parsed.detalhes : regras.detalhes,
      nota: Math.min(10, Math.max(0, Number(parsed.nota) || regras.nota)),
      recomendaReabertura: Boolean(parsed.recomendaReabertura),
      analiseIa: true,
    };
  } catch (err) {
    console.warn('[ClosureAudit] Falha na análise IA, usando regras:', (err as Error).message);
    return { ...regras, analiseIa: false };
  }
}

// ── Função principal ────────────────────────────────────────────

export async function auditarEncerramento(ticketId: string, usarIa = true): Promise<AuditoriaEncerramento> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { name: true } },
      csatResposta: { select: { nota: true, respondidoEm: true } },
      messages: {
        select: { fromMe: true, content: true, sentAt: true },
        orderBy: { sentAt: 'asc' },
      },
    },
  });

  if (!ticket) throw new Error('Ticket não encontrado');

  const mensagens: MensagemResumo[] = (ticket.messages || []).map(m => ({
    fromMe: m.fromMe,
    content: m.content || '',
    sentAt: m.sentAt,
  }));
  const csatNota = ticket.csatResposta?.nota ?? null;
  const csatRespondido = !!ticket.csatResposta?.respondidoEm;

  // Conta mensagens do cliente após o encerramento (novo ticket no mesmo telefone)
  let mensagensAposEncerramento = 0;
  let ticketReaberturaId: string | null = null;
  if (ticket.dataFechamento) {
    const reabertura = await prisma.ticket.findFirst({
      where: {
        id: { not: ticket.id },
        contactPhone: ticket.contactPhone || undefined,
        contactJid: ticket.contactJid || undefined,
        createdAt: { gt: ticket.dataFechamento },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (reabertura) {
      ticketReaberturaId = reabertura.id;
      mensagensAposEncerramento = await prisma.message.count({
        where: {
          ticketId: reabertura.id,
          fromMe: false,
          createdAt: { gte: ticket.dataFechamento },
        },
      });
      if (mensagensAposEncerramento === 0) mensagensAposEncerramento = 1;
    }
  }

  const regras = diagnosticarPorRegras(mensagens, csatNota, csatRespondido, mensagensAposEncerramento);
  const analise = usarIa
    ? await diagnosticarComIa(mensagens, csatNota, csatRespondido, mensagensAposEncerramento, regras)
    : { ...regras, analiseIa: false };

  return {
    ticketId: ticket.id,
    protocolo: ticket.protocolo,
    contactName: ticket.contactName,
    contactPhone: ticket.contactPhone,
    assigneeName: ticket.assignee?.name || null,
    dataFechamento: ticket.dataFechamento,
    ...analise,
    clienteVoltou: mensagensAposEncerramento > 0,
    mensagensAposEncerramento,
    csatNota,
    csatRespondido,
    ticketReaberturaId,
  };
}

// ── Listar tickets encerrados para auditoria ───────────────────

export interface FiltroAuditoria {
  dataInicio?: Date;
  dataFim?: Date;
  tipo?: string;
  assigneeId?: string;
  limit?: number;
}

export async function listarTicketsEncerrados(filtro: FiltroAuditoria = {}) {
  const where: any = {
    ...WHERE_TICKET_RESOLVIDO,
    dataFechamento: { not: null },
  };
  if (filtro.dataInicio || filtro.dataFim) {
    where.dataFechamento = {
      ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
      ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
    };
  }
  if (filtro.assigneeId) where.assigneeId = filtro.assigneeId;

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      contactPhone: true,
      dataFechamento: true,
      dataAbertura: true,
      assignee: { select: { name: true } },
      csatResposta: { select: { nota: true, respondidoEm: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { dataFechamento: 'desc' },
    take: filtro.limit || 50,
  });

  return tickets;
}

// ── Auditoria em lote (com limite) ─────────────────────────────

export async function auditarLoteEncerramentos(filtro: FiltroAuditoria = {}): Promise<{
  total: number;
  auditados: AuditoriaEncerramento[];
}> {
  const tickets = await listarTicketsEncerrados(filtro);
  const auditados: AuditoriaEncerramento[] = [];
  let erros = 0;

  for (const t of tickets) {
    try {
      auditados.push(await auditarEncerramento(t.id));
    } catch (e) {
      erros++;
      console.warn(`[ClosureAudit] Falha ao auditar ticket ${t.id}:`, (e as Error).message);
    }
  }

  console.log(`[ClosureAudit] Lote concluído: ${auditados.length} auditados, ${erros} erros`);
  return { total: auditados.length, auditados };
}

// ── Estatísticas agregadas ─────────────────────────────────────

export async function resumoAuditoriaEncerramentos(filtro: FiltroAuditoria = {}): Promise<{
  totalAuditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  taxaPrematura: number;
  pctReabertura: number;
}> {
  const { auditados } = await auditarLoteEncerramentos({ ...filtro, limit: filtro.limit || 100 });
  const prematuros = auditados.filter(a => a.tipo === 'encerramento_prematuro').length;
  const resolucoesReais = auditados.filter(a => a.tipo === 'resolucao_real').length;
  const reaberturas = auditados.filter(a => a.tipo === 'reabertura').length;
  const total = auditados.length;

  return {
    totalAuditados: total,
    prematuros,
    resolucoesReais,
    reaberturas,
    taxaPrematura: total > 0 ? Math.round((prematuros / total) * 100) : 0,
    pctReabertura: total > 0 ? Math.round((reaberturas / total) * 100) : 0,
  };
}
