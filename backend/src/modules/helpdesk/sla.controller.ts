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
import { escalarTicket, marcarResolvido } from './status.service';
import { getIpFromRequest } from '../audit/audit.service';
import { validarClassificacaoObrigatoria } from './categorias.service';

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

export async function postEscalarTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { filaId, motivo } = req.body;
    if (!filaId || !motivo) return res.status(400).json({ error: 'filaId e motivo sao obrigatorios' });
    const result = await escalarTicket(id, filaId, motivo, req.user?.id, getIpFromRequest(req));
    return res.json(result);
  } catch (error: any) {
    console.error('Erro ao escalar ticket:', error);
    const msg = error?.message || 'Erro ao escalar ticket';
    if (msg.includes('nao encontrado') || msg.includes('N1')) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: 'Erro ao escalar ticket' });
  }
}

export async function postResolverTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { resumoFinal } = req.body;
    if (!resumoFinal || resumoFinal.trim().length < 5) {
      return res.status(400).json({ error: 'resumoFinal e obrigatorio (min 5 caracteres)' });
    }
    if (req.user?.role !== 'admin') {
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (ticket) {
        try {
          await validarClassificacaoObrigatoria(ticket);
        } catch (e: any) {
          if (e?.message?.includes('CLASSIFICACAO_OBRIGATORIA')) {
            return res.status(400).json({ error: e.message.replace('CLASSIFICACAO_OBRIGATORIA: ', '') });
          }
          throw e;
        }
      }
    }
    const updated = await marcarResolvido(id, resumoFinal, req.user?.id, getIpFromRequest(req));
    return res.json(updated);
  } catch (error: any) {
    console.error('Erro ao resolver ticket:', error);
    if (error?.message?.includes('nao encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro ao resolver ticket' });
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
