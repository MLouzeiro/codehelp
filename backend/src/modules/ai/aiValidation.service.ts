import prisma from '../../config/database';
import { env } from '../../config/env';

// ── Claude API ─────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens = 800): Promise<string> {
  if (!env.anthropicKey) throw new Error('Chave Anthropic não configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}

function hasClaude(): boolean {
  return !!env.anthropicKey;
}

// ── Interfaces ─────────────────────────────────────────────────

export interface PropostaResposta {
  id: string;
  ticketId: string;
  mensagemCliente: string;
  respostaProposta: string;
  assunto?: string;
  prioridade?: string;
  confianca?: number;
  status: string;
  validacoesCount: number;
  validacaoIds: string[];
  respostaFinal?: string;
  enviadaEm?: Date;
}

export interface ValidacaoConfig {
  autoAtendimentoAtivo: boolean;
  thresholdValidacoes: number;
  maxInteracoesIa: number;
}

export interface MetricasValidacao {
  totalPropostas: number;
  pendentes: number;
  validadas: number;
  rejeitadas: number;
  autoEnviadas: number;
  taxaDeUso: number;
}

// ── 1. OBTER CONFIG GLOBAL ─────────────────────────────────────

export async function getConfigAutoAtendimento(): Promise<ValidacaoConfig> {
  const config = await prisma.helpdeskConfig.findUnique({
    where: { slug: 'auto_atendimento' },
  });

  if (!config) {
    // Criar config padrão se não existir
    const novaConfig = await prisma.helpdeskConfig.create({
      data: {
        slug: 'auto_atendimento',
        nome: 'Auto-Atendimento IA',
        descricao: 'Configurações do auto-atendimento por inteligência artificial',
        autoAtendimentoAtivo: false,
        thresholdValidacoes: 3,
        maxInteracoesIa: 5,
      },
    });
    return {
      autoAtendimentoAtivo: novaConfig.autoAtendimentoAtivo,
      thresholdValidacoes: novaConfig.thresholdValidacoes,
      maxInteracoesIa: novaConfig.maxInteracoesIa,
    };
  }

  return {
    autoAtendimentoAtivo: config.autoAtendimentoAtivo,
    thresholdValidacoes: config.thresholdValidacoes,
    maxInteracoesIa: config.maxInteracoesIa,
  };
}

export async function updateConfigAutoAtendimento(
  dados: Partial<ValidacaoConfig>
): Promise<ValidacaoConfig> {
  const config = await prisma.helpdeskConfig.findUnique({
    where: { slug: 'auto_atendimento' },
  });

  if (!config) {
    const novaConfig = await prisma.helpdeskConfig.create({
      data: {
        slug: 'auto_atendimento',
        nome: 'Auto-Atendimento IA',
        descricao: 'Configurações do auto-atendimento por inteligência artificial',
        autoAtendimentoAtivo: dados.autoAtendimentoAtivo ?? false,
        thresholdValidacoes: dados.thresholdValidacoes ?? 3,
        maxInteracoesIa: dados.maxInteracoesIa ?? 5,
      },
    });
    return {
      autoAtendimentoAtivo: novaConfig.autoAtendimentoAtivo,
      thresholdValidacoes: novaConfig.thresholdValidacoes,
      maxInteracoesIa: novaConfig.maxInteracoesIa,
    };
  }

  const atualizado = await prisma.helpdeskConfig.update({
    where: { slug: 'auto_atendimento' },
    data: {
      ...(dados.autoAtendimentoAtivo !== undefined && { autoAtendimentoAtivo: dados.autoAtendimentoAtivo }),
      ...(dados.thresholdValidacoes !== undefined && { thresholdValidacoes: dados.thresholdValidacoes }),
      ...(dados.maxInteracoesIa !== undefined && { maxInteracoesIa: dados.maxInteracoesIa }),
    },
  });

  return {
    autoAtendimentoAtivo: atualizado.autoAtendimentoAtivo,
    thresholdValidacoes: atualizado.thresholdValidacoes,
    maxInteracoesIa: atualizado.maxInteracoesIa,
  };
}

// ── 2. GERAR RESPOSTA IA PARA VALIDACAO ────────────────────────

/**
 * Gera uma resposta para o cliente usando IA e cria proposta para validação.
 * Não envia direto ao cliente — cria registro para validação humana.
 */
export async function propostaRespostaIA(
  ticketId: string,
  mensagemCliente: string
): Promise<PropostaResposta> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true, protocolo: true, assunto: true, categoria: true,
      prioridade: true, iaMensagensEnviadas: true,
    },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  // Verificar se já existe proposta pendente para este ticket
  const propostaExistente = await prisma.aIRespostaValidacao.findFirst({
    where: { ticketId, status: 'pendente' },
  });
  if (propostaExistente) {
    return propostaExistente as PropostaResposta;
  }

  // Buscar artigos da KB para contexto
  const artigosKB = await prisma.kBArticle.findMany({
    where: { publicado: true },
    select: { titulo: true, conteudo: true, tags: true },
    take: 5,
  });

  // Buscar histórico de mensagens
  const mensagens = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    take: 15,
    select: { content: true, fromMe: true, createdAt: true },
  });

  const historico = mensagens
    .map((m) => `${m.fromMe ? 'Agente' : 'Cliente'}: ${m.content || '[sem conteúdo]'}`)
    .join('\n');

  let respostaProposta = '';
  let confianca = 0;

  if (hasClaude()) {
    try {
      const kbTexto = artigosKB.length > 0
        ? artigosKB.map((a) => `- ${a.titulo}: ${a.conteudo.slice(0, 200)}`).join('\n')
        : 'Nenhum artigo disponível';

      const prompt = `Você é um assistente de suporte automatizado do sistema CodeHelp.
Sua função é gerar uma resposta para o cliente baseada na conversa e na base de conhecimento.

BASE DE CONHECIMENTO DISPONÍVEL:
${kbTexto}

HISTÓRICO DA CONVERSA:
${historico}

ÚLTIMA MENSAGEM DO CLIENTE:
${mensagemCliente}

${ticket.assunto ? `ASSUNTO DO TICKET: ${ticket.assunto}` : ''}
CATEGORIA: ${ticket.categoria || 'Não classificada'}

INSTRUÇÕES:
- Gere uma resposta completa e educada para o cliente
- Use a base de conhecimento quando disponível
- Seja empático, claro e objetivo
- Responda em português brasileiro
- NÃO invente informações nem procedimentos que não existam
- Se precisar de acesso humano ou informação que não tem, indique que será necessário

Responda APENAS com JSON (sem markdown):
{
  "resposta": "sua resposta completa para o cliente",
  "confianca": 0-100
}`;

      const resposta = await callClaude(prompt, 800);
      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        respostaProposta = parsed.resposta || '';
        confianca = Math.min(100, Math.max(0, parsed.confianca || 50));
      }
    } catch (e) {
      console.warn('[AI Validation] Falha LLM gerar proposta:', (e as Error).message);
    }
  }

  // Fallback sem Claude
  if (!respostaProposta) {
    const artigoRelevante = artigosKB.find(
      (a) => a.tags.toLowerCase().split(',').some(t => mensagemCliente.toLowerCase().includes(t.trim())) ||
        mensagemCliente.toLowerCase().includes(a.titulo.toLowerCase().slice(0, 20))
    );
    if (artigoRelevante) {
      respostaProposta = `Com base na nossa base de conhecimento:\n\n${artigoRelevante.conteudo.slice(0, 300)}\n\nSe precisar de mais ajuda, estou à disposição.`;
      confianca = 40;
    } else {
      respostaProposta = 'Estou analisando sua solicitação. Um atendente humano será acionado em breve para ajudá-lo.';
      confianca = 20;
    }
  }

  // Criar proposta de validação
  const proposta = await prisma.aIRespostaValidacao.create({
    data: {
      ticketId,
      mensagemCliente,
      respostaProposta,
      assunto: ticket.assunto || undefined,
      prioridade: ticket.prioridade || undefined,
      confianca,
      status: 'pendente',
    },
  });

  console.log(`[AI Validation] Proposta criada para ticket ${ticketId}: confiança ${confianca}%`);

  return proposta as PropostaResposta;
}

// ── 3. VALIDAR RESPOSTA ────────────────────────────────────────

/**
 * Atendente valida uma resposta proposta.
 * Se respostaFinal for fornecida, salva como versão editada.
 * Se validacoesCount atingir o threshold, auto-envia.
 */
export async function validarResposta(
  validacaoId: string,
  atendenteId: string,
  respostaFinal?: string
): Promise<{ proposta: PropostaResposta; autoEnviada: boolean }> {
  const proposta = await prisma.aIRespostaValidacao.findUnique({
    where: { id: validacaoId },
  });
  if (!proposta) throw new Error('Proposta de resposta não encontrada');
  if (proposta.status !== 'pendente') throw new Error('Proposta já foi processada');

  // Verificar se atendente já validou (dedup)
  if (proposta.validacaoIds.includes(atendenteId)) {
    throw new Error('Você já validou esta resposta');
  }

  // Atualizar validação
  const novasValidacoes = proposta.validacoesCount + 1;
  const novosIds = [...proposta.validacaoIds, atendenteId];

  const config = await getConfigAutoAtendimento();
  const autoEnviada = novasValidacoes >= config.thresholdValidacoes;

  const atualizado = await prisma.aIRespostaValidacao.update({
    where: { id: validacaoId },
    data: {
      validacoesCount: novasValidacoes,
      validacaoIds: novosIds,
      respostaFinal: respostaFinal || proposta.respostaFinal || proposta.respostaProposta,
      status: autoEnviada ? 'auto_enviada' : 'pendente',
      ...(autoEnviada && { enviadaEm: new Date() }),
    },
  });

  console.log(`[AI Validation] Resposta ${validacaoId} validada por ${atendenteId} (${novasValidacoes}/${config.thresholdValidacoes})`);

  return { proposta: atualizado as PropostaResposta, autoEnviada };
}

// ── 4. REJEITAR RESPOSTA ───────────────────────────────────────

export async function rejeitarResposta(validacaoId: string): Promise<PropostaResposta> {
  const proposta = await prisma.aIRespostaValidacao.findUnique({
    where: { id: validacaoId },
  });
  if (!proposta) throw new Error('Proposta de resposta não encontrada');
  if (proposta.status !== 'pendente') throw new Error('Proposta já foi processada');

  const atualizado = await prisma.aIRespostaValidacao.update({
    where: { id: validacaoId },
    data: { status: 'rejeitada' },
  });

  console.log(`[AI Validation] Resposta ${validacaoId} rejeitada`);

  return atualizado as PropostaResposta;
}

// ── 5. ENVIAR RESPOSTA AO CLIENTE ──────────────────────────────

/**
 * Envia a resposta validada/auto-gerada ao cliente via WhatsApp.
 * Chamado pelo handler quando a validação atinge o threshold.
 */
export async function enviarRespostaValidada(
  validacaoId: string,
  sendMessage: (to: string, message: string) => Promise<{ success: boolean; error?: string }>
): Promise<boolean> {
  const proposta = await prisma.aIRespostaValidacao.findUnique({
    where: { id: validacaoId },
    include: { ticket: { select: { contactPhone: true, id: true } } },
  });
  if (!proposta) throw new Error('Proposta de resposta não encontrada');

  const resposta = proposta.respostaFinal || proposta.respostaProposta;
  if (!resposta) throw new Error('Resposta não disponível');

  const phone = proposta.ticket.contactPhone;
  if (!phone) throw new Error('Telefone do cliente não encontrado');

  const result = await sendMessage(phone, resposta);

  if (result.success) {
    // Registrar mensagem enviada
    await prisma.message.create({
      data: {
        ticketId: proposta.ticketId,
        fromMe: true,
        content: resposta,
        source: 'bot',
        tipo: 'message',
      },
    });

    // Atualizar proposta
    await prisma.aIRespostaValidacao.update({
      where: { id: validacaoId },
      data: { status: 'auto_enviada', enviadaEm: new Date() },
    });

    // Atualizar ticket
    await prisma.ticket.update({
      where: { id: proposta.ticketId },
      data: {
        iaMensagensEnviadas: { increment: 1 },
        iaUltimaRespostaEm: new Date(),
        lastAgentMessageAt: new Date(),
      },
    });

    console.log(`[AI Validation] Resposta ${validacaoId} enviada ao cliente via WhatsApp`);

    return true;
  }

  console.warn(`[AI Validation] Falha ao enviar resposta ${validacaoId}: ${result.error}`);
  return false;
}

// ── 6. LISTAR PROPOSTAS PENDENTES ──────────────────────────────

export async function listarRespostasPendentes(): Promise<PropostaResposta[]> {
  const propostas = await prisma.aIRespostaValidacao.findMany({
    where: { status: 'pendente' },
    include: {
      ticket: {
        select: {
          id: true, protocolo: true, assunto: true, prioridade: true,
          contactName: true, etapa: true, departamentoId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return propostas as unknown as PropostaResposta[];
}

// ── 7. LISTAR TODAS AS PROPOSTAS (COM FILTRO) ──────────────────

export async function listarPropostas(filtro?: {
  status?: string;
  ticketId?: string;
  limite?: number;
}): Promise<PropostaResposta[]> {
  const where: any = {};
  if (filtro?.status) where.status = filtro.status;
  if (filtro?.ticketId) where.ticketId = filtro.ticketId;

  const propostas = await prisma.aIRespostaValidacao.findMany({
    where,
    include: {
      ticket: {
        select: {
          id: true, protocolo: true, assunto: true, prioridade: true,
          contactName: true, etapa: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filtro?.limite || 50,
  });

  return propostas as unknown as PropostaResposta[];
}

// ── 8. METRICAS ────────────────────────────────────────────────

export async function getMetricasValidacao(): Promise<MetricasValidacao> {
  const [totalPropostas, pendentes, validadas, rejeitadas, autoEnviadas] = await Promise.all([
    prisma.aIRespostaValidacao.count(),
    prisma.aIRespostaValidacao.count({ where: { status: 'pendente' } }),
    prisma.aIRespostaValidacao.count({ where: { status: 'validada' } }),
    prisma.aIRespostaValidacao.count({ where: { status: 'rejeitada' } }),
    prisma.aIRespostaValidacao.count({ where: { status: 'auto_enviada' } }),
  ]);

  const taxaDeUso = totalPropostas > 0
    ? ((validadas + autoEnviadas) / totalPropostas) * 100
    : 0;

  return {
    totalPropostas,
    pendentes,
    validadas,
    rejeitadas,
    autoEnviadas,
    taxaDeUso: Math.round(taxaDeUso * 100) / 100,
  };
}

// ── 9. VERIFICAR SE RESPOSTA JA FOI VALIDADA (PARA RE-ENVIO) ──

/**
 * Verifica se uma resposta similar já foi validada e pode ser reutilizada.
 * Usado pelo handler para evitar pedir validação novamente da mesma resposta.
 */
export async function respostaJaValidada(
  ticketId: string,
  mensagemCliente: string
): Promise<{ podeReenviar: boolean; respostaFinal?: string; validacaoId?: string }> {
  // Buscar respostas já auto-enviadas para mensagens similares do mesmo ticket
  const respostasAnteriores = await prisma.aIRespostaValidacao.findMany({
    where: {
      ticketId,
      status: 'auto_enviada',
    },
    orderBy: { enviadaEm: 'desc' },
    take: 5,
  });

  if (respostasAnteriores.length === 0) {
    return { podeReenviar: false };
  }

  // Verificar se a mensagem do cliente é similar a alguma mensagem anterior
  const msgLower = mensagemCliente.toLowerCase().trim();
  for (const r of respostasAnteriores) {
    const msgAnterior = r.mensagemCliente.toLowerCase().trim();
    // Similaridade simples: se 70% das palavras são iguais
    const palavras1 = msgLower.split(/\s+/);
    const palavras2 = msgAnterior.split(/\s+/);
    const intersecao = palavras1.filter(p => palavras2.includes(p));
    const similaridade = intersecao.length / Math.max(palavras1.length, palavras2.length);

    if (similaridade >= 0.7) {
      return {
        podeReenviar: true,
        respostaFinal: r.respostaFinal || r.respostaProposta,
        validacaoId: r.id,
      };
    }
  }

  return { podeReenviar: false };
}
