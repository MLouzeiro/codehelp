import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getSlaInfo,
  processarAlertasSLA,
  calcularSlaTotalMinutos,
  atribuirSlaAoTicket,
  SLA_DEFAULT_MINUTOS,
} from './sla.service';

export async function getTicketSla(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sla = await getSlaInfo(id);
    if (!sla) return res.status(404).json({ error: 'Ticket nao encontrado' });
    return res.json(sla);
  } catch (error) {
    console.error('Erro ao buscar SLA do ticket:', error);
    return res.status(500).json({ error: 'Erro ao buscar SLA' });
  }
}

export async function postProcessarAlertasSla(req: AuthRequest, res: Response) {
  try {
    const gerados = await processarAlertasSLA();
    return res.json({ total: gerados.length, alertas: gerados });
  } catch (error) {
    console.error('Erro ao processar alertas SLA:', error);
    return res.status(500).json({ error: 'Erro ao processar alertas' });
  }
}

export async function postAtribuirSla(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const minutos = await atribuirSlaAoTicket(id);
    return res.json({ ticketId: id, slaTotalMinutos: minutos });
  } catch (error) {
    console.error('Erro ao atribuir SLA:', error);
    return res.status(500).json({ error: 'Erro ao atribuir SLA' });
  }
}

export async function getFilas(req: AuthRequest, res: Response) {
  try {
    const filas = await prisma.fila.findMany({ orderBy: { ordem: 'asc' } });
    return res.json(filas);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar filas' });
  }
}

export async function getSlaConfigs(req: AuthRequest, res: Response) {
  try {
    const configs = await prisma.sLAConfig.findMany({ orderBy: { slaMinutosResolucao: 'asc' } });
    return res.json(configs);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar SLAConfigs' });
  }
}

export async function getCategorias(req: AuthRequest, res: Response) {
  try {
    const cats = await prisma.categoria.findMany({ orderBy: { ordem: 'asc' } });
    return res.json(cats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar categorias' });
  }
}
