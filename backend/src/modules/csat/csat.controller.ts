import { Response, Request } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  agendarCsat,
  enviarMensagemCsat,
  responderCsat,
  processarAgendamentosCsat,
  getEstatisticasCsat,
} from './csat.service';

export async function postAgendarCsat(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const r = await agendarCsat(ticketId);
    if (!r.criado) {
      return res.status(200).json({ criado: false, csat: r.csat, mensagem: 'CSAT ja agendado ou ticket nao elegivel' });
    }
    return res.status(201).json({ criado: true, csat: r.csat });
  } catch (error: any) {
    console.error('Erro ao agendar CSAT:', error);
    return res.status(500).json({ error: error?.message || 'Erro ao agendar CSAT' });
  }
}

export async function postEnviarCsat(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const csat = await (await import('./csat.service')).agendarCsat(ticketId);
    if (!csat.csat) {
      return res.status(400).json({ error: 'Nao foi possivel agendar CSAT' });
    }
    const r = await enviarMensagemCsat(csat.csat.id);
    return res.json(r);
  } catch (error) {
    console.error('Erro ao enviar CSAT:', error);
    return res.status(500).json({ error: 'Erro ao enviar CSAT' });
  }
}

export async function postResponderCsatPublic(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const { nota, comentario } = req.body;
    if (typeof nota !== 'number') {
      return res.status(400).json({ error: 'nota deve ser numero' });
    }
    const r = await responderCsat(token, { nota, comentario });
    return res.json({ success: true, nota: r.nota, respondidoEm: r.respondidoEm });
  } catch (error: any) {
    console.error('Erro ao responder CSAT:', error);
    const msg = error?.message || 'Erro ao responder';
    if (msg.includes('invalido') || msg.includes('ja respondido')) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: 'Erro ao responder CSAT' });
  }
}

export async function getEstatisticasCsatRoute(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const stats = await getEstatisticasCsat(
      dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim ? new Date(dataFim as string) : undefined
    );
    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatisticas CSAT:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatisticas' });
  }
}

export async function postProcessarCsat(req: AuthRequest, res: Response) {
  try {
    const r = await processarAgendamentosCsat();
    return res.json(r);
  } catch (error) {
    console.error('Erro ao processar CSAT:', error);
    return res.status(500).json({ error: 'Erro ao processar CSAT' });
  }
}
