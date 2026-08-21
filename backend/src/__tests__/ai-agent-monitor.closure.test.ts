import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  auditarEncerramentoTicket,
  getEncerramentosAgente,
  getMetricasAgente,
  getRelatorioAuditoria,
} from '../modules/ai/aiAgentMonitor.service';

let limpeza: {
  ticketIds: string[];
  userIds: string[];
} = { ticketIds: [], userIds: [] };

function sufixo() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

const HORA = 60 * 60 * 1000;

async function limparDados() {
  await prisma.aIAgentClosureAudit.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.aIAgentAudit.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.cSATResposta.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.message.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.ticket.deleteMany({ where: { id: { in: limpeza.ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: limpeza.userIds } } });
  limpeza = { ticketIds: [], userIds: [] };
}

async function criarTecnico() {
  const user = await prisma.user.create({
    data: {
      name: `Tecnico Closure ${sufixo()}`,
      email: `tec_closure_${sufixo()}@test.com`,
      password: 'hash-teste',
      role: 'tecnico',
      active: true,
    },
  });
  limpeza.userIds.push(user.id);
  return user;
}

async function criarTicketEncerrado(tecnicoId: string, status = 'fechado', etapa = 'concluido', extra?: Record<string, any>) {
  const ticket = await prisma.ticket.create({
    data: {
      externalId: `closure_${sufixo()}`,
      contactName: 'Cliente Closure',
      contactPhone: `55${sufixo().slice(-10)}`,
      status,
      etapa,
      canal: 'whatsapp_baileys',
      dataFechamento: new Date(Date.now() - 10 * 60 * 1000),
      assigneeId: tecnicoId,
      ...extra,
    },
  });
  limpeza.ticketIds.push(ticket.id);
  return ticket;
}

async function criarMensagem(ticketId: string, fromMe: boolean, content: string, at: Date) {
  await prisma.message.create({
    data: { ticketId, fromMe, content, sentAt: at, createdAt: at },
  });
}

beforeAll(async () => {
  await limparDados();
});

afterEach(async () => {
  await limparDados();
});

afterAll(async () => {
  await limparDados();
});

describe('Detecção de encerramento no AI Agent Monitor', () => {
  it('audita e persiste encerramento prematuro sem confirmação do cliente', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(ticket.id, true, 'Vou verificar o problema e te retorno.', new Date(Date.now() - HORA));

    const resultado = await auditarEncerramentoTicket(ticket.id);

    expect(resultado).not.toBeNull();
    expect(resultado!.tipo).toBe('encerramento_prematuro');
    expect(resultado!.recomendaReabertura).toBe(true);

    const persistido = await prisma.aIAgentClosureAudit.findUnique({ where: { ticketId: ticket.id } });
    expect(persistido).not.toBeNull();
    expect(persistido!.agentId).toBe(tecnico.id);
    expect(persistido!.tipo).toBe('encerramento_prematuro');
  });

  it('é idempotente (upsert por ticket, não duplica registro)', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(ticket.id, true, 'Concluímos o atendimento.', new Date(Date.now() - HORA));

    await auditarEncerramentoTicket(ticket.id);
    await auditarEncerramentoTicket(ticket.id);

    const total = await prisma.aIAgentClosureAudit.count({ where: { ticketId: ticket.id } });
    expect(total).toBe(1);
  });

  it('detecta resolução real quando o cliente confirma', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(ticket.id, true, 'Tentamos o procedimento, me confirma se resolveu?', new Date(Date.now() - 2 * HORA));
    await criarMensagem(ticket.id, false, 'Funcionou, obrigado! Pode fechar.', new Date(Date.now() - HORA));

    const resultado = await auditarEncerramentoTicket(ticket.id);

    expect(resultado!.tipo).toBe('resolucao_real');
    expect(resultado!.recomendaReabertura).toBe(false);
  });

  it('detecta reabertura quando o cliente abre novo ticket após o encerramento', async () => {
    const tecnico = await criarTecnico();
    const primeiro = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(primeiro.id, true, 'Concluímos o atendimento.', new Date(Date.now() - 2 * HORA));

    const reabertura = await prisma.ticket.create({
      data: {
        externalId: `closure_rea_${sufixo()}`,
        contactName: 'Cliente Closure',
        contactPhone: primeiro.contactPhone,
        contactJid: primeiro.contactJid,
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp_baileys',
        createdAt: new Date(),
        assigneeId: tecnico.id,
      },
    });
    limpeza.ticketIds.push(reabertura.id);
    await criarMensagem(reabertura.id, false, 'O problema voltou, preciso de ajuda!', new Date());

    const resultado = await auditarEncerramentoTicket(primeiro.id);

    expect(resultado!.tipo).toBe('reabertura');
    expect(resultado!.clienteVoltou).toBe(true);
  });

  it('agrega KPIs de encerramento por agente (prematuros/resoluções/reaberturas/taxa)', async () => {
    const tecnico = await criarTecnico();

    // Prematuro
    const prematuro = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(prematuro.id, true, 'Vou verificar o problema e te retorno.', new Date(Date.now() - HORA));
    await auditarEncerramentoTicket(prematuro.id);

    // Resolução real
    const resolvido = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(resolvido.id, true, 'Me confirma se resolveu?', new Date(Date.now() - 2 * HORA));
    await criarMensagem(resolvido.id, false, 'Resolveu sim, obrigado!', new Date(Date.now() - HORA));
    await auditarEncerramentoTicket(resolvido.id);

    const { metricas, lista } = await getEncerramentosAgente(tecnico.id, 30);

    expect(metricas.total).toBe(2);
    expect(metricas.prematuros).toBe(1);
    expect(metricas.resolucoesReais).toBe(1);
    expect(metricas.taxaEncerramentoCorreto).toBe(50);
    expect(lista.length).toBe(2);
  });

  it('inclui encerramentos nas métricas do agente (getMetricasAgente)', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(ticket.id, true, 'Vou verificar o problema e te retorno.', new Date(Date.now() - HORA));
    await auditarEncerramentoTicket(ticket.id);

    const metricas = await getMetricasAgente(tecnico.id, 30);

    expect(metricas).not.toBeNull();
    expect(metricas!.encerramentos).not.toBeNull();
    expect(metricas!.encerramentos!.total).toBe(1);
    expect(metricas!.encerramentos!.prematuros).toBe(1);
  });

  it('inclui bloco de encerramento no relatório do ticket', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicketEncerrado(tecnico.id);
    await criarMensagem(ticket.id, true, 'Vou verificar o problema e te retorno.', new Date(Date.now() - HORA));
    await auditarEncerramentoTicket(ticket.id);

    const relatorio = await getRelatorioAuditoria(ticket.id);

    expect(relatorio).not.toBeNull();
    expect(relatorio!.encerramento).not.toBeNull();
    expect(relatorio!.encerramento!.tipo).toBe('encerramento_prematuro');
    expect(relatorio!.encerramento!.recomendaReabertura).toBe(true);
  });
});