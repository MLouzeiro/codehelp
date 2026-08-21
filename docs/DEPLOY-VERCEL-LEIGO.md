# Como Publicar no Vercel — Guia para Leigos

## O que é o Vercel?

O Vercel é um serviço que coloc seu site online automaticamente. Toda vez que você envia uma alteração para o GitHub, o Vercel atualiza o site sozinho.

## Arquitetura do Sistema

```
Usuário
  ↓ acessa
Vercel (Frontend — site)
  ↓ chama API
Fly.io (Backend — servidor)
  ↓ consulta
PostgreSQL (banco de dados)
```

## Passo 1: Criar conta na Vercel

1. Acesse https://vercel.com
2. Clique "Sign Up"
3. Crie conta com o GitHub (mais fácil)

## Passo 2: Criar conta no Fly.io

1. Acesse https://fly.io
2. Clique "Sign Up"
3. Crie conta com o GitHub

## Passo 3: Instalar o Fly CLI

No terminal do seu computador:

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Mac/Linux
curl -L https://fly.io/install.sh | sh
```

## Passo 4: Criar conta no Fly.io

```bash
fly auth signup
```

Siga as instruções no terminal.

## Passo 5: Criar banco PostgreSQL (Neon)

1. Acesse https://neon.tech
2. Crie conta com GitHub
3. Crie um projeto
4. Copie a string de conexão (DATABASE_URL)

## Passo 6: Configurar o Backend no Fly.io

Na pasta do projeto:

```bash
# Entrar na pasta do backend
cd backend

# Login no Fly
fly auth login

# Criar aplicação
fly launch

# Configurar variáveis de ambiente
fly secrets set DATABASE_URL="sua-string-de-conexao"
fly secrets set JWT_SECRET="uma-chave-secreta-forte"
fly secrets set JWT_REFRESH_SECRET="outra-chave-secreta-forte"
fly secrets set APP_URL="https://seu-app.vercel.app"
fly secrets set API_URL="https://codehelp-backend.fly.dev"
fly secrets set NODE_ENV="production"

# Fazer deploy
fly deploy
```

## Passo 7: Configurar o Frontend no Vercel

1. Acesse https://vercel.com
2. Clique "New Project"
3. Selecione o repositório `code-help`
4. Configure:
   - **Framework Preset**: Outro
   - **Build Command**: `cd frontend && npm install && npx vite build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`
5. Adicione variáveis de ambiente:
   - `BACKEND_URL` = `https://codehelp-backend.fly.dev`
6. Clique "Deploy"

## Passo 8: Configurar CORS

No Fly.io, configure a variável:

```bash
fly secrets set CORS_ORIGINS="https://seu-app.vercel.app"
```

## Passo 9: Configurar Webhook do WhatsApp

Se usar WhatsApp Cloud API:
1. No Meta Developer, configure o webhook URL:
   `https://codehelp-backend.fly.dev/api/whatsapp/cloud/webhook`
2. Configure o verify token igual ao `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN`

## Passo 10: Verificar o Deploy

1. Acesse `https://seu-app.vercel.app`
2. Faça login
3. Teste as funcionalidades

## Comandos Úteis

### Ver logs do Backend
```bash
fly logs
```

### Ver logs do Vercel
1. Acesse vercel.com
2. Clique no projeto
3. Clique "Logs"

### Fazer redeploy
```bash
# Backend
fly deploy

# Frontend (automático com git push)
git push
```

### Voltar versão (rollback)
```bash
# Backend
fly releases list
fly rollback <ID>

# Frontend
# Acesse vercel.com → Projeto → Deployments → ··· → Promote to Production
```

### Verificar status
```bash
fly status
```

## Variáveis de Ambiente Necessárias

### Backend (Fly.io — via fly secrets set)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `JWT_SECRET` | Sim | Chave para gerar tokens |
| `JWT_REFRESH_SECRET` | Sim | Chave para refresh tokens |
| `APP_URL` | Sim | URL do frontend (Vercel) |
| `API_URL` | Sim | URL do backend (Fly.io) |
| `CORS_ORIGINS` | Sim | URL do frontend para CORS |
| `NODE_ENV` | Sim | `production` |

### Frontend (Vercel — via painel)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `BACKEND_URL` | Sim | URL do backend (Fly.io) |

## Custos

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby | **Grátis** |
| Fly.io | Free | **Grátis** |
| Neon | Free | **Grátis** (500MB) |
| GitHub | Free | **Grátis** |
| **Total** | | **R$ 0,00** |

## Limitações do Plano Grátis

- **Vercel**: Sem domínio próprio (usa `.vercel.app`)
- **Fly.io**: 256MB RAM, máquina para de dormir após inatividade
- **Neon**: 500MB de banco de dados

## Solução para Fly.io dormir

O Fly.io free tier desliga a máquina após inatividade. Para manter ativo:

1. Use um serviço de monitoramento gratuito (UptimeRobot, Better Stack)
2. Configure para fazer ping a cada 5 minutos:
   `https://codehelp-backend.fly.dev/api/health`

## Deploy Automático

Depois de configurado:

```
Você faz: git push origin main
  ↓
GitHub recebe as alterações
  ↓
Vercel faz deploy automático do frontend
Fly.io faz deploy automático do backend (se configurado)
```

## Se Algo Quebrar

1. **Verifique os logs**: `fly logs` ou Vercel Dashboard → Logs
2. **Verifique as variáveis**: `fly secrets list` ou Vercel Dashboard → Settings
3. **Voltar versão**: `fly rollback <ID>` ou Vercel Dashboard → Promote
