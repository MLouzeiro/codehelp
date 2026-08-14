import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  ensureAmbienteHelpdesk,
  limparTicketsPorTelefone,
  criarDepartamentoTeste,
  criarMensagemBotMenuEnviado,
  makeSendMessageMock,
} from './helpers/test-utils';
import { processIncomingMessageHandler } from '../modules/integrations/whatsapp/whatsapp-message-handler';
import { buscarTicketAtivo } from '../modules/helpdesk/flow.service';

// ⚠️ CRITICAL BUSINESS RULE — Smoke do handler canônico de WhatsApp.
// Cobre o caminho mais crítico do sistema: mensagem → ticket → menu de
// departamento → seleção → fila. Qualquer quebra aqui é bloqueante.
//
// O provider não está conectado nos testes; o handler trata envio de menu
// com falha controlada (fallback explícito), sem lançar exceção.

const PHONE = '85999990090';
const DEPT_SLUG = 'n1';

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  await criarDepartamentoTeste(DEPT_SLUG, 'N1 - Suporte Inicial');
});

afterEach(async () => {
  await limparTicketsPorTelefone(PHONE);
});

describe('Smoke — handler canônico de WhatsApp (fluxo crítico)', () => {
  it('nova mensagem sem ticket ativo cria ticket e salva a mensagem', async () => {
    const { fn } = makeSendMessageMock();

    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'Preciso de ajuda com o sistema',
        contactName: 'Cliente Smoke',
        provider: 'baileys',
        messageId: `smoke-1-${Date.now()}`,
      },
      fn,
    );

    const ativo = await buscarTicketAtivo(PHONE);
    expect(ativo).not.toBeNull();
    expect(ativo?.status).toBe('aberto');
    expect(ativo?.canal).toBe('whatsapp_baileys');
    expect(ativo?.contactPhone).toBe(PHONE);

    const msgCliente = await prisma.message.findFirst({
      where: { ticketId: ativo!.id, fromMe: false },
    });
    expect(msgCliente?.content).toContain('Preciso de ajuda');
  });

  it('clique no departamento (dept_<slug>) move o ticket para a fila', async () => {
    const { fn } = makeSendMessageMock();

    // Primeira mensagem → cria ticket
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'Ola',
        contactName: 'Cliente Smoke',
        provider: 'baileys',
        messageId: `smoke-2a-${Date.now()}`,
      },
      fn,
    );

    const ticket = await buscarTicketAtivo(PHONE);
    expect(ticket).not.toBeNull();

    // Simula o menu interativo já enviado (provider não conectado em teste)
    await criarMensagemBotMenuEnviado(ticket!.id);

    // Segunda mensagem = clique no menu de departamentos
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: `dept_${DEPT_SLUG}`,
        interactiveId: `dept_${DEPT_SLUG}`,
        contactName: 'Cliente Smoke',
        provider: 'baileys',
        messageId: `smoke-2b-${Date.now()}`,
      },
      fn,
    );

    const atualizado = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(atualizado?.departamentoId).not.toBeNull();
    expect(atualizado?.etapa).toBe('fila');
  });

  it('mensagem duplicada (mesmo messageId) NÃO cria segundo ticket', async () => {
    const { fn } = makeSendMessageMock();
    const messageId = `smoke-3-${Date.now()}`;

    await processIncomingMessageHandler(
      { phone: PHONE, text: 'Primeira', provider: 'baileys', messageId },
      fn,
    );
    await processIncomingMessageHandler(
      { phone: PHONE, text: 'Primeira (duplicada)', provider: 'baileys', messageId },
      fn,
    );

    const tickets = await prisma.ticket.findMany({ where: { contactPhone: PHONE } });
    expect(tickets).toHaveLength(1);
  });

  it('mensagem sem telefone é ignorada sem exceção', async () => {
    const { fn } = makeSendMessageMock();
    await expect(
      processIncomingMessageHandler({ phone: '', text: 'oi', provider: 'baileys' }, fn),
    ).resolves.toBeUndefined();
  });
});
