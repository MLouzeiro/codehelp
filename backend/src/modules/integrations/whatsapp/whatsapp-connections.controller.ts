import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as svc from './whatsapp-connections.service';

export async function listConnections(req: AuthRequest, res: Response) {
  try {
    const includeInativos = req.query.includeInativos === 'true';
    const connections = await svc.listConnections(includeInativos);
    return res.json(connections);
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao listar:', err?.message);
    return res.status(500).json({ error: 'Erro ao listar conexoes' });
  }
}

export async function getConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.getConnectionById(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar conexao' });
  }
}

export async function createConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.createConnection(req.body);
    return res.status(201).json(conn);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao criar conexao' });
  }
}

export async function updateConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.updateConnection(req.params.id, req.body);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar conexao' });
  }
}

export async function toggleConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.toggleConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao alternar conexao' });
  }
}
