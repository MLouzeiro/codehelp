import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import {
  auditarTicket,
  getAuditoriaByTicket,
  getAuditoriaById,
  listarAuditorias,
  revisarAuditoria,
  classificarNota,
} from '../modules/ai/auditoriaProfissional.service';
import { getPanoramaAuditoria } from '../modules/ai/auditoriaAgregacao.service';
import { gerarTomadaDecisao, getFilaAuditoria } from '../modules/ai/auditoriaDecisao.service';
import { gerarRelatorioTicket, exportarAuditoriaCsv } from '../modules/ai/auditoriaRelatorio.service';

let agenteId: string;
let ticketsIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
  const agente = await prisma.user.upsert({
    where: { email: 'auditor-profissional@teste.com' },
    create: {
      email: 'auditor-profissional@teste.com',
      name: 'Analista Profissional',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'tecnico',
      active: true,
    },
    update: {},
  });
  agenteId = agente.id;
});

afterEach(async () => {
  if (ticketsIds.length > 0) {
    await prisma.message.deleteMany({ where: { ticketId: { in: ticketsIds } } });
    await prisma.auditoriaProfissional.deleteMany({ where: { ticketId: { in: ticketsIds } } }).catch(() => {});
    await prisma.cSATResposta.deleteMany({ where: { ticketId: { in: ticketsIds } } }).catch(() => {});
    await prisma.ticket.deleteMany({ where: { id: { in: ticketsIds } } });
    ticketsIds = [];
  }
});

describe('Auditoria Profissional (FASE A — Auditoria IA)', () => {
  it('classificarNota retorna classificações corretas', () => {
    expect(classificarNota(95)).toBe('EXCELENTE');
    expect(classificarNota(85)).toBe('MUITO_BOM');
    expect(classificarNota(75)).toBe('BOM');
    expect(classificarNota(60)).toBe('ATENCAO');
    expect(classificarNota(40)).toBe('ABAIXO_DA_MEDIA');
    expect(classificarNota(15)).toBe('CRITICO');
  });

  it('audita ticket com fallback local e grava 14 notas', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Auditoria',
        contactPhone: '85999998820',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataAbertura: new Date(Date.now() - 3600000),
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: false, content: 'Preciso de ajuda com o sistema.', sentAt: new Date(Date.now() - 3600000) },
    });
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Olá! Vou verificar o problema agora.', sentAt: new Date(Date.now() - 3300000) },
    });

    const audit = await auditarTicket(ticket.id, false);

    expect(audit.status).toBe('ANALISADO');
    expect(audit.notaGeral).toBeGreaterThanOrEqual(0);
    expect(audit.notaGeral).toBeLessThanOrEqual(100);
    expect(audit.notaComunicacao).toBeGreaterThanOrEqual(0);
    expect(audit.notaSeguranca).toBeGreaterThanOrEqual(0);
    expect(audit.classificacao).toBeTruthy();
    expect(audit.modeloUsado).toBe('fallback-local');
    expect(audit.contactName).toBe('Cliente Auditoria');
    expect(audit.agenteId).toBe(agenteId);
  });

  it('getAuditoriaByTicket retorna a auditoria mais recente do ticket', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Consulta',
        contactPhone: '85999998821',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
      },
    });
    ticketsIds.push(ticket.id);

    await auditarTicket(ticket.id, false);
    const busca = await getAuditoriaByTicket(ticket.id);

    expect(busca).not.toBeNull();
    expect(busca!.ticketId).toBe(ticket.id);
  });

  it('getAuditoriaById retorna null para id inexistente', async () => {
    const a = await getAuditoriaById('id-inexistente-audp');
    expect(a).toBeNull();
  });

  it('listarAuditorias filtra por status ANALISADO', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp3-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Lista',
        contactPhone: '85999998822',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await auditarTicket(ticket.id, false);

    const res = await listarAuditorias({ status: 'ANALISADO' });
    expect(res.items.some((i: any) => i.ticketId === ticket.id)).toBe(true);
  });

  it('revisarAuditoria registra revisão humana CONFIRMADO', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp4-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Revisão',
        contactPhone: '85999998823',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    const audit = await auditarTicket(ticket.id, false);

    const revisado = await revisarAuditoria(audit.id, 'CONFIRMADO', 'Auditoria correta', agenteId);

    expect(revisado.revisaoStatus).toBe('CONFIRMADO');
    expect(revisado.revisaoJustificativa).toBe('Auditoria correta');
    expect(revisado.revisadoPorId).toBe(agenteId);
    expect(revisado.revisadoEm).toBeInstanceOf(Date);
  });

  it('revisarAuditoria com DISCORDO exige justificativa', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp5-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Discord',
        contactPhone: '85999998824',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    const audit = await auditarTicket(ticket.id, false);

    const revisado = await revisarAuditoria(audit.id, 'DISCORDO', 'Nota muito alta para este atendimento', agenteId);

    expect(revisado.revisaoStatus).toBe('DISCORDO');
    expect(revisado.revisaoJustificativa).toBe('Nota muito alta para este atendimento');
  });
});

describe('Auditoria Agregação + Decisão (FASE B/C)', () => {
  it('gera panorama com indicadores e alertas', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp6-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Panorama',
        contactPhone: '85999998825',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await auditarTicket(ticket.id, false);

    const panorama = await getPanoramaAuditoria({});

    expect(panorama).not.toBeNull();
    expect(panorama.indicadores).toBeDefined();
    expect(panorama.indicadores.totalAuditadas).toBeGreaterThanOrEqual(1);
    expect(panorama.indicadores.notaGeralMedia).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(panorama.alertasGerenciais)).toBe(true);
  });

  it('gera tomada de decisão com saúde do atendimento', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp7-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Decisão',
        contactPhone: '85999998826',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await auditarTicket(ticket.id, false);

    const decisao = await gerarTomadaDecisao({});

    expect(decisao.saudeAtendimento).toBeDefined();
    expect(['BOA', 'ATENCAO', 'CRITICA']).toContain(decisao.saudeAtendimento);
    expect(Array.isArray(decisao.recomendacoes)).toBe(true);
    expect(Array.isArray(decisao.planoAcao)).toBe(true);
    expect(decisao.notaGeralMedia).toBeGreaterThanOrEqual(0);
  });

  it('getFilaAuditoria retorna itens da fila', async () => {
    const fila = await getFilaAuditoria({});
    expect(Array.isArray(fila)).toBe(true);
  });
});

describe('Auditoria Relatório (FASE D)', () => {
  it('gera relatório interno do ticket', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `audp8-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Relatório',
        contactPhone: '85999998827',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    const audit = await auditarTicket(ticket.id, false);

    const rel = await gerarRelatorioTicket(audit.id, 'INTERNO');

    expect(rel).not.toBeNull();
    expect(rel.tipo).toBe('INTERNO');
    expect(rel.confidencial).toBe(true);
    expect(rel.auditoria).toBeDefined();
    expect(rel.auditoria!.notaGeral).toBeGreaterThanOrEqual(0);
  });

  it('exportarAuditoriaCsv gera CSV com cabeçalho', () => {
    const items = [{
      protocolo: 'P1',
      contactName: 'Cliente CSV',
      agenteId: null,
      notaGeral: 80,
      classificacao: 'MUITO_BOM',
      status: 'ANALISADO',
      auditadoEm: new Date(),
    }] as any;
    const csv = exportarAuditoriaCsv(items);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain('Protocolo');
  });
});