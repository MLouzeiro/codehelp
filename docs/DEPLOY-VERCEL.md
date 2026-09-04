# Deploy na Vercel

## Arquitetura de Deploy

```
GitHub → Vercel (Frontend + Backend serverless)
              ↓
         Neon PostgreSQL (banco web)
```

## Configuração

### vercel.json

- **Frontend**: Build estático (Vite) → `frontend/dist`
- **Backend**: Serverless function → `api/index.ts`
- **Rotas**: `/api/*` → backend, `/*` → frontend

### api/index.ts

Wrapper que conecta o Express ao runtime serverless da Vercel:
- Conecta Prisma na primeira requisição
- Reutiliza conexão entre invocações (warm start)
- Body parser desabilitado (Express gerencia)

## Variáveis de Ambiente no Vercel

Configurar no dashboard do Vercel → Settings → Environment Variables:

### Production

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `JWT_SECRET` | Gerar com `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Gerar com `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `APP_URL` | `https://dominio.vercel.app` |
| `API_URL` | `https://dominio.vercel.app` |
| `CORS_ORIGINS` | `https://dominio.vercel.app` |

### Preview (PRs)

Mesmos valores de Production, exceto:
- `APP_URL` → URL do preview automático
- `CORS_ORIGINS` → incluir URL do preview

## Passos para Deploy

1. Conectar repositório GitHub ao Vercel
2. Configurar variáveis de ambiente
3. Configurar build command: `npm install && npm run build:prisma && npm run build:frontend`
4. Configurar output directory: `frontend/dist`
5. Push para `main` → deploy automático

## Limitações

- **WebSocket**: Vercel não suporta WebSocket nativamente (Baileys precisa de Fly.io ou outro servidor)
- **Cron jobs**: Vercel cron tem limites (1/min no free tier)
- **Arquivos**: Storage local não persiste (usar S3/R2 para uploads)
- **Puppeteer**: Não funciona em serverless (usar Cloud API ou Evolution)

## Alternativa: Fly.io (Backend)

Se o backend precisar de WebSocket (WhatsApp Baileys):

```bash
fly deploy --app codehelp-backend
```

- Região: `gru` (São Paulo)
- RAM: 256MB (free tier)
- Storage: Volume persistente para sessões WhatsApp
