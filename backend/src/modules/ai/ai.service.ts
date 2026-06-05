import prisma from '../../config/database';
import { env } from '../../config/env';

type AiProvider = 'claude' | 'local';

function getProvider(): AiProvider {
  return env.anthropicKey ? 'claude' : 'local';
}

/* -------- Validação de Horário de Atendimento -------- */

interface BusinessHours {
  ativo: boolean;
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
  fusoHorario: string;
}

function parseDiasSemana(dias: string): number[] {
  return dias.split(',').map(Number).filter((n) => n >= 0 && n <= 6);
}

function dentroDoHorario(hours: BusinessHours): boolean {
  if (!hours.ativo) return true;

  try {
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0=Dom, 1=Seg..
    if (!hours.diasSemana.includes(diaSemana)) return false;

    const [hInicio, mInicio] = hours.horaInicio.split(':').map(Number);
    const [hFim, mFim] = hours.horaFim.split(':').map(Number);

    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const inicioMin = hInicio * 60 + mInicio;
    const fimMin = hFim * 60 + mFim;

    return agoraMin >= inicioMin && agoraMin <= fimMin;
  } catch {
    return true; // se falhar, permite execução
  }
}

async function robotPodeExecutar(slug: string): Promise<boolean> {
  try {
    const robot = await prisma.robot.findUnique({ where: { slug } });
    if (!robot) return true;
    if (!robot.ativo) return false;

    return dentroDoHorario({
      ativo: robot.horarioAtivo,
      diasSemana: parseDiasSemana(robot.diasSemana),
      horaInicio: robot.horaInicio,
      horaFim: robot.horaFim,
      fusoHorario: robot.fusoHorario,
    });
  } catch {
    return true;
  }
}

async function getConfig(slug: string): Promise<Record<string, any>> {
  try {
    const robot = await prisma.robot.findUnique({ where: { slug } });
    if (!robot) return {};
    return JSON.parse(robot.config || '{}');
  } catch {
    return {};
  }
}

async function callClaude(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  const data: any = await response.json();
  return data.content?.[0]?.text || '';
}

/* -------- ROBÔ 1: Assistente de Vendas (CRM) -------- */

export interface VendaSugestao {
  clientId: string;
  cliente: string;
  acao: string;
  motivo: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export async function gerarSugestoesVendas(): Promise<{
  sugestoes: VendaSugestao[];
  generated: boolean;
}> {
  if (!(await robotPodeExecutar('vendas'))) {
    return { sugestoes: [], generated: false };
  }

  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const setentaDias = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);

  const prospects = await prisma.client.findMany({
    where: { status: 'prospecto' },
    include: { contacts: { orderBy: { data: 'desc' }, take: 1 } },
  });

  const clientesSemContato = await prisma.client.findMany({
    where: {
      status: 'ativo',
      contacts: { none: { data: { gte: trintaDias } } },
    },
    include: { contacts: { orderBy: { data: 'desc' }, take: 1 } },
  });

  const oportunidadesParadas = await prisma.opportunity.findMany({
    where: {
      etapa: { in: ['prospeccao', 'proposta', 'negociacao'] },
      updatedAt: { lte: setentaDias },
    },
    include: { client: true, responsavel: { select: { name: true } } },
  });

  const sugestoes: VendaSugestao[] = [];

  for (const p of prospects.slice(0, 5)) {
    sugestoes.push({
      clientId: p.id,
      cliente: p.razaoSocial,
      acao: 'Fazer primeiro contato comercial',
      motivo: `Prospecto cadastrado há mais de 7 dias sem contato`,
      prioridade: 'alta',
    });
  }

  for (const c of clientesSemContato.slice(0, 5)) {
    sugestoes.push({
      clientId: c.id,
      cliente: c.razaoSocial,
      acao: 'Agendar follow-up',
      motivo: `Sem interação há mais de 30 dias (último contato: ${c.contacts[0]?.data ? new Date(c.contacts[0].data).toLocaleDateString('pt-BR') : 'nenhum'})`,
      prioridade: 'media',
    });
  }

  for (const o of oportunidadesParadas.slice(0, 5)) {
    sugestoes.push({
      clientId: o.client?.id || '',
      cliente: o.client?.razaoSocial || 'Desconhecido',
      acao: `Reativar oportunidade "${o.titulo}" — está parada há ${Math.floor((Date.now() - o.updatedAt.getTime()) / 86400000)} dias`,
      motivo: `Responsável: ${o.responsavel?.name || 'N/A'} | Estágio: ${o.etapa}`,
      prioridade: 'alta',
    });
  }

  if (getProvider() === 'claude' && sugestoes.length > 0) {
    try {
      const prompt = `Você é um analista de vendas da Codemed. Analise estas sugestões automáticas e reescreva cada ação de forma mais estratégica e persuasiva. Mantenha o formato JSON array com campos: clientId, cliente, acao, motivo, prioridade. Use português brasileiro.

Sugestões: ${JSON.stringify(sugestoes.slice(0, 10))}`;

      const text = await callClaude(prompt);
      try {
        const parsed = JSON.parse(text);
        return { sugestoes: parsed.slice(0, 10), generated: true };
      } catch {
        return { sugestoes: sugestoes.slice(0, 10), generated: false };
      }
    } catch {
      return { sugestoes: sugestoes.slice(0, 10), generated: false };
    }
  }

  return { sugestoes: sugestoes.slice(0, 10), generated: false };
}

/* -------- ROBÔ 2: Classificador de Tickets -------- */

export async function classificarTicketsPendentes(): Promise<{
  classificados: number;
  detalhes: { ticketId: string; categoria: string; confianca: string }[];
}> {
  if (!(await robotPodeExecutar('classificador'))) {
    return { classificados: 0, detalhes: [] };
  }

  const tickets = await prisma.ticket.findMany({
    where: { categoria: null, status: { not: 'fechado' } },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 3 } },
  });

  const categorias = [
    'suporte_tecnico',
    'duvida_faturamento',
    'solicitacao_mudanca',
    'treinamento',
    'reclamacao',
    'outro',
  ];

  const classificados: { ticketId: string; categoria: string; confianca: string }[] = [];

  for (const ticket of tickets.slice(0, 20)) {
    const texto = ticket.assunto + ' ' + ticket.messages.map((m) => m.content).join(' ');

    if (getProvider() === 'claude') {
      try {
        const prompt = `Classifique o ticket abaixo em UMA das categorias: ${categorias.join(', ')}. Responda apenas com o nome da categoria.

Assunto: ${ticket.assunto || 'Sem assunto'}
Mensagem: ${texto.slice(0, 300)}`;
        const result = await callClaude(prompt);
        const categoria = result.trim().toLowerCase();
        if (categorias.includes(categoria)) {
          await prisma.ticket.update({ where: { id: ticket.id }, data: { categoria } });
          classificados.push({ ticketId: ticket.id, categoria, confianca: 'auto' });
        }
      } catch {
        const categoria = classificarLocal(texto, categorias);
        if (categoria !== 'outro') {
          await prisma.ticket.update({ where: { id: ticket.id }, data: { categoria } });
          classificados.push({ ticketId: ticket.id, categoria, confianca: 'local' });
        }
      }
    } else {
      const categoria = classificarLocal(texto, categorias);
      if (categoria !== 'outro') {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { categoria } });
        classificados.push({ ticketId: ticket.id, categoria, confianca: 'local' });
      }
    }
  }

  return { classificados: classificados.length, detalhes: classificados };
}

function classificarLocal(texto: string, categorias: string[]): string {
  const lower = texto.toLowerCase();
  if (/(erro|bug|não funciona|quebrou|falha|problema|travou)/.test(lower)) return 'suporte_tecnico';
  if (/(boleto|fatura|nota|pagamento|cobrança|preço|valor|contrato)/.test(lower)) return 'duvida_faturamento';
  if (/(quero|preciso|mudar|adicionar|novo|implementar|sugestão|melhoria)/.test(lower)) return 'solicitacao_mudanca';
  if (/(como|ajuda|ensinar|aprender|dúvida|funciona|tutorial|manual)/.test(lower)) return 'treinamento';
  if (/(insatisfeito|péssimo|horrível|reclamação|chateado|decepção)/.test(lower)) return 'reclamacao';
  return 'outro';
}

/* -------- ROBÔ 3: Analista de OS -------- */

export interface OsAlert {
  orderId: string;
  numeroOs: string;
  cliente: string;
  tecnico: string;
  diasParada: number;
  alerta: string;
}

export async function analisarOsAtrasadas(): Promise<OsAlert[]> {
  if (!(await robotPodeExecutar('os-analyst'))) {
    return [];
  }

  const cfg = await getConfig('os-analyst');

  const orders = await prisma.serviceOrder.findMany({
    where: {
      status: { in: ['rascunho', 'aguardando_assinatura', 'em_execucao'] },
    },
    include: {
      client: { select: { razaoSocial: true } },
      tecnicoResponsavel: { select: { name: true } },
    },
  });

  const alerts: OsAlert[] = [];
  const now = Date.now();
  const diasRascunho = cfg.diasLimiteRascunho || 14;
  const diasAssinatura = cfg.diasLimiteAssinatura || 7;
  const diasExecucao = cfg.diasLimiteExecucao || 20;

  for (const o of orders) {
    const dias = Math.floor((now - o.createdAt.getTime()) / 86400000);

    if (dias >= diasRascunho && o.status === 'rascunho') {
      alerts.push({
        orderId: o.id,
        numeroOs: o.numeroOs,
        cliente: o.client?.razaoSocial || 'N/A',
        tecnico: o.tecnicoResponsavel?.name || 'N/A',
        diasParada: dias,
        alerta: `OS em rascunho há ${dias} dias sem progresso — risco de perda de serviço`,
      });
    }

    if (dias >= diasAssinatura && o.status === 'aguardando_assinatura') {
      alerts.push({
        orderId: o.id,
        numeroOs: o.numeroOs,
        cliente: o.client?.razaoSocial || 'N/A',
        tecnico: o.tecnicoResponsavel?.name || 'N/A',
        diasParada: dias,
        alerta: `Aguardando assinatura do cliente há ${dias} dias — reenviar link ou ligar`,
      });
    }

    if (dias >= diasExecucao && o.status === 'em_execucao') {
      alerts.push({
        orderId: o.id,
        numeroOs: o.numeroOs,
        cliente: o.client?.razaoSocial || 'N/A',
        tecnico: o.tecnicoResponsavel?.name || 'N/A',
        diasParada: dias,
        alerta: `OS em execução há ${dias} dias — acima do prazo esperado (${diasExecucao} dias)`,
      });
    }
  }

  return alerts.sort((a, b) => b.diasParada - a.diasParada);
}

/* -------- ROBÔ 4: Assistente de Tarefas -------- */

export interface TarefaSugestao {
  taskId: string;
  titulo: string;
  responsavel: string;
  sugestao: string;
}

export async function sugerirPrioridadesTarefas(): Promise<TarefaSugestao[]> {
  if (!(await robotPodeExecutar('tarefas'))) {
    return [];
  }

  const cfg = await getConfig('tarefas');

  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['aberta', 'em_andamento'] },
    },
    include: { responsavel: { select: { name: true } } },
  });

  const sugestoes: TarefaSugestao[] = [];
  const diasUrgente = cfg.diasUrgente || 2;
  const diasMedia = cfg.diasMedia || 7;
  const diasSemPrazo = cfg.diasSemPrazo || 5;

  for (const t of tasks) {
    if (t.dataVencimento) {
      const diasRestantes = Math.ceil((t.dataVencimento.getTime() - Date.now()) / 86400000);

      if (diasRestantes <= diasUrgente && t.prioridade !== 'urgente') {
        sugestoes.push({
          taskId: t.id,
          titulo: t.titulo,
          responsavel: t.responsavel?.name || 'N/A',
          sugestao: `Vence em ${diasRestantes} dia(s) — sugerido alterar prioridade para URGENTE`,
        });
      } else if (diasRestantes <= diasMedia && t.prioridade === 'baixa') {
        sugestoes.push({
          taskId: t.id,
          titulo: t.titulo,
          responsavel: t.responsavel?.name || 'N/A',
          sugestao: `Vence em ${diasRestantes} dia(s) — sugerido alterar prioridade para MÉDIA`,
        });
      }
    }

    if (!t.dataVencimento && t.prioridade === 'urgente' && t.status === 'aberta') {
      const diasCriada = Math.floor((Date.now() - t.createdAt.getTime()) / 86400000);
      if (diasCriada > diasSemPrazo) {
        sugestoes.push({
          taskId: t.id,
          titulo: t.titulo,
          responsavel: t.responsavel?.name || 'N/A',
          sugestao: `Prioridade URGENTE sem data de vencimento e criada há ${diasCriada} dias — definir prazo ou revisar prioridade`,
        });
      }
    }
  }

  return sugestoes;
}
