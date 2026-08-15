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
import { processarAguardandoExpediente } from '../modules/helpdesk/sla.scheduler';
import { abrirChamadoPorAtendente } from '../modules/helpdesk/triagem.service';
import { buscarTicketAtivo } from '../modules/helpdesk/flow.service';

// ⚠️ CRITICAL BUSINESS RULE — TESTE #31 (Fluxo Fora do Horário).
// Cliente manda msg fora do expediente → ticket fica em 'aguardando_expediente'
// (SEM enviar seleção de departamento incorreta). Ao iniciar o expediente, o JOB
// (processarAguardandoExpediente) move para boas-vindas e reutiliza o MESMO
// mecanismo de menu (enviarMenuInicial) de uma conversa nova — nunca um fluxo
// paralelo "escreva o setor". Estado antigo limpo (botFluxo=null).

const DEPT_SLUG = 'n1';
const PHONE = '85999990101';
const EMAIL_TESTE = 'analista-expediente@teste.com';
const CLIENTE_TESTE = 'Laboratorio Expediente Teste';

let horarioSnapshot: HorarioSnapshot | null = null;

// Força atendimento FECHADO de forma determinística: diasAtendimento vazio →
// isHorarioAtendimento sempre false (independente de horário/timezone).
async function fecharAtendimento() {
  await prisma.helpdeskConfig.update({
    where: { slug: 'fila' },
    data: { diasAtendimento: '' },
  });
}

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  await criarDepartamentoTeste(DEPT_SLUG, 'N1 - Suporte Inicial');
  horarioSnapshot = await abrirAtendimentoSempre();
  await prisma.user.upsert({
    where: { email: EMAIL_TESTE },
    create: { name: 'Analista Expediente', email: EMAIL_TESTE, password: 'x', role: 'tecnico' },
    update: { active: true },
  });
  // Cliente vinculado ao telefone → após o departamento, pula empresa e pede descrição.
  const clienteExistente = await prisma.client.findFirst({ where: { razaoSocial: CLIENTE_TESTE } });
  if (clienteExistente) {
    await prisma.client.update({ where: { id: clienteExistente.id }, data: { telefone: PHONE, status: 'ativo' } });
  } else {
    await prisma.client.create({
      data: {
        razaoSocial: CLIENTE_TESTE,
        nomeFantasia: 'Lab Expediente',
        telefone: PHONE,
        segmento: 'laboratorio',
        origem: 'whatsapp',
        status: 'ativo',
      },
    });
  }
});

afterEach(async () => {
  const tickets = await prisma.ticket.findMany({
    where: { contactPhone: PHONE },
    select: { id: true },
  });
  await prisma.notificacao.deleteMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } });
  await limparTicketsPorTelefone(PHONE);
});

afterAll(async () => {
  if (horarioSnapshot) await restaurarHorario(horarioSnapshot);
  const analista = await prisma.user.findFirst({ where: { email: EMAIL_TESTE } });
  if (analista) {
    await prisma.notificacao.deleteMany({ where: { destinatarioId: analista.id } });
    await prisma.user.deleteMany({ where: { email: EMAIL_TESTE } });
  }
  await prisma.client.deleteMany({ where: { razaoSocial: CLIENTE_TESTE } });
});

describe('Fluxo fora do horário → boas-vindas (TESTE #31)', () => {
  it('msg fora do horário → aguardando_expediente (sem seleção incorreta) → JOB → boas-vindas real → fila', async () => {
    const { fn, calls } = makeSendMessageMock();

    // 1) FORA do horário: mensagem → ticket fica aguardando expediente
    await fecharAtendimento();
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'Ola',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `exp-a-${Date.now()}`,
      },
      fn,
    );
    let ticket = await buscarTicketAtivo(PHONE);
    expect(ticket).not.toBeNull();
    expect(ticket!.etapa).toBe('aguardando_expediente');
    expect(ticket!.botFluxo).toBeNull();

    // 2) Mensagem enviada ao cliente = FORA DO HORÁRIO (NÃO a seleção de setor)
    const msgEnviada = calls[calls.length - 1]?.message || '';
    expect(msgEnviada).toContain('horario de atendimento');
    expect(msgEnviada.toLowerCase()).not.toContain('selecione o departamento');
    expect(msgEnviada.toLowerCase()).not.toContain('escrever o setor');

    // 3) Início do expediente → JOB identifica e processa
    await restaurarHorario(horarioSnapshot!);
    const processados = await processarAguardandoExpediente();
    expect(processados).toBeGreaterThanOrEqual(1);

    // 4) Ticket → etapa inicial (boas-vindas) + estado antigo limpo
    ticket = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(ticket!.etapa).not.toBe('aguardando_expediente');
    expect(['triagem', 'boas_vindas', 'fila']).toContain(ticket!.etapa);
    expect(ticket!.botFluxo).toBeNull();

    const evento = await prisma.ticketStageEvent.findFirst({
      where: { ticketId: ticket!.id, mensagemAutomatica: { contains: 'iniciar expediente' } },
    });
    expect(evento).not.toBeNull();

    // 5) O JOB reutiliza enviarMenuInicial (menu canônico). Nos testes o envio real
    // falha (sem provider WhatsApp), então simulamos o marcador produzido em produção.
    await criarMensagemBotMenuEnviado(ticket!.id);

    // 6) Cliente seleciona departamento → descrição → assunto → fila → analista assume
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: `dept_${DEPT_SLUG}`,
        interactiveId: `dept_${DEPT_SLUG}`,
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `exp-b-${Date.now()}`,
      },
      fn,
    );
    const comDept = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(comDept?.departamentoId).not.toBeNull();
    expect(comDept?.etapa).toBe('fila');
    expect(comDept?.botFluxo).toBe('awaiting_description');

    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'O sistema não imprime os laudos do exame',
        contactName: 'Cliente Fluxo',
        provider: 'baileys',
        messageId: `exp-c-${Date.now()}`,
      },
      fn,
    );
    const final = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(final?.assunto).toBeTruthy();
    expect(final?.protocolo).toMatch(/^TKT-\d{8}-\d{4}$/);
    expect(final?.botFluxo).toBeNull();
    expect(final?.etapa).toBe('fila');
    expect(final?.departamentoId).not.toBeNull();
    expect(final?.clientId).not.toBeNull();

    // 7) Analista consegue assumir (abrirChamadoPorAtendente reutiliza protocolo existente)
    const analista = await prisma.user.findFirst({ where: { email: EMAIL_TESTE } });
    const aberto = await abrirChamadoPorAtendente(final!.id, analista!.id, { assunto: final!.assunto! });
    expect(aberto.ok).toBe(true);
    const emAtendimento = await prisma.ticket.findUnique({ where: { id: final!.id } });
    expect(emAtendimento?.etapa).toBe('em_atendimento');
  });
});