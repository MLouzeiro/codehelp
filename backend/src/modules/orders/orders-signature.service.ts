import prisma from '../../config/database';
import { env } from '../../config/env';
import { generateToken, addDays } from '../../shared/utils/helpers';
import { registrarStatusEvent } from './orders.service';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
import { criarNotificacao } from '../notificacoes/notificacoes.service';
import { generatePdf } from './pdf.service';
import crypto from 'crypto';

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

// ── Validacao de CPF ─────────────────────────────────────────────────────────

export function validarCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i)) * (10 - i);
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i)) * (11 - i);
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned.charAt(10));
}

export function mascararCpf(cpf: string): string {
  const cleaned = cpf.replace(/[^\d]/g, '');
  if (cleaned.length !== 11) return cpf;
  return `***.***.***-${cleaned.slice(-2)}`;
}

// ── Geracao de hash de integridade ───────────────────────────────────────────

export function gerarSignatureHash(data: {
  orderId: string;
  nome: string;
  cpf: string;
  cargo: string;
  assinaturaBase64: string;
  signedAt: string;
}): string {
  const payload = `${data.orderId}:${data.nome}:${data.cpf}:${data.cargo}:${data.assinaturaBase64}:${data.signedAt}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ── Geracao de identificador unico da assinatura ─────────────────────────────

export function gerarSignatureIdentifier(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

// â”€â”€ Resolucao de contato para envio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ResolucaoContato {
  telefone: string | null;
  telefoneFormatado: string | null;
  origem: 'ticket_whatsapp' | 'ticket_lid' | 'manual' | null;
  contatoNome?: string | null;
  jid?: string | null;
  hasTicket?: boolean;
}

/**
 * Normaliza um telefone para envio via WhatsApp.
 * Remove caracteres nao numericos, suffixos de JID WhatsApp,
 * e garante formato brasileiro valido (55 + DDD + 8-9 digitos).
 * Retorna null se o numero for invalido apos normalizacao.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Remover suffixos de JID WhatsApp (ex: @s.whatsapp.net, @c.us, @lid)
  let cleaned = raw.replace(/@(s\.whatsapp\.net|c\.us|lid|g\.us)$/i, '');

  // 2. Remover todos os caracteres nao numericos
  cleaned = cleaned.replace(/[^\d]/g, '');

  // 3. Remover zeros a esquerda excessivos
  cleaned = cleaned.replace(/^0+/, '');

  // 4. Validar comprimento minimo (precisa ter pelo menos DDD + numero = 10 digitos)
  if (cleaned.length < 10) return null;

  // 5. Se tem 14+ digitos, provavelmente esta com codigo de pais duplicado ou lixo
  if (cleaned.length > 14) return null;

  // 6. Se tem exatamente 14 digitos e comeca com 55, pode ter 55 duplicado
  if (cleaned.length === 14 && cleaned.startsWith('55')) {
    cleaned = cleaned.substring(2);
  }

  // 7. Se tem 13 digitos, ja esta no formato completo (55 + DDD + 9 digitos)
  if (cleaned.length === 13) {
    if (cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4);
      if (parseInt(ddd) >= 11 && parseInt(ddd) <= 99) {
        return cleaned;
      }
    }
    return null;
  }

  // 8. Se tem 12 digitos (55 + DDD + 8 digitos fixo)
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return cleaned;
  }

  // 9. Se tem 11 digitos (DDD + 9 digitos celular)
  if (cleaned.length === 11) {
    const ddd = cleaned.substring(0, 2);
    if (parseInt(ddd) >= 11 && parseInt(ddd) <= 99) {
      return '55' + cleaned;
    }
  }

  // 10. Se tem 10 digitos (DDD + 8 digitos fixo)
  if (cleaned.length === 10) {
    const ddd = cleaned.substring(0, 2);
    if (parseInt(ddd) >= 11 && parseInt(ddd) <= 99) {
      return '55' + cleaned;
    }
  }

  return null;
}

/**
 * Verifica se um valor armazenado como contactPhone e um LID JID do WhatsApp
 * (identificador de 15 digitos que nao e numero de telefone).
 * Exemplos: 122187692417114, 153695622811697, 233809480036398
 */
function isWhatsAppLid(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length === 15;
}

/**
 * Constroi o JID completo a partir de um LID armazenado.
 * Ex: "122187692417114" → "122187692417114@lid"
 */
function buildLidJid(storedPhone: string): string {
  const digits = storedPhone.replace(/[^\d]/g, '');
  if (digits.includes('@')) return storedPhone;
  return `${digits}@lid`;
}

/**
 * Formata telefone para exibicao humana.
 * Ex: 5585999991111 -> (85) 99999-1111
 */
export function formatPhoneForDisplay(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = digits.replace(/[^\d]/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    const ddd = d.substring(2, 4);
    const part1 = d.substring(4, 9);
    const part2 = d.substring(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    const ddd = d.substring(2, 4);
    const part1 = d.substring(4, 8);
    const part2 = d.substring(8, 12);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (d.length === 11) {
    const ddd = d.substring(0, 2);
    const part1 = d.substring(2, 7);
    const part2 = d.substring(7, 11);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (d.length === 10) {
    const ddd = d.substring(0, 2);
    const part1 = d.substring(2, 6);
    const part2 = d.substring(6, 10);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return d;
}

/**
 * Resolve o telefone/whatsapp para onde o link de assinatura sera enviado.
 *
 * REGRA DEFINITIVA:
 * - OS COM TICKET → contato que abriu o chamado (contactPhone do ticket)
 *   - Se contactPhone e telefone valido (10-14 digitos) → envia direto
 *   - Se contactPhone e LID JID (15 digitos) → envia via JID (@lid)
 *   - NAO busca telefone do cliente, colaborador, etc.
 *   - NAO mostra campo manual quando o ticket existe
 *
 * - OS SEM TICKET → WhatsApp informado manualmente na OS (telefoneManual)
 *   - Se telefoneManual existe e e valido → envia
 *   - Se nao existe → retorna null (frontend mostra campo manual)
 */
export async function resolverTelefoneParaAssinatura(order: any): Promise<ResolucaoContato> {
  const hasTicket = !!order.ticketId;

  // ── CENARIO 1: OS TEM TICKET → usar contato do chamado ──
  if (hasTicket && order.ticket) {
    const contactPhone = order.ticket?.contactPhone;
    const contactName = order.ticket?.contactName || null;

    // Tentar normalizar como telefone valido
    const ticketNorm = normalizePhoneForWhatsApp(contactPhone);
    if (ticketNorm) {
      console.log(`[OS SIGNATURE] Ticket ${order.ticket?.id} → telefone valido: ${ticketNorm}`);
      return {
        telefone: ticketNorm,
        telefoneFormatado: formatPhoneForDisplay(ticketNorm),
        origem: 'ticket_whatsapp',
        contatoNome: contactName,
        hasTicket: true,
      };
    }

    // Se nao e telefone valido, verificar se e LID JID (15 digitos)
    if (isWhatsAppLid(contactPhone)) {
      const jid = buildLidJid(contactPhone);
      console.log(`[OS SIGNATURE] Ticket ${order.ticket?.id} → LID JID detectado: ${jid}`);
      return {
        telefone: null,
        telefoneFormatado: null,
        origem: 'ticket_lid',
        contatoNome: contactName,
        jid,
        hasTicket: true,
      };
    }

    // Ticket existe mas contactPhone nao e telefone nem LID
    console.log(`[OS SIGNATURE] Ticket ${order.ticket?.id} → contactPhone invalido: "${contactPhone}"`);
    return {
      telefone: null,
      telefoneFormatado: null,
      origem: 'ticket_whatsapp',
      contatoNome: contactName,
      hasTicket: true,
    };
  }

  // ── CENARIO 2: OS SEM TICKET → usar telefone manual ──
  const manualPhone = order.telefoneManual;
  const manualNorm = normalizePhoneForWhatsApp(manualPhone);
  if (manualNorm) {
    return {
      telefone: manualNorm,
      telefoneFormatado: formatPhoneForDisplay(manualNorm),
      origem: 'manual',
      contatoNome: null,
      hasTicket: false,
    };
  }

  // OS sem ticket e sem telefone manual → retorna null (frontend mostra campo)
  return { telefone: null, telefoneFormatado: null, origem: null, contatoNome: null, hasTicket: false };
}

/**
 * Valida telefone para WhatsApp apos normalizacao.
 * Retorna numero normalizado (com codigo 55) quando valido.
 * Se o contato for um LID JID, retorna ok=true com o JID.
 */
export function validarTelefoneWhatsApp(telefone: string | null | undefined, jid?: string | null): { ok: boolean; digits?: string; formatado?: string; error?: string; jid?: string } {
  // Se temos um JID (LID), usar diretamente — Baileys aceita envio via JID
  if (jid && jid.includes('@')) {
    return { ok: true, jid, formatado: jid };
  }

  if (!telefone) {
    return { ok: false, error: 'Nao foi encontrado um WhatsApp valido para este cliente. Informe o numero que recebera a assinatura.' };
  }

  const digits = normalizePhoneForWhatsApp(telefone);

  if (!digits) {
    return {
      ok: false,
      error: `Telefone "${formatPhoneForDisplay(telefone) || telefone}" nao e um numero valido para WhatsApp.`,
    };
  }

  return { ok: true, digits, formatado: formatPhoneForDisplay(digits) || digits };
}
let cachedBaseUrl: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function montarLinkAssinatura(token: string): Promise<string> {
  const now = Date.now();
  if (!cachedBaseUrl || now - cacheTimestamp > CACHE_TTL_MS) {
    try {
      const { getSignatureBaseUrl } = await import('./os-signature-config.service');
      cachedBaseUrl = await getSignatureBaseUrl();
      cacheTimestamp = now;
    } catch {
      cachedBaseUrl = env.appUrl || null;
      cacheTimestamp = now;
    }
  }

  const base = cachedBaseUrl;
  if (!base) {
    throw new Error('[ORDERS] Endereco publico nao configurado. Configure o endereco publico das Ordens de Servico nas Configuracoes > Ordens de Servico.');
  }
  if (base.includes('localhost')) {
    console.warn(`[ORDERS] Endereco publico apontando para localhost ("${base}"). Links so funcionarao na mesma maquina.`);
  }
  return `${base}/assinar/${token}`;
}

export function montarMensagemAssinatura(order: { numeroOs: string; tipoServico?: string | null }, signLink: string): string {
  return [
    `Olá! 👋`,
    ``,
    `Segue o link para assinar a Ordem de Servição nº ${order.numeroOs} da Codemed.`,
    ``,
    `🔗 ${signLink}`,
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

// --- Nucleo de envio do link ---

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
      telefoneFormatado?: string | null;
      origem?: string | null;
      signatureId?: string;
      signatureIdentifier?: string;
      jid?: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
      statusCode?: number;
      token?: string;
      signLink?: string;
      telefone?: string;
      telefoneFormatado?: string | null;
      origem?: string | null;
      signatureId?: string;
      jid?: string;
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
  if (!order) return { ok: false, code: 'OS_NAO_ENCONTRADA', error: 'OSão encontrada', statusCode: 404 };

  if (order.signature?.status === STATUS_SIGNATURE.ASSINADA) {
    return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };
  }
  if (order.status === 'cancelada') {
    return { ok: false, code: 'OS_CANCELADA', error: 'OS cancelada não pode ser enviada para assinatura', statusCode: 400 };
  }
  if (order.status !== 'rascunho' && order.status !== 'aguardando_assinatura') {
    return { ok: false, code: 'STATUS_INVALIDO', error: `OS no status "${order.status}" não pode ser enviada para assinatura`, statusCode: 400 };
  }

  const signature = order.signature;
  if (!opts.permitirReenvio && signature && ESTADOS_PENDENTES_SOLICITACAO.includes(signature.status)) {
    return {
      ok: false,
      code: 'SOLICITACAO_PENDENTE',
      error: 'Já existe uma solicitação de assinatura pendente para esta OS. Reenvie o link existente ou cancele a solicitação.',
      statusCode: 409,
      token: signature.tokenAssinatura,
      signLink: await montarLinkAssinatura(signature.tokenAssinatura),
      signatureId: signature.id,
    };
  }

  const contato = await resolverTelefoneParaAssinatura(order);
  const val = validarTelefoneWhatsApp(contato.telefone, contato.jid);
  if (!val.ok) {
    return { ok: false, code: 'SEM_TELEFONE', error: val.error!, statusCode: 400, telefoneFormatado: contato.telefoneFormatado, origem: contato.origem } as EnvioResultado;
  }
  const telefone = val.digits || '';
  const jid = val.jid || undefined;

  const connectionId = order.ticket?.whatsappConnectionId || undefined;
  const provider = await resolverProvider(connectionId);

  // Log de diagnóstico (mascarado)
  const phoneMask = telefone ? telefone.substring(0, 4) + '****' + telefone.slice(-3) : 'N/A';
  console.log(`[OS SIGNATURE] Preparando envio. OS=${order.numeroOs} origem=${contato.origem} provider=${provider} destino=${jid || phoneMask} connectionId=${connectionId || 'N/A'}`);

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

  const signLink = await montarLinkAssinatura(sig.tokenAssinatura);
  const message = montarMensagemAssinatura(order, signLink);

  let resultado: { success: boolean; error?: string; messageId?: string };
  try {
    resultado = await send(telefone, message, connectionId, jid);
  } catch (waError: any) {
    resultado = { success: false, error: waError?.message || 'Erro inesperado ao enviar mensagem WhatsApp' };
  }

  // Log de diagnóstico da resposta do provider
  console.log(`[OS SIGNATURE] Resposta do provider. OS=${order.numeroOs} success=${resultado.success} messageId=${resultado.messageId || 'N/A'} error=${resultado.error || 'N/A'}`);

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

    console.log(`[OS SIGNATURE] Envio confirmado. OS=${order.numeroOs} origem=${contato.origem} provider=${provider} messageId=${resultado.messageId || 'sem-id'}`);
    return {
      ok: true,
      token: sig.tokenAssinatura,
      signLink,
      messageId: resultado.messageId,
      provider,
      telefone,
      telefoneFormatado: contato.telefoneFormatado,
      origem: contato.origem,
      signatureId: sig.id,
    } as EnvioResultado;
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

  console.error(`[OS SIGNATURE] Falha no envio. OS=${order.numeroOs} origem=${contato.origem} provider=${provider} erro=${resultado.error || 'sem-detalhe'}`);
  return {
    ok: false,
    code: 'ERRO_ENVIO',
    error: `Falha ao enviar a mensagem WhatsApp: ${resultado.error || 'sem detalhes'}`,
    statusCode: 502,
    token: sig.tokenAssinatura,
    signLink,
    telefone,
    telefoneFormatado: contato.telefoneFormatado,
    origem: contato.origem,
    signatureId: sig.id,
  } as EnvioResultado;
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
  if (!order) return { ok: false, code: 'OS_NAO_ENCONTRADA', error: 'OSão encontrada', statusCode: 404 };
  if (!order.signature) return { ok: false, code: 'SEM_SOLICITACAO', error: 'Nenhuma solicitação de assinatura encontrada para esta OS', statusCode: 400 };
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
      observacao: 'Solicitação de assinatura cancelada',
    });
  }

  console.log(`[OS SIGNATURE] Solicitacao cancelada. OS=${order.numeroOs}`);
  return { ok: true, message: 'Solicitação de assinatura cancelada' };
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
  items?: Array<{
    id: string;
    descricao: string;
    tipo: string;
    quantidade: number;
    valorUnitario: number | null;
    valorTotal: number | null;
    observacoes?: string | null;
  }>;
}

export type DadosAssinaturaResult =
  | { ok: true; data: DadosAssinatura }
  | { ok: false; error: string; statusCode: number };

export async function obterDadosAssinatura(token: string): Promise<DadosAssinaturaResult> {
  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true, tecnicoResponsavel: { select: { name: true } }, items: true } } },
  });
  if (!signature) return { ok: false, error: 'Link de assinatura inválido', statusCode: 404 };

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
    return { ok: false, error: 'Solicitação de assinatura cancelada. Solicite um novo link.', statusCode: 410 };
  }
  if (signature.status === STATUS_SIGNATURE.RECUSADA) {
    return { ok: false, error: 'Solicitação de assinatura recusada anteriormente. Solicite um novo link.', statusCode: 410 };
  }
  if (signature.status === STATUS_SIGNATURE.ASSINADA) {
    return { ok: false, error: 'OS já assinada anteriormente', statusCode: 400 };
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
      items: signature.order.items.map((item) => ({
        id: item.id,
        descricao: item.descricao,
        tipo: item.tipo,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        observacoes: item.observacoes,
      })),
    },
  };
}

export async function registrarAssinatura(
  token: string,
  input: { assinanteNome: string; assinanteCpf: string; assinanteCargo: string; assinaturaBase64: string; timezone?: string },
  ip?: string | null,
  userAgent?: string,
): Promise<EnvioResultado> {
  const { assinanteNome, assinanteCpf, assinanteCargo, assinaturaBase64, timezone } = input;
  if (!assinanteNome || !assinanteCpf || !assinanteCargo || !assinaturaBase64) {
    return { ok: false, code: 'CAMPOS_OBRIGATORIOS', error: 'Todos os campos de assinatura são obrigatórios', statusCode: 400 };
  }

  if (!validarCpf(assinanteCpf)) {
    return { ok: false, code: 'CPF_INVALIDO', error: 'CPF informado é inválido', statusCode: 400 };
  }

  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true } } },
  });
  if (!signature) return { ok: false, code: 'TOKEN_INVALIDO', error: 'Link de assinatura inválido', statusCode: 404 };
  if (new Date() > signature.tokenExpiresAt) return { ok: false, code: 'EXPIRADO', error: 'Link de assinatura expirado', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.CANCELADA) return { ok: false, code: 'CANCELADA', error: 'Solicitação de assinatura cancelada', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.RECUSADA) return { ok: false, code: 'RECUSADA', error: 'Solicitação de assinatura recusada anteriormente', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };

  const signedAt = new Date();
  const signatureIdentifier = gerarSignatureIdentifier();
  const signedAtIso = signedAt.toISOString();

  const signatureHash = gerarSignatureHash({
    orderId: signature.orderId,
    nome: assinanteNome,
    cpf: assinanteCpf,
    cargo: assinanteCargo,
    assinaturaBase64,
    signedAt: signedAtIso,
  });

  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      assinanteNome,
      assinanteCpf,
      assinanteCargo,
      assinaturaBase64,
      ipAssinante: ip || null,
      userAgent: userAgent || null,
      assinadoEm: signedAt,
      status: STATUS_SIGNATURE.ASSINADA,
      signedAt,
      timezone: timezone || null,
      signatureIdentifier,
      documentHash: signatureHash,
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
    observacao: `OS assinada eletronicamente por ${assinanteNome} (${mascararCpf(assinanteCpf)})`,
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
    mensagem: `A OS ${signature.order.numeroOs} foi assinada eletronicamente por ${assinanteNome} (${assinanteCargo}).`,
    order: signature.order,
    dados: { orderId: signature.orderId, assinante: assinanteNome, signatureIdentifier },
  });

  console.log(`[OS SIGNATURE] OS assinada eletronicamente. OS=${signature.order.numeroOs} assinante=${assinanteNome} id=${signatureIdentifier}`);
  return { ok: true, message: 'OS assinada com sucesso!', pdfPath, signatureId: signature.id, signatureIdentifier };
}

export async function registrarAssinaturaSemDesenho(
  token: string,
  input: { assinanteNome: string; assinanteCpf: string; assinanteCargo: string; timezone?: string },
  ip?: string | null,
  userAgent?: string,
): Promise<EnvioResultado> {
  const { assinanteNome, assinanteCpf, assinanteCargo, timezone } = input;
  if (!assinanteNome || !assinanteCpf || !assinanteCargo) {
    return { ok: false, code: 'CAMPOS_OBRIGATORIOS', error: 'Nome, CPF e cargo são obrigatórios', statusCode: 400 };
  }

  if (!validarCpf(assinanteCpf)) {
    return { ok: false, code: 'CPF_INVALIDO', error: 'CPF informado é inválido', statusCode: 400 };
  }

  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true } } },
  });
  if (!signature) return { ok: false, code: 'TOKEN_INVALIDO', error: 'Link de assinatura inválido', statusCode: 404 };
  if (new Date() > signature.tokenExpiresAt) return { ok: false, code: 'EXPIRADO', error: 'Link de assinatura expirado', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.CANCELADA) return { ok: false, code: 'CANCELADA', error: 'Solicitação de assinatura cancelada', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.RECUSADA) return { ok: false, code: 'RECUSADA', error: 'Solicitação de assinatura recusada anteriormente', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };

  const signedAt = new Date();
  const signatureIdentifier = gerarSignatureIdentifier();
  const signedAtIso = signedAt.toISOString();

  const signatureHash = gerarSignatureHash({
    orderId: signature.orderId,
    nome: assinanteNome,
    cpf: assinanteCpf,
    cargo: assinanteCargo,
    assinaturaBase64: 'SEM_ASSINATURA',
    signedAt: signedAtIso,
  });

  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      assinanteNome,
      assinanteCpf,
      assinanteCargo,
      assinaturaBase64: 'SEM_ASSINATURA',
      ipAssinante: ip || null,
      userAgent: userAgent || null,
      assinadoEm: signedAt,
      status: STATUS_SIGNATURE.ASSINADA,
      signedAt,
      timezone: timezone || null,
      signatureIdentifier,
      documentHash: signatureHash,
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
    observacao: `OS concluída sem assinatura digital por ${assinanteNome} (${mascararCpf(assinanteCpf)})`,
  });

  let pdfPath: string | null = null;
  try {
    pdfPath = await generatePdf(signature.orderId);
    await prisma.signature.update({
      where: { id: signature.id },
      data: { pdfPath },
    });
  } catch (e: any) {
    console.warn('[OS SIGNATURE] Falha ao gerar PDF da OS:', e?.message || e);
  }

  await notificarInterno({
    tipo: 'os_assinada',
    mensagem: `A OS ${signature.order.numeroOs} foi concluída sem assinatura digital por ${assinanteNome} (${assinanteCargo}).`,
    order: signature.order,
    dados: { orderId: signature.orderId, assinante: assinanteNome, signatureIdentifier, semAssinatura: true },
  });

  console.log(`[OS SIGNATURE] OS concluída sem assinatura. OS=${signature.order.numeroOs} assinante=${assinanteNome} id=${signatureIdentifier}`);
  return { ok: true, message: 'OS concluída sem assinatura com sucesso!', pdfPath, signatureId: signature.id, signatureIdentifier };
}

export async function recusarAssinatura(token: string, motivo: string, ip?: string | null): Promise<EnvioResultado> {
  if (!motivo || !motivo.trim()) {
    return { ok: false, code: 'MOTIVO_OBRIGATORIO', error: 'Informe o motivo da recusa', statusCode: 400 };
  }

  const signature = await prisma.signature.findUnique({
    where: { tokenAssinatura: token },
    include: { order: { include: { client: true } } },
  });
  if (!signature) return { ok: false, code: 'TOKEN_INVALIDO', error: 'Link de assinatura inválido', statusCode: 404 };
  if (new Date() > signature.tokenExpiresAt) return { ok: false, code: 'EXPIRADO', error: 'Link de assinatura expirado', statusCode: 410 };
  if (signature.status === STATUS_SIGNATURE.ASSINADA) return { ok: false, code: 'JA_ASSINADA', error: 'OS já assinada anteriormente', statusCode: 400 };
  if (signature.status === STATUS_SIGNATURE.CANCELADA) return { ok: false, code: 'CANCELADA', error: 'Solicitação de assinatura cancelada', statusCode: 410 };

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
  return { ok: true, message: 'Assinatura recusada. Em breve nossa equipe entrará em contato.' };
}
