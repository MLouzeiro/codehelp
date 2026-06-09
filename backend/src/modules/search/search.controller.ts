import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { globalSearch, getSearchSuggestions } from './search.service';

export async function searchHandler(req: AuthRequest, res: Response) {
  try {
    const { q, tipo, limit } = req.query;
    const results = await globalSearch({
      q: q as string,
      tipo: tipo as any,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json({ results, total: results.length });
  } catch (err: any) {
    console.error('[Search] Erro:', err?.message);
    res.status(500).json({ error: 'Erro ao buscar' });
  }
}

export async function suggestionsHandler(req: AuthRequest, res: Response) {
  try {
    const { q } = req.query;
    const suggestions = await getSearchSuggestions(q as string);
    res.json({ suggestions });
  } catch (err: any) {
    console.error('[Search] Erro suggestions:', err?.message);
    res.json({ suggestions: [] });
  }
}
