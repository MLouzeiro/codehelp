# GUIA DE MIGRAÇÃO — CODE-HELP PARA NEON

> **Nível:** Leigo (copiar e colar comandos)
> **Data:** 03/09/2026
> **Duração estimada:** 15-30 minutos

---

## O QUE VAMOS FAZER

Vamos copiar o banco de dados do Code-Help (que está rodando no Docker local) para o Neon (banco na nuvem).

**NÃO vamos apagar nada do local.** Estamos apenas criando uma cópia.

---

## O QUE VOCÊ PRECISA

1. O arquivo de backup já criado: `backups/codemed_hub_FRESCO_20260903_131306.sql`
2. Acesso ao Neon (pelo site https://neon.tech)
3. O终端/PowerShell aberto

---

## PASSO 1 — ACESSAR O NEON

1. Abra o navegador e acesse: **https://console.neon.tech**
2. Faça login na sua conta
3. Se já tem um projeto chamado **CodeHelp** ou similar, clique nele
4. Se NÃO tem projeto, clique em **Create Project** e crie um novo

---

## PASSO 2 — COPIAR A STRING DE CONEXÃO DO NEON

1. No painel do Neon, clique no projeto
2. Clique em **Dashboard** (no menu lateral)
3. Procure a seção **Connection Details**
4. Você verá algo assim:

```
postgresql://neondb_owner:ABC123xyz@ep-little-smoke-ayxfbsel.us-east-2.aws.neon.tech/neondb?sslmode=require
```

5. **Copie essa string inteira** (clique no botão de copiar ao lado)

**IMPORTANTE:** Essa é a string de conexão **SEM pooling** (direta). Anote ou salve em um lugar seguro.

---

## PASSO 3 — ABRIR O POWERSHELL

1. Pressione **Windows + R**
2. Digite `powershell` e pressione **Enter**
3. Uma janela azul/preta vai abrir

---

## PASSO 4 — NAVEGAR ATÉ A PASTA DO PROJETO

Cole o comando abaixo e pressione **Enter**:

```powershell
cd "C:\Users\Louzeiro\Documents\Louzeiro\Projeto\code-help"
```

---

## PASSO 5 — CRIAR O SCHEMA NO NEON (sem dados)

Este comando cria as tabelas vazias no Neon. Nada é apagado.

Cole o comando abaixo, **MAS SUBSTITUA `<SUA_STRING_NEON>` pela string que você copiou no Passo 2**:

```powershell
$env:DATABASE_URL="<SUA_STRING_NEON>"; npx prisma db push --accept-data-loss
```

**Exemplo real** (com uma string fictícia — use a SUA):

```powershell
$env:DATABASE_URL="postgresql://neondb_owner:ABC123xyz@ep-little-smoke-ayxfbsel.us-east-2.aws.neon.tech/neondb?sslmode=require"; npx prisma db push --accept-data-loss
```

**O que vai acontecer:**
- Vai aparecer texto rolando na tela
- Pode demorar 1-3 minutos
- No final deve aparecer algo como "Generated Prisma Client" e "Database schema synced"
- Se der erro, **leia a seção "EM CASO DE ERRO" no final deste guia**

---

## PASSO 6 — RESTAURAR OS DADOS NO NEON

Este comando copia todos os dados do backup para o Neon.

Cole o comando abaixo, **MAS SUBSTITUA `<SUA_STRING_NEON>` pela string que você copiou no Passo 2**:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "<SUA_STRING_NEON>" -f "backups\codemed_hub_FRESCO_20260903_131306.sql"
```

**Se o caminho do psql estiver diferente**, tente:

```powershell
psql "<SUA_STRING_NEON>" -f "backups\codemed_hub_FRESCO_20260903_131306.sql"
```

**Se NÃO tiver o psql instalado**, use esta alternativa (mais lenta mas funciona):

```powershell
$backup = Get-Content "backups\codemed_hub_FRESCO_20260903_131306.sql" -Raw; Write-Host "Arquivo carregado: $($backup.Length) caracteres"; Write-Host "Execute o psql manualmente ou instale o PostgreSQL"
```

**O que vai acontecer:**
- Vai aparecer texto rolando na tela (CREATE TABLE, COPY, etc.)
- Pode demorar 2-5 minutos
- No final deve aparecer "COPY 1", "COPY 170", etc. (confirmando que dados foram copiados)
- Deve terminar com algo como "codemed_hub=> " ou "Query returned successfully"

---

## PASSO 7 — VERIFICAR SE FUNCIONOU

Após o Passo 6, cole estes comandos **um por um** para verificar:

### Verificar quantidade de tabelas:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "<SUA_STRING_NEON>" -c "SELECT count(*) AS tabelas FROM information_schema.tables WHERE table_schema='public';"
```

**Resultado esperado:** `91` (ou próximo disso)

### Verificar quantidade de tickets:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "<SUA_STRING_NEON>" -c "SELECT count(*) AS tickets FROM \"Ticket\";"
```

**Resultado esperado:** `170` (ou próximo)

### Verificar se tem clientes:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "<SUA_STRING_NEON>" -c "SELECT count(*) AS clientes FROM \"Client\";"
```

**Resultado esperado:** `68` (ou próximo)

### Verificar se tem OS:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "<SUA_STRING_NEON>" -c "SELECT count(*) AS os FROM \"ServiceOrder\";"
```

**Resultado esperado:** `9` (ou próximo)

---

## PASSO 8 — PRONTO!

Se todos os comandos acima retornaram números maiores que 0, a migração funcionou!

**O que foi feito:**
- ✅ Schema (tabelas) criado no Neon
- ✅ Dados copiados do backup para o Neon
- ✅ Nada foi apagado do local

**Próximos passos (depois):**
- Conectar o backend ao Neon (alterar `backend/.env`)
- Deploy na Vercel/Fly.io
- Testar o sistema

---

## EM CASO DE ERRO

### Erro: "password authentication failed"

**Causa:** A string de conexão está errada ou a senha mudou.

**Solução:** Volte ao Passo 2 e copie a string de conexão novamente do painel do Neon.

---

### Erro: "connection refused" ou "could not connect"

**Causa:** O Neon está em pausa (scale to zero) ou a string está errada.

**Solução:**
1. Acesse https://console.neon.tech
2. Clique no projeto
3. O Neon vai "acordar" automaticamente
4. Aguarde 30 segundos e tente novamente

---

### Erro: "psql: command not found"

**Causa:** O PostgreSQL não está instalado no Windows.

**Solução — alternativa sem psql:**

1. Acesse o painel do Neon: https://console.neon.tech
2. Clique no projeto
3. Clique em **SQL Editor** (menu lateral)
4. Cole o conteúdo do arquivo `backups/codemed_hub_FRESCO_20260903_131306.sql` no editor
5. Clique em **Run**

**ATENÇÃO:** O arquivo tem 13MB. Pode demorar para colar. Se der erro de "query too large", divida o arquivo em partes menores usando um editor de texto.

---

### Erro: "relation already exists"

**Causa:** O schema já foi criado anteriormente.

**Solução:** Isso é normal se você executou o Passo 5 duas vezes. Os dados vão ser inseridos mesmo assim (desde que não tenha conflitos de chave primária).

---

### Erro: "duplicate key value violates unique constraint"

**Causa:** Alguns registros já existem no Neon (possivelmente de uma migração anterior).

**Solução:** Isso é harmônico — os dados que já existem são ignorados e os novos são inseridos. O sistema vai funcionar normalmente.

---

### Erro: "permission denied"

**Causa:** A string de conexão não tem permissão de escrita.

**Solução:** Verifique se está usando a string de conexão correta (com o usuário `neondb_owner`) e não uma string de leitura apenas.

---

## CHECKLIST DE VERIFICAÇÃO

Antes de considerar a migração completa, confirme:

- [ ] Acessei o Neon (https://console.neon.tech)
- [ ] Copiei a string de conexão
- [ ] Executei o `prisma db push` (criação de tabelas)
- [ ] Executei o `psql` (restauração de dados)
- [ ] Verifiquei que existem tabelas (91 tabelas)
- [ ] Verifiquei que existem tickets (170+)
- [ ] Verifiquei que existem clientes (68+)
- [ ] Verifiquei que existem OS (9+)
- [ ] NÃO apaguei nada do Docker local
- [ ] NÃO alterei o `backend/.env`
- [ ] NÃO alterei nenhum código

---

## DADOS DO BACKUP

| Campo | Valor |
|-------|-------|
| Arquivo | `backups/codemed_hub_FRESCO_20260903_131306.sql` |
| Tamanho | 13.51 MB |
| Tabelas | 91 |
| Data do backup | 03/09/2026 13:30 |
| Banco original | `codemed_hub` (Docker `evolution-db`) |
| Compatível com Neon | ✅ Sim |

---

## REFERÊNCIA RÁPIDA

| Comando | O que faz |
|---------|-----------|
| `cd "C:\Users\Louzeiro\Documents\Louzeiro\Projeto\code-help"` | Navega até a pasta do projeto |
| `npx prisma db push` | Cria as tabelas no Neon |
| `psql <string> -f arquivo.sql` | Restaura os dados no Neon |
| `psql <string> -c "SELECT..."` | Consulta dados no Neon |
