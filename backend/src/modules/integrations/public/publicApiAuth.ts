import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../../config/env';

// ── API Key Auth (API pública de integração) ────────────────────────────
// Autenticação via header `x-api-key` (ou query `api_key`) com comparação
// timing-safe contra as chaves configuradas em INTEGRATION_API_KEYS.
// NÃO é o mesmo mecanismo do JWT do app web — é uma credencial de máquina
// para o CRM externo consumir a API do Helpdesk.

export interface ApiKeyMeta {
  keyPrefix: string;
  scope: 'read' | 'read-write';
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const headerKey = String(req.headers['x-api-key'] || '');
  const queryKey = String(req.query.api_key || '');
  const provided = headerKey || queryKey;

  if (!provided) {
    res.status(401).json({ error: 'Credencial ausente. Informe o header x-api-key.' });
    return;
  }

  if (!env.integrationApiKeys.length) {
    res.status(503).json({ error: 'API de integração não configurada (INTEGRATION_API_KEYS vazio).' });
    return;
  }

  const match = env.integrationApiKeys.find((k) => {
    const a = Buffer.from(String(k));
    const b = Buffer.from(provided);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });

  if (!match) {
    res.status(401).json({ error: 'Credencial inválida.' });
    return;
  }

  const scope: 'read' | 'read-write' = match.endsWith(':rw') ? 'read-write' : 'read';
  (req as any).apiKeyMeta = { keyPrefix: match.slice(0, 6) + '…', scope } as ApiKeyMeta;
  next();
}

export function requireWriteScope(req: Request, res: Response, next: NextFunction): void {
  const meta = (req as any).apiKeyMeta as ApiKeyMeta | undefined;
  if (!meta || meta.scope !== 'read-write') {
    res.status(403).json({ error: 'Esta chave tem permissão somente leitura.' });
    return;
  }
  next();
}