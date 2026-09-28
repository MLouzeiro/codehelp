import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getDesempenhoAnalistas, compararAnalistas, parseFiltrosDesempenho } from './desempenhoAnalista.service';

// ── GET /helpdesk/desempenho ──────────────────────────────────────────

export const getDesempenhoHandler = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltrosDesempenho(req.query as Record<string, unknown>);
    const resultado = await getDesempenhoAnalistas(filtros);
    res.json(resultado);
  } catch (err: any) {
    console.error('[DesempenhoAnalistas] Erro:', err?.message);
    res.status(500).json({ error: err?.message || 'Erro ao calcular desempenho dos analistas' });
  }
};

// ── GET /helpdesk/desempenho/comparar?ids=a,b,c ───────────────────────

export const compararAnalistasHandler = async (req: AuthRequest, res: Response) => {
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) {
      return res.status(400).json({ error: 'Parâmetro "ids" é obrigatório (separado por vírgula)' });
    }
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length < 2) {
      return res.status(400).json({ error: 'Informe pelo menos 2 IDs de analistas para comparar' });
    }
    const filtros = parseFiltrosDesempenho(req.query as Record<string, unknown>);
    const resultado = await compararAnalistas(ids, filtros);
    res.json(resultado);
  } catch (err: any) {
    console.error('[DesempenhoAnalistas] Erro ao comparar:', err?.message);
    res.status(500).json({ error: err?.message || 'Erro ao comparar analistas' });
  }
};
