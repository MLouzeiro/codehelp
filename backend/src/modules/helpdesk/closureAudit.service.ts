import prisma from '../../config/database';
import { callClaude, hasClaude } from '../../shared/aiClient';
import { WHERE_TICKET_RESOLVIDO, MOTIVO_ENCERRADO_SEM_RESOLUCAO } from '../helpdesk/constants';

// ── Interfaces ─────────────────────────────────────────────────

export type RiscoReabertura = 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO';

export interface AuditoriaEncerramento {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assigneeName: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  dataFechamento: Date | null;
  tipo: 'encerramento_prematuro' | 'resolucao_real' | 'reabertura' | 'sem_dados';
  riscoReabertura: RiscoReabertura;
  diagnostico: string;
  detalhes: string[];
  nota: number; // 0-10 (10 = encerramento perfeito)
  recomendaReabertura: boolean;
  semConfirmacao: boolean;
  motivoStatus: string | null;
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
): Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura' | 'semConfirmacao' | 'analiseIa'> {
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
      semConfirmacao: true,
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
      semConfirmacao: false,
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
      semConfirmacao: false,
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
      semConfirmacao: false,
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
      semConfirmacao: false,
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
      semConfirmacao: true,
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
    semConfirmacao: true,
    analiseIa: false,
  };
}

// ── Análise IA ──────────────────────────────────────────────────

async function diagnosticarComIa(
  mensagens: MensagemResumo[],
  csatNota: number | null,
  csatRespondido: boolean,
  mensagensAposEncerramento: number,
  regras: Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura' | 'semConfirmacao'>
): Promise<Pick<AuditoriaEncerramento, 'tipo' | 'diagnostico' | 'detalhes' | 'nota' | 'recomendaReabertura' | 'semConfirmacao' | 'analiseIa'>> {
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
    const text = await callClaude(prompt, 600, 'closure-audit');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON inválido');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      tipo: parsed.tipo || regras.tipo,
      diagnostico: parsed.diagnostico || regras.diagnostico,
      detalhes: Array.isArray(parsed.detalhes) ? parsed.detalhes : regras.detalhes,
      nota: Math.min(10, Math.max(0, Number(parsed.nota) || regras.nota)),
      recomendaReabertura: Boolean(parsed.recomendaReabertura),
      semConfirmacao: regras.semConfirmacao,
      analiseIa: true,
    };
  } catch (err) {
    console.warn('[ClosureAudit] Falha na análise IA, usando regras:', (err as Error).message);
    return { ...regras, analiseIa: false };
  }
}

// ── Função principal ────────────────────────────────────────────

function calcularRiscoReabertura(tipo: AuditoriaEncerramento['tipo'], nota: number, csatNota: number | null): RiscoReabertura {
  if (tipo === 'reabertura') return 'CRÍTICO';
  if (tipo === 'encerramento_prematuro') {
    if (nota <= 2 || (csatNota !== null && csatNota <= 2)) return 'ALTO';
    return 'MÉDIO';
  }
  return 'BAIXO';
}

export async function auditarEncerramento(ticketId: string, usarIa = true): Promise<AuditoriaEncerramento> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { name: true } },
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
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
    clienteId: ticket.client?.id || null,
    clienteNome: ticket.client?.nomeFantasia || ticket.client?.razaoSocial || null,
    dataFechamento: ticket.dataFechamento,
    ...analise,
    riscoReabertura: calcularRiscoReabertura(analise.tipo, analise.nota, csatNota),
    semConfirmacao: analise.semConfirmacao,
    motivoStatus: ticket.motivoStatus,
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
  clienteId?: string;
  departamentoId?: string;
  categoria?: string;
  prioridade?: string;
  status?: string;
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
  if (filtro.clienteId) where.clientId = filtro.clienteId;
  if (filtro.departamentoId) where.departamentoId = filtro.departamentoId;
  if (filtro.categoria) where.categoria = filtro.categoria;
  if (filtro.prioridade) where.prioridade = filtro.prioridade;
  if (filtro.status) where.status = filtro.status;

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

export interface ResumoAuditoria {
  totalAuditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  taxaPrematura: number;
  pctReabertura: number;
  taxaEncerramentoCorreto: number;
  semConfirmacao: number;
  problemaNaoResolvido: number;
  notaMedia: number;
  porRisco: { risco: RiscoReabertura; total: number }[];
  porTipo: { tipo: string; total: number }[];
  porAnalista: { analista: string; auditados: number; prematuros: number; resolucoesReais: number; reaberturas: number; notaMedia: number }[];
  porCliente: { cliente: string; auditados: number; prematuros: number; resolucoesReais: number; reaberturas: number }[];
}

export async function resumoAuditoriaEncerramentos(filtro: FiltroAuditoria = {}): Promise<ResumoAuditoria> {
  const { auditados } = await auditarLoteEncerramentos({ ...filtro, limit: filtro.limit || 100 });
  const total = auditados.length;

  const prematuros = auditados.filter(a => a.tipo === 'encerramento_prematuro').length;
  const resolucoesReais = auditados.filter(a => a.tipo === 'resolucao_real').length;
  const reaberturas = auditados.filter(a => a.tipo === 'reabertura').length;
  const semConfirmacao = auditados.filter(a => a.semConfirmacao).length;

  // Tickets encerrados sem resolução (confirmação "Não" / motivo persistido)
  const whereProblema: any = {
    ...WHERE_TICKET_RESOLVIDO,
    motivoStatus: MOTIVO_ENCERRADO_SEM_RESOLUCAO,
  };
  if (filtro.dataInicio || filtro.dataFim) {
    whereProblema.dataFechamento = {
      ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
      ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
    };
  }
  if (filtro.assigneeId) whereProblema.assigneeId = filtro.assigneeId;
  if (filtro.clienteId) whereProblema.clientId = filtro.clienteId;
  const problemaNaoResolvido = await prisma.ticket.count({ where: whereProblema });

  const notaMedia = total > 0
    ? Math.round((auditados.reduce((s, a) => s + a.nota, 0) / total) * 100) / 100
    : 0;

  const riscos: RiscoReabertura[] = ['BAIXO', 'MÉDIO', 'ALTO', 'CRÍTICO'];
  const porRisco = riscos.map(risco => ({
    risco,
    total: auditados.filter(a => a.riscoReabertura === risco).length,
  }));

  const porTipo = (['encerramento_prematuro', 'resolucao_real', 'reabertura', 'sem_dados'] as const).map(tipo => ({
    tipo,
    total: auditados.filter(a => a.tipo === tipo).length,
  }));

  const porAnalistaMap = new Map<string, { auditados: number; prematuros: number; resolucoesReais: number; reaberturas: number; notas: number[] }>();
  for (const a of auditados) {
    const nome = a.assigneeName || 'Sem analista';
    const e = porAnalistaMap.get(nome) || { auditados: 0, prematuros: 0, resolucoesReais: 0, reaberturas: 0, notas: [] };
    e.auditados += 1;
    if (a.tipo === 'encerramento_prematuro') e.prematuros += 1;
    if (a.tipo === 'resolucao_real') e.resolucoesReais += 1;
    if (a.tipo === 'reabertura') e.reaberturas += 1;
    e.notas.push(a.nota);
    porAnalistaMap.set(nome, e);
  }
  const porAnalista = Array.from(porAnalistaMap.entries())
    .map(([analista, e]) => ({
      analista,
      auditados: e.auditados,
      prematuros: e.prematuros,
      resolucoesReais: e.resolucoesReais,
      reaberturas: e.reaberturas,
      notaMedia: e.notas.length > 0 ? Math.round((e.notas.reduce((s, n) => s + n, 0) / e.notas.length) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.auditados - a.auditados);

  const porClienteMap = new Map<string, { auditados: number; prematuros: number; resolucoesReais: number; reaberturas: number }>();
  for (const a of auditados) {
    const nome = a.clienteNome || 'Sem cliente';
    const e = porClienteMap.get(nome) || { auditados: 0, prematuros: 0, resolucoesReais: 0, reaberturas: 0 };
    e.auditados += 1;
    if (a.tipo === 'encerramento_prematuro') e.prematuros += 1;
    if (a.tipo === 'resolucao_real') e.resolucoesReais += 1;
    if (a.tipo === 'reabertura') e.reaberturas += 1;
    porClienteMap.set(nome, e);
  }
  const porCliente = Array.from(porClienteMap.entries())
    .map(([cliente, e]) => ({ cliente, ...e }))
    .sort((a, b) => b.auditados - a.auditados);

  return {
    totalAuditados: total,
    prematuros,
    resolucoesReais,
    reaberturas,
    taxaPrematura: total > 0 ? Math.round((prematuros / total) * 100) : 0,
    pctReabertura: total > 0 ? Math.round((reaberturas / total) * 100) : 0,
    taxaEncerramentoCorreto: total > 0 ? Math.round((resolucoesReais / total) * 100) : 0,
    semConfirmacao,
    problemaNaoResolvido,
    notaMedia,
    porRisco,
    porTipo,
    porAnalista,
    porCliente,
  };
}

// ── Exportação CSV ─────────────────────────────────────────────

export function exportarAuditoriaCsv(auditados: AuditoriaEncerramento[]): string {
  const linhas: string[] = ['SEPARADOR=;'];
  linhas.push('Protocolo;Analista;Cliente;Data fechamento;Tipo;Risco reabertura;Nota;Recomenda reabertura;Sem confirmação;Motivo status;Cliente voltou;Mensagens após;CSAT;Diagnóstico');
  for (const a of auditados) {
    linhas.push([
      a.protocolo || '',
      a.assigneeName || '',
      a.clienteNome || '',
      a.dataFechamento ? a.dataFechamento.toISOString().slice(0, 10) : '',
      a.tipo,
      a.riscoReabertura,
      String(a.nota),
      a.recomendaReabertura ? 'sim' : 'não',
      a.semConfirmacao ? 'sim' : 'não',
      a.motivoStatus || '',
      a.clienteVoltou ? 'sim' : 'não',
      String(a.mensagensAposEncerramento),
      a.csatNota ? String(a.csatNota) : '',
      (a.diagnostico || '').replace(/;/g, ','),
    ].join(';'));
  }
  return linhas.join('\r\n');
}

// ── Exportação Excel (exceljs) ─────────────────────────────────

export async function exportarAuditoriaExcel(auditados: AuditoriaEncerramento[], resumo: ResumoAuditoria): Promise<Buffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Codemed Hub';
  wb.created = new Date();

  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.addRow(['Auditoria de Encerramento']).eachCell(cell => {
    cell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  });
  wsResumo.addRow([`Gerado em: ${new Date().toISOString()}`]);
  const indicadores: [string, any][] = [
    ['Tickets auditados', resumo.totalAuditados],
    ['Encerramentos prematuros', resumo.prematuros],
    ['Resoluções reais', resumo.resolucoesReais],
    ['Reaberturas', resumo.reaberturas],
    ['Taxa de encerramento correto (%)', resumo.taxaEncerramentoCorreto],
    ['Sem confirmação', resumo.semConfirmacao],
    ['Problemas não resolvidos', resumo.problemaNaoResolvido],
    ['Nota média', resumo.notaMedia],
  ];
  wsResumo.addRow([]);
  wsResumo.addRow(['Indicador', 'Valor']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const [label, valor] of indicadores) wsResumo.addRow([label, valor]);
  wsResumo.getColumn(1).width = 45;
  wsResumo.getColumn(2).width = 20;

  const wsRisco = wb.addWorksheet('Risco de Reabertura');
  wsRisco.addRow(['Risco', 'Total']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const r of resumo.porRisco) wsRisco.addRow([r.risco, r.total]);

  const wsAnalista = wb.addWorksheet('Por Analista');
  wsAnalista.addRow(['Analista', 'Auditados', 'Prematuros', 'Resoluções', 'Reaberturas', 'Nota média']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const a of resumo.porAnalista) {
    wsAnalista.addRow([a.analista, a.auditados, a.prematuros, a.resolucoesReais, a.reaberturas, a.notaMedia]);
  }

  const wsDetalhe = wb.addWorksheet('Detalhamento');
  wsDetalhe.addRow(['Protocolo', 'Cliente', 'Analista', 'Data fechamento', 'Tipo', 'Risco', 'Nota', 'Sem confirmação', 'Motivo status', 'Cliente voltou', 'CSAT', 'Diagnóstico']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const a of auditados) {
    wsDetalhe.addRow([
      a.protocolo || '',
      a.clienteNome || '',
      a.assigneeName || '',
      a.dataFechamento ? a.dataFechamento.toISOString().slice(0, 10) : '',
      a.tipo,
      a.riscoReabertura,
      a.nota,
      a.semConfirmacao ? 'sim' : 'não',
      a.motivoStatus || '',
      a.clienteVoltou ? 'sim' : 'não',
      a.csatNota ? String(a.csatNota) : '',
      (a.diagnostico || '').replace(/;/g, ','),
    ]);
  }
  wsDetalhe.getColumn(12).width = 60;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
