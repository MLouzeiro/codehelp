import prisma from '../../config/database';
import { criarNotificacao } from '../notificacoes/notificacoes.service';
import { enviarListaInterativa } from '../integrations/whatsapp/whatsapp-message-service';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h

function gerarToken(): string {
  return `aprov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export interface SolicitarAprovacaoOptions {
  canal?: string;
  telefoneAprovador?: string;
}

export async function solicitarAprovacao(
  ticketId: string,
  solicitadoPorId: string,
  tipo: string,
  motivo: string,
  observacao?: string,
  valorAprovado?: number,
  options?: SolicitarAprovacaoOptions
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { client: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const canal = options?.canal || 'interno';
  const telefoneAprovador = options?.telefoneAprovador || null;

  const aprovacao = await prisma.aprovacao.create({
    data: {
      ticketId,
      solicitadoPorId,
      tipo,
      motivo,
      observacao,
      valorAprovado,
      status: 'pendente',
      canal,
      telefoneAprovador,
      token: gerarToken(),
      expiraEm: new Date(Date.now() + TOKEN_TTL_MS),
    },
    include: {
      solicitadoPor: { select: { id: true, name: true, email: true } },
    },
  });

  const usuarios = await prisma.user.findMany({
    where: { role: { in: ['admin', 'gerente'] }, active: true },
    select: { id: true, phone: true },
  });

  for (const u of usuarios) {
    await criarNotificacao({
      tipo: 'aprovacao_solicitada',
      mensagem: `Nova solicitação de aprovação para o ticket #${ticket.protocolo || ticket.id.slice(0, 8)}: ${motivo}`,
      destinatarioId: u.id,
      ticketId,
      dados: JSON.stringify({ aprovacaoId: aprovacao.id, tipo, motivo }),
    });

    // Envia via WhatsApp para aprovadores com telefone cadastrado
    if (canal === 'whatsapp' && u.phone && u.phone.replace(/[^\d]/g, '') === (telefoneAprovador || '').replace(/[^\d]/g, '')) {
      await enviarAprovacaoWhatsApp(aprovacao.id).catch((e) =>
        console.warn(`[Aprovacao] Falha ao enviar WhatsApp para ${u.phone}:`, e?.message)
      );
    }
  }

  return aprovacao;
}

export async function enviarAprovacaoWhatsApp(aprovacaoId: string) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id: aprovacaoId },
    include: { ticket: { include: { client: true } } },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  if (!aprovacao.telefoneAprovador) throw new Error('Telefone do aprovador não informado');

  const titulo = aprovacao.tipo === 'financeira' ? 'Aprovação financeira' : 'Aprovação';
  const cliente = aprovacao.ticket.client?.razaoSocial || aprovacao.ticket.client?.nomeFantasia || 'Cliente';
  const descricao = [
    `*${titulo}*\n`,
    `Cliente: ${cliente}`,
    `Ticket: #${aprovacao.ticket.protocolo || aprovacao.ticket.id.slice(0, 8)}`,
    `Motivo: ${aprovacao.motivo}`,
    aprovacao.valorAprovado != null ? `Valor: R$ ${aprovacao.valorAprovado.toFixed(2)}` : '',
    aprovacao.observacao ? `Obs.: ${aprovacao.observacao}` : '',
  ].filter(Boolean).join('\n');

  const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/aprovacoes/${aprovacao.token}`;

  const result = await enviarListaInterativa(aprovacao.telefoneAprovador, {
    title: titulo,
    description: descricao,
    footer: `Válido até ${aprovacao.expiraEm ? new Date(aprovacao.expiraEm).toLocaleString('pt-BR') : ''}`,
    sections: [
      {
        title: 'Decisão',
        rows: [
          { id: `aprovacao_${aprovacao.id}_aprovar`, title: '✅ Aprovar' },
          { id: `aprovacao_${aprovacao.id}_rejeitar`, title: '❌ Rejeitar' },
        ],
      },
    ],
    connectionId: aprovacao.ticket.whatsappConnectionId || undefined,
    jid: (aprovacao as any).ticket.contactJid || undefined,
  });

  return { result, link };
}

export async function decidirAprovacao(
  aprovacaoId: string,
  aprovadoPorId: string,
  decidido: boolean,
  observacao?: string
) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id: aprovacaoId },
    include: { ticket: true, solicitadoPor: true },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  if (aprovacao.status !== 'pendente') throw new Error('Aprovação já foi decidida');

  const status = decidido ? 'aprovada' : 'rejeitada';

  const updated = await prisma.aprovacao.update({
    where: { id: aprovacaoId },
    data: {
      aprovadoPorId,
      status,
      observacao,
      dataDecisao: new Date(),
    },
    include: {
      solicitadoPor: { select: { id: true, name: true, email: true } },
      aprovadoPor: { select: { id: true, name: true, email: true } },
    },
  });

  await criarNotificacao({
    tipo: `aprovacao_${status}`,
    mensagem: `Sua solicitação de aprovação para o ticket #${aprovacao.ticket.protocolo || aprovacao.ticket.id.slice(0, 8)} foi ${status}${observacao ? `: ${observacao}` : ''}`,
    destinatarioId: aprovacao.solicitadoPorId,
    ticketId: aprovacao.ticketId,
    dados: JSON.stringify({ aprovacaoId, decidido, observacao }),
  });

  return updated;
}

// Decide aprovação por token (link) — NÃO exige autenticação e NÃO cria ticket.
export async function decidirAprovacaoPorToken(token: string, decidido: boolean, observacao?: string, aprovadoPorId?: string) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { token },
    include: { ticket: true, solicitadoPor: true },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  if (aprovacao.status !== 'pendente') throw new Error('Aprovação já foi decidida');
  if (aprovacao.expiraEm && new Date() > aprovacao.expiraEm) {
    throw new Error('Aprovação expirada');
  }

  const status = decidido ? 'aprovada' : 'rejeitada';
  const updated = await prisma.aprovacao.update({
    where: { id: aprovacao.id },
    data: { status, observacao, dataDecisao: new Date(), aprovadoPorId: aprovadoPorId || null },
    include: { ticket: { select: { protocolo: true } } },
  });

  await criarNotificacao({
    tipo: `aprovacao_${status}`,
    mensagem: `Sua solicitação de aprovação para o ticket #${aprovacao.ticket.protocolo || aprovacao.ticket.id.slice(0, 8)} foi ${status}${observacao ? `: ${observacao}` : ''}`,
    destinatarioId: aprovacao.solicitadoPorId,
    ticketId: aprovacao.ticketId,
    dados: JSON.stringify({ aprovacaoId: aprovacao.id, decidido, observacao }),
  });

  return updated;
}

// Processa resposta de aprovação vinda do WhatsApp (lista interativa ou texto).
// Retorna o aprovador (usuário) se foi tratado como resposta de aprovação — o
// handler canônico NÃO deve criar ticket quando isso acontecer.
const APROVACAO_RE = /^aprovacao_([a-zA-Z0-9-]+)_(aprovar|rejeitar)$/;

export async function processarRespostaAprovacaoWhatsApp(opts: {
  phoneDigits: string;
  interactiveId?: string;
  text?: string;
}): Promise<{ tratado: boolean; aprovacaoId?: string; decidido?: boolean; nomeAprovador?: string }> {
  const { phoneDigits, interactiveId, text } = opts;

  // 1) Lista interativa → identificação direta pela opção
  let aprovacaoId: string | undefined;
  let decidido: boolean | undefined;
  const m = interactiveId?.match(APROVACAO_RE);
  if (m) {
    aprovacaoId = m[1];
    decidido = m[2] === 'aprovar';
  }

  // 2) Texto simples → identifica aprovação pendente pelo telefone do aprovador
  if (!aprovacaoId && text) {
    const t = text.trim().toLowerCase();
    const ehResposta = t === 'aprovar' || t === 'aprovado' || t === '1' || t === 'sim' ||
      t === 'rejeitar' || t === 'rejeitado' || t === 'recusar' || t === '2' || t === 'nao' || t === 'não';
    if (ehResposta) {
      const pendente = await prisma.aprovacao.findFirst({
        where: {
          status: 'pendente',
          canal: 'whatsapp',
          telefoneAprovador: { contains: phoneDigits },
        },
        orderBy: { dataSolicitacao: 'desc' },
      });
      if (pendente) {
        aprovacaoId = pendente.id;
        decidido = t === 'aprovar' || t === 'aprovado' || t === '1' || t === 'sim';
      }
    }
  }

  if (!aprovacaoId || decidido === undefined) return { tratado: false };

  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id: aprovacaoId },
    include: { solicitadoPor: true, ticket: { select: { protocolo: true } } },
  });
  if (!aprovacao || aprovacao.status !== 'pendente') return { tratado: false };

  // Confirma que o telefone que respondeu é o aprovador alvo
  if (aprovacao.telefoneAprovador && !aprovacao.telefoneAprovador.replace(/[^\d]/g, '').includes(phoneDigits)) {
    return { tratado: false };
  }

  if (aprovacao.expiraEm && new Date() > aprovacao.expiraEm) {
    await prisma.aprovacao.update({
      where: { id: aprovacaoId },
      data: { status: 'expirada', dataDecisao: new Date() },
    });
    return { tratado: true, aprovacaoId };
  }

  await decidirAprovacaoPorToken(aprovacao.token!, decidido);
  return {
    tratado: true,
    aprovacaoId,
    decidido,
    nomeAprovador: aprovacao.solicitadoPor.name,
  };
}

export async function listarAprovacoes(filtros: {
  status?: string;
  tipo?: string;
  ticketId?: string;
  page?: number;
  limit?: number;
}) {
  const { status, tipo, ticketId, page = 1, limit = 20 } = filtros;

  const where: any = {};
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;
  if (ticketId) where.ticketId = ticketId;

  const [items, total] = await Promise.all([
    prisma.aprovacao.findMany({
      where,
      include: {
        ticket: { select: { id: true, protocolo: true, assunto: true, status: true } },
        solicitadoPor: { select: { id: true, name: true, email: true } },
        aprovadoPor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.aprovacao.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function obterAprovacao(id: string) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id },
    include: {
      ticket: { select: { id: true, protocolo: true, assunto: true, status: true, prioridade: true } },
      solicitadoPor: { select: { id: true, name: true, email: true } },
      aprovadoPor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  return aprovacao;
}

export async function contarApendentes() {
  return prisma.aprovacao.count({ where: { status: 'pendente' } });
}
