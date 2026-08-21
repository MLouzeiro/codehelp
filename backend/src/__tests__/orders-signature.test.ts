import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  enviarLinkAssinatura,
  reenviarLinkAssinatura,
  cancelarSolicitacaoAssinatura,
  obterDadosAssinatura,
  registrarAssinatura,
  recusarAssinatura,
  resolverTelefoneParaAssinatura,
} from '../modules/orders/orders-signature.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let usuarioId: string;
let tecnicoId: string;
let idsParaLimpar: { orderId?: string; clientId?: string; ticketId?: string; userIds: string[] } = { userIds: [] };

function makeSendFn(opts?: { fail?: boolean; messageId?: string }) {
  const calls: Array<{ to: string; message: string; connectionId?: string }> = [];
  const fn = async (to: string, message: string, connectionId?: string) => {
    calls.push({ to, message, connectionId });
    if (opts?.fail) return { success: false, error: 'Nenhum provider WhatsApp disponivel' };
    return { success: true, messageId: opts?.messageId || 'msg-12345' };
  };
  return { fn, calls };
}

async function criarOrderTeste(opts?: { telefoneCliente?: string | null; comTicket?: boolean; contactPhone?: string }) {
  const telefoneCliente = opts?.telefoneCliente !== undefined ? opts.telefoneCliente : '5585999998888';
  const client = await prisma.client.create({
    data: { razaoSocial: `Cliente Assinatura ${Date.now()}`, status: 'ativo', telefone: telefoneCliente },
  });
  idsParaLimpar.clientId = client.id;

  let ticketId: string | undefined;
  if (opts?.comTicket) {
    const ticket = await prisma.ticket.create({
      data: {
        contactName: 'Contato Ticket',
        contactPhone: opts?.contactPhone || '5585999997777',
        assunto: 'Assinatura OS',
        status: 'em_atendimento',
        etapa: 'em_atendimento',
        clientId: client.id,
        canal: 'whatsapp',
      },
    });
    ticketId = ticket.id;
    idsParaLimpar.ticketId = ticket.id;
  }

  const year = new Date().getFullYear();
  const numeroOs = `OS-${year}-${String(Math.floor(10000 + Math.random() * 89999))}`;
  const order = await prisma.serviceOrder.create({
    data: {
      numeroOs,
      clientId: client.id,
      tipoServico: 'suporte',
      descricaoServico: 'Teste de assinatura',
      tecnicoResponsavelId: tecnicoId,
      criadoPorId: usuarioId,
      status: 'rascunho',
      ticketId: ticketId || null,
    },
  });
  idsParaLimpar.orderId = order.id;
  return order;
}

async function cleanup() {
  if (idsParaLimpar.orderId) {
    const notif = await prisma.notificacao.findMany({
      where: { dados: { contains: idsParaLimpar.orderId } },
      select: { id: true },
    });
    await prisma.notificacao.deleteMany({ where: { id: { in: notif.map((n) => n.id) } } });
    await prisma.serviceOrderStatusEvent.deleteMany({ where: { orderId: idsParaLimpar.orderId } });
    const sigs = await prisma.signature.findMany({
      where: { orderId: idsParaLimpar.orderId },
      select: { id: true },
    });
    await prisma.signatureAttempt.deleteMany({ where: { signatureId: { in: sigs.map((s) => s.id) } } });
    await prisma.signature.deleteMany({ where: { orderId: idsParaLimpar.orderId } });
    await prisma.serviceOrder.delete({ where: { id: idsParaLimpar.orderId } });
  }
  if (idsParaLimpar.ticketId) {
    await prisma.message.deleteMany({ where: { ticketId: idsParaLimpar.ticketId } });
    await prisma.ticket.delete({ where: { id: idsParaLimpar.ticketId } });
  }
  if (idsParaLimpar.clientId) {
    await prisma.colaborador.deleteMany({ where: { clientId: idsParaLimpar.clientId } });
    await prisma.client.delete({ where: { id: idsParaLimpar.clientId } });
  }
  if (idsParaLimpar.userIds.length) {
    await prisma.notificacao.deleteMany({ where: { destinatarioId: { in: idsParaLimpar.userIds } } });
  }
  idsParaLimpar = { userIds: [] };
}

beforeAll(async () => {
  const tecnico = await prisma.user.create({
    data: { name: 'Tec Assinatura', email: `tec-ass-${Date.now()}@test.dev`, password: 'hash', role: 'agente' },
  });
  tecnicoId = tecnico.id;
  idsParaLimpar.userIds.push(tecnico.id);

  const usuario = await prisma.user.create({
    data: { name: 'User Assinatura', email: `usr-ass-${Date.now()}@test.dev`, password: 'hash', role: 'gerente' },
  });
  usuarioId = usuario.id;
  idsParaLimpar.userIds.push(usuario.id);
});

afterEach(async () => {
  await cleanup();
});

describe('Assinatura de OS - envio do link (correcao critica)', () => {
  it('TESTE 1 - OS inexistente retorna erro claro sem criar solicitação', async () => {
    const { fn } = makeSendFn();
    const result = await enviarLinkAssinatura('id-inexistente', usuarioId, fn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('OS_NAO_ENCONTRADA');
    }
    const total = await prisma.signature.count({ where: { tokenAssinatura: { not: '' } } });
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('TESTE 2 - prioridade de contato: telefone do ticket vence telefone do cliente', async () => {
    const order = await criarOrderTeste({ telefoneCliente: '5585999998888', comTicket: true, contactPhone: '5585999997777' });
    const { fn, calls } = makeSendFn();
    const result = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(result.ok).toBe(true);
    expect(calls[0].to.replace(/[^\d]/g, '')).toBe('5585999997777');

    const signature = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(signature?.telefone).toBe('5585999997777');
  });

  it('TESTE 3 - token seguro nao sequencial (UUID) e diferente do numero/telefone', async () => {
    const order = await criarOrderTeste();
    const { fn } = makeSendFn();
    const result = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toMatch(UUID_REGEX);
    expect(result.token).not.toContain(order.numeroOs);
    expect(result.token).not.toContain('5585999998888');
    expect(result.signLink).toContain('/assinar/');

    const signature = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(signature?.tokenAssinatura).toMatch(UUID_REGEX);
  });

  it('TESTE 4 - cliente sem telefone retorna SEM_TELEFONE e nao cria solicitacao', async () => {
    const order = await criarOrderTeste({ telefoneCliente: null });
    const { fn, calls } = makeSendFn();
    const result = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SEM_TELEFONE');
    }
    expect(calls.length).toBe(0);
    const signature = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(signature).toBeNull();
    const orderAtual = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderAtual?.status).toBe('rascunho');
  });

  it('TESTE 5 - nao duplica solicitacao pendente (SOLICITACAO_PENDENTE)', async () => {
    const order = await criarOrderTeste();
    const { fn, calls } = makeSendFn();
    const primeiro = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(primeiro.ok).toBe(true);

    const segundo = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(segundo.ok).toBe(false);
    if (!segundo.ok) {
      expect(segundo.code).toBe('SOLICITACAO_PENDENTE');
    }
    expect(calls.length).toBe(1);

    const signatures = await prisma.signature.findMany({ where: { orderId: order.id } });
    expect(signatures).toHaveLength(1);
  });

  it('TESTE 6 - falha no envio marca ERRO_ENVIO e mantem OS em rascunho', async () => {
    const order = await criarOrderTeste();
    const { fn, calls } = makeSendFn({ fail: true });
    const result = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ERRO_ENVIO');
    }

    const signature = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(signature?.status).toBe('erro_envio');
    expect(signature?.lastError).toContain('Nenhum provider');

    const attempts = await prisma.signatureAttempt.findMany({ where: { signatureId: signature!.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].resultado).toBe('erro');

    const orderAtual = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderAtual?.status).toBe('rascunho');
    expect(calls.length).toBe(1);
  });

  it('TESTE 7 - reenvio apos erro reutiliza token e incrementa attempts com log', async () => {
    const order = await criarOrderTeste();
    const falha = makeSendFn({ fail: true });
    await enviarLinkAssinatura(order.id, usuarioId, falha.fn);

    const ok = makeSendFn({ messageId: 'msg-resend-1' });
    const result = await reenviarLinkAssinatura(order.id, usuarioId, ok.fn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const signature = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(signature?.status).toBe('enviada');
    expect(signature?.attempts).toBe(2);
    expect(signature?.messageId).toBe('msg-resend-1');
    expect(signature?.lastError).toBeNull();

    const attempts = await prisma.signatureAttempt.findMany({
      where: { signatureId: signature!.id },
      orderBy: { dataHora: 'asc' },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].resultado).toBe('erro');
    expect(attempts[1].resultado).toBe('enviada');

    const orderAtual = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderAtual?.status).toBe('aguardando_assinatura');
  });

  it('TESTE 8 - fluxo publico completo: visualiza e assina (assinada + notificacao)', async () => {
    const order = await criarOrderTeste();
    const { fn } = makeSendFn();
    const envio = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(envio.ok).toBe(true);
    if (!envio.ok) return;

    const dados = await obterDadosAssinatura(envio.token!);
    expect(dados.ok).toBe(true);
    if (dados.ok) {
      expect(dados.data.order.numeroOs).toBe(order.numeroOs);
      expect(dados.data.client.razaoSocial).toBeTruthy();
    }
    const sigVisualizada = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(sigVisualizada?.status).toBe('visualizada');

    const assina = await registrarAssinatura(
      envio.token!,
      { assinanteNome: 'Cliente Teste', assinanteCpf: '11122233344', assinanteCargo: 'Diretor', assinaturaBase64: 'data:image/png;base64,AAA' },
      '200.1.2.3',
      'vitest',
    );
    expect(assina.ok).toBe(true);
    if (assina.ok) {
      expect(assina.message).toContain('assinada');
    }

    const sigFinal = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(sigFinal?.status).toBe('assinada');
    expect(sigFinal?.assinanteNome).toBe('Cliente Teste');
    expect(sigFinal?.ipAssinante).toBe('200.1.2.3');

    const orderFinal = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderFinal?.status).toBe('assinada');

    const notif = await prisma.notificacao.findMany({
      where: { tipo: 'os_assinada', destinatarioId: tecnicoId },
    });
    expect(notif.length).toBeGreaterThan(0);

    const timeline = await prisma.serviceOrderStatusEvent.findMany({
      where: { orderId: order.id, statusNovo: 'assinada' },
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].origem).toBe('publico');
  });

  it('TESTE 9 - recusa com motivo marca recusada e volta OS a rascunho', async () => {
    const order = await criarOrderTeste();
    const { fn } = makeSendFn();
    const envio = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(envio.ok).toBe(true);
    if (!envio.ok) return;

    const recusa = await recusarAssinatura(envio.token!, 'Valor divergente do contrato');
    expect(recusa.ok).toBe(true);

    const sig = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(sig?.status).toBe('recusada');
    expect(sig?.rejectionReason).toBe('Valor divergente do contrato');
    expect(sig?.rejectedAt).toBeInstanceOf(Date);

    const orderAtual = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderAtual?.status).toBe('rascunho');

    const notif = await prisma.notificacao.findMany({
      where: { tipo: 'os_assinatura_recusada', destinatarioId: tecnicoId },
    });
    expect(notif.length).toBeGreaterThan(0);

    const assinaDepois = await registrarAssinatura(
      envio.token!,
      { assinanteNome: 'Cliente', assinanteCpf: '11122233344', assinanteCargo: 'Diretor', assinaturaBase64: 'data:image/png;base64,BBB' },
      '200.1.2.4',
      'vitest',
    );
    expect(assinaDepois.ok).toBe(false);
  });

  it('TESTE 10 - cancelamento de solicitacao marca cancelada e volta OS a rascunho', async () => {
    const order = await criarOrderTeste();
    const { fn } = makeSendFn();
    const envio = await enviarLinkAssinatura(order.id, usuarioId, fn);
    expect(envio.ok).toBe(true);

    const cancelar = await cancelarSolicitacaoAssinatura(order.id, usuarioId);
    expect(cancelar.ok).toBe(true);

    const sig = await prisma.signature.findUnique({ where: { orderId: order.id } });
    expect(sig?.status).toBe('cancelada');

    const orderAtual = await prisma.serviceOrder.findUnique({ where: { id: order.id } });
    expect(orderAtual?.status).toBe('rascunho');

    const timeline = await prisma.serviceOrderStatusEvent.findMany({
      where: { orderId: order.id, statusNovo: 'rascunho', observacao: { contains: 'cancelada' } },
    });
    expect(timeline.length).toBeGreaterThan(0);
  });

  it('resolverTelefoneParaAssinatura usa fallback cliente depois colaborador', async () => {
    const order = await criarOrderTeste({ telefoneCliente: null });
    await prisma.colaborador.create({
      data: { clientId: order.clientId, nome: 'Contato Principal', telefone: '5585999996666', principal: true },
    });
    const resolvido = await resolverTelefoneParaAssinatura(
      await prisma.serviceOrder.findUnique({ where: { id: order.id }, include: { client: { include: { colaboradores: true } }, ticket: true } }),
    );
    expect(resolvido.telefone).toBe('5585999996666');
    expect(resolvido.origem).toBe('colaborador');
  });
});