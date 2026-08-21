# Variáveis de Ambiente — CodeHelp

Guia completo de todas as variáveis de ambiente do sistema.

## Backend (Fly.io)

### Obrigatórias em Produção

| Variável | Descrição | Onde configurar |
|----------|-----------|-----------------|
| `DATABASE_URL` | String de conexão PostgreSQL | `fly secrets set` |
| `JWT_SECRET` | Chave secreta para access tokens (mín. 32 chars) | `fly secrets set` |
| `JWT_REFRESH_SECRET` | Chave secreta para refresh tokens (mín. 32 chars) | `fly secrets set` |
| `APP_URL` | URL completa do frontend (ex: `https://codehelp.vercel.app`) | `fly secrets set` |
| `API_URL` | URL completa do backend (ex: `https://codehelp-backend.fly.dev`) | `fly secrets set` |
| `CORS_ORIGINS` | URLs permitidas por CORS, separadas por vírgula | `fly secrets set` |
| `NODE_ENV` | `production` | `fly.toml` ou `fly secrets set` |

### Opcionais — WhatsApp

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `WHATSAPP_SESSION_PATH` | Caminho para sessões Baileys | `./whatsapp-session` |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Meta Cloud API — Phone Number ID | — |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Meta Cloud API — Access Token | — |
| `WHATSAPP_CLOUD_API_VERSION` | Versão da API | `v19.0` |
| `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN` | Token de verificação do webhook | — |
| `EVOLUTION_API_URL` | URL da Evolution API | — |
| `EVOLUTION_API_KEY` | Chave da Evolution API | — |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância | `codehelp` |

### Opcionais — IA

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (Claude) |

### Opcionais — Email

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SMTP_HOST` | Servidor SMTP | — |
| `SMTP_PORT` | Porta SMTP | `587` |
| `SMTP_USER` | Usuário SMTP | — |
| `SMTP_PASS` | Senha SMTP | — |

### Opcionais — Integrações

| Variável | Descrição |
|----------|-----------|
| `INTEGRATION_ENCRYPTION_KEY` | Chave para criptografia AES-256-GCM |
| `INTEGRATION_API_KEYS` | API keys para acesso público (separadas por vírgula; sufixo `:rw` = escrita) |
| `BACKEND_URL` | URL do backend para webhooks |

### Opcionais — Outros

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3010` |
| `REDIS_URL` | URL do Redis | `redis://localhost:6379` |
| `TIMEZONE` | Fuso horário | `America/Fortaleza` |
| `ALERT_WHATSAPP_NUMBERS` | Números para alertas (separados por vírgula) | — |
| `ALERT_DAY` | Dia do relatório semanal | `1` (segunda) |
| `ALERT_HOUR` | Hora do relatório | `8` |
| `BILLING_DIA_CORTE` | Dia de corte da cobrança | `25` |
| `FRONTEND_URL` | URL do frontend (fallback) | `http://localhost:5173` |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Token webhook Facebook | — |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Token webhook Instagram | — |

## Frontend (Vercel)

O frontend NÃO usa variáveis de ambiente em runtime. Toda configuração vem do backend via API.

No Vercel, configure apenas para referência:

| Variável | Descrição |
|----------|-----------|
| `BACKEND_URL` | URL do backend (para referência) |

## Como Configurar

### Fly.io (Backend)

```bash
# Variáveis sensíveis (secrets)
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="chave-forte-aqui"
fly secrets set JWT_REFRESH_SECRET="outra-chave-forte"
fly secrets set APP_URL="https://seu-app.vercel.app"
fly secrets set API_URL="https://codehelp-backend.fly.dev"
fly secrets set CORS_ORIGINS="https://seu-app.vercel.app"

# Verificar
fly secrets list
```

### Vercel (Frontend)

1. Acesse https://vercel.com
2. Selecione o projeto
3. Settings → Environment Variables
4. Adicione cada variável

## Segurança

- **NUNCA** coloque valores reais no `.env.example`
- **NUNCA** envie `.env` para o GitHub
- **NUNCA** compartilhe `JWT_SECRET` ou `JWT_REFRESH_SECRET`
- **NUNCA** exponha `ANTHROPIC_API_KEY`
- Use chaves diferentes para desenvolvimento e produção
- Rotacione chaves periodicamente

## Geração de Chaves

```bash
# Gerar chaves JWT seguras
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Gere DUAS chaves diferentes — uma para `JWT_SECRET` e outra para `JWT_REFRESH_SECRET`.
