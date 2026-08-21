import prisma from '../../config/database';
import { generateToken, addDays } from '../../shared/utils/helpers';
import { registrarStatusEvent } from './orders.service';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
import { criarNotificacao } from '../notificacoes/notificacoes.service';
import { generatePdf } from './pdf.service';

// â”€â”€ Constantes de status da solicitacao de assinatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const STATUS_SIGNATURE = {
  PENDENTE: 'pendente',
  ENVIADA: 'enviada',
  ENTREGUE: 'entregue',
  VISUALIZADA: 'visualizada',
  ASSINADA: 'assinada',
  RECUSADA: 'recusada',
  EXPIRADA: 'expirada',
  CANCELADA: 'cancelada',
  ERRO_ENVIO: 'erro_envio',
} as const;

export const STATUS_SIGNATURE_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  enviada: 'Enviada',
  entregue: 'Entregue',
  visualizada: 'Visualizada',
  assinada: 'Assinada',
  recusada: 'Recusada',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
  erro_envio: 'Erro de Envio',
};

/** Validade do link de assinatura (horas). */
export const TEMPO_EXPIRACAO_LINK_HORAS = 48;

export const ESTADOS_PENDENTES_SOLICITACAO: string[] = [
  STATUS_SIGNATURE.PENDENTE,
  STATUS_SIGNATURE.ENVIADA,
  STATUS_SIGNATURE.ENTREGUE,
  STATUS_SIGNATURE.VISUALIZADA,
];

// â”€â”€ Resolucao de contato para envio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ResolucaoContato {
  telefone: string | null;
  origem: 'ticket' | 'cliente' | 'colaborador' | null;
  contatoNome?: string | null;
}

/**
 * Resolve o telefone/whatsapp para onde o link de assinatura sera enviado,
 * na seguinte ordem de prioridade:
 * 1. Numero do ticket (conversa WhatsApp do cliente) quando a OS veio do helpdesk;
 * 2. Telefone principal do cliente;
 * 3. Colaborador marcado como principal do cliente;
 * 4. Primeiro colaborador com telefone/whatsapp cadastrado.
 */
export async function resolverTelefoneParaAssinatura(order: any): Promise<ResolucaoContato> {
  const ticketPhone = order.ticket?.contactPhone;
  if (ticketPhone) {
    return { telefone: ticketPhone, origem: 'ticket', contatoNome: order.ticket?.contactName || null };
  }

  if (order.client?.telefone) {
    return { telefone: order.client.telefone, origem: 'cliente', contatoNome: null };
  }

  const colaboradores = order.client?.colaboradores || [];
  const principal = colaboradores.find((c: any) => c.principal && (c.telefone || c.whatsapp));
  if (principal) {
    return { telefone: principal.whatsapp || principal.telefone, origem: 'colaborador', contatoNome: principal.nome };
  }

  const algum = colaboradores.find((c: any) => c.telefone || c.whatsapp);
  if (algum) {
    return { telefone: algum.whatsapp || algum.telefone, origem: 'colaborador', contatoNome: algum.nome };
  }

  return { telefone: null, origem: null, contatoNome: null };
}

export function validarTelefoneWhatsApp(telefone: string | null | undefined): { ok: boolean; digits?: string; error?: string } {
  if (!telefone) {
    return { ok: false, error: 'Cliente nÃ£o possui telefone/WhatsApp cadastrado. Adicione um nÃºmero ao cliente para enviar a assinatura.' };
  }
  const digits = telefone.replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 13) {
    return { ok: false, error: `Telefone invÃ¡lido para WhatsApp: "${telefone}". Corrija o nÃºmero antes de enviar.` };
  }
  return { ok: true, digits };
}

export function montarLinkAssinatura(token: string): string {
  return `${process.env.APP_URL || 'http://localhost:3000'}/assinar/${token}`;
}

export function montarMensagemAssinatura(order: { numeroOs: string; tipoServico?: string | null }, signLink: string): string {
  return [
    `OlÃ¡! ðŸ‘‹`,
    ``,
    `Segue o link para assinar a Ordem de ServiÃ§o nÂº ${order.numeroOs} da Codemed.`,
    ``,
    `ðŸ”— ${signLink}`,
    ``,
    `O link expira em ${TEMPO_EXPIRACAO_LINK_HORAS} horas.`,
    ``,
    `Atenciosamente,`,
    `Equipe Codemed`,
  ].join('\n');
}

// â”€â”€ Tentativas de envio e notificacoes internas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function registrarTentativa(input: {
  signatureId: string;
  usuarioId?: string | null;
  telefone?: string | null;
  provider?: string | null;
  connectionId?: string | null;
  messageId?: string | null;
  resultado: 'enviada' | 'erro';
  erro?: string | null;
}) {
  return prisma.signatureAttempt.create({
    data: {
      signatureId: input.signatureId,
      usuarioId: input.usuarioId || null,
      telefone: input.telefone || null,
      provider: input.provider || null,
      connectionId: input.connectionId || null,
      messageId: input.messageId || null,
      resultado: input.resultado,
      erro: input.erro || null,
    },
  });
}

async function notificarInterno(params: {
  tipo: string;
  mensagem: string;
  order: { id: string; criadoPorId?: string | null; tecnicoResponsavelId?: string | null; ticketId?: string | null };
  dados?: Record<string, unknown>;
}) {
  const destinatarios = Array.from(
    new Set([params.order.criadoPorId, params.order.tecnicoResponsavelId].filter(Boolean))
  ) as string[];
  try {
    for (const destinatarioId of destinatarios) {
      await criarNotificacao({
        tipo: params.tipo,
        mensagem: params.mensagem,
        destinatarioId,
        ticketId: params.order.ticketId || null,
        dados: params.dados ? JSON.stringify(params.dados) : null,
      });
    }
  } catch (e: any) {
    console.warn('[OS SIGNATURE] Falha ao notificar internamente:', e?.message || e);
  }
}

// â”€â”€ NÃºcleo de envio do link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type SendFn = (
  to: string,
  message: string,
  connectionId?: string,
  jid?: string,
) => Promise<{ success: boolean; error?: string; messageId?: string }>;

export type EnvioResultado =
  | {
      ok: true;
      message?: string;
      pdfPath?: string | null;
      code?: string;
      token?: string;
      signLink?: string;
      messageId?: string;
      provider?: string;
      telefone?: string;
      signatureId?: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
      statusCode?: number;
      token?: string;
      signLink?: string;
      telefone?: string;
      signatureId?: string;
    };

async function carregarOrderParaAssinatura(orderId: string) {
  return prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      client: { include: { colaboradores: { where: { ativo: true } } } },
      signature: true,
      ticket: { select: { id: true, contactPhone: true, contactName: true, whatsappConnectionId: true } },
    },
  });
}

async function resolverProvider(connectionId?: string | null): Promise<string> {
  if (connectionId) {
    const conn = await prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
      select: { provider: true },
    });
    if (conn?.provider) return conn.provider;
  }
  return 'baileys';
}

/**
 * Cria (ou reutiliza) a solicitacao de assinatura e envia o link por WhatsApp.
 * `permitirReenvio` permite reenviar mesmo quando ja existe solicitacao
 * enviada/visualizada (evita duplicidade em envio normal, permite em reenvio).
 */
export async function executarEnvioLinkAssinatura(
  orderId: string,
  usuarioId: string,
  opts: { permitirReenvio?: boolean; sendFn?: SendFn } = {},
): Promise<EnvioResultado> {
  const send = opts.sendFn || sendWhatsAppMessage;
  const order = await carregarOrderParaAssinatura(orderId);
  if (!order) return { ok: false, code: 'OS_NAO_ENCONTRADA', error: 'OS nÃ£o encontrada', statusCode: 404 };

  if (order.signature?.status === STATUS_SIGNATURE.ASSINADA) {
    return { ok: false, code: 'JA_ASSINADA', error: 'OS jÃ¡ assinada anteriormente', statusCode: 400 };
  }
  if (order.status === 'cancelada') {
    return { ok: false, code: 'OS_CANCELADA', error: 'OS cancelada nÃ£o pode ser enviada para assinatura', statusCode: 400 };
  }
  if (order.status !== 'rascunho' && order.status !== 'aguardando_assinatura') {
    return { ok: false, code: 'STATUS_INVALIDO', error: `OS no status "${order.status}" nÃ£o pode ser enviada para assinatura`, statusCode: 400 };
  }

  const signature = order.signature;
  if (!opts.permitirReenvio && signature && ESTADOS_PENDENTES_SOLICITACAO.includes(signature.status)) {
    return {
      ok: false,
      code: 'SOLICITACAO_PENDENTE',
      error: 'JÃ¡ existe uma solicitaÃ§Ã£o de assinatura pendente para esta OS. Reenvie o link existente ou cancele a solicitaÃ§Ã£o.',
      statusCode: 409,
      token: signature.tokenAssinatura,
      signLink: montarLinkAssinatura(signature.tokenAssinatura),
      signatureId: signature.id,
    };
  }

  const contato = await resolverTelefoneParaAssinatura(order);
  const val = validarTelefoneWhatsApp(contato.telefone);
  if (!val.ok) {
    return { ok: false, code: 'SEM_TELEFONE', error: val.error!, statusCode: 400 };
  }
  const telefone = contato.telefone!;

  const connectionId = order.ticket?.whatsappConnectionId || undefined;
  const provider = await resolverProvider(connectionId);

  let sig = signature;
  if (!sig) {
    sig = await prisma.signature.create({
      data: {
        orderId: order.id,
        tokenAssinatura: generateToken(),
        tokenExpiresAt: addDays(new Date(), TEMPO_EXPIRACAO_LINK_HORAS / 24),
        assinanteNome: '',
        assinanteCpf: '',
        assinanteCargo: '',
        assinaturaBase64: '',
        status: STATUS_SIGNATURE.PENDENTE,
      },
    });
  } else {
    await prisma.signature.update({
      where: { id: sig.id },
      data: { status: STATUS_SIGNATURE.PENDENTE, lastError: null },
    });
  }

  const signLink = montarLinkAssinatura(sig.tokenAssinatura);
  const message = montarMensagemAssinatura(order, signLink);

  let resultado: { success: boolean; error?: string; messageId?: string };
  try {
    resultado = await send(telefone, message, connectionId);
  } catch (waError: any) {
    resultado = { success: false, error: waError?.message || 'Erro inesperado ao enviar mensagem WhatsApp' };
  }

  if (resultado.success) {
    await prisma.signature.update({
      where: { id: sig.id },
      data: {
        status: STATUS_SIGNATURE.ENVIADA,
        messageId: resultado.messageId || null,
        provider,
        telefone,
        sentAt: new Date(),
        sentBy: usuarioId,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    await registrarTentativa({
      signatureId: sig.id,
      usuarioId,
      telefone,
      provider,
      connectionId,
      messageId: resultado.messageId,
      resultado: 'enviada',
    });

    if (order.status !== 'aguardando_assinatura') {
      await prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: 'aguardando_assinatura' },
      });
      await registrarStatusEvent({
        orderId: order.id,
        statusNovo: 'aguardando_assinatura',
        statusAnterior: order.status,
        usuarioId,
        origem: 'manual',
        observacao: `Link de assinatura enviado via WhatsApp (${provider})`,
      });
    }

    console.log(`[OS SIGNATURE] Link enviado. OS=${order.numeroOs} telefone=${telefone} provider=${provider} messageId=${resultado.messageId || 'sem-id'}`);
    return {
      ok: true,
      token: sig.tokenAssinatura,
      signLink,
      messageId: resultado.messageId,
      provider,
      telefone,
      signatureId: sig.id,
    };
  }

  await prisma.signature.update({
    where: { id: sig.id },
    data: {
      status: STATUS_SIGNATURE.ERRO_ENVIO,
      lastError: resultado.error || 'Falha desconhecida no envio',
      telefone,
      attempts: { increment: 1 },
    },
  });
  await registrarTentativa({
    signatureId: sig.id,
    usuarioId,
    telefone,
    provider,
    connectionId,
    messageId: resultado.messageId,
    resultado: 'erro',
    erro: resultado.error || 'Falha desconhecida no envio',
  });

  console.error(`[OS SIGNATURE] Falha no envio. OS=${order.numeroOs} telefone=${telefone} provider=${provider} erro=${resultado.error || 'sem-detalhe'}`);
  return {
    ok: false,
    code: 'ERRO_ENVIO',
    error: `Falha ao enviar a mensagem WhatsApp: ${resultado.error || 'sem detalhes'}`,
    statusCode: 502,
    token: sig.tokenAssinatura,
    signLink,
    telefone,
    signatureId: sig.id,
  };
}

export async function enviarLinkAssinatura(orderId: string, usuarioId: string, sendFn?: SendFn): Promise<EnvioResultado> {
  return executarEnvioLinkAssinatura(orderId, usuarioId, { sendFn });
}

export async function reenviarLinkAssinatura(orderId: string, usuarioId: string, sendFn?: SendFn): Promise<EnvioResultado> {
  return executarEnvioLinkAssinatura(orderId, usuarioId, { permitirReenvio: true, sendFn });
}

export async function cancelarSolicitacaoAssinatura(orderId: string, usuarioId: string): Promise<EnvioResultado> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { signature: true },
  });
  if (!order) return { ok: false, code: 'OS_NAO_ENCONTRADA', error: 'OS nÃ£o encontrada', statusCode: 404 };
  if (!order.signature) return { ok: false, code: 'SEM_SOLICITACAO', error: 'Nenhuma solicitaÃ§Ã£o de assinatura encontrada para esta OS', statusCode: 400 };
  if (order.signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada, não é possível cancelar', statusCode: 400 };

  await prisma.signature.update({
    where: { id: order.signature.id },
    data: { status: STATUS_SIGNATURE.CANCELADA },
  });

  if (order.status === 'aguardando_assinatura' || order.status === 'rascunho') {
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'rascunho' },
    });
    await registrarStatusEvent({
      orderId: order.id,
      statusNovo: 'rascunho',
      statusAnterior: order.status,
      usuarioId,
      origem: 'manual',
      observacao: 'SolicitaÃ§Ã£o de assinatura cancelada',
    });
  }

  console.log(`[OS SIGNATURE] Solicitacao cancelada. OS=${order.numeroOs}`);
  return { ok: true, message: 'SolicitaÃ§Ã£o de assinatura cancelada' };
}

// â”€â”€ Pagina publica de assinatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DadosAssinatura {
  token: string;
  status: string;
  expiraEm: Date;
  order: {
    numeroOs: string;
    tipoServico: string | null;
    descricaoServico: string | null;
    valorServico: number | null;
    dataEmissao: Date;
  };
  client: {
    razaoSocial: string;
    cnpjCpf?: string | null;
    telefone?: string | null;
  };
  tecnico: string | null;
}

export type DadosAssinaturaResult =
  | { ok: true; data: DadosAssinatura }
  | { ok: false; error: string; statusCode: number };

export async function obterDadosAssinatura(token: string): Promise<DadosAssinaturaResult> {
  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true, tecnicoResponsavel: { select: { name: true } } } } },
  });
  if (!signature) return { ok: false, error: 'Link de assinatura invÃ¡lido', statusCode: 404 };

  const now = new Date();
  if (now > signature.tokenExpiresAt) {
    await prisma.signature.update({
      where: { id: signature.id },
      data: { status: STATUS_SIGNATURE.EXPIRADA },
    });
    if (signature.order.status === 'aguardando_assinatura') {
      await prisma.serviceOrder.update({
        where: { id: signature.orderId },
        data: { status: 'rascunho' },
      });
      await registrarStatusEvent({
        orderId: signature.orderId,
        statusNovo: 'rascunho',
        statusAnterior: 'aguardando_assinatura',
        origem: 'sistema',
        observacao: 'Link de assinatura expirado',
      });
    }
    console.log(`[OS SIGNATURE] Link expirado. OS=${signature.order.numeroOs}`);
    return { ok: false, error: 'Link de assinatura expirado', statusCode: 410 };
  }

  if (signature.status === STATUS_SIGNATURE.CANCELADA) {
    return { ok: false, error: 'SolicitaÃ§Ã£o de assinatura cancelada. Solicite um novo link.', statusCode: 410 };
  }
  if (signature.status === STATUS_SIGNATURE.RECUSADA) {
    return { ok: false, error: 'SolicitaÃ§Ã£o de assinatura recusada anteriormente. Solicite um novo link.', statusCode: 410 };
  }
  if (signature.status === STATUS_SIGNATURE.ASSINADA) {
    return { ok: false, error: 'OS jÃ¡ assinada anteriormente', statusCode: 400 };
  }

  if (!([STATUS_SIGNATURE.ASSINADA, STATUS_SIGNATURE.VISUALIZADA] as string[]).includes(signature.status)) {
    await prisma.signature.update({
      where: { id: signature.id },
      data: { status: STATUS_SIGNATURE.VISUALIZADA, viewedAt: now },
    });
    console.log(`[OS SIGNATURE] Link visualizado. OS=${signature.order.numeroOs}`);
  }

  return {
    ok: true,
    data: {
      token: signature.tokenAssinatura,
      status: signature.status,
      expiraEm: signature.tokenExpiresAt,
      order: {
        numeroOs: signature.order.numeroOs,
        tipoServico: signature.order.tipoServico,
        descricaoServico: signature.order.descricaoServico,
        valorServico: signature.order.valorServico,
        dataEmissao: signature.order.dataEmissao,
      },
      client: {
        razaoSocial: signature.order.client.razaoSocial,
        cnpjCpf: signature.order.client.cnpjCpf,
        telefone: signature.order.client.telefone,
      },
      tecnico: signature.order.tecnicoResponsavel?.name || null,
    },
  };
}

export async function registrarAssinatura(
  token: string,
  input: { assinanteNome: string; assinanteCpf: string; assinanteCargo: string; assinaturaBase64: string },
  ip?: string | null,
  userAgent?: string,
): Promise<EnvioResultado> {
  const { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64 } = input;
  if (!assinanteNome || !assinanteCpf || !assinanteCargo || !assinaturaBase64) {
    return { ok: false, code: 'CAMPOS_OBRIGATORIOS', error: 'Todos os campos de assinatura sÃ£o obrigatÃ³rios', statusCode: 400 };
  }

  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true } } },
  });
  if (!signature) return { ok: false, code: 'TOKEN_INVALIDO', error: 'Link de assinatura invÃ¡lido', statusCode: 404 };
  if (new Date() > signature.tokenExpiresAt) return { ok: false, code: 'EXPIRADO', error: 'Link de assinatura expirado', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.CANCELADA) return { ok: false, code: 'CANCELADA', error: 'SolicitaÃ§Ã£o de assinatura cancelada', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.RECUSADA) return { ok: false, code: 'RECUSADA', error: 'SolicitaÃ§Ã£o de assinatura recusada anteriormente', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };

  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      assinanteNome,
      assinanteCpf,
      assinanteCargo,
      assinaturaBase64,
      ipAssinante: ip || null,
      userAgent: userAgent || null,
      assinadoEm: new Date(),
      status: STATUS_SIGNATURE.ASSINADA,
    },
  });

  await prisma.serviceOrder.update({
    where: { id: signature.orderId },
    data: { status: 'assinada' },
  });

  await registrarStatusEvent({
    orderId: signature.orderId,
    statusNovo: 'assinada',
    statusAnterior: 'aguardando_assinatura',
    usuarioId: null,
    origem: 'publico',
    observacao: `OS assinada por ${assinanteNome}`,
  });

  let pdfPath: string | null = null;
  try {
    pdfPath = await generatePdf(signature.orderId);
    await prisma.signature.update({
      where: { id: signature.id },
      data: { pdfPath },
    });
  } catch (e: any) {
    console.warn('[OS SIGNATURE] Falha ao gerar PDF da OS assinada:', e?.message || e);
  }

  await notificarInterno({
    tipo: 'os_assinada',
    mensagem: `A OS ${signature.order.numeroOs} foi assinada por ${assinanteNome}${assinanteCargo ? ` (${assinanteCargo})` : ''}.`,
    order: signature.order,
    dados: { orderId: signature.orderId, assinante: assinanteNome },
  });

  console.log(`[OS SIGNATURE] OS assinada. OS=${signature.order.numeroOs} assinante=${assinanteNome}`);
  return { ok: true, message: 'OS assinada com sucesso!', pdfPath };
}

export async function recusarAssinatura(token: string, motivo: string, ip?: string | null): Promise<EnvioResultado> {
  if (!motivo || !motivo.trim()) {
    return { ok: false, code: 'MOTIVO_OBRIGATORIO', error: 'Informe o motivo da recusa', statusCode: 400 };
  }

  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true } } },
  });
  if (!signature) return { ok: false, code: 'TOKEN_INVALIDO', error: 'Link de assinatura invÃ¡lido', statusCode: 404 };
  if (new Date() > signature.tokenExpiresAt) return { ok: false, code: 'EXPIRADO', error: 'Link de assinatura expirado', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };
  if (signature.status === STATUS_SIGNATURE.CANCELADA) return { ok: false, code: 'CANCELADA', error: 'SolicitaÃ§Ã£o de assinatura cancelada', statusCode: 410 };

  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      status: STATUS_SIGNATURE.RECUSADA,
      rejectionReason: motivo.trim(),
      rejectedAt: new Date(),
      ipAssinante: ip || signature.ipAssinante,
    },
  });

  if (signature.order.status === 'aguardando_assinatura' || signature.order.status === 'rascunho') {
    await prisma.serviceOrder.update({
      where: { id: signature.orderId },
      data: { status: 'rascunho' },
    });
    await registrarStatusEvent({
      orderId: signature.orderId,
      statusNovo: 'rascunho',
      statusAnterior: signature.order.status,
      origem: 'publico',
      observacao: `Cliente recusou a assinatura: ${motivo.trim()}`,
    });
  }

  await notificarInterno({
    tipo: 'os_assinatura_recusada',
    mensagem: `O cliente recusou a assinatura da OS ${signature.order.numeroOs}. Motivo: ${motivo.trim()}.`,
    order: signature.order,
    dados: { orderId: signature.orderId, motivo: motivo.trim() },
  });

  console.log(`[OS SIGNATURE] Assinatura recusada. OS=${signature.order.numeroOs} motivo="${motivo.trim()}"`);
  return { ok: true, message: 'Assinatura recusada. Em breve nossa equipe entrarÃ¡ em contato.' };
}
