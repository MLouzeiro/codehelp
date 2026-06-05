import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  stageEventCreate: vi.fn(),
}));

vi.mock('../config/database', () => ({
  default: {
    ticket: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    ticketStageEvent: {
      create: mocks.stageEventCreate,
    },
  },
}));

import { Request, Response } from 'express';
import { descartarTicket } from '../modules/integrations/whatsapp/whatsapp.controller';
import { AuthRequest } from '../shared/middleware/auth';

function mockReqRes(user: any, params: any = {}) {
  const req = { params, user } as unknown as AuthRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

const tecnico = { id: 'user-1', email: 'tec@codemed.com.br', role: 'tecnico' } as any;

describe('WhatsApp Controller — descartar ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 401 quando nao autenticado', async () => {
    const { req, res } = mockReqRes(null, { id: 't-1' });
    await descartarTicket(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nao autenticado' });
  });

  it('retorna 404 quando ticket nao existe', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes(tecnico, { id: 't-1' });
    await descartarTicket(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ticket nao encontrado' });
  });

  it('retorna 409 quando ticket ja foi descartado', async () => {
    mocks.findUnique.mockResolvedValue({ id: 't-1', etapa: 'descartado' });
    const { req, res } = mockReqRes(tecnico, { id: 't-1' });
    await descartarTicket(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ticket ja foi descartado' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('move ticket para etapa descartado, status cancelado, dataConclusao agora, sem enviar msg', async () => {
    const ticketOriginal = { id: 't-1', etapa: 'fila', status: 'aberto' };
    const ticketAtualizado = {
      id: 't-1',
      etapa: 'descartado',
      status: 'cancelado',
      dataConclusao: new Date('2026-06-05T18:00:00Z'),
      usuarioId: 'user-1',
    };
    mocks.findUnique.mockResolvedValue(ticketOriginal);
    mocks.update.mockResolvedValue(ticketAtualizado);
    mocks.stageEventCreate.mockResolvedValue({});

    const { req, res } = mockReqRes(tecnico, { id: 't-1' });
    await descartarTicket(req, res);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const updateArg = mocks.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 't-1' });
    expect(updateArg.data.etapa).toBe('descartado');
    expect(updateArg.data.status).toBe('cancelado');
    expect(updateArg.data.dataConclusao).toBeInstanceOf(Date);
    expect(updateArg.data.usuarioId).toBe('user-1');

    expect(mocks.stageEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 't-1',
        etapaAnterior: 'fila',
        etapaNova: 'descartado',
        origem: 'manual',
        usuarioId: 'user-1',
      }),
    });

    expect(res.json).toHaveBeenCalledWith({
      ticket: ticketAtualizado,
      autoMessage: expect.objectContaining({ sent: false }),
    });
  });
});
