import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  gerarRelatorioSemanal,
  enviarRelatorioSemanalWhatsApp,
  formatarMensagemWhatsApp,
} from './weeklyReport.service';

export async function getRelatorioSemanal(req: AuthRequest, res: Response) {
  try {
    const { inicio, fim } = req.query;
    const dataInicio = inicio ? new Date(inicio as string) : undefined;
    const dataFim = fim ? new Date(fim as string) : undefined;

    const report = await gerarRelatorioSemanal(dataInicio, dataFim);
    res.json(report);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao gerar relatório' });
  }
}

export async function getRelatorioSemanalMensagem(req: AuthRequest, res: Response) {
  try {
    const { inicio, fim } = req.query;
    const dataInicio = inicio ? new Date(inicio as string) : undefined;
    const dataFim = fim ? new Date(fim as string) : undefined;

    const report = await gerarRelatorioSemanal(dataInicio, dataFim);
    const mensagem = formatarMensagemWhatsApp(report);
    res.json({ mensagem, report });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao gerar mensagem' });
  }
}

export async function postEnviarRelatorio(_req: AuthRequest, res: Response) {
  try {
    const resultado = await enviarRelatorioSemanalWhatsApp();
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao enviar relatório' });
  }
}
