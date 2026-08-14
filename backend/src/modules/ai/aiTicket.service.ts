import prisma from '../../config/database';
import { classifyLocal } from '../helpdesk/classificador';
import { logAction } from '../audit/audit.service';
import { propostaRespostaIA, getConfigAutoAtendimento } from './aiValidation.service';
import { callClaude, hasClaude } from '../../shared/aiClient';

// ── Helper: buscar ultimas N mensagens do ticket ────────────────

async function getMensagens(ticketId: string, limite = 10) {
  return prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: { id: true, content: true, fromMe: true, tipo: true, source: true, createdAt: true },
  });
}

function montarHistorico(mensagens: Awaited<ReturnType<typeof getMensagens>>): string {
  return mensagens
    .map((m) => {
      const remetente = m.fromMe ? 'Agente' : 'Cliente';
      const texto = m.content || '[sem conteúdo]';
      return `${remetente}: ${texto}`;
    })
    .join('\n');
}

// ── 1. CLASSIFICACAO AUTOMATICA ────────────────────────────────

interface ClassificacaoResultado {
  categoria: string;
  prioridade: string;
  confianca: number;
  metodo: 'regex' | 'llm' | 'hibrido';
}

export async function classificarTicket(ticketId: string): Promise<ClassificacaoResultado> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, assunto: true, categoria: true, prioridade: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const mensagens = await getMensagens(ticketId, 10);
  const textoParaClassificar = [
    ticket.assunto || '',
    ...mensagens.map((m) => m.content || ''),
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000);

  if (!textoParaClassificar.trim()) {
    return { categoria: 'outros', prioridade: 'media', confianca: 0, metodo: 'regex' };
  }

  // Classificacao local (regex)
  const localCategoria = classifyLocal(textoParaClassificar);

  if (!hasClaude()) {
    const resultado: ClassificacaoResultado = {
      categoria: localCategoria || 'outros',
      prioridade: ticket.prioridade || 'media',
      confianca: 40,
      metodo: 'regex',
    };
    await salvarClassificacao(ticketId, resultado);
    return resultado;
  }

  // Classificacao via LLM
  try {
    const prompt = `Analise esta conversa de suporte e classifique o ticket.

CONVERSA:
${montarHistorico(mensagens.slice(-5))}

Assunto: ${ticket.assunto || 'não informado'}

Responda APENAS com JSON (sem markdown):
{
  "categoria": "uma das opcoes: suporte_tecnico, duvida_faturamento, solicitacao_mudanca, treinamento, reclamacao, orcamento, agendamento, cancelamento, outro",
  "prioridade": "uma das opcoes: baixa, media, alta, urgente, critica",
  "confianca": 0-100,
  "motivo": "breve justificativa"
}`;

    const resposta = await callClaude(prompt, 300);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const resultado: ClassificacaoResultado = {
        categoria: parsed.categoria || localCategoria || 'outros',
        prioridade: parsed.prioridade || ticket.prioridade || 'media',
        confianca: Math.min(100, Math.max(0, parsed.confianca || 70)),
        metodo: 'hibrido',
      };
      await salvarClassificacao(ticketId, resultado, resposta);
      return resultado;
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM classificacao, usando regex:', (e as Error).message);
  }

  // Fallback: regex
  const resultado: ClassificacaoResultado = {
    categoria: localCategoria || 'outros',
    prioridade: ticket.prioridade || 'media',
    confianca: 40,
    metodo: 'regex',
  };
  await salvarClassificacao(ticketId, resultado);
  return resultado;
}

async function salvarClassificacao(
  ticketId: string,
  resultado: ClassificacaoResultado,
  rawResponse?: string
) {
  await prisma.aIClassification.create({
    data: {
      ticketId,
      categoria: resultado.categoria,
      prioridade: resultado.prioridade,
      confianca: resultado.confianca,
      metodo: resultado.metodo,
      rawResponse: rawResponse || null,
    },
  });

  // Atualizar ticket com classificacao sugerida
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      iaClassificacao: JSON.stringify(resultado),
      categoria: resultado.categoria,
      prioridade: resultado.prioridade,
    },
  });
}

// ── 2. ANALISE DE CONTEXTO (0-100) ─────────────────────────────

interface AnaliseContextoResultado {
  pontuacao: number; // 0-100
  contexto: string;
  sentimento: string;
  sugestaoAcao: string;
  urgenciaDetectada: boolean;
}

export async function analiseContexto(ticketId: string): Promise<AnaliseContextoResultado> {
  const mensagens = await getMensagens(ticketId, 15);

  if (mensagens.length === 0) {
    return {
      pontuacao: 0,
      contexto: 'Sem mensagens ainda',
      sentimento: 'neutro',
      sugestaoAcao: 'Aguardar primeira mensagem do cliente',
      urgenciaDetectada: false,
    };
  }

  const historico = montarHistorico(mensagens);

  if (!hasClaude()) {
    // Analise local baseada em regras
    const ultimaMsg = mensagens[mensagens.length - 1];
    const texto = (ultimaMsg.content || '').toLowerCase();
    const palavrasUrgencia = ['urgente', 'rápido', 'parou', 'caiu', 'bloqueado', 'erro', 'não funciona'];
    const urgenciaDetectada = palavrasUrgencia.some((p) => texto.includes(p));
    const pontuacao = urgenciaDetectada ? 70 : 30;

    return {
      pontuacao,
      contexto: `Última mensagem: ${(ultimaMsg.content || '').slice(0, 100)}`,
      sentimento: urgenciaDetectada ? 'negativo' : 'neutro',
      sugestaoAcao: urgenciaDetectada ? 'Priorizar atendimento' : 'Acompanhar evolução',
      urgenciaDetectada,
    };
  }

  try {
    const prompt = `Analise esta conversa de suporte e dê uma avaliação de contexto.

CONVERSA:
${historico}

Responda APENAS com JSON (sem markdown):
{
  "pontuacao": 0-100 (quanto maior, mais contexto e urgência o ticket acumulou),
  "contexto": "resumo do que está acontecendo",
  "sentimento": "positivo|neutro|negativo|irritado",
  "sugestaoAcao": "o que o agente deve fazer agora",
  "urgenciaDetectada": true/false
}`;

    const resposta = await callClaude(prompt, 500);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        pontuacao: Math.min(100, Math.max(0, parsed.pontuacao || 0)),
        contexto: parsed.contexto || '',
        sentimento: parsed.sentimento || 'neutro',
        sugestaoAcao: parsed.sugestaoAcao || '',
        urgenciaDetectada: !!parsed.urgenciaDetectada,
      };
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM analise contexto:', (e as Error).message);
  }

  return {
    pontuacao: 25,
    contexto: 'Análise automática indisponível',
    sentimento: 'neutro',
    sugestaoAcao: 'Verificar manualmente',
    urgenciaDetectada: false,
  };
}

// ── 3. SUGESTAO DE RESPOSTA ────────────────────────────────────

export async function sugerirResposta(ticketId: string): Promise<string> {
  const mensagens = await getMensagens(ticketId, 10);
  if (mensagens.length === 0) return '';

  const historico = montarHistorico(mensagens);
  const ultimaMsgCliente = mensagens.filter((m) => !m.fromMe).pop();

  if (!hasClaude()) {
    return `Sugestão: Responder ao cliente sobre "${(ultimaMsgCliente?.content || '').slice(0, 50)}". Verificar base de conhecimento para resposta adequada.`;
  }

  try {
    const prompt = `Você é um agente de suporte profissional. Gere uma resposta para o cliente.

CONVERSA:
${historico}

Instruções:
- Seja empático e profissional
- Resolva o problema quando possível
- Se não souber, diga que vai verificar com o time
- Não invente informações
- Responda em português brasileiro

Gere APENAS o texto da resposta (sem JSON, sem formatação):`;

    const resposta = await callClaude(prompt, 600);

    // Salvar sugestao no ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { iaSugestaoResposta: resposta.trim() },
    });

    return resposta.trim();
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM sugestao:', (e as Error).message);
    return 'Não foi possível gerar sugestão no momento.';
  }
}

// ── 4. DETECCAO DE SINAIS DE INSATISFACAO ──────────────────────

export interface SinalInsatisfacao {
  tipo: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
}

interface RelatorioCompleto {
  problema: string;
  acoes: string;
  resolucao: string;
  observacoes: string;
  notaCompleta: string;
  sinaisInsatisfacao: SinalInsatisfacao[];
}

export async function detectarSinaisInsatisfacao(mensagens: Awaited<ReturnType<typeof getMensagens>>): Promise<SinalInsatisfacao[]> {
  const sinaisLocal: SinalInsatisfacao[] = [];

  for (const m of mensagens) {
    if (m.fromMe) continue;
    const texto = (m.content || '').toLowerCase();

    // Regras locais de deteccao
    if (/demor(a|ou)|estou esperando|quanto tempo|já era pra ter/.test(texto)) {
      sinaisLocal.push({ tipo: 'reclamacao_demora', descricao: 'Cliente reclamou de demora no atendimento', severidade: 'alta' });
    }
    if (/(vou cancelar|cancelamento|quero falar com gerente|seu chefe|ouvidoria|reclamação|advogad)/i.test(texto)) {
      sinaisLocal.push({ tipo: 'escalada', descricao: 'Cliente ameaçou escalar o problema', severidade: 'alta' });
    }
    if (/(?!)(não funciona|não resolveu|continua com problema|mesmo erro|de novo|não adiantou)/i.test(texto)) {
      sinaisLocal.push({ tipo: 'problema_nao_resolvido', descricao: 'Cliente relatou que problema não foi resolvido', severidade: 'alta' });
    }
    if (/grosseria|palavrao|(?:\b(?:caralho|porra|merda|foda|desgraça)\b)/i.test(texto)) {
      sinaisLocal.push({ tipo: 'tom_alterado', descricao: 'Cliente utilizou tom alterado ou linguagem agressiva', severidade: 'alta' });
    }
  }

  return sinaisLocal;
}

export async function gerarRelatorioCompleto(ticketId: string): Promise<RelatorioCompleto> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true, assunto: true, categoria: true, prioridade: true,
      resumoFinal: true, protocolo: true, iaNotaEncerramento: true,
      iaClassificacao: true, dataAbertura: true, dataFechamento: true,
      resolvidoPorIa: true,
    },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const mensagens = await getMensagens(ticketId, 50);
  const historico = montarHistorico(mensagens);
  const sinaisLocais = await detectarSinaisInsatisfacao(mensagens);

  // Fallback sem Claude
  if (!hasClaude()) {
    return {
      problema: ticket.assunto || ticket.resumoFinal || 'Problema não registrado',
      acoes: `${mensagens.filter(m => m.fromMe).length} mensagens enviadas pelo agente`,
      resolucao: ticket.resumoFinal || 'Chamado encerrado.',
      observacoes: `Protocolo: ${ticket.protocolo || 'N/A'}`,
      notaCompleta: ticket.iaNotaEncerramento || 'Relatório indisponível.',
      sinaisInsatisfacao: sinaisLocais,
    };
  }

  try {
    const prompt = `Gere um relatório COMPLETO e sinais de insatisfação para este ticket de suporte.

PROTOCOLO: ${ticket.protocolo || 'N/A'}
ASSUNTO: ${ticket.assunto || 'Não informado'}
CATEGORIA: ${ticket.categoria || 'Não classificado'}
PRIORIDADE: ${ticket.prioridade || 'Não definida'}
CLASSIFICACAO IA: ${ticket.iaClassificacao || 'N/A'}
RESOLVIDO POR IA: ${ticket.resolvidoPorIa ? 'Sim' : 'Não'}

CONVERSA COMPLETA:
${historico}

Gere um JSON com:
1. problema: descrição clara do problema relatado
2. acoes: lista de ações tomadas (separadas por ponto e vírgula)
3. resolucao: como foi resolvido
4. observacoes: observações adicionais relevantes
5. notaCompleta: texto formatado completo do relatório
6. sinaisInsatisfacao: array de objetos {tipo, descricao, severidade} identificando sinais de insatisfação do cliente durante a conversa (ex: reclamacao_demora, tom_alterado, problema_nao_resolvido, escalada, frustracao)

Responda APENAS com JSON (sem markdown):
{
  "problema": "...",
  "acoes": "...",
  "resolucao": "...",
  "observacoes": "...",
  "notaCompleta": "...",
  "sinaisInsatisfacao": [{"tipo": "reclamacao_demora", "descricao": "...", "severidade": "alta"}]
}`;

    const resposta = await callClaude(prompt, 1200);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const sinais = (parsed.sinaisInsatisfacao || []).concat(sinaisLocais);
      // Deduplicar sinais
      const sinaisUnicos = sinais.filter((s: SinalInsatisfacao, i: number, arr: SinalInsatisfacao[]) =>
        arr.findIndex((x: SinalInsatisfacao) => x.tipo === s.tipo) === i
      );

      const relatorio: RelatorioCompleto = {
        problema: parsed.problema || ticket.assunto || 'Não informado',
        acoes: parsed.acoes || '',
        resolucao: parsed.resolucao || '',
        observacoes: parsed.observacoes || '',
        notaCompleta: parsed.notaCompleta || '',
        sinaisInsatisfacao: sinaisUnicos,
      };

      // Salvar nota de encerramento no ticket
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { iaNotaEncerramento: relatorio.notaCompleta },
      });

      return relatorio;
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM relatorio completo:', (e as Error).message);
  }

  return {
    problema: ticket.assunto || 'Problema não registrado',
    acoes: `${mensagens.filter(m => m.fromMe).length} mensagens enviadas`,
    resolucao: ticket.resumoFinal || 'Chamado encerrado.',
    observacoes: `Protocolo: ${ticket.protocolo || 'N/A'}`,
    notaCompleta: ticket.iaNotaEncerramento || `Ticket ${ticket.protocolo || ticketId.slice(0, 8)} encerrado.`,
    sinaisInsatisfacao: sinaisLocais,
  };
}

// ── 5. NOTA DE ENCERRAMENTO (legado, mantido para compatibilidade) ──

export async function gerarNotaEncerramento(ticketId: string): Promise<string> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, assunto: true, categoria: true, resumoFinal: true, protocolo: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const mensagens = await getMensagens(ticketId, 30);
  const historico = montarHistorico(mensagens);

  if (!hasClaude()) {
    const nota = `Protocolo ${ticket.protocolo || ticketId.slice(0, 8)}\n` +
      `Assunto: ${ticket.assunto || 'Não informado'}\n` +
      `Categoria: ${ticket.categoria || 'Não classificado'}\n` +
      `Mensagens trocadas: ${mensagens.length}\n` +
      `Resumo: ${ticket.resumoFinal || 'Chamado encerrado.'}`;
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { iaNotaEncerramento: nota },
    });
    return nota;
  }

  try {
    const prompt = `Gere uma nota de encerramento profissional para este ticket de suporte.

PROTOCOLO: ${ticket.protocolo || 'N/A'}
ASSUNTO: ${ticket.assunto || 'Não informado'}
CATEGORIA: ${ticket.categoria || 'Não classificado'}

CONVERSA COMPLETA:
${historico}

A nota deve conter:
1. Problema relatado pelo cliente
2. Ações tomadas pelo agente
3. Resolução alcançada
4. Observações relevantes

Responda APENAS com JSON (sem markdown):
{
  "problema": "descrição do problema",
  "acoes": "ações tomadas",
  "resolucao": "como foi resolvido",
  "observacoes": "observações adicionais",
  "notaCompleta": "texto formatado da nota"
}`;

    const resposta = await callClaude(prompt, 1000);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const notaFormatada = parsed.notaCompleta ||
        `**Problema:** ${parsed.problema}\n\n` +
        `**Ações:** ${parsed.acoes}\n\n` +
        `**Resolução:** ${parsed.resolucao}\n\n` +
        `**Observações:** ${parsed.observacoes}`;

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { iaNotaEncerramento: notaFormatada },
      });
      return notaFormatada;
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM nota encerramento:', (e as Error).message);
  }

  return `Ticket ${ticket.protocolo || ticketId.slice(0, 8)} encerrado. Resumo: ${ticket.resumoFinal || 'Sem detalhes.'}`;
}

// ── 6. AUTO-ATENDIMENTO IA ───────────────────────────────────────

export interface AutoAtendimentoResultado {
  resolvidoPorIa: boolean;
  respostaEnviada?: string;
  precisaHumano: boolean;
  motivoEscalada?: string;
  propostaCriada?: boolean;
}

export async function processarAutoAtendimento(
  ticketId: string,
  mensagemCliente: string
): Promise<AutoAtendimentoResultado> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true, protocolo: true, assunto: true, categoria: true,
      resolvidoPorIa: true, iaMensagensEnviadas: true,
      dataAbertura: true,
    },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  // Se já foi resolvido pela IA, nao processar de novo
  if (ticket.resolvidoPorIa) {
    return { resolvidoPorIa: true, precisaHumano: false };
  }

  // Verificar config de auto-atendimento
  const config = await getConfigAutoAtendimento();

  // Se auto-atendimento está ativo, usar sistema de validação
  if (config.autoAtendimentoAtivo) {
    // Se ja tem mais de maxInteracoesIa mensagens da IA, escalar para humano
    if (ticket.iaMensagensEnviadas >= config.maxInteracoesIa) {
      return {
        resolvidoPorIa: false,
        precisaHumano: true,
        motivoEscalada: `Número máximo de interações da IA atingido (${config.maxInteracoesIa})`,
      };
    }

    // Criar proposta de resposta para validação (não envia direto)
    try {
      const proposta = await propostaRespostaIA(ticketId, mensagemCliente);

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { iaMensagensEnviadas: { increment: 1 }, iaUltimaRespostaEm: new Date() },
      });

      return {
        resolvidoPorIa: false,
        precisaHumano: false,
        propostaCriada: true,
      };
    } catch (e) {
      console.warn('[AI Ticket] Falha ao criar proposta de validação:', (e as Error).message);
      return {
        resolvidoPorIa: false,
        precisaHumano: true,
        motivoEscalada: 'Erro ao gerar proposta de resposta',
      };
    }
  }

  // Fluxo legado: auto-atendimento direto (sem validação)
  // Buscar artigos da base de conhecimento para contexto
  const artigosKB = await prisma.kBArticle.findMany({
    where: { publicado: true },
    select: { titulo: true, conteudo: true, tags: true },
    take: 5,
  });

  const mensagens = await getMensagens(ticketId, 15);
  const historico = montarHistorico(mensagens);

  // Se ja tem mais de 5 mensagens da IA, escalar para humano
  if (ticket.iaMensagensEnviadas >= 5) {
    return {
      resolvidoPorIa: false,
      precisaHumano: true,
      motivoEscalada: 'Número máximo de interações da IA atingido (5)',
    };
  }

  if (!hasClaude()) {
    // Fallback sem API: tentar responder com KB local
    const texto = mensagemCliente.toLowerCase();
    const artigoRelevante = artigosKB.find(
      (a) => a.tags.toLowerCase().split(',').some(t => texto.includes(t.trim())) ||
        texto.includes(a.titulo.toLowerCase().slice(0, 20))
    );

    if (artigoRelevante) {
      const resposta = `Com base na nossa base de conhecimento:\n\n${artigoRelevante.conteudo.slice(0, 300)}\n\nSe precisar de mais ajuda, estou à disposição.`;
      await enviarRespostaIa(ticketId, resposta);
      return {
        resolvidoPorIa: false,
        respostaEnviada: resposta,
        precisaHumano: false,
      };
    }

    return {
      resolvidoPorIa: false,
      precisaHumano: true,
      motivoEscalada: 'IA não conseguiu resolver com base de conhecimento local',
    };
  }

  try {
    const kbTexto = artigosKB.length > 0
      ? artigosKB.map((a) => `- ${a.titulo}: ${a.conteudo.slice(0, 200)}`).join('\n')
      : 'Nenhum artigo disponível';

    const prompt = `Você é um assistente de suporte automatizado do sistema CodeHelp.
Sua função é tentar resolver o problema do cliente sozinho.

BASE DE CONHECIMENTO DISPONÍVEL:
${kbTexto}

HISTÓRICO DA CONVERSA:
${historico}

ÚLTIMA MENSAGEM DO CLIENTE:
${mensagemCliente}
${ticket.assunto ? `ASSUNTO DO TICKET: ${ticket.assunto}` : ''}
CATEGORIA: ${ticket.categoria || 'Não classificada'}

INSTRUÇÕES:
- Tente resolver o problema do cliente usando APENAS a base de conhecimento fornecida
- Seja educado, empático e objetivo
- Responda em português brasileiro
- Se NÃO conseguir resolver (problema complexo, fora da KB, ou precisa de acesso humano), responda que vai escalar para um atendente humano
- NÃO invente informações nem procedimentos

Responda APENAS com JSON (sem markdown):
{
  "resposta": "sua resposta para o cliente",
  "resolveu": true/false (true se resolveu o problema, false se precisa escalar),
  "motivoNaoResolveu": "explicação se não resolveu, ou vazio",
  "confianca": 0-100 (confiança na resposta)
}`;

    const resposta = await callClaude(prompt, 800);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const resolveu = parsed.resolveu === true;
      const confianca = Math.min(100, Math.max(0, parsed.confianca || 50));

      if (resolveu && confianca >= 60) {
        // IA conseguiu resolver
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { iaMensagensEnviadas: { increment: 1 }, iaUltimaRespostaEm: new Date() },
        });
        await enviarRespostaIa(ticketId, parsed.resposta);
        // Atualizar primeira resposta IA se for a primeira
        const mensagensCount = await prisma.message.count({ where: { ticketId, fromMe: true } });
        if (mensagensCount <= 1) {
          await prisma.ticket.update({
            where: { id: ticketId },
            data: { iaPrimeiraRespostaEm: new Date() },
          });
        }
        return { resolvidoPorIa: false, respostaEnviada: parsed.resposta, precisaHumano: false };
      }

      // IA nao conseguiu
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { iaMensagensEnviadas: { increment: 1 }, iaUltimaRespostaEm: new Date() },
      });

      // Se confianca > 30, tenta enviar resposta informando que vai escalar
      if (confianca > 30) {
        await enviarRespostaIa(ticketId, parsed.resposta);
      }

      return {
        resolvidoPorIa: false,
        precisaHumano: true,
        motivoEscalada: parsed.motivoNaoResolveu || 'IA não conseguiu resolver com confiança suficiente',
      };
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM auto-atendimento:', (e as Error).message);
  }

  return {
    resolvidoPorIa: false,
    precisaHumano: true,
    motivoEscalada: 'Erro ao processar auto-atendimento',
  };
}

async function enviarRespostaIa(ticketId: string, conteudo: string) {
  await prisma.message.create({
    data: {
      ticketId,
      fromMe: true,
      content: conteudo,
      source: 'bot',
      tipo: 'message',
    },
  });
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { lastAgentMessageAt: new Date() },
  });
  // Registrar da primeira resposta IA se for a primeira
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { dataPrimeiraResposta: true },
  });
  if (!ticket?.dataPrimeiraResposta) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { dataPrimeiraResposta: new Date() },
    });
  }
}

// ── 7. RESOLVER TICKET VIA IA ───────────────────────────────────

export async function resolverTicketPorIa(ticketId: string): Promise<void> {
  const relatorio = await gerarRelatorioCompleto(ticketId);

  const { encerrarTicket } = await import('../helpdesk/flow.service');
  await encerrarTicket(ticketId, {
    status: 'resolvido',
    etapa: 'concluido',
    origem: 'ia',
    dataConclusao: true,
    dataResolucao: true,
    dataFechamento: true,
    extra: { resolvidoPorIa: true, iaNotaEncerramento: relatorio.notaCompleta },
    finalizarCsat: true,
    criarStageEvent: false,
  });

  await logAction({
    usuarioId: 'system',
    acao: 'resolvido_por_ia',
    entidade: 'Ticket',
    entidadeId: ticketId,
    detalhes: { motivo: 'Atendimento realizado integralmente pela IA' },
  });
}

// ── 5. AVALIACAO DE QUALIDADE ──────────────────────────────────

interface AvaliacaoQualidade {
  notaQualidade: number;
  pontosForts: string[];
  pontosMelhoria: string[];
  resumo: string;
}

export async function avaliarQualidade(ticketId: string): Promise<AvaliacaoQualidade> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, assunto: true, categoria: true, iaNotaEncerramento: true, resolvidoPorIa: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const mensagens = await getMensagens(ticketId, 30);
  const historico = montarHistorico(mensagens);

  if (!hasClaude()) {
    return {
      notaQualidade: 5,
      pontosForts: ['Atendimento registrado'],
      pontosMelhoria: ['Análise detalhada indisponível'],
      resumo: 'Avaliação manual necessária.',
    };
  }

  try {
    const prompt = `Avalie a qualidade deste atendimento de suporte.

CONVERSA:
${historico}

NOTA DE ENCERRAMENTO:
${ticket.iaNotaEncerramento || 'Não disponível'}

Responda APENAS com JSON (sem markdown):
{
  "notaQualidade": 1-10,
  "pontosForts": ["ponto 1", "ponto 2"],
  "pontosMelhoria": ["melhoria 1", "melhoria 2"],
  "resumo": "resumo da avaliação"
}

Critérios:
- Empatia e profissionalismo
- Clareza das respostas
- Eficiência na resolução
- Uso correto da base de conhecimento
- Tempo de resposta adequado`;

    const resposta = await callClaude(prompt, 800);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const avaliacao: AvaliacaoQualidade = {
        notaQualidade: Math.min(10, Math.max(1, parsed.notaQualidade || 5)),
        pontosForts: Array.isArray(parsed.pontosForts) ? parsed.pontosForts : [],
        pontosMelhoria: Array.isArray(parsed.pontosMelhoria) ? parsed.pontosMelhoria : [],
        resumo: parsed.resumo || '',
      };

      await prisma.aIEvaluation.create({
        data: {
          ticketId,
          notaQualidade: avaliacao.notaQualidade,
          pontosForts: JSON.stringify(avaliacao.pontosForts),
          pontosMelhoria: JSON.stringify(avaliacao.pontosMelhoria),
          resumo: avaliacao.resumo,
          modeloUsado: 'claude-sonnet-4-20250514',
        },
      });

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { iaAvaliacaoQualidade: JSON.stringify(avaliacao) },
      });

      return avaliacao;
    }
  } catch (e) {
    console.warn('[AI Ticket] Falha LLM avaliacao:', (e as Error).message);
  }

  return {
    notaQualidade: 5,
    pontosForts: [],
    pontosMelhoria: ['Avaliação automática falhou'],
    resumo: 'Não foi possível avaliar automaticamente.',
  };
}

// ── 6. CORRECAO DE RESPOSTA (treinamento) ──────────────────────

interface CorrecaoInput {
  mensagemId?: string;
  mensagemOriginal: string;
  tipoErro: string;
  correcao: string;
}

export async function corrigirResposta(
  ticketId: string,
  dados: CorrecaoInput,
  corrigidoPorId: string
): Promise<{ id: string; treinada: boolean }> {
  // Validar tipo de erro
  const TIPOS_ERRO_VALIDOS = [
    'informacao_incorreta',
    'tom_inadequado',
    'nao_respondeu',
    'alucinacao',
    'outro',
  ];
  if (!TIPOS_ERRO_VALIDOS.includes(dados.tipoErro)) {
    throw new Error(`Tipo de erro inválido: ${dados.tipoErro}`);
  }

  // Salvar correcao
  const correcao = await prisma.aICorrection.create({
    data: {
      ticketId,
      mensagemId: dados.mensagemId || null,
      mensagemOriginal: dados.mensagemOriginal,
      tipoErro: dados.tipoErro,
      correcao: dados.correcao,
      corrigidoPorId,
      treinada: false,
    },
  });

  // Atualizar ticket com info da correcao
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      iaCorrecaoOperador: JSON.stringify({
        tipoErro: dados.tipoErro,
        correcao: dados.correcao,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // Log de auditoria
  await logAction({
    usuarioId: corrigidoPorId,
    acao: 'correcao_ia',
    entidade: 'AICorrection',
    entidadeId: correcao.id,
    detalhes: {
      ticketId,
      tipoErro: dados.tipoErro,
      mensagemOriginal: dados.mensagemOriginal.slice(0, 100),
      correcao: dados.correcao.slice(0, 100),
    },
  });

  return { id: correcao.id, treinada: false };
}

// ── 7. MARCAR CORRECAO COMO TREINADA ──────────────────────────

export async function marcarCorrecaoTreinada(correcaoId: string): Promise<void> {
  await prisma.aICorrection.update({
    where: { id: correcaoId },
    data: { treinada: true },
  });
}

// ── 8. PROCESSAR NOVO TICKET (automacao) ──────────────────────

export async function processarNovoTicket(ticketId: string): Promise<{
  classificacao: ClassificacaoResultado | null;
  analise: AnaliseContextoResultado | null;
}> {
  let classificacao: ClassificacaoResultado | null = null;
  let analise: AnaliseContextoResultado | null = null;

  try {
    classificacao = await classificarTicket(ticketId);
  } catch (e) {
    console.warn('[AI Ticket] Falha ao classificar ticket:', (e as Error).message);
  }

  try {
    analise = await analiseContexto(ticketId);
  } catch (e) {
    console.warn('[AI Ticket] Falha ao analisar contexto:', (e as Error).message);
  }

  return { classificacao, analise };
}

// ── 9. METRICAS DE IA PARA DASHBOARD ───────────────────────────

interface MetricasIa {
  periodo: { inicio: string; fim: string };
  totalChamados: number;
  chamadosIaResolveu: number;
  taxaResolucaoIa: number;
  tempoMedioResolucaoIaMin: number;
  tempoMedioResolucaoHumanoMin: number;
  totalCorrecoes: number;
  confiancaMediaClassificacao: number;
  distribuicaoClassificacao: Array<{ categoria: string; total: number }>;
}

export async function getMetricasIa(dataInicio?: string, dataFim?: string): Promise<MetricasIa> {
  const fim = dataFim ? new Date(dataFim) : new Date();
  const inicio = dataInicio ? new Date(dataInicio) : new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalChamados, chamadosIaResolveu, correcoes, classificacoes, ticketsIa, ticketsHumanos] = await Promise.all([
    prisma.ticket.count({
      where: { dataAbertura: { gte: inicio, lte: fim }, status: { not: 'arquivado' } },
    }),
    prisma.ticket.count({
      where: { dataAbertura: { gte: inicio, lte: fim }, resolvidoPorIa: true },
    }),
    prisma.aICorrection.count({
      where: { createdAt: { gte: inicio, lte: fim } },
    }),
    prisma.aIClassification.findMany({
      where: { createdAt: { gte: inicio, lte: fim } },
      select: { categoria: true, confianca: true },
    }),
    prisma.ticket.findMany({
      where: {
        dataAbertura: { gte: inicio, lte: fim },
        resolvidoPorIa: true,
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true },
    }),
    prisma.ticket.findMany({
      where: {
        dataAbertura: { gte: inicio, lte: fim },
        resolvidoPorIa: false,
        status: { in: ['fechado', 'resolvido'] },
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true },
    }),
  ]);

  const taxaResolucaoIa = totalChamados > 0
    ? Math.round((chamadosIaResolveu / totalChamados) * 10000) / 100
    : 0;

  const tempoMedioResolucaoIaMin = ticketsIa.length > 0
    ? Math.round(
        ticketsIa.reduce((acc, t) => {
          const ms = new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime();
          return acc + ms / 60000;
        }, 0) / ticketsIa.length
      )
    : 0;

  const tempoMedioResolucaoHumanoMin = ticketsHumanos.length > 0
    ? Math.round(
        ticketsHumanos.reduce((acc, t) => {
          const ms = new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime();
          return acc + ms / 60000;
        }, 0) / ticketsHumanos.length
      )
    : 0;

  const confiancaMedia = classificacoes.length > 0
    ? Math.round(
        classificacoes.reduce((acc, c) => acc + (c.confianca || 0), 0) / classificacoes.length
      )
    : 0;

  // Distribuicao por categoria
  const catMap = new Map<string, number>();
  for (const c of classificacoes) {
    const cat = c.categoria || 'sem_classificacao';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }
  const distribuicaoClassificacao = Array.from(catMap.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    totalChamados,
    chamadosIaResolveu,
    taxaResolucaoIa,
    tempoMedioResolucaoIaMin,
    tempoMedioResolucaoHumanoMin,
    totalCorrecoes: correcoes,
    confiancaMediaClassificacao: confiancaMedia,
    distribuicaoClassificacao,
  };
}

// ── 10. HISTORICO DE CLASSIFICACOES DE UM TICKET ───────────────

export async function getHistoricoClassificacoes(ticketId: string) {
  return prisma.aIClassification.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAvaliacoesTicket(ticketId: string) {
  return prisma.aIEvaluation.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCorrecoesTicket(ticketId: string) {
  return prisma.aICorrection.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    include: { corrigidoPor: { select: { id: true, name: true } } },
  });
}
