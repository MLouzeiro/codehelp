import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  ensureAmbienteHelpdesk,
  limparTicketsPorTelefone,
  criarDepartamentoTeste,
  criarMensagemBotMenuEnviado,
  makeSendMessageMock,
  abrirAtendimentoSempre,
  restaurarHorario,
  HorarioSnapshot,
} from './helpers/test-utils';
import { processIncomingMessageHandler } from '../modules/integrations/whatsapp/whatsapp-message-handler';
import { buscarTicketAtivo } from '../modules/helpdesk/flow.service';

// ⚠️ CRITICAL BUSINESS RULE — Fluxo determinístico pós-departamento.
// Cobra a correção: depois que o cliente escolhe o setor, o bot NÃO pode parar.
//   departamento → verificar empresa → (perguntar empresa se não vinculada)
//   → pedir descrição → identificar assunto → ticket na fila → analista.
// Estado persistido em Ticket.botFluxo (awaiting_company/awaiting_description).

const DEPT_SLUG = 'n1';
const PHONE_SEM_EMPRESA = '85999990092';
const PHONE_EMPRESA_INEXISTENTE = '85999990093';
const PHONE_VINCULADO = '85999990094';
const PHONE_MULTIPLAS = '85999990095';
const PHONE_DEPARTAMENTO_INVALIDO = '85999990096';
const PHONE_DUPLICADO = '85999990097';
const PHONE_RESTART = '85999990098';
const PHONE_PROTOCOLO = '85999990099';

const NOMES_CLIENTS_TESTE = [
  'Laboratorio Teste Central',
  'Lab Central Alfa',
  'Lab Central Beta',
];

let horarioSnapshot: HorarioSnapshot | null = null;

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  await criarDepartamentoTeste(DEPT_SLUG, 'N1 - Suporte Inicial');
  horarioSnapshot = await abrirAtendimentoSempre();
});

afterAll(async () => {
  if (horarioSnapshot) await restaurarHorario(horarioSnapshot);
});

afterEach(async () => {
  for (const phone of [
    PHONE_SEM_EMPRESA,
    PHONE_EMPRESA_INEXISTENTE,
    PHONE_VINCULADO,
    PHONE_MULTIPLAS,
    PHONE_DEPARTAMENTO_INVALIDO,
    PHONE_DUPLICADO,
    PHONE_RESTART,
    PHONE_PROTOCOLO,
  ]) {
    await limparTicketsPorTelefone(phone);
  }
  // Colaborador tem onDelete: Cascade → deletar o Client limpa tudo.
  await prisma.client.deleteMany({
    where: { razaoSocial: { in: NOMES_CLIENTS_TESTE } },
  });
});

async function criarTicketComMenuEnviado(fn: any, phone: string, messageId: string) {
  await processIncomingMessageHandler(
    { phone, text: 'Ola', contactName: 'Cliente Fluxo', provider: 'baileys', messageId },
    fn,
  );
  const ticket = await buscarTicketAtivo(phone);
  expect(ticket).not.toBeNull();
  await criarMensagemBotMenuEnviado(ticket!.id);
  return ticket!;
}

async function selecionarDepartamento(fn: any, phone: string, messageId: string) {
  await processIncomingMessageHandler(
    {
      phone,
      text: `dept_${DEPT_SLUG}`,
      interactiveId: `dept_${DEPT_SLUG}`,
      contactName: 'Cliente Fluxo',
      provider: 'baileys',
      messageId,
    },
    fn,
  );
  return buscarTicketAtivo(phone);
}

describe('Fluxo pós-departamento (correção fluxo parado)', () => {
  it('cliente sem empresa vinculada: pergunta empresa → confirma → descrição → assunto → fila', async () => {
    const { fn } = makeSendMessageMock();
    await prisma.client.create({
      data: {
        razaoSocial: 'Laboratorio Teste Central',
        nomeFantasia: 'Lab Teste',
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_SEM_EMPRESA, `fd-1a-${Date.now()}`);

    // 1) Seleção do departamento → aguarda EMPRESA (sem vínculo)
    const comDept = await selecionarDepartamento(fn, PHONE_SEM_EMPRESA, `fd-1b-${Date.now()}`);
    expect(comDept?.departamentoId).not.toBeNull();
    expect(comDept?.etapa).toBe('fila');
    expect(comDept?.botFluxo).toBe('awaiting_company');

    const pergEmpresa = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'nome do seu laboratório' } },
    });
    expect(pergEmpresa).not.toBeNull();

    // 2) Cliente informa a empresa existente → vinculada + pede descrição
    await processIncomingMessageHandler(
      {
        phone: PHONE_SEM_EMPRESA,
        text: 'Laboratorio Teste Central',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-1c-${Date.now()}`,
      },
      fn,
    );

    const vinculado = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(vinculado?.clientId).not.toBeNull();
    expect(vinculado?.botFluxo).toBe('awaiting_description');

    const colaboradores = await prisma.colaborador.findMany({
      where: { clientId: vinculado!.clientId! },
    });
    expect(colaboradores).toHaveLength(1);
    expect(colaboradores[0].telefone).toBe(PHONE_SEM_EMPRESA);

    const msgConfirm = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'empresa confirmada' } },
    });
    expect(msgConfirm).not.toBeNull();

    // 3) Cliente descreve o problema → assunto identificado, fluxo concluído
    await processIncomingMessageHandler(
      {
        phone: PHONE_SEM_EMPRESA,
        text: 'O sistema não imprime os laudos do exame',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-1d-${Date.now()}`,
      },
      fn,
    );

    const final = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(final?.assunto).toBeTruthy();
    expect(final?.assunto).toContain('sistema');
    expect(final?.botFluxo).toBeNull();
    expect(final?.observacoes).toContain('não imprime os laudos');
    expect(final?.categoria).toBe('suporte_tecnico');

    const msgAssunto = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'Assunto:' } },
    });
    expect(msgAssunto).not.toBeNull();
  });

  it('empresa não encontrada: NÃO cria vínculo e mantém o fluxo aguardando a empresa', async () => {
    const { fn } = makeSendMessageMock();
    const antes = await prisma.client.count();

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_EMPRESA_INEXISTENTE, `fd-2a-${Date.now()}`);
    await selecionarDepartamento(fn, PHONE_EMPRESA_INEXISTENTE, `fd-2b-${Date.now()}`);

    await processIncomingMessageHandler(
      {
        phone: PHONE_EMPRESA_INEXISTENTE,
        text: 'Laboratorio Inexistente XYZ',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-2c-${Date.now()}`,
      },
      fn,
    );

    const apos = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(apos?.clientId).toBeNull();
    expect(apos?.botFluxo).toBe('awaiting_company');
    expect(await prisma.client.count()).toBe(antes);

    const msgNaoEncontrado = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'Não localizamos a empresa' } },
    });
    expect(msgNaoEncontrado).not.toBeNull();
  });

  it('cliente com empresa já vinculada por telefone: pula a pergunta de empresa e pede descrição', async () => {
    const { fn } = makeSendMessageMock();
    await prisma.client.create({
      data: {
        razaoSocial: 'Laboratorio Teste Central',
        nomeFantasia: 'Lab Teste',
        telefone: PHONE_VINCULADO,
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_VINCULADO, `fd-3a-${Date.now()}`);
    // Ticket nasce com clientId (resolvido por telefone na criação)
    expect(ticket.clientId).not.toBeNull();

    const comDept = await selecionarDepartamento(fn, PHONE_VINCULADO, `fd-3b-${Date.now()}`);
    expect(comDept?.botFluxo).toBe('awaiting_description');

    const pergEmpresa = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'nome do seu laboratório' } },
    });
    expect(pergEmpresa).toBeNull();

    await processIncomingMessageHandler(
      {
        phone: PHONE_VINCULADO,
        text: 'Sistema travou ao gerar relatório',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-3c-${Date.now()}`,
      },
      fn,
    );

    const final = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(final?.assunto).toBeTruthy();
    expect(final?.botFluxo).toBeNull();
  });

  it('múltiplas empresas com o mesmo nome: mostra opções e vincula a escolhida por número', async () => {
    const { fn } = makeSendMessageMock();
    await prisma.client.create({
      data: {
        razaoSocial: 'Lab Central Alfa',
        nomeFantasia: 'Alfa Laboratorios',
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });
    await prisma.client.create({
      data: {
        razaoSocial: 'Lab Central Beta',
        nomeFantasia: 'Beta Laboratorios',
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_MULTIPLAS, `fd-4a-${Date.now()}`);
    await selecionarDepartamento(fn, PHONE_MULTIPLAS, `fd-4b-${Date.now()}`);

    // Nome parcial → duas empresas → lista numerada
    await processIncomingMessageHandler(
      {
        phone: PHONE_MULTIPLAS,
        text: 'Lab Central',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-4c-${Date.now()}`,
      },
      fn,
    );

    const msgOpcoes = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'Encontrei mais de uma empresa' } },
    });
    expect(msgOpcoes).not.toBeNull();

    // Cliente escolhe a 2ª opção
    await processIncomingMessageHandler(
      {
        phone: PHONE_MULTIPLAS,
        text: '2',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-4d-${Date.now()}`,
      },
      fn,
    );

    const final = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const beta = await prisma.client.findFirst({ where: { razaoSocial: 'Lab Central Beta' } });
    expect(final?.clientId).toBe(beta!.id);
    expect(final?.botFluxo).toBe('awaiting_description');
  });

  it('departamento inválido (número inexistente): re-pergunta e NÃO salva; depois aceita por NOME', async () => {
    const { fn } = makeSendMessageMock();
    const ticket = await criarTicketComMenuEnviado(fn, PHONE_DEPARTAMENTO_INVALIDO, `fd-5a-${Date.now()}`);

    // TESTE 3 — número inválido → re-pergunta, nada é salvo
    await processIncomingMessageHandler(
      {
        phone: PHONE_DEPARTAMENTO_INVALIDO,
        text: '9',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-5b-${Date.now()}`,
      },
      fn,
    );
    const semDept = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(semDept?.departamentoId).toBeNull();
    const msgInvalida = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: 'Não consegui identificar' } },
    });
    expect(msgInvalida).not.toBeNull();

    // TESTE 4 — aceita o NOME do departamento (resposta de texto, sem número)
    await processIncomingMessageHandler(
      {
        phone: PHONE_DEPARTAMENTO_INVALIDO,
        text: 'N1 - Suporte Inicial',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-5c-${Date.now()}`,
      },
      fn,
    );
    const comDept = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(comDept?.departamentoId).not.toBeNull();
    expect(comDept?.etapa).toBe('fila');
    expect(comDept?.botFluxo).toBe('awaiting_company');
  });

  it('mensagem duplicada / webhook duplicado (mesmo messageId): NÃO duplica ticket', async () => {
    const { fn } = makeSendMessageMock();
    const msgId = `fd-6dup-${Date.now()}`;

    await processIncomingMessageHandler(
      {
        phone: PHONE_DUPLICADO,
        text: 'Ola',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: msgId,
      },
      fn,
    );
    await processIncomingMessageHandler(
      {
        phone: PHONE_DUPLICADO,
        text: 'Ola',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: msgId,
      },
      fn,
    );

    const tickets = await prisma.ticket.findMany({ where: { contactPhone: PHONE_DUPLICADO } });
    expect(tickets).toHaveLength(1);
  });

  it('reinício do serviço preserva estado (fonte de verdade = botFluxo no banco)', async () => {
    const { fn } = makeSendMessageMock();
    await prisma.client.create({
      data: {
        razaoSocial: 'Laboratorio Teste Central',
        nomeFantasia: 'Lab Teste',
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_RESTART, `fd-7a-${Date.now()}`);
    await selecionarDepartamento(fn, PHONE_RESTART, `fd-7b-${Date.now()}`);

    await processIncomingMessageHandler(
      {
        phone: PHONE_RESTART,
        text: 'Laboratorio Teste Central',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-7c-${Date.now()}`,
      },
      fn,
    );
    const aposEmpresa = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(aposEmpresa?.botFluxo).toBe('awaiting_description');

    // "Reinício": a próxima mensagem é processada apenas com o estado persistido no banco.
    await processIncomingMessageHandler(
      {
        phone: PHONE_RESTART,
        text: 'Sistema travou ao gerar relatório',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-7d-${Date.now()}`,
      },
      fn,
    );
    const final = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(final?.assunto).toBeTruthy();
    expect(final?.botFluxo).toBeNull();
  });

  it('TESTE CRÍTICO: confirmação ao cliente inclui Protocolo #XXXXXX gerado na criação', async () => {
    const { fn } = makeSendMessageMock();
    await prisma.client.create({
      data: {
        razaoSocial: 'Laboratorio Teste Central',
        nomeFantasia: 'Lab Teste',
        telefone: PHONE_PROTOCOLO,
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });

    const ticket = await criarTicketComMenuEnviado(fn, PHONE_PROTOCOLO, `fd-c1-${Date.now()}`);
    await selecionarDepartamento(fn, PHONE_PROTOCOLO, `fd-c2-${Date.now()}`);

    await processIncomingMessageHandler(
      {
        phone: PHONE_PROTOCOLO,
        text: 'O sistema não imprime os laudos do exame',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `fd-c3-${Date.now()}`,
      },
      fn,
    );

    const final = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(final?.protocolo).toMatch(/^TKT-\d{8}-\d{4}$/);
    expect(final?.botFluxo).toBeNull();

    const msgConfirmacao = await prisma.message.findFirst({
      where: { ticketId: ticket.id, fromMe: true, content: { contains: `#${final!.protocolo}` } },
    });
    expect(msgConfirmacao).not.toBeNull();
    expect(msgConfirmacao?.content).toContain('atendimento foi registrado com sucesso');

    const eventoDescricao = await prisma.ticketStageEvent.findFirst({
      where: { ticketId: ticket.id, mensagemAutomatica: { contains: 'assunto identificado' } },
    });
    expect(eventoDescricao).not.toBeNull();
  });
});