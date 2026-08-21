import prisma from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';

// ── API Pública de Integração — Leitura/Dados do Helpdesk ──────────────
// Camada genérica para que um sistema externo (ex.: CRM) consuma dados do
// Helpdesk com paginação, filtros e ordenação. NUNCA expõe credenciais,
// senhas, sessionToken ou dados internos de auditoria.

export interface Paginacao {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function parsePaginacao(query: any): { page: number; limit: number; skip: number } {
  const page = Math.max(parseInt(String(query?.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query?.limit || '50'), 10) || 50, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function asDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Clientes / Empresas ─────────────────────────────────────────────────

export async function listarClientes(query: any) {
  const { page, limit, skip } = parsePaginacao(query);
  const where: any = {
    ...(query.search ? { OR: [{ razaoSocial: { contains: String(query.search), mode: 'insensitive' } }, { nomeFantasia: { contains: String(query.search), mode: 'insensitive' } }, { cnpjCpf: { contains: String(query.search) } }] } : {}),
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.segmento ? { segmento: String(query.segmento) } : {}),
    ...(query.estado ? { estado: String(query.estado) } : {}),
    ...(query.cidade ? { cidade: { contains: String(query.cidade), mode: 'insensitive' } } : {}),
    ...(query.cnpj ? { cnpjCpf: { contains: String(query.cnpj) } } : {}),
    ...(query.ativo === 'false' ? { ativo: false } : query.ativo ? { ativo: true } : {}),
  };
  const orderBy: any = query.ordem === 'nome'
    ? { razaoSocial: (query.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' }
    : { createdAt: (query.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' };

  const [total, rows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        colaboradores: {
          where: { ativo: true },
          select: { id: true, nome: true, cargo: true, setor: true, email: true, telefone: true, whatsapp: true, principal: true },
        },
      },
    }),
  ]);

  return { data: rows, paginacao: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function detalharCliente(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      colaboradores: {
        where: { ativo: true },
        select: { id: true, nome: true, cargo: true, setor: true, email: true, telefone: true, whatsapp: true, principal: true },
      },
      ativos: {
        where: { ativo: true },
        select: { id: true, nome: true, tipo: true, serial: true, descricao: true },
      },
    },
  });
  if (!client) throw new AppError('Cliente não encontrado', 404);
  return client;
}

export async function listarEmpresas(query: any) {
  // Empresas = clientes com CNPJ/CPF (a entidade "empresa" do CRM mapeia para Client).
  const base = await listarClientes(query);
  return { ...base, data: base.data.filter(c => c.cnpjCpf) };
}

export async function listarContratos(query: any) {
  const { page, limit, skip } = parsePaginacao(query);
  const where: any = {
    ...(query.ativo === 'false' ? { ativo: false } : query.ativo ? { ativo: true } : {}),
    ...(query.tipoContrato ? { tipoContrato: String(query.tipoContrato) } : {}),
    ...(query.inicioDe ? { dataInicioContrato: { gte: asDate(String(query.inicioDe)) } } : {}),
    ...(query.inicioAte ? { dataInicioContrato: { lte: asDate(String(query.inicioAte)) } } : {}),
    ...(query.fimDe ? { dataFimContrato: { gte: asDate(String(query.fimDe)) } } : {}),
    ...(query.fimAte ? { dataFimContrato: { lte: asDate(String(query.fimAte)) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpjCpf: true, segmento: true,
        tipoContrato: true, valorMensalidade: true, diaVencimento: true,
        dataInicioContrato: true, dataFimContrato: true, status: true, responsavelTecnico: { select: { id: true, name: true } },
      },
      orderBy: { dataFimContrato: 'asc' },
    }),
  ]);
  return { data: rows, paginacao: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ── Tickets ─────────────────────────────────────────────────────────────

export async function listarTickets(query: any) {
  const { page, limit, skip } = parsePaginacao(query);
  const where: any = {
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.etapa ? { etapa: String(query.etapa) } : {}),
    ...(query.categoria ? { categoria: String(query.categoria) } : {}),
    ...(query.canal ? { canal: String(query.canal) } : {}),
    ...(query.prioridade ? { prioridade: String(query.prioridade) } : {}),
    ...(query.clienteId ? { clientId: String(query.clienteId) } : {}),
    ...(query.telefone ? { contactPhone: { contains: String(query.telefone) } } : {}),
    ...(query.de ? { createdAt: { gte: asDate(String(query.de)) } } : {}),
    ...(query.ate ? { createdAt: { lte: asDate(String(query.ate)) } } : {}),
  };
  if (query.de && query.ate) where.createdAt = { gte: asDate(String(query.de)), lte: asDate(String(query.ate)) };

  const orderBy: any = { createdAt: (query.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' };
  const [total, rows] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, protocolo: true, externalId: true, contactName: true, contactPhone: true,
        assunto: true, categoria: true, status: true, etapa: true, prioridade: true,
        canal: true, dataAbertura: true, dataFechamento: true, dataPrimeiraResposta: true,
        slaTotalMinutos: true, satisfacao: true, createdAt: true, updatedAt: true,
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjCpf: true } },
        assignee: { select: { id: true, name: true } },
        departamento: { select: { id: true, nome: true } },
      },
    }),
  ]);
  return { data: rows, paginacao: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function detalharTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjCpf: true, telefone: true, email: true } },
      assignee: { select: { id: true, name: true } },
      departamento: { select: { id: true, nome: true } },
      fila: { select: { id: true, nome: true } },
      metrics: true,
      messages: { orderBy: { sentAt: 'asc' }, take: 100, select: { id: true, fromMe: true, content: true, sentAt: true, tipo: true } },
      csatResposta: { select: { nota: true, respondidoEm: true } },
    },
  });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  return ticket;
}

// ── Analistas ───────────────────────────────────────────────────────────

export async function listarAgentes(query: any) {
  const { page, limit, skip } = parsePaginacao(query);
  const where: any = {
    active: query.ativo === 'false' ? false : true,
    ...(query.role ? { role: String(query.role) } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: { id: true, name: true, email: true, role: true, phone: true, active: true, online: true, lastSeenAt: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { data: rows, paginacao: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ── Escrita (escopo read-write) ─────────────────────────────────────────

export async function atualizarStatusTicket(id: string, body: any) {
  const { status, etapa, motivoStatus, assigneeId } = body || {};
  if (!status && !etapa && !motivoStatus && !assigneeId) {
    throw new AppError('Informe ao menos um campo: status, etapa, motivoStatus ou assigneeId', 400);
  }
  if (status && !['aberto', 'em_andamento', 'pendente', 'escalonado', 'fechado', 'cancelado', 'resolvido'].includes(status)) {
    throw new AppError('Status inválido', 422);
  }
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  return prisma.ticket.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(etapa ? { etapa } : {}),
      ...(motivoStatus !== undefined ? { motivoStatus: motivoStatus || null } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(status === 'fechado' ? { dataFechamento: new Date() } : {}),
    },
    select: { id: true, protocolo: true, status: true, etapa: true, motivoStatus: true, dataFechamento: true, updatedAt: true },
  });
}

export async function atualizarCliente(id: string, body: any) {
  const ticket = await prisma.client.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Cliente não encontrado', 404);
  const camposPermitidos = ['razaoSocial', 'nomeFantasia', 'cnpjCpf', 'segmento', 'telefone', 'email', 'cidade', 'estado', 'status', 'tipoContrato', 'responsavelTecnicoId'];
  const data: any = {};
  for (const campo of camposPermitidos) {
    if (body[campo] !== undefined) data[campo] = body[campo];
  }
  if (Object.keys(data).length === 0) throw new AppError('Nenhum campo válido informado', 400);
  return prisma.client.update({ where: { id }, data });
}