import { Request, Response, NextFunction } from 'express';

// ── In-Memory Rate Limiter ─────────────────────────────────────────────
// Simples, sem dependencias externas. Para producao com multi-instance,
// migrar para Redis (ioredis).

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpar entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number;   // janela de tempo em ms
  max: number;         // maximo de requests por janela
  keyPrefix?: string;  // prefixo para a chave (default: 'rl')
  message?: string;    // mensagem de erro
}

export function rateLimiter(opts: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl', message = 'Muitas requisites. Tente novamente em alguns minutos.' } = opts;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || '';
    const key = `${keyPrefix}:${ip}:${userId}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
      return next();
    }

    entry.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}
