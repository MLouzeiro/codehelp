# Backup e Restauração — Guia para Leigos

## O que é Backup?

Backup é uma cópia de segurança do seu sistema. Se algo quebrar, você pode voltar ao normal.

## Tipos de Backup

| Tipo | O que salva | Como fazer |
|------|-------------|------------|
| **Código** | Todo o sistema | Git + GitHub |
| **Banco de dados** | Dados do sistema | pg_dump |
| **Variáveis de ambiente** | Configurações | Arquivo .env |

## 1. Backup do Código (Git)

O código já está salvo no GitHub sempre que você faz `git push`.

### Verificar se está salvo
```bash
git status
```

### Salvar agora
```bash
git add .
git commit -m "Backup: descrição do que fez"
git push
```

### Ver histórico de backups
```bash
git log --oneline
```

### Voltar para um backup
```bash
# Ver versões disponíveis
git tag -l

# Voltar para uma versão
git checkout v1.0.0

# Voltar para o desenvolvimento
git checkout main
```

## 2. Backup do Banco de Dados

### Exportar banco (Neon/Railway)

Se usar Neon (plano grátis):
1. Acesse https://console.neon.tech
2. Selecione o projeto
3. Clique "SQL Editor"
4. Execute: `pg_dump (SELECT version())` — ou use o painel de exportação

### Usando comando (se tiver acesso direto)

```bash
# Exportar
pg_dump "sua-string-de-conexao" > backup_$(date +%Y%m%d).sql

# Importar
psql "sua-string-de-conexao" < backup.sql
```

### Backup automático (Neon)

O Neon faz backups automáticos diários no plano grátis.

## 3. Backup das Variáveis de Ambiente

Salve o arquivo `.env` em local seguro (NUNCA no GitHub).

### Listar variáveis importantes
```bash
# Fly.io
fly secrets list

# Vercel
# Acesse Dashboard → Settings → Environment Variables
```

## 4. Restaurar o Sistema

### Se o código quebrou
```bash
# Voltar para última versão funcional
git checkout v1.0.0

# Reinstalar dependências
npm install

# Reiniciar
npm run dev
```

### Se o banco de dados quebrou
```bash
# Recriar estrutura
npm run db:push

# Importar dados do backup
psql "sua-string-de-conexao" < backup.sql
```

### Se tudo quebrou
1. Clonar o projeto novamente:
```bash
git clone https://github.com/SEU-USUARIO/code-help.git
cd code-help
npm install
```

2. Configurar variáveis de ambiente (copiar `.env.example` para `.env`)

3. Configurar banco:
```bash
npm run db:push
npm run db:seed
```

4. Iniciar:
```bash
npm run dev
```

## 5. Clonar o Projeto em Outro Computador

```bash
# 1. Instalar Git (https://git-scm.com)

# 2. Clonar
git clone https://github.com/SEU-USUARIO/code-help.git

# 3. Entrar na pasta
cd code-help

# 4. Instalar dependências
npm install

# 5. Configurar banco
cp .env.example backend/.env
# Edite backend/.env com seus dados
npm run db:push

# 6. Iniciar
npm run dev
```

## 6. Frequência Recomendada

| Ação | Frequência |
|------|------------|
| `git push` | Sempre que fizer alteração importante |
| `git tag` | Quando criar uma versão estável |
| Backup do banco | Semanal (automático no Neon) |
| Backup do .env | Quando alterar configurações |

## 7. O que NÃO fazer

- **NUNCA** envie o arquivo `.env` para o GitHub
- **NUNCA** delete o arquivo `.git` (pasta oculta)
- **NUNCA** faça `git push --force` sem saber o que está fazendo
- **NUNCA** delete branches principais (main, develop)
