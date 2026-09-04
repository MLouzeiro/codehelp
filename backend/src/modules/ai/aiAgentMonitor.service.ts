import prisma from '../../config/database';
import { callClaude, hasClaude } from '../../shared/aiClient';
import { auditarEncerramento } from '../helpdesk/closureAudit.service';

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
  treinamentoNecessario: boolean;
  treinamentoCategoria: string | null;
  treinamentoMotivo: string | null;
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
  encerramentos: MetricasEncerramento | null;
}

export interface MetricasEncerramento {
  total: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  taxaEncerramentoCorreto: number;
  notaMediaEncerramento: number;
  riscoAlto: number;
  riscoCritico: number;
  recomendaReabertura: number;
}

export interface EncerramentoAgente {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  tipo: string;
  riscoReabertura: string;
  nota: number;
  diagnostico: string | null;
  recomendaReabertura: boolean;
  semConfirmacao: boolean;
  clienteVoltou: boolean;
  mensagensAposEncerramento: number;
  csatNota: number | null;
  analiseIa: boolean;
  dataFechamento: Date | null;
  processadoEm: Date;
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
  encerramento: {
    tipo: string;
    riscoReabertura: string;
    nota: number;
    diagnostico: string | null;
    detalhes: string[];
    recomendaReabertura: boolean;
    semConfirmacao: boolean;
    motivoStatus: string | null;
    clienteVoltou: boolean;
    mensagensAposEncerramento: number;
    csatNota: number | null;
    csatRespondido: boolean;
    analiseIa: boolean;
    ticketReaberturaId: string | null;
    dataFechamento: Date | null;
    processadoEm: Date | null;
  } | null;
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
  "alertas": [<array de strings com problemas encontrados>],
  "pontosFortes": [<array de strings com pontos positivos>],
  "pontosMelhoria": [<array de strings com sugestões de melhoria>],
  "treinamentoNecessario": <true se notaGeral < 6 ou se há problemas graves em qualquer dimensão>,
  "treinamentoCategoria": "<Conhecimento Técnico|Processo/Procedimento|Comunicação|Comportamento/Profissionalismo|Uso do Sistema|null>",
  "treinamentoMotivo": "<justificativa concisa do porquê o treinamento é necessário, citando evidências da mensagem; null se treinamentoNecessario=false>"
}

Categorias de treinamento:
- Conhecimento Técnico: Falta de conhecimento sobre o produto/serviço, respostas tecnicamente incorretas
- Processo/Procedimento: Não seguiu o fluxo correto, pulou etapas, documentação incorreta
- Comunicação: Tom inapropiado, falta de empatia, mensagem confusa, ausência de saudação/despedida
- Comportamento/Profissionalismo: Grosseria, impaciência, descaso com o cliente
- Uso do Sistema: Não soube usar ferramentas, erros de digitação em dados, cadastro incorreto

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
      const response = await callClaude(prompt, 1200, 'avaliacao-agente');

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
          treinamentoNecessario: avaliacao.treinamentoNecessario ?? false,
          treinamentoCategoria: avaliacao.treinamentoCategoria ?? null,
          treinamentoMotivo: avaliacao.treinamentoMotivo ?? null,
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
        treinamentoNecessario: avaliacao.treinamentoNecessario,
        treinamentoCategoria: avaliacao.treinamentoCategoria,
        treinamentoMotivo: avaliacao.treinamentoMotivo,
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
    const sugestao = await callClaude(prompt, 600, 'sugestao-resposta');

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

    let encerramentos: MetricasEncerramento | null = null;
    try {
      const enc = await getEncerramentosAgente(agentId, dias);
      encerramentos = enc.metricas.total > 0 ? enc.metricas : null;
    } catch { /* sem dados de encerramento não quebra as métricas */ }

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
        encerramentos,
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
      encerramentos,
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
        dataFechamento: true,
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

    // Detecção de encerramento (prematuro / resolução real / reabertura).
    // Busca a auditoria persistida; se o ticket já foi fechado e ainda não há
    // registro, gera on-demand (upsert) — nunca lança erro para não quebrar a tela.
    let encerramento: RelatorioAuditoria['encerramento'] = null;
    try {
      let closure = await prisma.aIAgentClosureAudit.findUnique({
        where: { ticketId },
      });
      if (!closure && ticket.dataFechamento) {
        const gerada = await auditarEncerramentoTicket(ticketId);
        if (gerada) {
          closure = await prisma.aIAgentClosureAudit.findUnique({ where: { ticketId } });
        }
      }
      if (closure) {
        let detalhes: string[] = [];
        try { detalhes = JSON.parse(closure.detalhes || '[]'); } catch { detalhes = []; }
        encerramento = {
          tipo: closure.tipo,
          riscoReabertura: closure.riscoReabertura,
          nota: closure.nota,
          diagnostico: closure.diagnostico,
          detalhes: Array.isArray(detalhes) ? detalhes : [],
          recomendaReabertura: closure.recomendaReabertura,
          semConfirmacao: closure.semConfirmacao,
          motivoStatus: closure.motivoStatus,
          clienteVoltou: closure.clienteVoltou,
          mensagensAposEncerramento: closure.mensagensAposEncerramento,
          csatNota: closure.csatNota,
          csatRespondido: closure.csatRespondido,
          analiseIa: closure.analiseIa,
          ticketReaberturaId: closure.ticketReaberturaId,
          dataFechamento: closure.dataFechamento,
          processadoEm: closure.processadoEm,
        };
      }
    } catch (err) {
      console.warn('[AI Agent Monitor] Falha ao carregar encerramento do ticket:', (err as Error).message);
    }

    if (audits.length === 0 && !encerramento) return null;

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
      encerramento,
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

// ── Detecção de Encerramento (prematuro / resolução real / reabertura) ──

function agregarMetricasEncerramento(records: Array<{
  tipo: string;
  riscoReabertura: string;
  nota: number;
  recomendaReabertura: boolean;
}>): MetricasEncerramento {
  const total = records.length;
  const prematuros = records.filter((r) => r.tipo === 'encerramento_prematuro').length;
  const resolucoesReais = records.filter((r) => r.tipo === 'resolucao_real').length;
  const reaberturas = records.filter((r) => r.tipo === 'reabertura').length;
  return {
    total,
    prematuros,
    resolucoesReais,
    reaberturas,
    taxaEncerramentoCorreto: total > 0 ? Math.round((resolucoesReais / total) * 100) : 0,
    notaMediaEncerramento: total > 0 ? Math.round((records.reduce((s, r) => s + r.nota, 0) / total) * 10) / 10 : 0,
    riscoAlto: records.filter((r) => r.riscoReabertura === 'ALTO').length,
    riscoCritico: records.filter((r) => r.riscoReabertura === 'CRÍTICO').length,
    recomendaReabertura: records.filter((r) => r.recomendaReabertura).length,
  };
}

export async function auditarEncerramentoTicket(ticketId: string): Promise<EncerramentoAgente | null> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, assigneeId: true },
    });
    if (!ticket) return null;

    const auditoria = await auditarEncerramento(ticketId, true);

    const saved = await prisma.aIAgentClosureAudit.upsert({
      where: { ticketId },
      update: {
        protocolo: auditoria.protocolo,
        agentId: ticket.assigneeId ?? null,
        tipo: auditoria.tipo,
        riscoReabertura: auditoria.riscoReabertura,
        nota: auditoria.nota,
        diagnostico: auditoria.diagnostico,
        detalhes: JSON.stringify(auditoria.detalhes),
        recomendaReabertura: auditoria.recomendaReabertura,
        semConfirmacao: auditoria.semConfirmacao,
        motivoStatus: auditoria.motivoStatus,
        clienteVoltou: auditoria.clienteVoltou,
        mensagensAposEncerramento: auditoria.mensagensAposEncerramento,
        csatNota: auditoria.csatNota,
        csatRespondido: auditoria.csatRespondido,
        analiseIa: auditoria.analiseIa,
        ticketReaberturaId: auditoria.ticketReaberturaId,
        dataFechamento: auditoria.dataFechamento,
        processadoEm: new Date(),
      },
      create: {
        ticketId,
        protocolo: auditoria.protocolo,
        agentId: ticket.assigneeId ?? null,
        tipo: auditoria.tipo,
        riscoReabertura: auditoria.riscoReabertura,
        nota: auditoria.nota,
        diagnostico: auditoria.diagnostico,
        detalhes: JSON.stringify(auditoria.detalhes),
        recomendaReabertura: auditoria.recomendaReabertura,
        semConfirmacao: auditoria.semConfirmacao,
        motivoStatus: auditoria.motivoStatus,
        clienteVoltou: auditoria.clienteVoltou,
        mensagensAposEncerramento: auditoria.mensagensAposEncerramento,
        csatNota: auditoria.csatNota,
        csatRespondido: auditoria.csatRespondido,
        analiseIa: auditoria.analiseIa,
        ticketReaberturaId: auditoria.ticketReaberturaId,
        dataFechamento: auditoria.dataFechamento,
      },
    });

    return {
      ticketId: saved.ticketId,
      protocolo: saved.protocolo,
      contactName: auditoria.contactName,
      tipo: saved.tipo,
      riscoReabertura: saved.riscoReabertura,
      nota: saved.nota,
      diagnostico: saved.diagnostico,
      recomendaReabertura: saved.recomendaReabertura,
      semConfirmacao: saved.semConfirmacao,
      clienteVoltou: saved.clienteVoltou,
      mensagensAposEncerramento: saved.mensagensAposEncerramento,
      csatNota: saved.csatNota,
      analiseIa: saved.analiseIa,
      dataFechamento: saved.dataFechamento,
      processadoEm: saved.processadoEm,
    };
  } catch (err: any) {
    console.error('[AI Agent Monitor] Erro ao auditar encerramento do ticket:', err?.message);
    return null;
  }
}

export async function getEncerramentosAgente(
  agentId: string,
  dias: number = 30
): Promise<{ metricas: MetricasEncerramento; lista: EncerramentoAgente[] }> {
  const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const records = await prisma.aIAgentClosureAudit.findMany({
    where: {
      agentId,
      processadoEm: { gte: dataInicio },
    },
    orderBy: { processadoEm: 'desc' },
  });

  const lista: EncerramentoAgente[] = records.map((r) => ({
    ticketId: r.ticketId,
    protocolo: r.protocolo,
    contactName: null,
    tipo: r.tipo,
    riscoReabertura: r.riscoReabertura,
    nota: r.nota,
    diagnostico: r.diagnostico,
    recomendaReabertura: r.recomendaReabertura,
    semConfirmacao: r.semConfirmacao,
    clienteVoltou: r.clienteVoltou,
    mensagensAposEncerramento: r.mensagensAposEncerramento,
    csatNota: r.csatNota,
    analiseIa: r.analiseIa,
    dataFechamento: r.dataFechamento,
    processadoEm: r.processadoEm,
  }));

  return { metricas: agregarMetricasEncerramento(records), lista };
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
    treinamentoNecessario: notaGeral < 6,
    treinamentoCategoria: notaGeral < 6 ? inferirCategoriaTreinamento(alertas, pontosMelhoria) : null,
    treinamentoMotivo: notaGeral < 6 ? `Nota geral ${notaGeral}/10. ${alertas.join('; ') || 'Atendimento abaixo do esperado.'}` : null,
  };
}

function inferirCategoriaTreinamento(alertas: string[], pontosMelhoria: string[]): string {
  const todos = [...alertas, ...pontosMelhoria].join(' ').toLowerCase();
  if (/técnico|conhecimento|produto|funcion/.test(todos)) return 'Conhecimento Técnico';
  if (/fluxo|etapa|processo|procedimento|document/.test(todos)) return 'Processo/Procedimento';
  if (/comunicação|tom|idioma|gíria|informal|saudação|objetiv/.test(todos)) return 'Comunicação';
  if (/comportamento|profissionalismo|grosseria|impaciência|descaso/.test(todos)) return 'Comportamento/Profissionalismo';
  if (/sistema|ferramenta|cadastro|digitação/.test(todos)) return 'Uso do Sistema';
  return 'Comunicação';
}

// ── Diagnóstico de Treinamento de Analistas ──────────────────────────────
// Agrega dados de 4 fontes (AIAgentAudit, AIAgentClosureAudit, AuditoriaProfissional,
// Ticket+CSAT) e gera um diagnóstico consolidado via Claude (ou fallback local).

export interface DiagnosticoTreinamento {
  agentId: string;
  agentName: string;
  periodo: { inicio: string; fim: string; dias: number };
  resumo: {
    totalTickets: number;
    totalAvaliacoes: number;
    ticketsComTreinamento: number;
    csatMedio: number | null;
    notaIaMedia: number;
    classificacaoGeral: string;
    fcr: number | null;
    taxaResolucao: number | null;
    reaberturas: number;
    transferencias: number;
  };
  diagnosticoIa: string;
  diagnosticoConsolidado: string;
  necessidadePrincipal: {
    area: string;
    prioridade: 'alta' | 'media' | 'baixa';
    confianca: number;
    motivo: string;
    detalhe: string;
  } | null;
  classificacaoNecessidade: {
    categoria: string;
    icone: string;
    descricao: string;
  } | null;
  necessidades: NecessidadeTreinamento[];
  assuntoTreinamento: {
    assunto: string;
    totalTickets: number;
    ticketsComDificuldade: number;
    transferencias: number;
    reaberturas: number;
    csatMedio: number | null;
    fcr: number | null;
  } | null;
  raciocinioIa: string[];
  naoProblema: Array<{ area: string; icone: string; texto: string }>;
  causaProbavel: {
    tipo: 'analista' | 'sistema' | 'desenvolvimento' | 'base_conhecimento' | 'processo' | 'cliente';
    label: string;
    descricao: string;
    recomendacao: string;
  };
  competencias: CompetenciaAvaliada[];
  ticketsAnalisados: TicketDiagnostico[];
  ondeEstaDificuldade: DificuldadePorAssunto[];
  evidencias: EvidenciaDiagnostico[];
  separacao: { fatos: string[]; interpretacaoIa: string[]; recomendacao: string[] };
  planoTreinamento: PlanoTreinamentoItem[];
  treinamentoRecomendado: {
    titulo: string;
    prioridade: 'alta' | 'media' | 'baixa';
    objetivo: string;
    motivo: string;
    evidencias: string;
  } | null;
  confianca: number;
  confiancaExplicacao: string;
  problemaNaoEhDoAnalista: string | null;
  evolucao: {
    antes: { csat: number | null; fcr: number | null; resolucao: number | null; reaberturas: number } | null;
    depois: { csat: number | null; fcr: number | null; resolucao: number | null; reaberturas: number } | null;
    temHistorico: boolean;
  };
}

export interface NecessidadeTreinamento {
  categoria: string;
  icone: string;
  prioridade: 'alta' | 'media' | 'baixa';
  evidencias: string[];
  conclusao: string;
  treinamentoRecomendado: string;
  Assunto?: string;
  areaPrincipal?: string;
  subCategoria?: string;
}

export interface CompetenciaAvaliada {
  nome: string;
  percentual: number;
  situacao: 'otimo' | 'bom' | 'atencao' | 'critico';
}

export interface TicketDiagnostico {
  ticketId: string;
  protocolo: string | null;
  cliente: string | null;
  assunto: string | null;
  csat: number | null;
  resultado: string;
  evidencia: string;
  transferido: boolean;
  reaberto: boolean;
  intervecaoAnalista: boolean;
}

export interface DificuldadePorAssunto {
  assunto: string;
  totalTickets: number;
  resolvidos: number;
  reabertos: number;
  transferidos: number;
  csatMedio: number | null;
  resolucaoPercentual: number;
}

export interface EvidenciaDiagnostico {
  padrao: string;
  ocorrencias: number;
  impacto: string;
  conclusaoIa: string;
}

export interface PlanoTreinamentoItem {
  tema: string;
  prioridade: 'alta' | 'media' | 'baixa';
  motivo: string;
  evidencias: string;
}

export async function gerarDiagnosticoTreinamento(
  agentId: string,
  dias: number = 30
): Promise<DiagnosticoTreinamento | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) return null;

  const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const agora = new Date();

  // ── 1) Avaliações IA (por mensagem) ──────────────────────────────────
  const audits = await prisma.aIAgentAudit.findMany({
    where: { agentId, processadoEm: { gte: dataInicio } },
    select: {
      ticketId: true, notaGeral: true, classificacao: true,
      alertas: true, pontosMelhoria: true, pontosFortes: true,
      treinamentoNecessario: true, treinamentoCategoria: true, treinamentoMotivo: true,
      notProfissionalismo: true, notCordialidade: true, notClareza: true, notEmpatia: true,
    },
    orderBy: { processadoEm: 'desc' },
  });

  const ticketIdsUnicos = [...new Set(audits.map((a) => a.ticketId))];
  const totalAvaliacoes = audits.length;
  const ticketsComTreinamento = audits.filter((a) => a.treinamentoNecessario).length;

  // ── 2) Encerramentos ─────────────────────────────────────────────────
  const encerramentos = await prisma.aIAgentClosureAudit.findMany({
    where: { agentId, processadoEm: { gte: dataInicio } },
    select: {
      ticketId: true, tipo: true, riscoReabertura: true, nota: true,
      diagnostico: true, semConfirmacao: true, clienteVoltou: true,
    },
  });

  // ── 3) Tickets com CSAT ──────────────────────────────────────────────
  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: agentId,
      createdAt: { gte: dataInicio },
    },
    include: {
      csatResposta: { select: { nota: true, respondidoEm: true } },
      _count: { select: { messages: true } },
      client: { select: { razaoSocial: true } },
      metrics: { select: { totalReaberturas: true, slaStatus: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const ticketsComCsat = tickets.filter((t) => t.csatResposta?.nota != null);
  const csatMedio = ticketsComCsat.length > 0
    ? Math.round(ticketsComCsat.reduce((s, t) => s + (t.csatResposta?.nota || 0), 0) / ticketsComCsat.length * 10) / 10
    : null;

  // ── 3b) FCR e métricas derivadas ───────────────────────────────────
  const ticketsComMetricas = tickets.filter((t) => t.metrics);
  const totalComMetricas = ticketsComMetricas.length;
  const fcr = totalComMetricas > 0
    ? Math.round(ticketsComMetricas.filter((t) => (t.metrics?.totalReaberturas || 0) === 0).length / totalComMetricas * 100)
    : null;
  const totalResolvidos = tickets.filter((t) => t.etapa === 'concluido' || t.status === 'fechado').length;
  const taxaResolucao = tickets.length > 0 ? Math.round(totalResolvidos / tickets.length * 100) : null;
  const totalReaberturas = ticketsComMetricas.reduce((s, t) => s + (t.metrics?.totalReaberturas || 0), 0);

  // ── 3c) Transferências (encerramentos prematuros sem confirmação) ──
  // ── 4) Auditoria Profissional ────────────────────────────────────────
  const auditoriasProfissionais = await prisma.auditoriaProfissional.findMany({
    where: { agenteId: agentId, auditadoEm: { gte: dataInicio } },
    select: {
      ticketId: true, notaGeral: true, classificacao: true,
      notaComunicacao: true, notaProfissionalismo: true, notaEmpatia: true,
      notaClareza: true, notaConhecimentoTecnico: true, notaDiagnostico: true,
      notaResolucao: true, notaProcesso: true, notaEncerramento: true,
      evidenciaProblemas: true, recomendacoes: true,
    },
  });

  // ── 5) Nota IA média ─────────────────────────────────────────────────
  const notaIaMedia = totalAvaliacoes > 0
    ? Math.round(audits.reduce((s, a) => s + a.notaGeral, 0) / totalAvaliacoes * 10) / 10
    : 0;

  let classificacaoGeral = 'sem_dados';
  if (notaIaMedia >= 8) classificacaoGeral = 'excelente';
  else if (notaIaMedia >= 6) classificacaoGeral = 'bom';
  else if (notaIaMedia >= 4) classificacaoGeral = 'neutro';
  else if (notaIaMedia >= 2) classificacaoGeral = 'atencao';
  else if (notaIaMedia > 0) classificacaoGeral = 'critico';

  // ── 6) Agregar necessidades de treinamento ───────────────────────────
  const necessidadesMap = new Map<string, { count: number; motivos: Set<string>; categorias: Set<string> }>();
  for (const a of audits) {
    if (!a.treinamentoNecessario || !a.treinamentoCategoria) continue;
    const cat = a.treinamentoCategoria;
    if (!necessidadesMap.has(cat)) {
      necessidadesMap.set(cat, { count: 0, motivos: new Set(), categorias: new Set() });
    }
    const entry = necessidadesMap.get(cat)!;
    entry.count++;
    if (a.treinamentoMotivo) entry.motivos.add(a.treinamentoMotivo);
    entry.categorias.add(a.classificacao);
  }

  const necessidades: NecessidadeTreinamento[] = [];
  const ICONES: Record<string, string> = {
    'Conhecimento Técnico': '📚',
    'Funcionalidade': '⚙️',
    'Processo/Procedimento': '📋',
    'Comunicação': '💬',
    'Comportamento/Profissionalismo': '🤝',
    'Uso do Sistema': '🖥️',
  };
  for (const [cat, data] of necessidadesMap) {
    const prioridade = data.count >= 5 ? 'alta' : data.count >= 3 ? 'media' : 'baixa';
    necessidades.push({
      categoria: cat,
      icone: ICONES[cat] || '📌',
      prioridade,
      evidencias: [...data.motivos].slice(0, 3),
      conclusao: `${data.count} ocorrência(s) identificada(s) na categoria "${cat}".`,
      treinamentoRecomendado: `Treinamento em ${cat.toLowerCase()}.`,
    });
  }
  necessidades.sort((a, b) => {
    const ord = { alta: 0, media: 1, baixa: 2 };
    return ord[a.prioridade] - ord[b.prioridade];
  });

  // ── 7) Competências avaliadas ────────────────────────────────────────
  const medias = (field: string) => {
    const vals = auditoriasProfissionais.map((a) => (a as any)[field] as number).filter((v) => v > 0);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };
  const competencias: CompetenciaAvaliada[] = [
    { nome: 'Conhecimento Técnico', percentual: medias('notaConhecimentoTecnico'), situacao: classifyPercent(medias('notaConhecimentoTecnico')) },
    { nome: 'Diagnóstico', percentual: medias('notaDiagnostico'), situacao: classifyPercent(medias('notaDiagnostico')) },
    { nome: 'Resolução', percentual: medias('notaResolucao'), situacao: classifyPercent(medias('notaResolucao')) },
    { nome: 'Comunicação', percentual: medias('notaComunicacao'), situacao: classifyPercent(medias('notaComunicacao')) },
    { nome: 'Processo', percentual: medias('notaProcesso'), situacao: classifyPercent(medias('notaProcesso')) },
    { nome: 'Profissionalismo', percentual: medias('notaProfissionalismo'), situacao: classifyPercent(medias('notaProfissionalismo')) },
    { nome: 'Empatia', percentual: medias('notaEmpatia'), situacao: classifyPercent(medias('notaEmpatia')) },
    { nome: 'Encerramento', percentual: medias('notaEncerramento'), situacao: classifyPercent(medias('notaEncerramento')) },
  ];

  // ── 8) Tickets analisados ────────────────────────────────────────────
  const ticketsDiag: TicketDiagnostico[] = tickets.slice(0, 30).map((t) => {
    const enc = encerramentos.find((e) => e.ticketId === t.id);
    const audAudit = auditoriasProfissionais.find((a) => a.ticketId === t.id);
    const evidencias = audAudit?.evidenciaProblemas ? safeJsonParse(audAudit.evidenciaProblemas) : [];
    const isReaberto = enc?.tipo === 'reabertura';
    const isTransferido = enc?.tipo === 'encerramento_prematuro' && enc.semConfirmacao;
    return {
      ticketId: t.id,
      protocolo: t.protocolo,
      cliente: t.contactName || t.client?.razaoSocial || null,
      assunto: (t as any).categoria || (t as any).assunto || null,
      csat: t.csatResposta?.nota ?? null,
      resultado: enc?.tipo || t.etapa || t.status,
      evidencia: evidencias[0]?.descricao || enc?.diagnostico || null,
      transferido: !!isTransferido,
      reaberto: !!isReaberto,
      intervecaoAnalista: !!isTransferido || !!isReaberto,
    };
  });

  // ── 9) Dificuldade por assunto ───────────────────────────────────────
  const assuntoMap = new Map<string, { total: number; resolvidos: number; reabertos: number; transferidos: number; csats: number[] }>();
  for (const t of tickets) {
    const assunto = (t as any).categoria || (t as any).assunto || 'Geral';
    if (!assuntoMap.has(assunto)) assuntoMap.set(assunto, { total: 0, resolvidos: 0, reabertos: 0, transferidos: 0, csats: [] });
    const entry = assuntoMap.get(assunto)!;
    entry.total++;
    if (t.etapa === 'concluido' || t.status === 'fechado') entry.resolvidos++;
    const enc = encerramentos.find((e) => e.ticketId === t.id);
    if (enc?.tipo === 'reabertura') entry.reabertos++;
    if (enc?.tipo === 'encerramento_prematuro' && enc.semConfirmacao) entry.transferidos++;
    if (t.csatResposta?.nota != null) entry.csats.push(t.csatResposta.nota);
  }
  const ondeEstaDificuldade: DificuldadePorAssunto[] = [];
  for (const [assunto, data] of assuntoMap) {
    ondeEstaDificuldade.push({
      assunto,
      totalTickets: data.total,
      resolvidos: data.resolvidos,
      reabertos: data.reabertos,
      transferidos: data.transferidos,
      csatMedio: data.csats.length > 0 ? Math.round(data.csats.reduce((a, b) => a + b, 0) / data.csats.length * 10) / 10 : null,
      resolucaoPercentual: data.total > 0 ? Math.round(data.resolvidos / data.total * 100) : 0,
    });
  }
  ondeEstaDificuldade.sort((a, b) => a.resolucaoPercentual - b.resolucaoPercentual);

  // ── 10) Evidências da IA ─────────────────────────────────────────────
  const evidencias: EvidenciaDiagnostico[] = [];
  const padroesMap = new Map<string, { ocorrencias: number; tickets: Set<string> }>();
  for (const a of audits) {
    if (!a.alertas) continue;
    const alertas = safeJsonParse(a.alertas);
    for (const alerta of alertas) {
      if (!padroesMap.has(alerta)) padroesMap.set(alerta, { ocorrencias: 0, tickets: new Set() });
      const p = padroesMap.get(alerta)!;
      p.ocorrencias++;
      p.tickets.add(a.ticketId);
    }
  }
  for (const [padrao, data] of padroesMap) {
    if (data.ocorrencias < 2) continue;
    evidencias.push({
      padrao,
      ocorrencias: data.ocorrencias,
      impacto: `${data.ocorrencias} ocorrência(s) em ${data.tickets.size} ticket(s)`,
      conclusaoIa: `Padrão identificado: ${padrao.toLowerCase()}`,
    });
  }
  evidencias.sort((a, b) => b.ocorrencias - a.ocorrencias);

  // ── 11) Calcular confiança ───────────────────────────────────────────
  const fatoresConfianca: string[] = [];
  let confianca = 50;
  if (totalAvaliacoes >= 20) { confianca += 20; fatoresConfianca.push(`${totalAvaliacoes} avaliações`); }
  else if (totalAvaliacoes >= 10) { confianca += 10; fatoresConfianca.push(`${totalAvaliacoes} avaliações`); }
  if (tickets.length >= 15) { confianca += 15; fatoresConfianca.push(`${tickets.length} tickets`); }
  else if (tickets.length >= 8) { confianca += 8; fatoresConfianca.push(`${tickets.length} tickets`); }
  if (auditoriasProfissionais.length >= 5) { confianca += 10; fatoresConfianca.push(`${auditoriasProfissionais.length} auditorias profissionais`); }
  if (evidencias.length >= 3) { confianca += 5; fatoresConfianca.push(`${evidencias.length} padrões recorrentes`); }
  confianca = Math.min(confianca, 95);
  if (totalAvaliacoes < 5 && tickets.length < 5) confianca = 0;

  const confiancaExplicacao = confianca === 0
    ? 'Dados insuficientes para um diagnóstico confiável.'
    : `Baseado em ${fatoresConfianca.join(', ')}.`;

  // ── 12) Verificar se problema NÃO é do analista ──────────────────────
  let problemaNaoEhDoAnalista: string | null = null;
  const encPrematuros = encerramentos.filter((e) => e.tipo === 'encerramento_prematuro');
  if (encPrematuros.length > 0 && encPrematuros.every((e) => e.diagnostico?.includes('sistema') || e.diagnostico?.includes('bug'))) {
    problemaNaoEhDoAnalista = 'Os encerramentos prematuros parecem estar relacionados a problemas do sistema, não do analista.';
  }

  // ── 13) Gerar diagnóstico via Claude (ou fallback) ────────────────────
  let diagnosticoIa = '';
  let separacao = { fatos: [] as string[], interpretacaoIa: [] as string[], recomendacao: [] as string[] };
  let planoTreinamento: PlanoTreinamentoItem[] = [];

  if (hasClaude()) {
    try {
      const prompt = buildDiagnosticoPrompt({
        agentName: agent.name, totalTickets: tickets.length, totalAvaliacoes,
        csatMedio, notaIaMedia, classificacaoGeral,
        necessidades, competencias, ondeEstaDificuldade, evidencias,
        encerramentos: encerramentos.length,
        prematuros: encPrematuros.length,
        reaberturas: encerramentos.filter((e) => e.tipo === 'reabertura').length,
      });
      const response = await callClaude(prompt, 2000, 'diagnostico-treinamento');
      const parsed = safeJsonParse(response);
      if (parsed) {
        diagnosticoIa = parsed.diagnostico || '';
        separacao = {
          fatos: parsed.fatos || [],
          interpretacaoIa: parsed.interpretacao || [],
          recomendacao: parsed.recomendacao || [],
        };
        planoTreinamento = (parsed.planoTreinamento || []).map((p: any) => ({
          tema: p.tema || '',
          prioridade: p.prioridade || 'media',
          motivo: p.motivo || '',
          evidencias: p.evidencias || '',
        }));
      }
    } catch (err: any) {
      console.warn('[DIAGNOSTICO] Claude falhou, usando fallback local:', err?.message);
    }
  }

  if (!diagnosticoIa) {
    const fallback = buildDiagnosticoFallback({
      agentName: agent.name, totalTickets: tickets.length, totalAvaliacoes,
      csatMedio, notaIaMedia, classificacaoGeral,
      necessidades, ondeEstaDificuldade, evidencias,
      prematuros: encPrematuros.length,
      reaberturas: encerramentos.filter((e) => e.tipo === 'reabertura').length,
    });
    diagnosticoIa = fallback.diagnostico;
    separacao = fallback.separacao;
    planoTreinamento = fallback.planoTreinamento;
  }

  // ── 14) Necessidade principal ─────────────────────────────────────
  const necessidadePrincipal = necessidades.length > 0
    ? {
        area: necessidades[0].categoria,
        prioridade: necessidades[0].prioridade,
        confianca: confianca,
        motivo: necessidades[0].conclusao,
        detalhe: necessidades[0].treinamentoRecomendado,
      }
    : null;

  // ── 15) Classificação da necessidade ──────────────────────────────
  const classificacaoNecessidade = necessidadePrincipal
    ? {
        categoria: necessidadePrincipal.area,
        icone: necessidades[0].icone,
        descricao: necessidades[0].conclusao,
      }
    : null;

  // ── 16) Assunto que necessita treinamento ─────────────────────────
  const assuntoComDificuldade = ondeEstaDificuldade.find((a) => a.resolucaoPercentual < 70 || (a.csatMedio != null && a.csatMedio < 3));
  const assuntoTreinamento = assuntoComDificuldade
    ? {
        assunto: assuntoComDificuldade.assunto,
        totalTickets: assuntoComDificuldade.totalTickets,
        ticketsComDificuldade: assuntoComDificuldade.totalTickets - assuntoComDificuldade.resolvidos,
        transferencias: assuntoComDificuldade.transferidos,
        reaberturas: assuntoComDificuldade.reabertos,
        csatMedio: assuntoComDificuldade.csatMedio,
        fcr: assuntoComDificuldade.totalTickets > 0
          ? Math.round((assuntoComDificuldade.totalTickets - assuntoComDificuldade.reabertos) / assuntoComDificuldade.totalTickets * 100)
          : null,
      }
    : null;

  // ── 17) Diagnóstico consolidado do analista ────────────────────────
  const diagnosticoConsolidado = gerarDiagnosticoConsolidado({
    agentName: agent.name, necessidades, competencias, ondeEstaDificuldade,
    csatMedio, fcr, taxaResolucao, totalReaberturas,
    totalTickets: tickets.length, totalAvaliacoes, assuntoTreinamento,
  });

  // ── 18) O que NÃO é problema ─────────────────────────────────────
  const naoProblema: Array<{ area: string; icone: string; texto: string }> = [];
  const compMap = new Map(competencias.map((c) => [c.nome, c]));
  const areasOk = ['Comunicação', 'Profissionalismo', 'Processo', 'Empatia'];
  for (const area of areasOk) {
    const c = compMap.get(area);
    if (!c || c.percentual >= 70) {
      naoProblema.push({
        area,
        icone: '✅',
        texto: `Não foram identificadas evidências suficientes de necessidade de treinamento em ${area.toLowerCase()}.`,
      });
    }
  }

  // ── 19) Causa provável ────────────────────────────────────────────
  const causaProbavel = determinarCausaProbavel({
    encerramentos, ondeEstaDificuldade, competencias, evidencias,
    necessidades, totalReaberturas,
  });

  // ── 20) Treinamento recomendado ───────────────────────────────────
  const treinamentoRecomendado = necessidadePrincipal
    ? {
        titulo: `Treinamento em ${necessidadePrincipal.area}` + (assuntoTreinamento ? ` — ${assuntoTreinamento.assunto}` : ''),
        prioridade: necessidadePrincipal.prioridade,
        objetivo: `Capacitar o analista para ${necessidadePrincipal.area.toLowerCase()}${assuntoTreinamento ? ' em ' + assuntoTreinamento.assunto.toLowerCase() : ''}.`,
        motivo: necessidadePrincipal.motivo,
        evidencias: assuntoTreinamento
          ? `${assuntoTreinamento.ticketsComDificuldade} ticket(s) com dificuldade.`
          : `${ticketsComTreinamento} avaliação(ões) com necessidade de treinamento.`,
      }
    : null;

  // ── 21) Evolução (comparar primeiro vs segundo半do do período) ─────
  const evolucao = await calcularEvolucaoTreinamento(agentId, dataInicio, agora);

  return {
    agentId,
    agentName: agent.name,
    periodo: {
      inicio: dataInicio.toISOString(),
      fim: agora.toISOString(),
      dias,
    },
    resumo: {
      totalTickets: tickets.length,
      totalAvaliacoes,
      ticketsComTreinamento,
      csatMedio,
      notaIaMedia,
      classificacaoGeral,
      fcr,
      taxaResolucao,
      reaberturas: totalReaberturas,
      transferencias: encPrematuros.length,
    },
    diagnosticoIa,
    diagnosticoConsolidado,
    necessidadePrincipal,
    classificacaoNecessidade,
    necessidades,
    assuntoTreinamento,
    raciocinioIa: separacao.interpretacaoIa,
    naoProblema,
    causaProbavel,
    competencias,
    ticketsAnalisados: ticketsDiag,
    ondeEstaDificuldade,
    evidencias,
    separacao,
    planoTreinamento,
    treinamentoRecomendado,
    confianca,
    confiancaExplicacao,
    problemaNaoEhDoAnalista,
    evolucao,
  };
}

// ── Helpers de Diagnóstico de Treinamento ──────────────────────────────

function gerarDiagnosticoConsolidado(d: {
  agentName: string; necessidades: NecessidadeTreinamento[];
  competencias: CompetenciaAvaliada[]; ondeEstaDificuldade: DificuldadePorAssunto[];
  csatMedio: number | null; fcr: number | null; taxaResolucao: number | null;
  totalReaberturas: number; totalTickets: number; totalAvaliacoes: number;
  assuntoTreinamento?: { assunto: string } | null;
}): string {
  const parts: string[] = [];
  parts.push(`O principal ponto de desenvolvimento de ${d.agentName} está relacionado a ${d.necessidades.length > 0 ? d.necessidades[0].categoria.toLowerCase() : 'áreas não identificadas'}.`);

  if (d.assuntoTreinamento) {
    parts.push(`A análise identificou dificuldade recorrente em chamados de ${d.assuntoTreinamento.assunto}.`);
  }

  const areasOk = d.competencias.filter((c) => c.percentual >= 70).map((c) => c.nome);
  if (areasOk.length > 0) {
    parts.push(`A análise não encontrou evidências suficientes de problemas relacionados a ${areasOk.join(', ')}.`);
  }

  const impactos: string[] = [];
  if (d.fcr != null && d.fcr < 60) impactos.push(`taxa FCR de ${d.fcr}%`);
  if (d.csatMedio != null && d.csatMedio < 3.5) impactos.push(`CSAT de ${d.csatMedio}`);
  if (d.totalReaberturas > 3) impactos.push(`${d.totalReaberturas} reaberturas`);
  if (impactos.length > 0) {
    parts.push(`O impacto está principalmente na ${impactos.join(', ')}.`);
  }

  return parts.join(' ');
}

function determinarCausaProbavel(d: {
  encerramentos: Array<{ tipo: string; diagnostico: string | null; semConfirmacao: boolean }>;
  ondeEstaDificuldade: DificuldadePorAssunto[];
  competencias: CompetenciaAvaliada[];
  evidencias: EvidenciaDiagnostico[];
  necessidades: NecessidadeTreinamento[];
  totalReaberturas: number;
}): { tipo: 'analista' | 'sistema' | 'desenvolvimento' | 'base_conhecimento' | 'processo' | 'cliente'; label: string; descricao: string; recomendacao: string } {
  const encPrematuros = d.encerramentos.filter((e) => e.tipo === 'encerramento_prematuro');
  const diags = encPrematuros.map((e) => (e.diagnostico || '').toLowerCase());
  const temSistema = diags.some((d) => d.includes('sistema') || d.includes('bug') || d.includes('comportamento incorreto'));

  if (temSistema && encPrematuros.length >= 2) {
    return {
      tipo: 'sistema',
      label: 'Sistema',
      descricao: 'Os tickets apresentam comportamento inconsistente da aplicação. Não foram encontradas evidências suficientes de falta de conhecimento do analista.',
      recomendacao: 'Encaminhar para Desenvolvimento.',
    };
  }

  const compDiagnostico = d.competencias.find((c) => c.nome === 'Diagnóstico');
  const compConhecimento = d.competencias.find((c) => c.nome === 'Conhecimento Técnico');
  if (compDiagnostico && compDiagnostico.percentual < 50) {
    return {
      tipo: 'analista',
      label: 'Analista — Diagnóstico',
      descricao: 'A análise identificou dificuldade recorrente na identificação da causa do problema.',
      recomendacao: 'Treinamento em diagnóstico técnico e resolução de problemas.',
    };
  }
  if (compConhecimento && compConhecimento.percentual < 50) {
    return {
      tipo: 'analista',
      label: 'Analista — Conhecimento',
      descricao: 'O analista não demonstra domínio suficiente do assunto técnico.',
      recomendacao: 'Treinamento técnico específico sobre os assuntos com maior demanda.',
    };
  }

  if (d.totalReaberturas > 5) {
    return {
      tipo: 'processo',
      label: 'Processo',
      descricao: 'Alta taxa de reaberturas indica possível problema no processo de resolução.',
      recomendacao: 'Revisar o fluxo de resolução e criar checklists de verificação.',
    };
  }

  return {
    tipo: 'analista',
    label: 'Analista',
    descricao: 'Foram identificadas dificuldades recorrentes que indicam necessidade de aprimoramento.',
    recomendacao: 'Treinamento direcionado para as áreas identificadas.',
  };
}

async function calcularEvolucaoTreinamento(
  agentId: string,
  dataInicio: Date,
  dataFim: Date,
): Promise<{ antes: { csat: number | null; fcr: number | null; resolucao: number | null; reaberturas: number } | null; depois: { csat: number | null; fcr: number | null; resolucao: number | null; reaberturas: number } | null; temHistorico: boolean }> {
  const meio = new Date(dataInicio.getTime() + (dataFim.getTime() - dataInicio.getTime()) / 2);

  const metricasPeriodo = async (ini: Date, fim: Date) => {
    const ticks = await prisma.ticket.findMany({
      where: { assigneeId: agentId, createdAt: { gte: ini, lt: fim } },
      include: { csatResposta: { select: { nota: true } }, metrics: { select: { totalReaberturas: true } } },
    });
    if (ticks.length === 0) return null;
    const comCsat = ticks.filter((t) => t.csatResposta?.nota != null);
    const csat = comCsat.length > 0 ? Math.round(comCsat.reduce((s, t) => s + (t.csatResposta!.nota || 0), 0) / comCsat.length * 10) / 10 : null;
    const comMetricas = ticks.filter((t) => t.metrics);
    const fcr = comMetricas.length > 0 ? Math.round(comMetricas.filter((t) => (t.metrics!.totalReaberturas || 0) === 0).length / comMetricas.length * 100) : null;
    const resolvidos = ticks.filter((t) => t.etapa === 'concluido' || t.status === 'fechado').length;
    const resolucao = Math.round(resolvidos / ticks.length * 100);
    const reaberturas = comMetricas.reduce((s, t) => s + (t.metrics!.totalReaberturas || 0), 0);
    return { csat, fcr, resolucao, reaberturas };
  };

  const antes = await metricasPeriodo(dataInicio, meio);
  const depois = await metricasPeriodo(meio, dataFim);

  return {
    antes,
    depois,
    temHistorico: antes != null && depois != null,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function classifyPercent(v: number): 'otimo' | 'bom' | 'atencao' | 'critico' {
  if (v >= 80) return 'otimo';
  if (v >= 60) return 'bom';
  if (v >= 40) return 'atencao';
  return 'critico';
}

function safeJsonParse(s: string | null): any {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function buildDiagnosticoPrompt(d: {
  agentName: string; totalTickets: number; totalAvaliacoes: number;
  csatMedio: number | null; notaIaMedia: number; classificacaoGeral: string;
  necessidades: NecessidadeTreinamento[]; competencias: CompetenciaAvaliada[];
  ondeEstaDificuldade: DificuldadePorAssunto[]; evidencias: EvidenciaDiagnostico[];
  encerramentos: number; prematuros: number; reaberturas: number;
}): string {
  return `Você é um especialista em gestão de pessoas e qualidade de atendimento. Gere um diagnóstico consolidado de treinamento para o analista.

DADOS DO ANALISTA:
- Nome: ${d.agentName}
- Período: últimos ${d.necessidades.length > 0 ? '30' : '30'} dias
- Tickets atendidos: ${d.totalTickets}
- Avaliações IA: ${d.totalAvaliacoes}
- CSAT médio: ${d.csatMedio ?? 'sem dados'}/5
- Nota IA média: ${d.notaIaMedia}/10
- Classificação geral: ${d.classificacaoGeral}
- Encerramentos auditados: ${d.encerramentos}
- Encerramentos prematuros: ${d.prematuros}
- Reaberturas: ${d.reaberturas}

NECESSIDADES IDENTIFICADAS:
${d.necessidades.map((n) => `- ${n.categoria}: ${n.evidencias.join('; ')}`).join('\n') || 'Nenhuma necessidade específica identificada.'}

COMPETÊNCIAS (0-100):
${d.competencias.map((c) => `- ${c.nome}: ${c.percentual}% (${c.situacao})`).join('\n')}

DIFICULDADE POR ASSUNTO:
${d.ondeEstaDificuldade.map((a) => `- ${a.assunto}: ${a.totalTickets} tickets, ${a.resolucaoPercentual}% resolução, CSAT ${a.csatMedio ?? 'N/A'}`).join('\n')}

PADRÕES IDENTIFICADOS:
${d.evidencias.map((e) => `- ${e.padrao}: ${e.ocorrencias} ocorrências`).join('\n') || 'Nenhum padrão recorrente identificado.'}

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "diagnostico": "<parágrafo explicando em linguagem natural por que o alerta foi gerado, com números reais>",
  "fatos": [<array de fatos observados, ex: "9 chamados não resolvidos no primeiro contato", "5 transferências">],
  "interpretacao": [<array de interpretações da IA, ex: "O principal padrão está relacionado à dificuldade de diagnóstico">],
  "recomendacao": [<array de recomendações acionáveis>],
  "planoTreinamento": [
    {
      "tema": "<tema específico>",
      "prioridade": "alta|media|baixa",
      "motivo": "<por que esse treinamento é necessário>",
      "evidencias": "<dados que sustentam>"
    }
  ]
}

REGRAS:
1. Cada frase deve citar números reais dos dados.
2. Não inventar dados não fornecidos.
3. Se não houver evidência suficiente, diga "Dados insuficientes".
4. Separar fatos de interpretação de recomendação.
5. Plano de treinamento deve ser específico (não "treinar em tudo").`;
}

function buildDiagnosticoFallback(d: {
  agentName: string; totalTickets: number; totalAvaliacoes: number;
  csatMedio: number | null; notaIaMedia: number; classificacaoGeral: string;
  necessidades: NecessidadeTreinamento[]; ondeEstaDificuldade: DificuldadePorAssunto[];
  evidencias: EvidenciaDiagnostico[]; prematuros: number; reaberturas: number;
}): { diagnostico: string; separacao: { fatos: string[]; interpretacaoIa: string[]; recomendacao: string[] }; planoTreinamento: PlanoTreinamentoItem[] } {
  const fatos: string[] = [];
  const interpretacaoIa: string[] = [];
  const recomendacao: string[] = [];
  const planoTreinamento: PlanoTreinamentoItem[] = [];

  fatos.push(`${d.totalTickets} tickets atendidos no período.`);
  if (d.csatMedio != null) fatos.push(`CSAT médio: ${d.csatMedio}/5.`);
  fatos.push(`Nota IA média: ${d.notaIaMedia}/10.`);
  if (d.prematuros > 0) fatos.push(`${d.prematuros} encerramento(s) prematuro(s).`);
  if (d.reaberturas > 0) fatos.push(`${d.reaberturas} reabertura(s).`);

  if (d.necessidades.length > 0) {
    interpretacaoIa.push(`Foram identificadas ${d.necessidades.length} necessidade(s) de treinamento.`);
    for (const n of d.necessidades) {
      planoTreinamento.push({
        tema: n.categoria,
        prioridade: n.prioridade,
        motivo: n.conclusao,
        evidencias: n.evidencias.join('; '),
      });
    }
  } else {
    interpretacaoIa.push('Não foram identificadas necessidades específicas de treinamento com os dados disponíveis.');
  }

  if (d.ondeEstaDificuldade.length > 0) {
    const pior = d.ondeEstaDificuldade[0];
    if (pior.resolucaoPercentual < 60) {
      interpretacaoIa.push(`Maior dificuldade em "${pior.assunto}" com ${pior.resolucaoPercentual}% de resolução.`);
    }
  }

  recomendacao.push(d.necessidades.length > 0 ? 'Recomenda-se treinamento focado nas categorias identificadas.' : 'Coletar mais dados para um diagnóstico confiável.');

  const diagnostico = `O analista ${d.agentName} atendeu ${d.totalTickets} tickets no período. ${d.csatMedio != null ? `CSAT médio: ${d.csatMedio}/5.` : ''} Nota IA: ${d.notaIaMedia}/10. ${d.necessidades.length > 0 ? `Foram identificadas ${d.necessidades.length} necessidade(s) de treinamento.` : 'Não foram identificadas necessidades específicas de treinamento.'}`;

  return { diagnostico, separacao: { fatos, interpretacaoIa, recomendacao }, planoTreinamento };
}
