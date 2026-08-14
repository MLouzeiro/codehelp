import prisma from '../../config/database';
import { callClaude, hasClaude } from '../../shared/aiClient';

// ── Interfaces ─────────────────────────────────────────────────

export interface AvaliacaoMensagem {
  notProfissionalismo: number;
  notCordialidade: number;
  notClareza: number;
  notEmpatia: number;
  notaGeral: number;
  classificacao: 'excelente' | 'bom' | 'neutro' | 'atencao' | 'critico';
  sugestaoResposta: string | null;
  alertas: string[];
  pontosFortes: string[];
  pontosMelhoria: string[];
}

export interface MetricasAgente {
  agentId: string;
  agentName: string;
  totalMensagens: number;
  notaGeralMedia: number;
  profissionalismoMedio: number;
  cordialidadeMedia: number;
  clarezaMedia: number;
  empatiaMedia: number;
  classificacaoGeral: string;
  totalAlertas: number;
  totalSugestoes: number;
  periodo: { inicio: Date; fim: Date };
}

export interface RelatorioAuditoria {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  agentName: string;
  totalMensagensAgente: number;
  avaliacoes: Array<{
    id: string;
    conteudoMensagem: string;
    notProfissionalismo: number;
    notCordialidade: number;
    notClareza: number;
    notEmpatia: number;
    notaGeral: number;
    classificacao: string;
    alertas: string | null;
    pontosFortes: string | null;
    pontosMelhoria: string | null;
    processadoEm: Date;
  }>;
  metricas: {
    notaGeralMedia: number;
    profissionalismoMedio: number;
    cordialidadeMedia: number;
    clarezaMedia: number;
    empatiaMedia: number;
    totalAlertas: number;
  };
}

// ── Prompt Builder ─────────────────────────────────────────────

function buildAvaliacaoPrompt(
  mensagemAgente: string,
  contextoConversa: string,
  nomeContato: string
): string {
  return `Você é um especialista em treinamento e qualidade de atendimento ao cliente. Analise a mensagem enviada por um atendente de suporte/helpdesk e avalie profissionalismo, cordialidade, clareza e empatia.

CONTEXTO DA CONVERSA COM O CLIENTE:
${contextoConversa}

MENSAGEM DO ATENDENTE AO CLIENTE:
"${mensagemAgente}"

NOME DO CLIENTE: ${nomeContato}

Avalie a mensagem do atendente considerando:
1. Profissionalismo (tom formal, linguagem técnica adequada, sem gírias)
2. Cordialidade (educação, uso de "por favor", "obrigado", saudação adequada)
3. Clareza (mensagem objetiva, fácil de entender, sem ambiguidades)
4. Empatia (demonstra compreensão do problema, coloca-se no lugar do cliente)

Retorne APENAS um JSON valido (sem markdown, sem code block) com esta estrutura:
{
  "notProfissionalismo": <0-10>,
  "notCordialidade": <0-10>,
  "notClareza": <0-10>,
  "notEmpatia": <0-10>,
  "notaGeral": <0-10 media das anteriores>,
  "classificacao": "<excelente|bom|neutro|atencao|critico>",
  "sugestaoResposta": "<se notaGeral < 7, sugira uma versão melhorada da mensagem; senão null>",
  "alertas": [<array de strings com problemas encontrados, ex: ["linguagem muito informal", "faltou saudação"]>],
  "pontosFortes": [<array de strings com pontos positivos>],
  "pontosMelhoria": [<array de strings com sugestões de melhoria>]
}

Classificações:
- excelente (8-10): Atendimento exemplar
- bom (6-7.9): Bom atendimento, pequenas melhorias possíveis
- neutro (4-5.9): Atendimento ok, mas pode melhorar
- atencao (2-3.9): Problemas que precisam de atenção
- critico (0-1.9): Atendimento inaceitável, precisa de intervenção

Seja justo e construtivo nas avaliações. Considere o contexto do suporte técnico.`;
}

function buildSugestaoPrompt(
  contextoConversa: string,
  nomeContato: string,
  ultimoProblema: string
): string {
  return `Você é um assistente de atendimento ao cliente especializado em suporte técnico. Gere uma sugestão de resposta profissional, cordial e eficiente para o atendente.

CONTEXTO DA CONVERSA:
${contextoConversa}

NOME DO CLIENTE: ${nomeContato}
PROBLEMA PRINCIPAL: ${ultimoProblema}

Gere uma sugestão de resposta que:
1. Seja profissional e cordial
2. Demonstre empatia com o problema do cliente
3. Seja clara e objetiva
4. Ofereça uma solução ou próximo passo
5. Use linguagem técnica acessível

Retorne APENAS o texto da mensagem sugerida, sem formatação adicional, sem aspas extras.`;
}

// ── Core Functions ─────────────────────────────────────────────

export async function avaliarMensagemAgente(
  ticketId: string,
  agentId: string,
  mensagemId: string,
  conteudoMensagem: string
): Promise<AvaliacaoMensagem> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        contactName: true,
        id: true,
      },
    });
    if (!ticket) throw new Error('Ticket não encontrado');

    const mensagensRecentes = await prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { content: true, fromMe: true, createdAt: true },
    });

    const contextoConversa = mensagensRecentes
      .reverse()
      .map((m) => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content || '(sem conteúdo)'}`)
      .join('\n');

    const nomeContato = ticket.contactName || 'Cliente';

    if (hasClaude()) {
      const prompt = buildAvaliacaoPrompt(conteudoMensagem, contextoConversa, nomeContato);
      const response = await callClaude(prompt, 1200);

      let avaliacao: AvaliacaoMensagem;
      try {
        const jsonStr = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        avaliacao = JSON.parse(jsonStr);
      } catch {
        avaliacao = buildFallbackAvaliacao(conteudoMensagem);
      }

      avaliacao.notaGeral = Math.round(
        (avaliacao.notProfissionalismo + avaliacao.notCordialidade + avaliacao.notClareza + avaliacao.notEmpatia) / 4 * 10
      ) / 10;

      if (avaliacao.notaGeral >= 8) avaliacao.classificacao = 'excelente';
      else if (avaliacao.notaGeral >= 6) avaliacao.classificacao = 'bom';
      else if (avaliacao.notaGeral >= 4) avaliacao.classificacao = 'neutro';
      else if (avaliacao.notaGeral >= 2) avaliacao.classificacao = 'atencao';
      else avaliacao.classificacao = 'critico';

      const auditRecord = await prisma.aIAgentAudit.create({
        data: {
          ticketId,
          agentId,
          mensagemId,
          conteudoMensagem,
          notProfissionalismo: avaliacao.notProfissionalismo,
          notCordialidade: avaliacao.notCordialidade,
          notClareza: avaliacao.notClareza,
          notEmpatia: avaliacao.notEmpatia,
          notaGeral: avaliacao.notaGeral,
          classificacao: avaliacao.classificacao,
          sugestaoResposta: avaliacao.sugestaoResposta,
          alertas: JSON.stringify(avaliacao.alertas),
          pontosFortes: JSON.stringify(avaliacao.pontosFortes),
          pontosMelhoria: JSON.stringify(avaliacao.pontosMelhoria),
          contextoConversa,
          modeloUsado: 'claude-sonnet-4-20250514',
        },
      });

      return { ...avaliacao, id: auditRecord.id } as AvaliacaoMensagem & { id: string };
    }

    const avaliacao = buildFallbackAvaliacao(conteudoMensagem);

    await prisma.aIAgentAudit.create({
      data: {
        ticketId,
        agentId,
        mensagemId,
        conteudoMensagem,
        notProfissionalismo: avaliacao.notProfissionalismo,
        notCordialidade: avaliacao.notCordialidade,
        notClareza: avaliacao.notClareza,
        notEmpatia: avaliacao.notEmpatia,
        notaGeral: avaliacao.notaGeral,
        classificacao: avaliacao.classificacao,
        sugestaoResposta: avaliacao.sugestaoResposta,
        alertas: JSON.stringify(avaliacao.alertas),
        pontosFortes: JSON.stringify(avaliacao.pontosFortes),
        pontosMelhoria: JSON.stringify(avaliacao.pontosMelhoria),
        contextoConversa,
        modeloUsado: 'fallback-local',
      },
    });

    return avaliacao;
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao avaliar mensagem:', err?.message);
    return buildFallbackAvaliacao(conteudoMensagem);
  }
}

export async function gerarSugestaoResposta(
  ticketId: string,
  ultimoProblema?: string
): Promise<string | null> {
  try {
    if (!hasClaude()) return null;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { contactName: true },
    });
    if (!ticket) return null;

    const mensagens = await prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { content: true, fromMe: true, createdAt: true },
    });

    const contextoConversa = mensagens
      .reverse()
      .map((m) => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content || '(sem conteúdo)'}`)
      .join('\n');

    const problema = ultimoProblema || mensagens.find((m) => !m.fromMe)?.content || 'Problema não especificado';

    const prompt = buildSugestaoPrompt(contextoConversa, ticket.contactName || 'Cliente', problema);
    const sugestao = await callClaude(prompt, 600);

    return sugestao.trim() || null;
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao gerar sugestão:', err?.message);
    return null;
  }
}

export async function getMetricasAgente(
  agentId: string,
  dias: number = 30
): Promise<MetricasAgente | null> {
  try {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    });
    if (!agent) return null;

    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const audits = await prisma.aIAgentAudit.findMany({
      where: {
        agentId,
        processadoEm: { gte: dataInicio },
      },
      select: {
        notProfissionalismo: true,
        notCordialidade: true,
        notClareza: true,
        notEmpatia: true,
        notaGeral: true,
        classificacao: true,
        alertas: true,
        sugestaoResposta: true,
      },
    });

    if (audits.length === 0) {
      return {
        agentId,
        agentName: agent.name,
        totalMensagens: 0,
        notaGeralMedia: 0,
        profissionalismoMedio: 0,
        cordialidadeMedia: 0,
        clarezaMedia: 0,
        empatiaMedia: 0,
        classificacaoGeral: 'sem_dados',
        totalAlertas: 0,
        totalSugestoes: 0,
        periodo: { inicio: dataInicio, fim: new Date() },
      };
    }

    const total = audits.length;
    const soma = audits.reduce(
      (acc: { prof: number; cor: number; cl: number; em: number; geral: number }, a: any) => ({
        prof: acc.prof + a.notProfissionalismo,
        cor: acc.cor + a.notCordialidade,
        cl: acc.cl + a.notClareza,
        em: acc.em + a.notEmpatia,
        geral: acc.geral + a.notaGeral,
      }),
      { prof: 0, cor: 0, cl: 0, em: 0, geral: 0 }
    );

    const totalAlertas = audits.reduce((acc: number, a: any) => {
      try {
        const alertas = JSON.parse(a.alertas || '[]');
        return acc + (Array.isArray(alertas) ? alertas.length : 0);
      } catch { return acc; }
    }, 0);

    const totalSugestoes = audits.filter((a: any) => a.sugestaoResposta).length;

    const notaGeralMedia = Math.round((soma.geral / total) * 10) / 10;
    let classificacaoGeral = 'neutro';
    if (notaGeralMedia >= 8) classificacaoGeral = 'excelente';
    else if (notaGeralMedia >= 6) classificacaoGeral = 'bom';
    else if (notaGeralMedia >= 4) classificacaoGeral = 'neutro';
    else if (notaGeralMedia >= 2) classificacaoGeral = 'atencao';
    else classificacaoGeral = 'critico';

    return {
      agentId,
      agentName: agent.name,
      totalMensagens: total,
      notaGeralMedia,
      profissionalismoMedio: Math.round((soma.prof / total) * 10) / 10,
      cordialidadeMedia: Math.round((soma.cor / total) * 10) / 10,
      clarezaMedia: Math.round((soma.cl / total) * 10) / 10,
      empatiaMedia: Math.round((soma.em / total) * 10) / 10,
      classificacaoGeral,
      totalAlertas,
      totalSugestoes,
      periodo: { inicio: dataInicio, fim: new Date() },
    };
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao calcular métricas:', err?.message);
    return null;
  }
}

export async function getRelatorioAuditoria(
  ticketId: string
): Promise<RelatorioAuditoria | null> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        protocolo: true,
        contactName: true,
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!ticket) return null;

    const audits = await prisma.aIAgentAudit.findMany({
      where: { ticketId },
      orderBy: { processadoEm: 'asc' },
      select: {
        id: true,
        conteudoMensagem: true,
        notProfissionalismo: true,
        notCordialidade: true,
        notClareza: true,
        notEmpatia: true,
        notaGeral: true,
        classificacao: true,
        alertas: true,
        pontosFortes: true,
        pontosMelhoria: true,
        processadoEm: true,
      },
    });

    if (audits.length === 0) return null;

    const total = audits.length;
    const soma = audits.reduce(
      (acc: { prof: number; cor: number; cl: number; em: number; geral: number }, a: any) => ({
        prof: acc.prof + a.notProfissionalismo,
        cor: acc.cor + a.notCordialidade,
        cl: acc.cl + a.notClareza,
        em: acc.em + a.notEmpatia,
        geral: acc.geral + a.notaGeral,
      }),
      { prof: 0, cor: 0, cl: 0, em: 0, geral: 0 }
    );

    const totalAlertas = audits.reduce((acc: number, a: any) => {
      try {
        const alertas = JSON.parse(a.alertas || '[]');
        return acc + (Array.isArray(alertas) ? alertas.length : 0);
      } catch { return acc; }
    }, 0);

    return {
      ticketId,
      protocolo: ticket.protocolo,
      contactName: ticket.contactName,
      agentName: ticket.assignee?.name || 'Não atribuído',
      totalMensagensAgente: total,
      avaliacoes: audits,
      metricas: {
        notaGeralMedia: Math.round((soma.geral / total) * 10) / 10,
        profissionalismoMedio: Math.round((soma.prof / total) * 10) / 10,
        cordialidadeMedia: Math.round((soma.cor / total) * 10) / 10,
        clarezaMedia: Math.round((soma.cl / total) * 10) / 10,
        empatiaMedia: Math.round((soma.em / total) * 10) / 10,
        totalAlertas,
      },
    };
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao gerar relatório:', err?.message);
    return null;
  }
}

export async function getRankingAgentes(
  dias: number = 30
): Promise<MetricasAgente[]> {
  try {
    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const agentes = await prisma.user.findMany({
      where: { active: true, role: { in: ['tecnico', 'gerente'] } },
      select: { id: true, name: true },
    });

    const metricas: MetricasAgente[] = [];
    for (const agente of agentes) {
      const m = await getMetricasAgente(agente.id, dias);
      if (m && m.totalMensagens > 0) {
        metricas.push(m);
      }
    }

    return metricas.sort((a, b) => b.notaGeralMedia - a.notaGeralMedia);
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao gerar ranking:', err?.message);
    return [];
  }
}

// ── Fallback Local ─────────────────────────────────────────────

function buildFallbackAvaliacao(mensagem: string): AvaliacaoMensagem {
  const msgLower = mensagem.toLowerCase();

  let profissionalismo = 7;
  let cordialidade = 7;
  let clareza = 7;
  let empatia = 7;
  const alertas: string[] = [];
  const pontosFortes: string[] = [];
  const pontosMelhoria: string[] = [];

  const palavrasInformais = ['blz', 'beleza', 'tranquilo', 'massa', 'top', 'irado', 'maneiro', 'foda', 'caralho', 'porra', 'merda'];
  const temInformal = palavrasInformais.some((p) => msgLower.includes(p));
  if (temInformal) {
    profissionalismo -= 3;
    alertas.push('Linguagem informal detectada');
    pontosMelhoria['Linguagem informal detectada'.length] = 'Usar linguagem mais formal e profissional';
  }

  const saudacoes = ['olá', 'bom dia', 'boa tarde', 'boa noite', 'oi', 'prezado', 'estimado'];
  const temSaudacao = saudacoes.some((s) => msgLower.startsWith(s) || msgLower.includes(s));
  if (temSaudacao) {
    cordialidade += 1;
    pontosFortes['Saudação adequada'.length] = 'Saudação profissional presente';
  } else {
    cordialidade -= 1;
    pontosMelhoria['Faltou saudação'.length] = 'Incluir saudação no início da mensagem';
  }

  const palavrasEmpatia = ['entendo', 'compreendo', 'sinto muito', 'lamento', 'pode ficar tranquilo', 'vou ajudar'];
  const temEmpatia = palavrasEmpatia.some((p) => msgLower.includes(p));
  if (temEmpatia) {
    empatia += 2;
    pontosFortes['Demonstrou empatia'.length] = 'Demonstrou compreensão do problema';
  } else {
    empatia -= 1;
    pontosMelhoria['Faltou empatia'.length] = 'Demonstrar compreensão do problema do cliente';
  }

  if (mensagem.length < 20) {
    clareza -= 2;
    alertas.push('Mensagem muito curta');
    pontosMelhoria['Mensagem curta'.length] = 'Desenvolver melhor a resposta';
  }

  if (mensagem.length > 500) {
    clareza -= 1;
    pontosMelhoria['Mensagem longa'.length] = 'Tornar a mensagem mais objetiva';
  }

  const pontuacao = [profissionalismo, cordialidade, clareza, empatia].map((n) => Math.max(0, Math.min(10, n)));
  const notaGeral = Math.round((pontuacao.reduce((a, b) => a + b, 0) / 4) * 10) / 10;

  let classificacao: AvaliacaoMensagem['classificacao'] = 'neutro';
  if (notaGeral >= 8) classificacao = 'excelente';
  else if (notaGeral >= 6) classificacao = 'bom';
  else if (notaGeral >= 4) classificacao = 'neutro';
  else if (notaGeral >= 2) classificacao = 'atencao';
  else classificacao = 'critico';

  return {
    notProfissionalismo: pontuacao[0],
    notCordialidade: pontuacao[1],
    notClareza: pontuacao[2],
    notEmpatia: pontuacao[3],
    notaGeral,
    classificacao,
    sugestaoResposta: null,
    alertas,
    pontosFortes: Object.values(pontosFortes).filter(Boolean),
    pontosMelhoria: Object.values(pontosMelhoria).filter(Boolean),
  };
}
