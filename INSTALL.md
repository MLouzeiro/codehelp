# Codemed Hub — Guia de Instalacao (Windows)

## Pre-requisitos

| Software | Versao Minima | Como verificar | Download |
|----------|---------------|----------------|----------|
| **Node.js** | 20.0.0+ | `node -v` | https://nodejs.org/ |
| **npm** | 9.0.0+ | `npm -v` | Vem com Node.js |
| **Docker Desktop** | 24.0+ | `docker -v` | https://www.docker.com/products/docker-desktop |
| **Git** | 2.0+ | `git -v` | https://git-scm.com/ |

> **Opcional**: Se nao quiser Docker, instale PostgreSQL 16+ manualmente: https://www.postgresql.org/download/windows/

---

## Instalacao Rapida (3 passos)

### Passo 1 — Clonar o repositorio

```cmd
git clone <url-do-repositorio> code-help
cd code-help
```

### Passo 2 — Executar setup automatico

```cmd
setup.bat
```

O script vai:
1. Verificar se Node.js e npm estao instalados
2. Instalar todas as dependencias
3. Criar o arquivo `backend/.env` (se nao existir)
4. Gerar o Prisma Client
5. Aplicar o schema no banco de dados
6. Executar o seed (dados padrao)

### Passo 3 — Iniciar o sistema

```cmd
dev.bat
```

Acesse:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3010
- **Prisma Studio**: http://localhost:5555

---

## Instalacao Manual (passo a passo)

### 1. Subir PostgreSQL e Redis com Docker

```cmd
docker-compose up -d
```

Isso cria:
- PostgreSQL na porta **5432** (usuario: `codemed`, senha: `codemed123`, banco: `codemed`)
- Redis na porta **6379**

Para verificar se esta rodando:
```cmd
docker ps
```

### 2. Configurar variaveis de ambiente

```cmd
copy backend\.env.example backend\.env
```

Edite `backend/.env` conforme necessario. As configuracoes padrao funcionam com o Docker acima.

### 3. Instalar dependencias

```cmd
npm install
```

Isso instala as dependencias da raiz, do backend e do frontend automaticamente.

### 4. Gerar Prisma Client

```cmd
cd backend
npx prisma generate
cd ..
```

### 5. Aplicar schema no banco

```cmd
cd backend
npx prisma db push
cd ..
```

### 6. Popular dados padrao (seed)

```cmd
cd backend
npx prisma db seed
cd ..
```

### 7. Iniciar em modo desenvolvimento

```cmd
npm run dev
```

---

## Comandos Disponiveis

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
| `npm run db:seed` | Executar seed |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:push` | Aplicar schema sem migration |
| `npm run db:migrate` | Criar migration |

---

## Credenciais Padrao

| Usuario | Email | Senha | Role |
|---------|-------|-------|------|
| Admin | admin@codemed.com.br | admin123 | admin (master) |
| Gerente | gerente@codemed.com.br | tecnico123 | gerente |
| Tecnico 1 | joao@codemed.com.br | tecnico123 | tecnico |
| Tecnico 2 | maria@codemed.com.br | tecnico123 | tecnico |
| Comercial | comercial@codemed.com.br | tecnico123 | comercial |

> **IMPORTANTE**: Altere as senhas apos o primeiro login em producao!

---

## Portas do Sistema

| Porta | Servico | URL |
|-------|---------|-----|
| 3000 | Frontend (Vite) | http://localhost:3000 |
| 3010 | Backend (Express) | http://localhost:3010 |
| 5432 | PostgreSQL | localhost:5432 |
| 5555 | Prisma Studio | http://localhost:5555 |
| 6379 | Redis | localhost:6379 |

---

## Estrutura do Projeto

```
code-help/
├── backend/
│   ├── prisma/              # Schema + migrations + seed
│   ├── src/
│   │   ├── config/          # database.ts, env.ts, redis.ts
│   │   ├── modules/         # auth, users, clients, tasks, helpdesk, etc.
│   │   ├── shared/          # middleware (auth, error)
│   │   └── server.ts        # Entry point
│   ├── storage/pdfs/        # Uploads (gitignored)
│   ├── whatsapp-session/    # Sessao WhatsApp (gitignored)
│   └── dist/                # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components, KanbanBoard, Layout
│   │   ├── pages/           # Login, Dashboard, Clients, Kanban, Helpdesk, Settings
│   │   ├── services/        # api.ts, auth.tsx, useTheme.ts
│   │   └── types/           # TypeScript interfaces
│   └── dist/                # Build (gitignored)
├── docker-compose.yml       # PostgreSQL + Redis
├── setup.bat                # Setup inicial Windows
├── dev.bat                  # Modo desenvolvimento
├── build.bat                # Build producao
├── start.bat                # Iniciar producao
├── db.bat                   # Gerenciar banco
└── INSTALL.md               # Este arquivo
```

---

## Solucao de Problemas

### "ERRO: Porta 3000/3010 ja esta em uso"

```cmd
:: Matar processos node
taskkill /F /IM node.exe

:: Ou usar o reset (como Administrador)
reset-dev.ps1
```

### "ERRO: Database nao encontrado"

```cmd
:: Verificar se Docker esta rodando
docker ps

:: Se nao estiver, subir os servicos
docker-compose up -d

:: Verificar logs
docker-compose logs postgres
```

### "ERRO: Prisma Client nao encontrado"

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

### "ERRO: bcrypt / node-gyp no Windows"

Instale as ferramentas de build do Windows:
```cmd
npm install -g windows-build-tools
```

Ou use o PowerShell como Administrador:
```cmd
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm install -g windows-build-tools
```

---

## Deploy em Producao

### Opcao 1 — Vercel (Frontend) + Railway/Render (Backend)

1. **Frontend**: Faça push para o GitHub e importe no Vercel
2. **Backend**: Faça push para o GitHub e importe no Railway ou Render
3. Configure as variaveis de ambiente no painel de cada servico

### Opcao 2 — VPS (DigitalOcean, AWS, etc.)

```cmd
:: No servidor Linux
git clone <url> code-help
cd code-help

:: Instalar Docker
curl -fsSL https://get.docker.com | sh
docker-compose up -d

:: Build e iniciar
npm install
npm run build
npm run start
```

### Opcao 3 — Docker completo (futuro)

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '3010:3010'
    environment:
      - DATABASE_URL=postgresql://codemed:codemed123@postgres:5432/codemed
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
```

---

## Variaveis de Ambiente

Consulte `backend/.env.example` para a lista completa. As principais:

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `DATABASE_URL` | URL de conexao com PostgreSQL | `postgresql://codemed:codemed123@localhost:5432/codemed` |
| `JWT_SECRET` | Chave secreta JWT (access token) | `dev_jwt_secret_codemed_2024` |
| `JWT_REFRESH_SECRET` | Chave secreta JWT (refresh token) | `dev_refresh_secret_codemed_2024` |
| `PORT` | Porta do backend | `3010` |
| `WHATSAPP_CHROME_PATH` | Caminho do Chrome para WhatsApp Web | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

---

## Contato

Em caso de problemas, consulte o arquivo `AGENTS.md` ou abra uma issue no repositorio.
