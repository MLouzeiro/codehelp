import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import {
  solicitarAprovacao,
  processarRespostaAprovacaoWhatsApp,
  decidirAprovacaoPorToken,
} from '../modules/aprovacoes/aprovacao.service';

let userId: string;
let ticketId: string;

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (ticketId) {
    await prisma.aprovacao.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
  if (userId) {
    await prisma.notificacao.deleteMany({ where: { destinatarioId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

describe('Aprovações via WhatsApp (FASE 5)', () => {
  it('cria aprovação com token + expiração e canal whatsapp', async () => {
    const user = await prisma.user.create({
      data: { name: 'Solicitante', email: `ap-${Date.now()}@test.dev`, password: 'hash', role: 'tecnico' },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `ap-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente AP',
        contactPhone: '85999990092',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const aprovacao = await solicitarAprovacao(
      ticket.id,
      user.id,
      'financeira',
      'Aprovação de horas extras',
      undefined,
      1500,
      { canal: 'whatsapp', telefoneAprovador: '85999991000' }
    );

    expect(aprovacao.status).toBe('pendente');
    expect(aprovacao.canal).toBe('whatsapp');
    expect(aprovacao.telefoneAprovador).toContain('85999991000');
    expect(aprovacao.token).toMatch(/^aprov_/);
    expect(aprovacao.expiraEm).toBeInstanceOf(Date);
    expect(aprovacao.expiraEm!.getTime()).toBeGreaterThan(Date.now());
  });

  it('resposta por lista interativa aprova SEM criar ticket', async () => {
    const user = await prisma.user.create({
      data: { name: 'Solicitante 2', email: `ap2-${Date.now()}@test.dev`, password: 'hash', role: 'tecnico' },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `ap2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente AP2',
        contactPhone: '85999990093',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const aprovacao = await solicitarAprovacao(
      ticket.id,
      user.id,
      'geral',
      'Liberação de acesso',
      undefined,
      undefined,
      { canal: 'whatsapp', telefoneAprovador: '85999992000' }
    );

    const resposta = await processarRespostaAprovacaoWhatsApp({
      phoneDigits: '85999992000',
      interactiveId: `aprovacao_${aprovacao.id}_aprovar`,
    });

    expect(resposta.tratado).toBe(true);
    expect(resposta.decidido).toBe(true);

    const atualizada = await prisma.aprovacao.findUnique({ where: { id: aprovacao.id } });
    expect(atualizada?.status).toBe('aprovada');

    // ZERO novo ticket criado para o telefone do aprovador
    const ticketsCriados = await prisma.ticket.count({
      where: { contactPhone: '85999992000' },
    });
    expect(ticketsCriados).toBe(0);
  });

  it('resposta por texto (aprovar/1) decide pelo telefone do aprovador', async () => {
    const user = await prisma.user.create({
      data: { name: 'Solicitante 3', email: `ap3-${Date.now()}@test.dev`, password: 'hash', role: 'tecnico' },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `ap3-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente AP3',
        contactPhone: '85999990094',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const aprovacao = await solicitarAprovacao(
      ticket.id,
      user.id,
      'geral',
      'Aprovação teste texto',
      undefined,
      undefined,
      { canal: 'whatsapp', telefoneAprovador: '85999993000' }
    );

    const resposta = await processarRespostaAprovacaoWhatsApp({
      phoneDigits: '85999993000',
      text: 'aprovar',
    });

    expect(resposta.tratado).toBe(true);
    expect(resposta.decidido).toBe(true);

    const atualizada = await prisma.aprovacao.findUnique({ where: { id: aprovacao.id } });
    expect(atualizada?.status).toBe('aprovada');
  });

  it('link por token decide sem autenticação e NÃO cria ticket', async () => {
    const user = await prisma.user.create({
      data: { name: 'Solicitante 4', email: `ap4-${Date.now()}@test.dev`, password: 'hash', role: 'tecnico' },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `ap4-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente AP4',
        contactPhone: '85999990095',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const aprovacao = await solicitarAprovacao(
      ticket.id,
      user.id,
      'financeira',
      'Aprovação por link',
      undefined,
      100,
      { canal: 'whatsapp', telefoneAprovador: '85999994000' }
    );

    const decidida = await decidirAprovacaoPorToken(aprovacao.token!, true, 'ok via link');

    expect(decidida.status).toBe('aprovada');
    expect(decidida.observacao).toBe('ok via link');

    // Rejeição de segunda decisão é bloqueada
    await expect(decidirAprovacaoPorToken(aprovacao.token!, false)).rejects.toThrow('já foi decidida');
  });

  it('resposta de texto de cliente comum NÃO é tratada como aprovação', async () => {
    const resposta = await processarRespostaAprovacaoWhatsApp({
      phoneDigits: '85999995555',
      text: 'aprovar',
    });
    expect(resposta.tratado).toBe(false);
  });
});