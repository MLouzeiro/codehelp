import prisma from '../../config/database';
import { ensureHelpdeskEntities, ensureFilas, ensureSLAConfigs, ensureCategorias } from '../../modules/helpdesk/seed.service';
import { ensureHelpdeskConfigs } from '../../modules/helpdesk/helpdesk.service';
import { ensureHelpdeskRules } from '../../modules/helpdesk/rules.service';

// ── Test utils compartilhados (FASE 1) ─────────────────────────────────
// Padroniza setup/cleanup entre testes que usam o banco real (SQLite dev).
// NUNCA usar deleteMany em dados de produção — aqui apenas em dados criados
// pelos próprios testes (tickets por telefone de teste).

export async function limparTicketsPorTelefone(phone: string) {
  const tickets = await prisma.ticket.findMany({
    where: { contactPhone: phone },
    select: { id: true },
  });
  for (const t of tickets) {
    await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticketStageEvent.deleteMany({ where: { ticketId: t.id } });
    await prisma.message.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticket.delete({ where: { id: t.id } });
  }
}

export async function ensureAmbienteHelpdesk() {
  await ensureHelpdeskEntities();
  await ensureHelpdeskConfigs();
  await ensureHelpdeskRules();
}

export async function criarDepartamentoTeste(slug: string, nome: string) {
  return prisma.departamento.upsert({
    where: { slug },
    create: { slug, nome, ativo: true, ordem: 0 },
    update: { ativo: true },
  });
}

export interface HorarioSnapshot {
  existia: boolean;
  horarioInicio: string | null;
  horarioFim: string | null;
  diasAtendimento: string | null;
}

// Garante atendimento aberto 24/7 durante os testes (determinístico,
// independente de horário do dia). Retorna snapshot para restaurar.
export async function abrirAtendimentoSempre(): Promise<HorarioSnapshot> {
  const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
  const snapshot: HorarioSnapshot = {
    existia: !!config,
    horarioInicio: config?.horarioInicio ?? null,
    horarioFim: config?.horarioFim ?? null,
    diasAtendimento: config?.diasAtendimento ?? null,
  };
  await prisma.helpdeskConfig.upsert({
    where: { slug: 'fila' },
    create: {
      slug: 'fila',
      nome: 'Fila',
      horarioInicio: '00:00',
      horarioFim: '23:59',
      diasAtendimento: '0,1,2,3,4,5,6',
    },
    update: {
      horarioInicio: '00:00',
      horarioFim: '23:59',
      diasAtendimento: '0,1,2,3,4,5,6',
    },
  });
  return snapshot;
}

export async function restaurarHorario(snapshot: HorarioSnapshot) {
  if (!snapshot.existia) {
    await prisma.helpdeskConfig.deleteMany({ where: { slug: 'fila' } });
    return;
  }
  await prisma.helpdeskConfig.update({
    where: { slug: 'fila' },
    data: {
      horarioInicio: snapshot.horarioInicio,
      horarioFim: snapshot.horarioFim,
      diasAtendimento: snapshot.diasAtendimento,
    },
  });
}

export async function criarMensagemBotMenuEnviado(ticketId: string) {
  await prisma.message.create({
    data: {
      ticketId,
      fromMe: true,
      content: '[Bot] Menu de departamentos enviado (interativo)',
      source: 'bot',
      tipo: 'system',
    },
  });
}

export function makeSendMessageMock() {
  const calls: Array<{ to: string; message: string }> = [];
  const fn = async (to: string, message: string) => {
    calls.push({ to, message });
    return { success: true };
  };
  return { fn, calls };
}
