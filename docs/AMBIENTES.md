# Ambientes

## Visão Geral

| Componente | Local | Web |
|------------|-------|-----|
| **Frontend** | localhost:5173 (Vite) | Vercel (estático) |
| **Backend** | localhost:3010 (tsx watch) | Vercel (serverless) ou Fly.io |
| **Banco** | Docker `evolution-db`:5434 | Neon PostgreSQL |
| **Redis** | Docker `evolution-redis`:6379 | Não utilizado |
| **WhatsApp** | Evolution API Docker | Cloud API ou Evolution remoto |

## Variáveis de Ambiente

### Local (`backend/.env`)

```
DATABASE_URL=postgresql://evolution:***@127.0.0.1:5434/codemed_hub?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_jwt_secret_codemed_2024
JWT_REFRESH_SECRET=dev_refresh_secret_codemed_2024
APP_URL=http://localhost:3000
API_URL=http://localhost:3010
PORT=3010
NODE_ENV=development
```

### Web (`backend/.env.web` — NÃO commitar)

```
DATABASE_URL=postgresql://neondb_owner:***@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:***@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=<gerar>
JWT_REFRESH_SECRET=<gerar>
APP_URL=https://<dominio>.vercel.app
API_URL=https://<dominio>.vercel.app
NODE_ENV=production
```

## Como Rodar

### Local

```bash
# Instalar dependências
npm install

# Iniciar banco
docker-compose up -d postgres redis

# Push do schema
npm run db:push

# Seed
npm run db:seed

# Rodar
npm run dev
```

### Web (após configurar Vercel)

```bash
# Push do schema no Neon
DATABASE_URL="<neon_url>" npx prisma db push

# Deploy via Git push (Vercel CI/CD)
git push origin main
```

## Comandos Úteis

```bash
# Banco local
npm run db:push          # Schema sync
npm run db:seed          # Dados iniciais
npm run db:studio        # GUI do banco

# Typecheck
npx tsc --noEmit         # Backend
cd frontend && npx tsc --noEmit  # Frontend

# Testes
npm test                 # Backend
cd frontend && npm test  # Frontend
```
