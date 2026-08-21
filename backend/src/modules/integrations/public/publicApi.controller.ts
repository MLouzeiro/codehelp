import { Request, Response } from 'express';
import {
  listarClientes, detalharCliente, listarEmpresas, listarContratos,
  listarTickets, detalharTicket, listarAgentes,
  atualizarStatusTicket, atualizarCliente,
} from './publicApi.service';
import { isAppError } from '../../../shared/errors/AppError';

// ── API Pública de Integração — Controllers ────────────────────────────
// Tratamento de erros padronizado + log de auditoria para escrita.

function erro(res: Response, err: unknown) {
  if (isAppError(err)) return res.status(err.statusCode).json({ error: err.message });
  console.error('[API Integração]', err);
  return res.status(500).json({ error: 'Erro interno na API de integração' });
}

export async function getClientes(req: Request, res: Response) {
  try { res.json(await listarClientes(req.query)); } catch (e) { erro(res, e); }
}

export async function getCliente(req: Request, res: Response) {
  try { res.json(await detalharCliente(req.params.id)); } catch (e) { erro(res, e); }
}

export async function getEmpresas(req: Request, res: Response) {
  try { res.json(await listarEmpresas(req.query)); } catch (e) { erro(res, e); }
}

export async function getContratos(req: Request, res: Response) {
  try { res.json(await listarContratos(req.query)); } catch (e) { erro(res, e); }
}

export async function getTickets(req: Request, res: Response) {
  try { res.json(await listarTickets(req.query)); } catch (e) { erro(res, e); }
}

export async function getTicket(req: Request, res: Response) {
  try { res.json(await detalharTicket(req.params.id)); } catch (e) { erro(res, e); }
}

export async function getAgentes(req: Request, res: Response) {
  try { res.json(await listarAgentes(req.query)); } catch (e) { erro(res, e); }
}

export async function patchTicketStatus(req: Request, res: Response) {
  try {
    const result = await atualizarStatusTicket(req.params.id, req.body);
    res.json(result);
  } catch (e) { erro(res, e); }
}

export async function patchCliente(req: Request, res: Response) {
  try {
    const result = await atualizarCliente(req.params.id, req.body);
    res.json(result);
  } catch (e) { erro(res, e); }
}