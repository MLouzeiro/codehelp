import { Request, Response } from 'express';
import prisma from '../../config/database';
import { gerarRelatorioAnalista, gerarResumoTodosAnalistas, getReplayConversa } from './agentReport.service';

export async function getResumoTodosAnalistas(req: Request, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const resumo = await gerarResumoTodosAnalistas(
      dataInicio as string | undefined,
      dataFim as string | undefined
    );
    return res.json(resumo);
  } catch (error) {
    console.error('Erro no resumo de todos os analistas:', error);
    return res.status(500).json({ error: 'Erro ao gerar resumo de analistas' });
  }
}

export async function getRelatorioAnalista(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim } = req.query;
    const relatorio = await gerarRelatorioAnalista(
      id as string,
      dataInicio as string | undefined,
      dataFim as string | undefined
    );
    if (!relatorio) {
      return res.status(404).json({ error: 'Analista não encontrado' });
    }
    return res.json(relatorio);
  } catch (error) {
    console.error('Erro no relatório do analista:', error);
    return res.status(500).json({ error: 'Erro ao gerar relatório do analista' });
  }
}

export async function getReplayAnalista(req: Request, res: Response) {
  try {
    const { id, ticketId } = req.params;
    const agente = await prisma.user.findUnique({
      where: { id: id as string },
      select: { id: true, name: true },
    });
    if (!agente) {
      return res.status(404).json({ error: 'Analista não encontrado' });
    }
    const replay = await getReplayConversa(ticketId as string);
    if (!replay) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    return res.json(replay);
  } catch (error) {
    console.error('Erro no replay do analista:', error);
    return res.status(500).json({ error: 'Erro ao carregar replay da conversa' });
  }
}