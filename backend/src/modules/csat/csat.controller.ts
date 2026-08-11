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

export async function getCsatPorAgente(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const where: any = {
      respondidoEm: { not: null },
    };
    if (dataInicio && dataFim) {
      where.respondidoEm = { gte: new Date(dataInicio as string), lte: new Date(dataFim as string) };
    }

    const respostas = await (await import('../../config/database')).default.cSATResposta.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true, protocolo: true, assigneeId: true,
            assignee: { select: { id: true, name: true } },
            contactName: true,
          },
        },
      },
      orderBy: { respondidoEm: 'desc' },
    });

    const porAgente: Record<string, { nome: string; total: number; somaNotas: number; notas: number[]; respostas: any[] }> = {};

    for (const r of respostas) {
      const agenteId = r.ticket.assigneeId || 'sem_agente';
      const agenteNome = r.ticket.assignee?.name || 'Sem atendente';
      if (!porAgente[agenteId]) {
        porAgente[agenteId] = { nome: agenteNome, total: 0, somaNotas: 0, notas: [], respostas: [] };
      }
      porAgente[agenteId].total++;
      porAgente[agenteId].somaNotas += r.nota || 0;
      if (r.nota) porAgente[agenteId].notas.push(r.nota);
      porAgente[agenteId].respostas.push({
        ticketId: r.ticketId,
        protocolo: r.ticket.protocolo,
        contactName: r.ticket.contactName,
        nota: r.nota,
        comentario: r.comentario,
        respondidoEm: r.respondidoEm,
      });
    }

    const resultado = Object.entries(porAgente).map(([id, d]) => ({
      agenteId: id,
      agenteNome: d.nome,
      totalRespostas: d.total,
      mediaNotas: d.total > 0 ? Math.round((d.somaNotas / d.total) * 10) / 10 : 0,
      distribuicao: [1, 2, 3, 4, 5].map(n => d.notas.filter(x => x === n).length),
      ultimasRespostas: d.respostas.slice(0, 10),
    }));

    return res.json(resultado.sort((a, b) => b.mediaNotas - a.mediaNotas));
  } catch (error) {
    console.error('Erro ao buscar CSAT por agente:', error);
    return res.status(500).json({ error: 'Erro ao buscar CSAT por agente' });
  }
}
