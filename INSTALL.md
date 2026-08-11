# Codemed Hub — Guia Completo de Instalacao

Sistema de Helpdesk & CRM para Windows.

---

## Sumario

1. [Pre-requisitos](#1-pre-requisitos)
2. [Instalacao Rapida](#2-instalacao-rapida)
3. [Instalacao Manual](#3-instalacao-manual)
4. [Comandos Disponiveis](#4-comandos-disponiveis)
5. [Credenciais Padrao](#5-credenciais-padrao)
6. [Portas do Sistema](#6-portas-do-sistema)
7. [Estrutura do Projeto](#7-estrutura-do-projeto)
8. [Configuracao Avancada](#8-configuracao-avancada)
9. [Deploy em Producao](#9-deploy-em-producao)
10. [Solucao de Problemas](#10-solucao-de-problemas)

---

## 1. Pre-requisitos

### Obrigatorio

| Software | Versao Minima | Como Verificar | Download |
|----------|---------------|----------------|----------|
| **Node.js** | 20.0.0+ | `node -v` | https://nodejs.org/ |
| **npm** | 9.0.0+ | `npm -v` | Vem junto com Node.js |
| **PostgreSQL** | 16+ | `psql --version` | https://www.postgresql.org/download/windows/ |
| **Git** | 2.0+ | `git -v` | https://git-scm.com/ |

### Opcional (para rodar via container)

| Software | Versao Minima | Como Verificar | Download |
|----------|---------------|----------------|----------|
| **Docker Desktop** | 24.0+ | `docker -v` | https://www.docker.com/products/docker-desktop |

### Instalacao do PostgreSQL no Windows

1. Baixe o instalador em https://www.postgresql.org/download/windows/
2. Execute o instalador e siga o assistente
3. Na tela de configuracao, defina:
   - **Porta**: 5432 (padrao)
   - **Senha do usuario postgres**: lembre-se dela
4. finalize a instalacao

Apos instalar, adicione o diretorio `bin` do PostgreSQL ao PATH do sistema:
```
C:\Program Files\PostgreSQL\16\bin
```

Ou crie o banco manualmente via pgAdmin:
- Usuario: `codemed`
- Senha: `codemed123`
- Banco: `codemed_hub`

---

## 2. Instalacao Rapida

### Passo 1 — Clonar o repositorio

```cmd
git clone <url-do-repositorio> code-help
cd code-help
```

### Passo 2 — Executar setup automatico

```cmd
setup.bat
```

O script faz tudo automaticamente:
1. Verifica se Node.js e npm estao instalados
2. Verifica se PostgreSQL esta acessivel
3. Instala todas as dependencias (backend + frontend)
4. Cria o arquivo `backend/.env` (se nao existir)
5. Gera o Prisma Client
6. Aplica o schema no banco de dados
7. Executa o seed (dados padrao)

### Passo 3 — Iniciar o sistema

```cmd
dev.bat
```

Acesse:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3010

---

## 3. Instalacao Manual

Se preferir configurar passo a passo:

### 3.1 — Subir PostgreSQL (Docker ou Manual)

**Opcao A — Docker (recomendado):**

```cmd
docker-compose -f docker-compose.dev.yml up -d
```

Isso cria PostgreSQL (porta 5432) e Redis (porta 6379).

**Opcao B — PostgreSQL local:**

Se ja instalou o PostgreSQL manualmente, crie o banco:

```cmd
psql -U postgres -c "CREATE USER codemed WITH PASSWORD 'codemed123';"
psql -U postgres -c "CREATE DATABASE codemed_hub OWNER codemed;"
```

### 3.2 — Configurar variaveis de ambiente

```cmd
copy backend\.env.example backend\.env
```

Edite `backend/.env` se necessario. As configuracoes padrao funcionam com Docker.

### 3.3 — Instalar dependencias

```cmd
npm install
```

Isso instala dependencias da raiz, backend e frontend.

### 3.4 — Gerar Prisma Client

```cmd
cd backend
npx prisma generate
cd ..
```

### 3.5 — Aplicar schema no banco

```cmd
cd backend
npx prisma db push
cd ..
```

### 3.6 — Executar seed (dados padrao)

```cmd
cd backend
npx prisma db seed
cd ..
```

### 3.7 — Iniciar desenvolvimento

```cmd
npm run dev
```

Ou use `dev.bat` para iniciar com as informacoes de porta.

---

## 4. Comandos Disponiveis

### Scripts Windows (.bat)

| Script | Descricao |
|--------|-----------|
| `setup.bat` | Setup inicial completo (instala + configura + seed) |
| `dev.bat` | Inicia backend + frontend em modo desenvolvimento |
| `build.bat` | Build para producao (frontend + backend) |
| `start.bat` | Inicia o servidor em modo producao |
| `db.bat` | Menu interativo para gerenciar o banco |

### Scripts npm

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Backend + frontend em paralelo |
| `npm run dev:backend` | Apenas backend (tsx watch, porta 3010) |
| `npm run dev:frontend` | Apenas frontend (vite, porta 3000) |
| `npm run build` | Build de ambos |
| `npm run start` | Iniciar em producao |
| `npm run db:seed` | Executar seed |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:push` | Aplicar schema sem migration |
| `npm run db:migrate` | Criar migration |
| `npm run reset` | Reset completo (requer Admin) |

### Docker Compose

| Comando | Descricao |
|---------|-----------|
| `docker-compose -f docker-compose.dev.yml up -d` | Sobe infra (PG + Redis) |
| `docker-compose up -d` | Sobe tudo (PG + Redis + Backend + Frontend) |
| `docker-compose down` | Para todos os servicos |
| `docker-compose logs -f` | Ver logs em tempo real |

---

## 5. Credenciais Padrao

| Usuario | Email | Senha | Nivel |
|---------|-------|-------|-------|
| Admin | admin@codemed.com.br | admin123 | admin (master) |
| Gerente | ana@codemed.com.br | tecnico123 | gerente |
| Tecnico 1 | joao@codemed.com.br | tecnico123 | tecnico |
| Tecnico 2 | maria@codemed.com.br | tecnico123 | tecnico |
| Comercial | pedro@codemed.com.br | tecnico123 | comercial |

> **IMPORTANTE**: Altere todas as senhas apos o primeiro login em producao!

---

## 6. Portas do Sistema

| Porta | Servico | URL |
|-------|---------|-----|
| 3000 | Frontend (Vite) | http://localhost:3000 |
| 3010 | Backend (Express) | http://localhost:3010 |
| 5432 | PostgreSQL | localhost:5432 |
| 5555 | Prisma Studio | http://localhost:5555 |
| 6379 | Redis | localhost:6379 |

---

## 7. Estrutura do Projeto

```
code-help/
├── backend/
│   ├── prisma/              # Schema + migrations + seed
│   ├── src/
│   │   ├── config/          # database.ts, env.ts, redis.ts
│   │   ├── modules/         # auth, users, clients, tasks, helpdesk, etc.
│   │   ├── shared/          # middleware (auth, error, ticketAccess)
│   │   └── server.ts        # Entry point
│   ├── storage/pdfs/        # Uploads (gitignored)
│   ├── whatsapp-session/    # Sessao WhatsApp (gitignored)
│   └── dist/                # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components, KanbanBoard, Layout, SearchBar
│   │   ├── pages/           # Login, Dashboard, CRM, Helpdesk, Settings, WhatsApp
│   │   ├── services/        # api.ts, auth.tsx, useTheme.ts
│   │   └── types/           # TypeScript interfaces
│   └── dist/                # Build (gitignored)
├── .env.example             # Template de variaveis de ambiente (raiz)
├── backend/.env.example     # Template de variaveis de ambiente (backend)
├── docker-compose.yml       # Docker completo (producao)
├── docker-compose.dev.yml   # Docker infra (desenvolvimento)
├── setup.bat                # Setup inicial Windows
├── dev.bat                  # Modo desenvolvimento
├── build.bat                # Build producao
├── start.bat                # Iniciar producao
├── db.bat                   # Gerenciar banco
├── reset-dev.ps1            # Reset de desenvolvimento (Admin)
├── AGENTS.md                # Regras de desenvolvimento
└── INSTALL.md               # Este arquivo
```

---

## 8. Configuracao Avancada

### Variaveis de Ambiente

Edite `backend/.env` conforme necessidade:

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `DATABASE_URL` | URL de conexao PostgreSQL | `postgresql://codemed:codemed123@localhost:5432/codemed_hub` |
| `JWT_SECRET` | Chave secreta JWT (access) | `dev_jwt_secret_codemed_2024` |
| `JWT_REFRESH_SECRET` | Chave secreta JWT (refresh) | `dev_refresh_secret_codemed_2024` |
| `PORT` | Porta do backend | `3010` |
| `NODE_ENV` | Ambiente | `development` |
| `WHATSAPP_CHROME_PATH` | Caminho do Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| `SMTP_HOST` | Servidor de email | (vazio) |
| `SMTP_PORT` | Porta SMTP | `587` |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (IA) | (vazio) |

### WhatsApp (Opcional)

O WhatsApp WebJS precisa de Chrome/Chromium instalado:

1. Instale o Google Chrome
2. Configure o caminho em `backend/.env`:
   ```
   WHATSAPP_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
   ```
3. Na primeira execucao, escaneie o QR Code que aparece no terminal

### Redis (Opcional)

O Redis e usado para cache. Se nao estiver rodando, o sistema funciona sem ele.

Para rodar via Docker:
```cmd
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

---

## 9. Deploy em Producao

### Opcao 1 — Docker Completo (recomendado)

```cmd
# No servidor
git clone <url> code-help
cd code-help

# Configurar .env com producao
copy backend\.env.example backend\.env
# Edite com senhas fortes e DATABASE_URL do servidor

# Build e subir
docker-compose up -d --build
```

O sistema ficara acessivel na porta 80 (frontend) e 3010 (API).

### Opcao 2 — VPS sem Docker

```cmd
# Instalar Node.js e PostgreSQL no servidor
# Clonar repositorio
git clone <url> code-help
cd code-help

# Configurar
copy backend\.env.example backend\.env
# Edite com DATABASE_URL remoto

# Instalar e buildar
npm install
npm run build

# Iniciar com PM2 (recomendado)
npm install -g pm2
pm2 start backend/dist/server.js --name codemed-api
pm2 save
pm2 startup
```

### Opcao 3 — Vercel (Frontend) + Railway/Render (Backend)

1. Frontend: push para GitHub, importe no Vercel
2. Backend: push para GitHub, importe no Railway ou Render
3. Configure as variaveis de ambiente no painel de cada servico

---

## 10. Solucao de Problemas

### "Porta 3000/3010 ja esta em uso"

```cmd
:: Matar processos node
taskkill /F /IM node.exe

:: Ou usar o reset (como Administrador)
powershell -ExecutionPolicy Bypass -File ./reset-dev.ps1
```

### "Database nao encontrado" ou "Connection refused"

```cmd
:: Verificar se PostgreSQL esta rodando
pg_isready

:: Se nao estiver, iniciar o servico
:: Windows: painel de servicos ou:
net start postgresql-x64-16

:: Ou via Docker
docker-compose -f docker-compose.dev.yml up -d
```

### "Prisma Client nao encontrado"

```cmd
cd backend
npx prisma generate
```

### "WhatsApp nao conecta / QR Code nao aparece"

```cmd
:: Limpar sessao do WhatsApp
rmdir /s /q backend\whatsapp-session

:: Reiniciar o sistema
npm run dev
```

### "bcrypt / node-gyp erro no Windows"

Instale as ferramentas de build:
```cmd
npm install -g windows-build-tools
```

Ou execute como Administrador:
```cmd
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm install -g windows-build-tools
```

### "prisma generate trava no Windows"

O Prisma trava se outros processos Node estao usando o client:
```cmd
:: Matar todos os processos node
taskkill /F /IM node.exe

:: Gerar novamente
cd backend
npx prisma generate
```

### "Seed falhou"

```cmd
:: Verificar conexao com o banco
cd backend
npx prisma db push --skip-generate

:: Executar seed novamente
npx prisma db seed
```

---

## Contato

Em caso de problemas, consulte o arquivo `AGENTS.md` ou abra uma issue no repositorio.
