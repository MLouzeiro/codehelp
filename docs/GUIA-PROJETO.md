# Guia do Projeto — CodeHelp CRM/Helpdesk

Guia completo para leigos administrarem o projeto.

## 1. Como o Sistema está Estruturado

```
code-help/
├── frontend/          → Interface web (React)
├── backend/           → API e regras de negócio (Node.js)
├── mobile/            → App celular (React Native + Expo)
├── api/index.ts       → Ponto de entrada Vercel (serverless)
├── vercel.json        → Configuração do Vercel
├── fly.toml           → Configuração do Fly.io
└── docs/              → Documentação
```

## 2. Como Iniciar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco de dados
# Copie .env.example para backend/.env e preencha
npm run db:push

# 3. Iniciar sistema
npm run dev
```

O sistema abre em: `http://localhost:3000`

## 3. Como Salvar Alterações

```bash
# Ver o que foi alterado
git status

# Adicionar todas as alterações
git add .

# Salvar com mensagem descritiva
git commit -m "descreva o que fez"

# Enviar para o GitHub
git push
```

## 4. Como Criar uma Versão

```bash
# Criar tag (versão)
git tag -a v1.0.0 -m "Descrição da versão"

# Enviar tag para GitHub
git push origin v1.0.0
```

## 5. Como Enviar para o GitHub

```bash
# Primeira vez:
git remote add origin https://github.com/SEU-USUARIO/code-help.git
git push -u origin main

# Depois:
git push
```

## 6. Como Publicar no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique "New Project"
3. Selecione o repositório `code-help`
4. Configure as variáveis de ambiente (veja `.env.example`)
5. Clique "Deploy"

## 7. Como Atualizar o Sistema

```bash
# Puxar últimas alterações
git pull

# Reiniciar se necessário
npm run dev
```

## 8. Como Voltar uma Versão

```bash
# Ver histórico
git log --oneline

# Voltar para uma versão
git checkout v1.0.0

# Voltar para o desenvolvimento
git checkout main
```

## 9. Como Verificar Erros

```bash
# Verificar TypeScript
npx tsc --noEmit

# Rodar testes
npm test

# Ver logs do Vercel
# Acesse vercel.com → Seu Projeto → Logs
```

## 10. Como Fazer Backup

O banco PostgreSQL já faz backup automático (Neon/Railway).

Para backup manual:
```bash
# Exportar banco
pg_dump $DATABASE_URL > backup.sql
```

## 11. Variáveis de Ambiente

Veja `.env.example` para a lista completa.

Variáveis OBRIGÓRIAS:
- `DATABASE_URL` — Conexão com banco PostgreSQL
- `JWT_SECRET` — Chave de autenticação
- `JWT_REFRESH_SECRET` — Chave de refresh token
- `APP_URL` — URL do frontend
- `API_URL` — URL do backend

## 12. Como Recuperar o Sistema

Se algo quebrar:

```bash
# Verificar última versão funcional
git log --oneline

# Voltar para ela
git checkout v1.0.0

# Reiniciar
npm install
npm run dev
```

Se precisar recriar o banco:
```bash
npm run db:push
npm run db:seed
```
