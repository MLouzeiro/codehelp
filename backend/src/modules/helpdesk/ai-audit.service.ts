import { env } from '../../config/env';
import prisma from '../../config/database';

interface AuditResult {
  nota: number;
  classificacao: 'excelente' | 'bom' | 'regular' | 'ruim';
  pontosFortes: string[];
  pontosFracos: string[];
  sugestao: string;
}

interface AgentAudit {
  agenteId: string;
  agenteNome: string;
  totalAtendimentos: number;
  mediaNotas: number;
  classificacao: string;
  ultimasAvaliacoes: { ticketId: string; nota: number; classificacao: string; data: string }[];
}

export async function auditAgentResponse(messageId: string, messageText: string): Promise<AuditResult> {
  if (!env.anthropicKey) {
    return auditLocal(messageText);
  }

  const prompt = `Analise a resposta de um atendente de suporte técnico abaixo. Avalie se é educado, profissional e respeitoso. Retorne APENAS um JSON válido com:
- nota: número de 1 a 10
- classificacao: "excelente" (9-10), "bom" (7-8), "regular" (5-6), "ruim" (1-4)
- pontosFortes: array de strings com pontos positivos
- pontosFracos: array de strings com pontos que precisam melhorar
- sugestao: string com sugestão de melhoria

Resposta do atendente:
"${messageText}"

Considere: educação, profissionalismo, clareza, empatia, resolução do problema, uso de linguagem adequada.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error('Erro na API Claude');
    const data: any = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta não é JSON válido');
    const result = JSON.parse(jsonMatch[0]);

    return {
      nota: Math.min(10, Math.max(1, result.nota || 5)),
      classificacao: result.classificacao || 'regular',
      pontosFortes: result.pontosFortes || [],
      pontosFracos: result.pontosFracos || [],
      sugestao: result.sugestao || '',
    };
  } catch (err) {
    console.error('[AI Audit] Erro ao auditar:', err);
    return auditLocal(messageText);
  }
}

function auditLocal(text: string): AuditResult {
  const lower = text.toLowerCase();
  let nota = 5;
  const pontosFortes: string[] = [];
  const pontosFracos: string[] = [];

  const positivos = ['por favor', 'obrigado', 'desculpa', 'compreendo', 'vou ajudar', 'pode ficar tranquilo', 'bom dia', 'boa tarde', 'boas vindas', 'estou aqui'];
  const negativos = ['isso é obvio', 'nao sei', 'ta errado', 'leia o manual', 'isso ja foi respondido', 'burro', 'idiota', 'nao pode', 'impossivel', 'de jeito nenhum'];

  for (const p of positivos) { if (lower.includes(p)) { nota += 1; pontosFortes.push(`Usou "${p}"`); } }
  for (const n of negativos) { if (lower.includes(n)) { nota -= 1.5; pontosFracos.push(`Usou "${n}"`); } }

  if (lower.includes('!')) pontosFracos.push('Uso excessivo de exclamação');
  if (text.length > 200) pontosFortes.push('Resposta detalhada');
  if (text.length < 20) pontosFracos.push('Resposta muito curta');

  nota = Math.min(10, Math.max(1, Math.round(nota)));
  const classificacao = nota >= 9 ? 'excelente' : nota >= 7 ? 'bom' : nota >= 5 ? 'regular' : 'ruim';

  return {
    nota,
    classificacao,
    pontosFortes: pontosFortes.length ? pontosFortes : ['Resposta neutra'],
    pontosFracos: pontosFracos.length ? pontosFracos : ['Sem problemas críticos'],
    sugestao: nota < 7 ? 'Recomenda-se treinamento em atendimento ao cliente' : 'Bom atendimento, manter padrão',
  };
}

export async function getAgentPerformance(dataInicio?: string, dataFim?: string): Promise<AgentAudit[]> {
  const where: any = {
    fromMe: true,
    createdAt: dataInicio && dataFim ? {
      gte: new Date(dataInicio),
      lte: new Date(dataFim),
    } : undefined,
  };

  const agentes = await prisma.user.findMany({
    where: { role: { in: ['tecnico', 'gerente', 'admin'] }, active: true },
    select: { id: true, name: true },
  });

  const results: AgentAudit[] = [];

  for (const agente of agentes) {
    const messages = await prisma.message.findMany({
      where: { ...where, ticket: { assigneeId: agente.id } },
      select: { id: true, content: true, createdAt: true, ticketId: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (messages.length === 0) {
      results.push({
        agenteId: agente.id,
        agenteNome: agente.name,
        totalAtendimentos: 0,
        mediaNotas: 0,
        classificacao: 'sem_dados',
        ultimasAvaliacoes: [],
      });
      continue;
    }

    let somaNotas = 0;
    const avaliacoes: AgentAudit['ultimasAvaliacoes'] = [];

    for (const msg of messages) {
      const audit = await auditAgentResponse(msg.id, msg.content || '');
      somaNotas += audit.nota;
      avaliacoes.push({
        ticketId: msg.ticketId,
        nota: audit.nota,
        classificacao: audit.classificacao,
        data: msg.createdAt.toISOString(),
      });
    }

    const mediaNotas = Math.round((somaNotas / messages.length) * 10) / 10;
    const classificacao = mediaNotas >= 9 ? 'excelente' : mediaNotas >= 7 ? 'bom' : mediaNotas >= 5 ? 'regular' : 'ruim';

    results.push({
      agenteId: agente.id,
      agenteNome: agente.name,
      totalAtendimentos: messages.length,
      mediaNotas,
      classificacao,
      ultimasAvaliacoes: avaliacoes.slice(0, 10),
    });
  }

  return results.sort((a, b) => b.mediaNotas - a.mediaNotas);
}
