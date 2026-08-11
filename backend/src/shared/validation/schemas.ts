import { z } from 'zod';

// ── Auth Schemas ─────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Email invalido').max(255),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres').max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatorio'),
  sessionToken: z.string().uuid().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio').max(255),
  email: z.string().email('Email invalido').max(255),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres').max(128),
  role: z.enum(['tecnico', 'comercial', 'gerente', 'admin']).optional().default('tecnico'),
  isMaster: z.boolean().optional().default(false),
  phone: z.string().max(20).optional(),
  departamentoIds: z.array(z.string().uuid()).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(6).max(128).optional(),
  role: z.enum(['tecnico', 'comercial', 'gerente', 'admin']).optional(),
  active: z.boolean().optional(),
  isMaster: z.boolean().optional(),
  phone: z.string().max(20).optional(),
  signature: z.string().max(255).optional(),
  departamentoIds: z.array(z.string().uuid()).optional(),
});

// ── CRM Schemas ──────────────────────────────────────────────────────

export const createClientSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatorio').max(255),
  email: z.string().email('Email invalido').max(255).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  empresa: z.string().max(255).optional().nullable(),
  cpfCnpj: z.string().max(20).optional().nullable(),
  endereco: z.string().max(500).optional().nullable(),
  observacoes: z.string().max(5000).optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial();

// ── WhatsApp Schemas ─────────────────────────────────────────────────

export const sendWhatsAppMessageSchema = z.object({
  to: z.string().min(10, 'Telefone invalido').max(15),
  message: z.string().min(1, 'Mensagem obrigatoria').max(4096),
  ticketId: z.string().uuid().optional(),
  whatsappConnectionId: z.string().uuid().optional(),
});

export const createWhatsAppConnectionSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatorio').max(100),
  numero: z.string().min(10, 'Telefone invalido').max(15),
  slug: z.string().min(1).max(100).optional(),
  departamentoId: z.string().uuid().optional(),
});

// ── Helpdesk Schemas ─────────────────────────────────────────────────

export const moveTicketSchema = z.object({
  targetStage: z.enum([
    'fila', 'triagem', 'boas_vindas', 'em_atendimento',
    'aguardando_cliente', 'aguardando_os', 'concluido',
    'descartado',
  ]),
  departamentoId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['pendente', 'aberto', 'em_atendimento', 'fechado', 'cancelado']).optional(),
  etapa: z.enum([
    'fila', 'triagem', 'em_atendimento',
    'aguardando_cliente', 'aguardando_os', 'concluido',
    'descartado', 'boas_vindas',
  ]).optional(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  departamentoId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  assunto: z.string().max(255).optional(),
  descricao: z.string().max(10000).optional(),
});

// ── Kanban Schemas ───────────────────────────────────────────────────

export const createKanbanTaskSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio').max(255),
  descricao: z.string().max(10000).optional(),
  columnId: z.string().uuid(),
  boardId: z.string().uuid(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).optional().default('media'),
  prazoEntrega: z.string().datetime().optional().nullable(),
  estimativaHoras: z.number().min(0).max(1000).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export const updateKanbanTaskSchema = createKanbanTaskSchema.partial().omit({ boardId: true });

// ── Orders Schemas ───────────────────────────────────────────────────

export const createOrderSchema = z.object({
  clienteId: z.string().uuid('Cliente invalido'),
  tecnicoId: z.string().uuid().optional(),
  descricao: z.string().min(1, 'Descricao obrigatoria').max(5000),
  tipo: z.string().max(100).optional(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).optional().default('media'),
  valor: z.number().min(0).optional(),
  prazoEntrega: z.string().datetime().optional().nullable(),
});

// ── AI Schemas ───────────────────────────────────────────────────────

export const aiTicketAnalysisSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(5000, 'Mensagem muito longa (max 5000 caracteres)'),
});

export const aiValidationSchema = z.object({
  ticketId: z.string().uuid(),
  response: z.string().min(1).max(5000, 'Resposta muito longa (max 5000 caracteres)'),
});

// ── Middleware de validacao ───────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Dados invalidos', details: errors });
    }
    req.body = result.data;
    next();
  };
}
