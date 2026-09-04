import prisma from '../../config/database';
import { callClaude, hasClaude, AI_MODEL } from '../../shared/aiClient';

// ── Tipos públicos ──────────────────────────────────────────────

export type StatusAuditoria = 'PENDENTE' | 'ANALISANDO' | 'ANALISADO' | 'REVISAR' | 'ERRO';

export interface EvidenciaProblema {
  descricao: string;
  trecho: string | null;
  autor: 'cliente' | 'agente' | 'bot' | null;
  data: string | null;
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  impacto: string | null;
  confianca: number; // 0-100
  categoria: string;
}

export interface PontoForte {
  descricao: string;
  trecho: string | null;
  confianca: number;
}

export interface RiscoAuditoria {
  tipo: string;
  descricao: string;
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  confianca: number;
}

export interface RecomendacaoAuditoria {
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  meta: string;
  acao: string;
}

export interface PlanoMelhoria {
  descricao: string;
  prazo: string; // ex: "7 dias", "30 dias", "60 dias"
  acompanhamento: string;
}

export interface AlertAuditoria {
  tipo: string;
  mensagem: string;
  gravidade: 'info' | 'baixa' | 'media' | 'alta' | 'critica';
}

export interface AuditoriaResultado {
  notas: {
    comunicacao: number;
    profissionalismo: number;
    empatia: number;
    clareza: number;
    formalidade: number;
    conhecimentoTecnico: number;
    diagnostico: number;
    resolucao: number;
    gestaoTempo: number;
    processo: number;
    encerramento: number;
    seguranca: number;
    responsabilidade: number;
    satisfacaoCliente: number;
    notaGeral: number;
  };
  classificacao: string;
  classificacaoResolucao: string;
  classificacaoEncerramento: string;
  padrao: string;
  confiancaMedia: number;
  analiseInconclusiva: boolean;
  resumoExecutivo: string;
  analiseQualitativa: string;
  explicacaoLeiga: string;
  evidenciaProblemas: EvidenciaProblema[];
  pontosFortes: PontoForte[];
  riscos: RiscoAuditoria[];
  recomendacoes: RecomendacaoAuditoria[];
  planoMelhoria: PlanoMelhoria[];
  alertas: AlertAuditoria[];
  riscoInsatisfacao: string;
  retrabalho: boolean;
  custoOperacionalMin: number;
}

// ── Constantes ──────────────────────────────────────────────────

export const CATEGORIAS_14 = [
  'Comunicação',
  'Profissionalismo',
  'Empatia',
  'Clareza',
  'Formalidade',
  'Conhecimento técnico',
  'Capacidade de diagnóstico',
  'Capacidade de resolução',
  'Gestão do tempo',
  'Cumprimento de processo',
  'Encerramento',
  'Segurança',
  'Responsabilidade',
  'Satisfação do cliente',
] as const;

export const CLASSIFICACOES_GERAIS = [
  'EXCELENTE',
  'MUITO_BOM',
  'BOM',
  'ATENCAO',
  'ABAIXO_DA_MEDIA',
  'CRITICO',
] as const;

export const CLASSIFICACOES_RESOLUCAO = [
  'RESOLVIDO',
  'PROVAVELMENTE_RESOLVIDO',
  'PARCIALMENTE_RESOLVIDO',
  'NAO_RESOLVIDO',
  'SEM_CONFIRMACAO',
  'REABERTO',
  'TRANSFERIDO',
  'PRECISOU_DE_DESENVOLVIMENTO',
  'IMPLANTACAO',
  'OUTRO_SETOR',
] as const;

export const CLASSIFICACOES_ENCERRAMENTO = [
  'ADEQUADO',
  'PARCIAL',
  'INADEQUADO',
  'SEM_ENCERRAMENTO',
] as const;

export const PADROES = [
  'EVENTO_ISOLADO',
  'PADRAO_RECORRENTE',
  'PROBLEMA_FREQUENTE',
  'PROBLEMA_CRITICO',
  'PROBLEMA_SISTEMICO',
] as const;

// ── Helpers de mensagens ───────────────────────────────────────

interface MensagemAudit {
  fromMe: boolean;
  content: string | null;
  createdAt: Date;
  source: string | null;
  tipo: string | null;
}

function normalizar(texto: string | null | undefined): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rotularAutor(m: MensagemAudit): 'cliente' | 'agente' | 'bot' {
  const conteudo = (m.content || '').toLowerCase();
  const pareceBot =
    m.source === 'bot' ||
    m.tipo === 'bot' ||
    conteudo.startsWith('*') ||
    conteudo.includes('departamento') ||
    conteudo.includes('digite 1') ||
    conteudo.includes('digite 2') ||
    conteudo.includes('para dar continuidade') ||
    conteudo.includes('avaliacao');
  if (m.fromMe) return pareceBot ? 'bot' : 'agente';
  return 'cliente';
}

function resumoConversa(mensagens: MensagemAudit[], limite = 80): string {
  const slice = mensagens.slice(-limite);
  return slice
    .map((m) => {
      const autor = rotularAutor(m);
      const data = m.createdAt.toISOString();
      return `[${data}] (${autor}${m.fromMe ? ', enviada pelo atendimento' : ', cliente'}) ${m.content || '(sem conteúdo)'}`;
    })
    .join('\n');
}

// ── Prompt ─────────────────────────────────────────────────────

function buildPromptAuditoria(
  ticket: any,
  mensagens: MensagemAudit[],
  dadosContexto: string
): string {
  const conversa = resumoConversa(mensagens, 80);
  return `Você é um auditor especialista em qualidade de atendimento ao cliente e helpdesk. Você receberá o registro completo de um ticket de atendimento e deve produzir uma auditoria profissional, imparcial e baseada ESTRITAMENTE em evidências da conversa.

REGRAS DE OURO:
1. NUNCA invente evidências. Toda conclusão, nota, problema ou ponto forte DEVE estar apoiado em trechos REAIS da conversa fornecida.
2. Se não houver evidência suficiente para concluir algo, use confiança baixa e marque analiseInconclusiva=true.
3. Não diagnostique a personalidade do atendente. Descreva comportamentos observáveis com números (ex: "mensagens curtas em 4 ocasiões") em vez de rótulos ("o atendente é preguiçoso").
4. Limite os trechos de evidência a, no máximo, 1 a 5 mensagens REAIS (copie o texto exato da conversa).
5. Notas de 0 a 100 em 14 categorias. 100 = excelência, 0 = gravíssimo.
6. A IA apenas SUGERE. As decisões pertencem ao gestor. Seja construtivo.
7. Evidências citadas no campo "trecho" devem ser copiadas literalmente da conversa — o sistema valida isso e descartará trechos que não existem.

DADOS DO TICKET:
${dadosContexto}

CONVERSA COMPLETA (as mensagens estão no formato [data/hora] (autor) conteúdo):
${conversa}

Responda APENAS com um JSON válido (sem markdown, sem code block) com esta estrutura exata:
{
  "notas": {
    "comunicacao": 0-100,
    "profissionalismo": 0-100,
    "empatia": 0-100,
    "clareza": 0-100,
    "formalidade": 0-100,
    "conhecimentoTecnico": 0-100,
    "diagnostico": 0-100,
    "resolucao": 0-100,
    "gestaoTempo": 0-100,
    "processo": 0-100,
    "encerramento": 0-100,
    "seguranca": 0-100,
    "responsabilidade": 0-100,
    "satisfacaoCliente": 0-100
  },
  "classificacao": "EXCELENTE|MUITO_BOM|BOM|ATENCAO|ABAIXO_DA_MEDIA|CRITICO",
  "classificacaoResolucao": "RESOLVIDO|PROVAVELMENTE_RESOLVIDO|PARCIALMENTE_RESOLVIDO|NAO_RESOLVIDO|SEM_CONFIRMACAO|REABERTO|TRANSFERIDO|PRECISOU_DE_DESENVOLVIMENTO|IMPLANTACAO|OUTRO_SETOR",
  "classificacaoEncerramento": "ADEQUADO|PARCIAL|INADEQUADO|SEM_ENCERRAMENTO",
  "padrao": "EVENTO_ISOLADO|PADRAO_RECORRENTE|PROBLEMA_FREQUENTE|PROBLEMA_CRITICO|PROBLEMA_SISTEMICO",
  "confiancaMedia": 0-100,
  "analiseInconclusiva": true|false,
  "resumoExecutivo": "resumo curto e direto do que aconteceu",
  "analiseQualitativa": "análise detalhada do atendimento com interpretação das notas",
  "explicacaoLeiga": "explique em linguagem simples, sem jargão, o que o atendimento significou para o cliente e para a empresa",
  "evidenciaProblemas": [
    {"descricao": "descrição objetiva do problema", "trecho": "texto literal da conversa ou null", "autor": "cliente|agente|bot|null", "data": "data do trecho ou null", "gravidade": "baixa|media|alta|critica", "impacto": "impacto no cliente/empresa", "confianca": 0-100, "categoria": "categoria da 14 à qual se refere"}
  ],
  "pontosFortes": [{"descricao": "ponto positivo", "trecho": "texto literal ou null", "confianca": 0-100}],
  "riscos": [{"tipo": "tipo do risco", "descricao": "descrição", "gravidade": "baixa|media|alta|critica", "confianca": 0-100}],
  "recomendacoes": [{"descricao": "recomendação", "prioridade": "baixa|media|alta|urgente", "meta": "meta mensurável", "acao": "ação concreta para o gestor"}],
  "planoMelhoria": [{"descricao": "ação de melhoria", "prazo": "7 dias|30 dias|60 dias", "acompanhamento": "como acompanhar"}],
  "alertas": [{"tipo": "tipo do alerta", "mensagem": "mensagem", "gravidade": "info|baixa|media|alta|critica"}],
  "riscoInsatisfacao": "BAIXO|MEDIO|ALTO|CRITICO",
  "retrabalho": true|false,
  "custoOperacionalMin": "minutos estimados de retrabalho ou 0"
}

CRITÉRIOS DE CLASSIFICAÇÃO (nota geral):
- EXCELENTE: >= 90
- MUITO_BOM: 80-89
- BOM: 70-79
- ATENCAO: 50-69
- ABAIXO_DA_MEDIA: 30-49
- CRITICO: < 30

A nota geral é a média ponderada das 14 categorias com estes pesos:
comunicacao 8, profissionalismo 8, empatia 7, clareza 8, formalidade 5, conhecimentoTecnico 9, diagnostico 9, resolucao 10, gestaoTempo 6, processo 7, encerramento 8, seguranca 10, responsabilidade 8, satisfacaoCliente 10.`;
}

// ── Parse / validação ───────────────────────────────────────────

function extrairJson(texto: string): any {
  const limpo = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio !== -1 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch {
        throw new Error('JSON inválido');
      }
    }
    throw new Error('JSON não encontrado');
  }
}

function clampNota(valor: any, fallback = 0): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validarEvidencias(resultado: AuditoriaResultado, mensagens: MensagemAudit[]): void {
  const textosReais = new Set(mensagens.map((m) => normalizar(m.content)));
  const todosTextos = textosReais;

  function trechoExiste(trecho: string | null | undefined): boolean {
    if (!trecho) return false;
    const norm = normalizar(trecho);
    if (!norm || norm.length < 5) return false;
    if (todosTextos.has(norm)) return true;
    // trecho pode ser substring de uma mensagem maior
    for (const t of todosTextos) {
      if (t && (t.includes(norm) || norm.includes(t))) return true;
    }
    return false;
  }

  const problemasValidos = (resultado.evidenciaProblemas || []).filter((p) => {
    const ok = p && (p.trecho === null || trechoExiste(p.trecho));
    if (!ok) {
      resultado.alertas = resultado.alertas || [];
      resultado.alertas.push({
        tipo: 'evidencia_descartada',
        mensagem: `Evidência descartada por não existir na conversa: ${(p as any)?.descricao || 'sem descrição'}`,
        gravidade: 'info',
      });
    }
    return ok;
  });
  resultado.evidenciaProblemas = problemasValidos;

  const fortesValidos = (resultado.pontosFortes || []).filter((pf) => {
    const ok = pf && (pf.trecho === null || trechoExiste(pf.trecho));
    if (!ok) {
      resultado.alertas = resultado.alertas || [];
      resultado.alertas.push({
        tipo: 'evidencia_descartada',
        mensagem: 'Ponto forte descartado por evidência inexistente.',
        gravidade: 'info',
      });
    }
    return ok;
  });
  resultado.pontosFortes = fortesValidos;

  // Se não restou nenhuma evidência para problemas e havia problemas, marcar inconclusivo
  if ((resultado.evidenciaProblemas?.length || 0) === 0 && resultado.analiseInconclusiva === false) {
    // manter analiseInconclusiva conforme retorno da IA — não forçar
  }
}

// ── Fallback local (sem Claude) ─────────────────────────────────

function buildFallbackAuditoria(ticket: any, mensagens: MensagemAudit[]): AuditoriaResultado {
  const alertas: AlertAuditoria[] = [];
  const problemas: EvidenciaProblema[] = [];
  const fortes: PontoForte[] = [];
  const riscos: RiscoAuditoria[] = [];
  const recomendacoes: RecomendacaoAuditoria[] = [];
  const plano: PlanoMelhoria[] = [];
  const autoradas: MensagemAudit[] = mensagens.filter((m) => m.fromMe);

  let comunicacao = 70;
  let profissionalismo = 70;
  let empatia = 65;
  let clareza = 70;
  let formalidade = 70;
  let conhecimentoTecnico = 65;
  let diagnostico = 65;
  let resolucao = 65;
  let gestaoTempo = 65;
  let processo = 65;
  let encerramento = 60;
  let seguranca = 80;
  let responsabilidade = 70;
  let satisfacaoCliente = 65;

  const palavrasInformais = ['blz', 'beleza', 'tranquilo', 'massa', 'top', 'irado', 'maneiro', 'foda', 'caralho', 'porra', 'merda', 'vou ver', 'deixa quieto'];
  const palavrasEmpatia = ['entendo', 'compreendo', 'sinto muito', 'lamento', 'pode ficar tranquilo', 'vou ajudar', 'vou resolver'];
  const palavrasResolucao = ['resolvi', 'resolvido', 'corrigido', 'pronto', 'funcionou', 'ajuste feito', 'atualizei', 'configurei'];
  const saudacoes = ['olá', 'bom dia', 'boa tarde', 'boa noite', 'oi', 'prezado', 'estimado'];

  let msgsCurta = 0;
  let totalAgente = 0;
  let saudaPrev = 0;
  for (const m of autoradas) {
    const texto = (m.content || '').toLowerCase();
    totalAgente++;
    if (texto.length < 20) msgsCurta++;
    if (saudacoes.some((s) => texto.includes(s))) saudaPrev++;
  }

  const msgFinal = autoradas[autoradas.length - 1]?.content?.toLowerCase() || '';

  if (palavrasInformais.some((p) => msgFinal.includes(p))) {
    profissionalismo -= 15;
    formalidade -= 15;
    comunicacao -= 8;
    problemas.push({ descricao: 'Linguagem informal na comunicação com o cliente', trecho: autoradas[autoradas.length - 1]?.content, autor: 'agente', data: autoradas[autoradas.length - 1]?.createdAt.toISOString() || null, gravidade: 'media', impacto: 'Reduz a percepção de profissionalismo', confianca: 80, categoria: 'Comunicação' });
    alertas.push({ tipo: 'informalidade', mensagem: 'Linguagem informal detectada na última mensagem do atendente', gravidade: 'media' });
  }

  if (totalAgente > 0 && saudaPrev === 0) {
    comunicacao -= 10;
    cordialidadeNota(empatia);
    problemas.push({ descricao: 'Ausência de saudação nas mensagens do atendente', trecho: autoradas[0]?.content, autor: 'agente', data: autoradas[0]?.createdAt.toISOString() || null, gravidade: 'baixa', impacto: 'Atendimento menos acolhedor', confianca: 70, categoria: 'Comunicação' });
  }

  function cordialidadeNota(n: number) { empatia = Math.max(0, Math.min(100, n - 10)); }

  if (palavrasEmpatia.some((p) => msgFinal.includes(p))) {
    empatia += 10;
    fortes.push({ descricao: 'Demonstrou empatia com o problema do cliente', trecho: autoradas[autoradas.length - 1]?.content, confianca: 75 });
  }

  if (palavrasResolucao.some((p) => msgFinal.includes(p))) {
    resolucao += 10;
    diagnostico += 5;
    fortes.push({ descricao: 'Apresentou resolução concreta ao cliente', trecho: autoradas[autoradas.length - 1]?.content, confianca: 75 });
  } else if (totalAgente > 0) {
    resolucao -= 10;
    problemas.push({ descricao: 'Última resposta do atendente não apresenta resolução concreta', trecho: autoradas[autoradas.length - 1]?.content, autor: 'agente', data: autoradas[autoradas.length - 1]?.createdAt.toISOString() || null, gravidade: 'alta', impacto: 'Pode gerar novo contato do cliente', confianca: 60, categoria: 'Capacidade de resolução' });
  }

  if (msgsCurta > 0 && msgsCurta >= Math.max(1, Math.floor(totalAgente / 3))) {
    clareza -= 12;
    comunicacao -= 8;
    alertas.push({ tipo: 'mensagens_curtas', mensagem: `${msgsCurta} mensagens do atendente muito curtas`, gravidade: 'media' });
  }

  if (ticket.resolvidoPorIa) {
    satisfacaoCliente = Math.min(100, satisfacaoCliente + 5);
    fortes.push({ descricao: 'Resolução auxiliada por IA', trecho: null, confianca: 60 });
  }

  if (ticket.motivoStatus === 'encerrado_sem_resolucao') {
    resolucao = Math.max(0, resolucao - 25);
    satisfacaoCliente = Math.max(0, satisfacaoCliente - 20);
    encerramento = Math.max(0, encerramento - 20);
    problemas.push({ descricao: 'Ticket encerrado sem resolução confirmada', trecho: null, autor: 'agente', data: ticket.dataFechamento?.toISOString() || null, gravidade: 'critica', impacto: 'Cliente pode retornar ou ficar insatisfeito', confianca: 85, categoria: 'Encerramento' });
    riscos.push({ tipo: 'insatisfacao', descricao: 'Encerramento sem resolução aumenta risco de reabertura e CSAT negativo', gravidade: 'alta', confianca: 80 });
  }

  if (ticket.csatResposta && ticket.csatResposta.nota !== null && ticket.csatResposta.nota <= 2) {
    satisfacaoCliente = Math.max(0, satisfacaoCliente - 25);
    riscoInsatisfacao = 'CRITICO';
    alertas.push({ tipo: 'csat_baixo', mensagem: `CSAT respondido com nota ${ticket.csatResposta.nota}/5`, gravidade: 'critica' });
    riscos.push({ tipo: 'csat', descricao: 'Avaliação de satisfação negativa do cliente', gravidade: 'critica', confianca: 95 });
  }

  if (ticket.csatResposta && ticket.csatResposta.nota !== null && ticket.csatResposta.nota >= 4) {
    satisfacaoCliente = Math.min(100, satisfacaoCliente + 15);
    fortes.push({ descricao: `Cliente avaliou o atendimento com ${ticket.csatResposta.nota}/5`, trecho: null, confianca: 90 });
  }

  const notasFinais = {
    comunicacao: clampNota(comunicacao),
    profissionalismo: clampNota(profissionalismo),
    empatia: clampNota(empatia),
    clareza: clampNota(clareza),
    formalidade: clampNota(formalidade),
    conhecimentoTecnico: clampNota(conhecimentoTecnico),
    diagnostico: clampNota(diagnostico),
    resolucao: clampNota(resolucao),
    gestaoTempo: clampNota(gestaoTempo),
    processo: clampNota(processo),
    encerramento: clampNota(encerramento),
    seguranca: clampNota(seguranca),
    responsabilidade: clampNota(responsabilidade),
    satisfacaoCliente: clampNota(satisfacaoCliente),
    notaGeral: 0,
  };
  notasFinais.notaGeral = Math.round(calcularNotaGeral(notasFinais) * 10) / 10;

  const retrabalho = ticket.numeroReaberturas > 0 || ticket.motivoStatus === 'encerrado_sem_resolucao';

  if (ticket.numeroReaberturas > 0) {
    riscos.push({ tipo: 'reabertura', descricao: `Ticket foi reaberto ${ticket.numeroReaberturas} vez(es)`, gravidade: 'media', confianca: 90 });
    gestaoTempo = Math.max(0, gestaoTempo - 10);
    processo = Math.max(0, processo - 10);
  }

  return {
    notas: notasFinais,
    classificacao: classificarNota(notasFinais.notaGeral),
    classificacaoResolucao: classificarResolucao(ticket, mensagens, retrabalho),
    classificacaoEncerramento: classificarEncerramento(ticket),
    padrao: ticket.numeroReaberturas > 1 ? 'PROBLEMA_FREQUENTE' : ticket.numeroReaberturas > 0 ? 'PADRAO_RECORRENTE' : 'EVENTO_ISOLADO',
    confiancaMedia: 55,
    analiseInconclusiva: false,
    resumoExecutivo: `Atendimento com nota geral ${notasFinais.notaGeral}/100 (${classificarNota(notasFinais.notaGeral)}). ${problemas.length} problema(s) identificado(s).`,
    analiseQualitativa: `Auditoria automática local (fallback). ${problemas.map((p) => `- ${p.descricao} (${p.gravidade}).`).join('\n')}`,
    explicacaoLeiga: 'Esta é uma análise automática preliminar do atendimento, baseada em regras de qualidade. A avaliação final deve ser feita pelo gestor.',
    evidenciaProblemas: problemas,
    pontosFortes: fortes,
    riscos,
    recomendacoes: recomendacoes.length ? recomendacoes : [{ descricao: 'Revisar o atendimento com o analista responsável', prioridade: 'media', meta: 'Alinhar expectativas e padrões', acao: 'Agendar 1:1 com o analista para revisar o caso' }],
    planoMelhoria: plano.length ? plano : [{ descricao: 'Revisar padrões de comunicação e resolução', prazo: '30 dias', acompanhamento: 'Comparar notas em auditorias futuras' }],
    alertas,
    riscoInsatisfacao: typeof riscoInsatisfacao === 'string' ? riscoInsatisfacao : 'BAIXO',
    retrabalho,
    custoOperacionalMin: retrabalho ? Math.round((ticket.metrics?.tempoTotalMin || 30) * 0.5) : 0,
  };
}

let riscoInsatisfacao: string = 'BAIXO';

function calcularNotaGeral(notas: Record<string, number>): number {
  const pesos: Record<string, number> = {
    comunicacao: 8, profissionalismo: 8, empatia: 7, clareza: 8, formalidade: 5,
    conhecimentoTecnico: 9, diagnostico: 9, resolucao: 10, gestaoTempo: 6, processo: 7,
    encerramento: 8, seguranca: 10, responsabilidade: 8, satisfacaoCliente: 10,
  };
  let soma = 0;
  let somaPeso = 0;
  for (const [k, v] of Object.entries(notas)) {
    if (k === 'notaGeral' || !(k in pesos)) continue;
    soma += v * pesos[k];
    somaPeso += pesos[k];
  }
  return somaPeso ? soma / somaPeso : 0;
}

export function classificarNota(nota: number): string {
  if (nota >= 90) return 'EXCELENTE';
  if (nota >= 80) return 'MUITO_BOM';
  if (nota >= 70) return 'BOM';
  if (nota >= 50) return 'ATENCAO';
  if (nota >= 30) return 'ABAIXO_DA_MEDIA';
  return 'CRITICO';
}

function classificarResolucao(ticket: any, mensagens: MensagemAudit[], retrabalho: boolean): string {
  if (ticket.etapa === 'concluido' || ticket.status === 'resolvido' || ticket.status === 'concluido') {
    if (retrabalho) return 'PROVAVELMENTE_RESOLVIDO';
    return 'RESOLVIDO';
  }
  if (ticket.motivoStatus === 'encerrado_sem_resolucao') return 'NAO_RESOLVIDO';
  if (retrabalho) return 'REABERTO';
  if (ticket.status === 'transferido') return 'TRANSFERIDO';
  if (ticket.status === 'fechado' || ticket.etapa === 'aguardando_os') return 'SEM_CONFIRMACAO';
  return 'SEM_CONFIRMACAO';
}

function classificarEncerramento(ticket: any): string {
  if (!ticket.dataFechamento && ticket.etapa !== 'concluido') return 'SEM_ENCERRAMENTO';
  if (ticket.motivoStatus === 'encerrado_sem_resolucao') return 'INADEQUADO';
  if (ticket.csatResposta && ticket.csatResposta.nota !== null && ticket.csatResposta.nota <= 2) return 'INADEQUADO';
  if (ticket.numeroReaberturas > 0) return 'PARCIAL';
  return 'ADEQUADO';
}

// ── Função principal ────────────────────────────────────────────

export async function auditarTicket(ticketId: string, usarIa = true): Promise<any> {
  try {
    await prisma.auditoriaProfissional.updateMany({
      where: { ticketId, status: 'ANALISANDO' },
      data: { status: 'REVISAR' },
    });

    const auditoriaPendente = await prisma.auditoriaProfissional.create({
      data: { ticketId, status: 'ANALISANDO' },
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, razaoSocial: true } },
        departamento: { select: { id: true, nome: true } },
        csatResposta: { select: { nota: true, comentario: true } },
        metrics: true,
        aiAgentAudits: { orderBy: { processadoEm: 'desc' }, take: 5 },
      },
    });
    if (!ticket) {
      await prisma.auditoriaProfissional.update({ where: { id: auditoriaPendente.id }, data: { status: 'ERRO' } });
      throw new Error('Ticket não encontrado');
    }

    const mensagens = await prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: { fromMe: true, content: true, createdAt: true, source: true, tipo: true },
      take: 200,
    });

    const numeroReaberturas = await prisma.ticket.count({
      where: { contactPhone: ticket.contactPhone, dataFechamento: { not: null }, id: { not: ticket.id } },
    });

    const dadosContexto = [
      `Protocolo: ${ticket.protocolo || 'n/a'}`,
      `Cliente: ${ticket.contactName || ticket.client?.razaoSocial || 'n/a'}`,
      `Atendente: ${ticket.assignee?.name || 'não atribuído'}`,
      `Departamento: ${ticket.departamento?.nome || ticket.departamentoId || 'n/a'}`,
      `Categoria: ${ticket.categoria || 'n/a'}`,
      `Prioridade: ${ticket.prioridade || 'n/a'}`,
      `Status: ${ticket.status}`,
      `Etapa: ${ticket.etapa}`,
      `Abertura: ${ticket.dataAbertura?.toISOString() || 'n/a'}`,
      `Fechamento: ${ticket.dataFechamento?.toISOString() || 'não fechado'}`,
      `Motivo status: ${ticket.motivoStatus || 'n/a'}`,
      `Resumo final: ${ticket.resumoFinal || 'n/a'}`,
      `CSAT: ${ticket.csatResposta ? `${ticket.csatResposta.nota ?? 'sem nota'}/5` : 'não respondido'}`,
      `Número de reaberturas estimadas: ${numeroReaberturas}`,
      `Horas de desenvolvimento: ${ticket.horasDesenvolvimento ?? 'n/a'}`,
      `Tempo total (min): ${ticket.metrics?.tempoTotalMin ?? 'n/a'}`,
      `IA resolveu: ${ticket.resolvidoPorIa ? 'sim' : 'não'}`,
      `Resolvido sem ajuda: ${ticket.resolvidoSemAjuda ? 'sim' : 'não'}`,
    ].join('\n');

    let resultado: AuditoriaResultado;

    if (usarIa && hasClaude()) {
      try {
        const prompt = buildPromptAuditoria(ticket, mensagens, dadosContexto);
        const resposta = await callClaude(prompt, 2500, 'auditoria-profissional');
        const parsed = extrairJson(resposta);
        resultado = normalizarResultado(parsed);
        validarEvidencias(resultado, mensagens);
      } catch (err: any) {
        console.warn('[AuditoriaProfissional] Falha na IA, usando fallback local:', err?.message);
        resultado = buildFallbackAuditoria(ticket, mensagens);
      }
    } else {
      resultado = buildFallbackAuditoria(ticket, mensagens);
    }

    const notaGeral = Math.round(calcularNotaGeral(resultado.notas) * 10) / 10;
    resultado.notas.notaGeral = notaGeral;
    resultado.classificacao = classificarNota(notaGeral);

    const custoTokens = usarIa && hasClaude() ? null : null;

    const auditado = await prisma.auditoriaProfissional.update({
      where: { id: auditoriaPendente.id },
      data: {
        protocolo: ticket.protocolo,
        contactName: ticket.contactName || ticket.client?.razaoSocial || null,
        agenteId: ticket.assigneeId,
        clienteId: ticket.clientId,
        departamentoId: ticket.departamentoId,
        categoria: ticket.categoria,
        status: 'ANALISADO',
        notaComunicacao: resultado.notas.comunicacao,
        notaProfissionalismo: resultado.notas.profissionalismo,
        notaEmpatia: resultado.notas.empatia,
        notaClareza: resultado.notas.clareza,
        notaFormalidade: resultado.notas.formalidade,
        notaConhecimentoTecnico: resultado.notas.conhecimentoTecnico,
        notaDiagnostico: resultado.notas.diagnostico,
        notaResolucao: resultado.notas.resolucao,
        notaGestaoTempo: resultado.notas.gestaoTempo,
        notaProcesso: resultado.notas.processo,
        notaEncerramento: resultado.notas.encerramento,
        notaSeguranca: resultado.notas.seguranca,
        notaResponsabilidade: resultado.notas.responsabilidade,
        notaSatisfacaoCliente: resultado.notas.satisfacaoCliente,
        notaGeral,
        classificacao: resultado.classificacao,
        classificacaoResolucao: resultado.classificacaoResolucao,
        classificacaoEncerramento: resultado.classificacaoEncerramento,
        padrao: resultado.padrao,
        confiancaMedia: clampNota(resultado.confiancaMedia),
        analiseInconclusiva: !!resultado.analiseInconclusiva,
        resumoExecutivo: resultado.resumoExecutivo || null,
        analiseQualitativa: resultado.analiseQualitativa || null,
        explicacaoLeiga: resultado.explicacaoLeiga || null,
        evidenciaProblemas: JSON.stringify(resultado.evidenciaProblemas || []),
        pontosFortes: JSON.stringify(resultado.pontosFortes || []),
        riscos: JSON.stringify(resultado.riscos || []),
        recomendacoes: JSON.stringify(resultado.recomendacoes || []),
        planoMelhoria: JSON.stringify(resultado.planoMelhoria || []),
        alertas: JSON.stringify(resultado.alertas || []),
        riscoInsatisfacao: resultado.riscoInsatisfacao || 'BAIXO',
        retrabalho: !!resultado.retrabalho,
        custoOperacionalMin: Math.round(resultado.custoOperacionalMin || 0),
        reaberto: numeroReaberturas > 0,
        numeroReaberturas,
        modeloUsado: usarIa && hasClaude() ? AI_MODEL : 'fallback-local',
        analisadoEm: new Date(),
      },
    });

    return auditado;
  } catch (err: any) {
    console.error('[AuditoriaProfissional] Erro ao auditar ticket:', err?.message);
    throw err;
  }
}

function normalizarResultado(parsed: any): AuditoriaResultado {
  const notas = parsed?.notas || {};
  return {
    notas: {
      comunicacao: clampNota(notas.comunicacao, 0),
      profissionalismo: clampNota(notas.profissionalismo, 0),
      empatia: clampNota(notas.empatia, 0),
      clareza: clampNota(notas.clareza, 0),
      formalidade: clampNota(notas.formalidade, 0),
      conhecimentoTecnico: clampNota(notas.conhecimentoTecnico, 0),
      diagnostico: clampNota(notas.diagnostico, 0),
      resolucao: clampNota(notas.resolucao, 0),
      gestaoTempo: clampNota(notas.gestaoTempo, 0),
      processo: clampNota(notas.processo, 0),
      encerramento: clampNota(notas.encerramento, 0),
      seguranca: clampNota(notas.seguranca, 0),
      responsabilidade: clampNota(notas.responsabilidade, 0),
      satisfacaoCliente: clampNota(notas.satisfacaoCliente, 0),
      notaGeral: 0,
    },
    classificacao: (parsed.classificacao || 'ATENCAO') as string,
    classificacaoResolucao: (parsed.classificacaoResolucao || 'SEM_CONFIRMACAO') as string,
    classificacaoEncerramento: (parsed.classificacaoEncerramento || 'SEM_ENCERRAMENTO') as string,
    padrao: (parsed.padrao || 'EVENTO_ISOLADO') as string,
    confiancaMedia: clampNota(parsed.confiancaMedia, 0),
    analiseInconclusiva: !!parsed.analiseInconclusiva,
    resumoExecutivo: typeof parsed.resumoExecutivo === 'string' ? parsed.resumoExecutivo : null,
    analiseQualitativa: typeof parsed.analiseQualitativa === 'string' ? parsed.analiseQualitativa : null,
    explicacaoLeiga: typeof parsed.explicacaoLeiga === 'string' ? parsed.explicacaoLeiga : null,
    evidenciaProblemas: Array.isArray(parsed.evidenciaProblemas) ? parsed.evidenciaProblemas : [],
    pontosFortes: Array.isArray(parsed.pontosFortes) ? parsed.pontosFortes : [],
    riscos: Array.isArray(parsed.riscos) ? parsed.riscos : [],
    recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
    planoMelhoria: Array.isArray(parsed.planoMelhoria) ? parsed.planoMelhoria : [],
    alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
    riscoInsatisfacao: (parsed.riscoInsatisfacao || 'BAIXO') as string,
    retrabalho: !!parsed.retrabalho,
    custoOperacionalMin: Math.round(Number(parsed.custoOperacionalMin) || 0),
  };
}

// ── Consultas ───────────────────────────────────────────────────

export async function getAuditoriaByTicket(ticketId: string) {
  return prisma.auditoriaProfissional.findFirst({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAuditoriaById(id: string) {
  return prisma.auditoriaProfissional.findUnique({
    where: { id },
    include: { agente: { select: { id: true, name: true } } },
  });
}

export interface FiltroAuditoria {
  dataInicio?: Date;
  dataFim?: Date;
  agenteId?: string;
  clienteId?: string;
  departamentoId?: string;
  categoria?: string;
  status?: string;
  classificacao?: string;
  classificacaoResolucao?: string;
  revisaoStatus?: string;
  limit?: number;
  offset?: number;
}

export async function listarAuditorias(filtro: FiltroAuditoria = {}) {
  const where: any = {};
  if (filtro.dataInicio || filtro.dataFim) {
    where.auditadoEm = {
      ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
      ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
    };
  }
  if (filtro.agenteId) where.agenteId = filtro.agenteId;
  if (filtro.clienteId) where.clienteId = filtro.clienteId;
  if (filtro.departamentoId) where.departamentoId = filtro.departamentoId;
  if (filtro.categoria) where.categoria = filtro.categoria;
  if (filtro.status) where.status = filtro.status;
  if (filtro.classificacao) where.classificacao = filtro.classificacao;
  if (filtro.classificacaoResolucao) where.classificacaoResolucao = filtro.classificacaoResolucao;
  if (filtro.revisaoStatus) where.revisaoStatus = filtro.revisaoStatus;

  const [items, total] = await Promise.all([
    prisma.auditoriaProfissional.findMany({
      where,
      orderBy: { auditadoEm: 'desc' },
      take: filtro.limit || 50,
      skip: filtro.offset || 0,
      include: {
        agente: { select: { id: true, name: true } },
      },
    }),
    prisma.auditoriaProfissional.count({ where }),
  ]);

  return { items, total, limit: filtro.limit || 50, offset: filtro.offset || 0 };
}

export async function revisarAuditoria(
  auditoriaId: string,
  revisaoStatus: string,
  justificativa: string,
  revisadoPorId: string
) {
  const statusMap: Record<string, string> = {
    CONFIRMADO: 'ANALISADO',
    DISCORDO: 'ANALISADO',
    REVISAR: 'REVISAR',
    NAO_SE_APLICA: 'ANALISADO',
  };
  return prisma.auditoriaProfissional.update({
    where: { id: auditoriaId },
    data: {
      revisaoStatus,
      revisaoJustificativa: justificativa || null,
      revisadoPorId,
      revisadoEm: new Date(),
      status: statusMap[revisaoStatus] || 'ANALISADO',
    },
  });
}
