import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { detectarOpcaoMenu, resolverOpcaoMenu } from '../modules/helpdesk/menu';
import { extrairNotaAvaliacao, finalizeTicketAfterEvaluation } from '../modules/helpdesk/flow.service';
import { agendarCsat } from '../modules/csat/csat.service';

// ⚠️ CRITICAL BUSINESS RULE — Fluxo interativo protegido por teste.
// Saudação (menu de departamentos, dept_<slug>) e avaliação (rating_N) são
// LISTAS INTERATIVAS clicáveis. Se voltarem a ser texto "Responda com o
// número", este teste aponta a regressão na normalização/detecção.

const PHONE = '85999990081';
const DEPT_SLUG = 'n1';

beforeAll(async () => {
  await ensureHelpdeskEntities();
  await prisma.departamento.upsert({
    where: { slug: DEPT_SLUG },
    create: { slug: DEPT_SLUG, nome: 'N1 - Suporte Inicial', ativo: true, ordem: 0 },
    update: { ativo: true },
  });
});

afterEach(async () => {
  const tickets = await prisma.ticket.findMany({
    where: { contactPhone: PHONE },
    select: { id: true },
  });
  for (const t of tickets) {
    await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticketStageEvent.deleteMany({ where: { ticketId: t.id } });
    await prisma.message.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticket.delete({ where: { id: t.id } });
  }
});

describe('Fluxo interativo (menu + avaliação)', () => {
  it('clique no menu de departamentos (dept_<slug>) resolve o departamento', async () => {
    const opcao = detectarOpcaoMenu(`dept_${DEPT_SLUG}`);
    expect(opcao).toBe(`dept_${DEPT_SLUG}`);

    const resolvido = await resolverOpcaoMenu(opcao as string);
    expect(resolvido).not.toBeNull();
    expect(resolvido!.departamentoNome).toContain('Suporte Inicial');
  });

  it('menu sem departamento ativo não resolve opção dept_inexistente', async () => {
    const resolvido = await resolverOpcaoMenu('dept_nao-existe');
    expect(resolvido).toBeNull();
  });

  it('clique na avaliação (rating_N) extrai a nota correta', () => {
    expect(extrairNotaAvaliacao('rating_5')).toBe(5);
    expect(extrairNotaAvaliacao('rating_1')).toBe(1);
    // Departamento NÃO é nota
    expect(extrairNotaAvaliacao('dept_n1')).toBeNull();
  });

  it('fluxo completo: ticket ativo → departamento selecionado → avaliação → finalizado', async () => {
    // 1. Novo ticket em triagem (como o handler cria antes do menu)
    const t = await prisma.ticket.create({
      data: {
        externalId: `interactive-1-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Interativo',
        contactPhone: PHONE,
        status: 'aberto',
        etapa: 'triagem',
        canal: 'whatsapp_baileys',
      },
    });

    // 2. Cliente clica no menu → departamento resolvido → ticket vai para fila
    const opcao = detectarOpcaoMenu(`dept_${DEPT_SLUG}`);
    const dept = await resolverOpcaoMenu(opcao!);
    expect(dept).not.toBeNull();
    await prisma.ticket.update({
      where: { id: t.id },
      data: { departamentoId: dept!.departamentoId, etapa: 'fila' },
    });

    // 3. Analista conclui → CSAT agendado
    await prisma.ticket.update({
      where: { id: t.id },
      data: { status: 'fechado', etapa: 'concluido', dataFechamento: new Date(), dataConclusao: new Date() },
    });
    const { criado, csat } = await agendarCsat(t.id);
    expect(criado).toBe(true);

    // 4. Cliente clica em rating_5 → avaliação registrada e ticket finalizado
    const nota = extrairNotaAvaliacao('rating_5');
    expect(nota).toBe(5);
    const r = await finalizeTicketAfterEvaluation(PHONE, csat, nota!);
    expect(r.ok).toBe(true);

    const ticket = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(ticket?.satisfacao).toBe(5);
    expect(ticket?.evaluationStatus).toBe('respondido');
    expect(ticket?.etapa).toBe('concluido');
    expect(ticket?.status).toBe('fechado');

    const csatAtual = await prisma.cSATResposta.findUnique({ where: { id: csat.id } });
    expect(csatAtual?.respondidoEm).toBeInstanceOf(Date);
  });

  it('texto numerado simples (fallback) também é aceito como nota', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `interactive-2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Fallback',
        contactPhone: PHONE,
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        evaluationStatus: 'aguardando',
      },
    });
    const { csat } = await agendarCsat(t.id);

    const nota = extrairNotaAvaliacao('3');
    expect(nota).toBe(3);
    const r = await finalizeTicketAfterEvaluation(PHONE, csat, nota!);
    expect(r.ok).toBe(true);
  });
});
