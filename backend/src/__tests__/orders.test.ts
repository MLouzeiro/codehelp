import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../config/database';
import { registrarStatusEvent, listOrderTimeline, getOrdersDashboard, exportOrdersCsv } from '../modules/orders/orders.service';

let clientId = '';
let tecnicoId = '';
let orderId = '';
let order2Id = '';

const random = Math.random().toString(36).slice(2, 8);

beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  const tecnico = await prisma.user.findFirst({ where: { role: 'tecnico' } });
  if (!admin || !tecnico) throw new Error('Need admin and tecnico users in DB');
  tecnicoId = tecnico.id;

  const client = await prisma.client.create({
    data: { razaoSocial: `OS Test ${random}`, cnpjCpf: `${random}0000000001` },
  });
  clientId = client.id;
});

afterAll(async () => {
  if (orderId) {
    await prisma.serviceOrderStatusEvent.deleteMany({ where: { orderId } });
    await prisma.signature.deleteMany({ where: { orderId } });
    await prisma.serviceOrder.deleteMany({ where: { id: orderId } });
  }
  if (order2Id) {
    await prisma.serviceOrderStatusEvent.deleteMany({ where: { orderId: order2Id } });
    await prisma.serviceOrder.deleteMany({ where: { id: order2Id } });
  }
  if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
});

describe('Orders - CRUD via Prisma', () => {
  it('cria uma OS com campos básicos', async () => {
    const order = await prisma.serviceOrder.create({
      data: {
        numeroOs: `OS-TEST-${random}`,
        clientId,
        tipoServico: 'suporte',
        descricaoServico: 'Suporte técnico',
        tecnicoResponsavelId: tecnicoId,
        valorServico: 150,
        criadoPorId: tecnicoId,
        status: 'rascunho',
      },
      include: { client: true },
    });
    expect(order.id).toBeTruthy();
    expect(order.numeroOs).toBe(`OS-TEST-${random}`);
    expect(order.status).toBe('rascunho');
    expect(order.client.razaoSocial).toBe(`OS Test ${random}`);
    orderId = order.id;
  });

  it('cria uma OS com campos de implantação', async () => {
    const order = await prisma.serviceOrder.create({
      data: {
        numeroOs: `OS-IMP-${random}`,
        clientId,
        tipoServico: 'implantacao',
        tecnicoResponsavelId: tecnicoId,
        criadoPorId: tecnicoId,
        status: 'rascunho',
        tipoImplantacao: 'customizada',
        precoImplantacao: 5000,
        horasDev: 40,
        horasSuporte: 20,
      },
    });
    expect(order.tipoImplantacao).toBe('customizada');
    expect(order.precoImplantacao).toBe(5000);
    expect(order.horasDev).toBe(40);
    expect(order.horasSuporte).toBe(20);
    order2Id = order.id;
  });

  it('atualiza uma OS', async () => {
    const updated = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { descricaoServico: 'Suporte remoto atualizado', equipamentos: 'Desktop Dell' },
    });
    expect(updated.descricaoServico).toBe('Suporte remoto atualizado');
    expect(updated.equipamentos).toBe('Desktop Dell');
  });

  it('lista OS', async () => {
    const orders = await prisma.serviceOrder.findMany({
      where: { clientId },
      include: { client: true, tecnicoResponsavel: { select: { name: true } } },
    });
    expect(orders.length).toBeGreaterThanOrEqual(2);
  });

  it('detalha uma OS com relaciones', async () => {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { client: true, tecnicoResponsavel: { select: { name: true } }, signature: true },
    });
    expect(order).toBeTruthy();
    expect(order!.client).toBeDefined();
    expect(order!.tecnicoResponsavel).toBeDefined();
  });
});

describe('Orders - Status Events', () => {
  it('registra evento de status', async () => {
    await registrarStatusEvent({
      orderId,
      statusNovo: 'em_execucao',
      statusAnterior: 'rascunho',
      usuarioId: tecnicoId,
      origem: 'manual',
      observacao: 'Iniciando execução',
    });
    const events = await prisma.serviceOrderStatusEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1].statusNovo).toBe('em_execucao');
  });

  it('listOrderTimeline retorna eventos', async () => {
    const timeline = await listOrderTimeline(orderId);
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    expect(timeline[0].statusLabel).toBeTruthy();
  });
});

describe('Orders - Dashboard', () => {
  it('getOrdersDashboard retorna dados', async () => {
    const dashboard = await getOrdersDashboard();
    expect(dashboard.total).toBeGreaterThanOrEqual(1);
    expect(dashboard.porStatus).toBeDefined();
    expect(dashboard.porTipo).toBeDefined();
    expect(dashboard.porTecnico).toBeDefined();
  });
});

describe('Orders - CSV Export', () => {
  it('exportOrdersCsv gera CSV válido', async () => {
    const orders = await prisma.serviceOrder.findMany({
      where: { clientId },
      include: { client: true, tecnicoResponsavel: { select: { name: true } } },
      take: 10,
    });
    const csv = exportOrdersCsv(orders);
    expect(csv).toContain('Numero');
    expect(csv).toContain(`OS-TEST-${random}`);
  });
});

describe('Orders - Validações', () => {
  it('rejeita OS com numeroOs duplicado', async () => {
    await expect(
      prisma.serviceOrder.create({
        data: {
          numeroOs: `OS-TEST-${random}`,
          clientId,
          tipoServico: 'suporte',
          tecnicoResponsavelId: tecnicoId,
          criadoPorId: tecnicoId,
        },
      })
    ).rejects.toThrow();
  });

  it('deleta uma OS', async () => {
    const temp = await prisma.serviceOrder.create({
      data: {
        numeroOs: `OS-DEL-${random}`,
        clientId,
        tipoServico: 'manutencao',
        tecnicoResponsavelId: tecnicoId,
        criadoPorId: tecnicoId,
      },
    });
    await prisma.serviceOrder.delete({ where: { id: temp.id } });
    const found = await prisma.serviceOrder.findUnique({ where: { id: temp.id } });
    expect(found).toBeNull();
  });
});
