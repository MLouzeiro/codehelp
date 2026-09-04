# Backup e Recuperação

## Backup Atual

| Campo | Valor |
|-------|-------|
| **Data** | 2026-09-01 |
| **Localização** | `backups/` |
| **Arquivos** | `codemed_hub_20260901_170042.sql` (27MB) + `.dump` (11MB) |
| **Método** | `pg_dump` via Docker |
| **Banco** | `codemed_hub` (PostgreSQL 15) |

## Como Gerar Backup

### Backup SQL (texto)

```bash
docker exec evolution-db pg_dump -U evolution -d codemed_hub -F p --no-owner > backups/codemed_hub_$(Get-Date -Format yyyyMMdd_HHmmss).sql
```

### Backup Custom (binário, compacto)

```bash
docker exec evolution-db pg_dump -U evolution -d codemed_hub -F c --no-owner > backups/codemed_hub_$(Get-Date -Format yyyyMMdd_HHmmss).dump
```

### Backup apenas schema (sem dados)

```bash
docker exec evolution-db pg_dump -U evolution -d codemed_hub --schema-only > backups/schema_only.sql
```

## Como Restaurar

### Do arquivo SQL

```bash
# Criar banco (se necessário)
docker exec -it evolution-db psql -U evolution -d postgres -c "CREATE DATABASE codemed_hub;"

# Restaurar
cat backups/codemed_hub.sql | docker exec -i evolution-db psql -U evolution -d codemed_hub
```

### Do arquivo Custom

```bash
cat backups/codemed_hub.dump | docker exec -i evolution-db pg_restore -U evolution -d codemed_hub --no-owner
```

### Em novo container

```bash
docker run -d --name codemed-db \
  -e POSTGRES_USER=codemed \
  -e POSTGRES_PASSWORD=senha \
  -e POSTGRES_DB=codemed_hub \
  -p 5435:5432 \
  postgres:15-alpine

cat backups/codemed_hub.sql | docker exec -i codemed-db psql -U codemed -d codemed_hub
```

## Como Verificar Backup

```bash
# Primeiras linhas (deve mostrar "PostgreSQL database dump")
head -5 backups/codemed_hub.sql

# Últimas linhas (deve mostrar "dump complete")
tail -3 backups/codemed_hub.sql

# Contar tabelas no dump
grep "CREATE TABLE" backups/codemed_hub.sql | wc -l
# Deve retornar: 89
```

## Recuperação de Desastres

### Cenário 1: Banco corrompido

1. Parar a aplicação
2. Restaurar do backup mais recente
3. Verificar integridade
4. Reiniciar aplicação

### Cenário 2: Dados deletados acidentalmente

1. Se backup recente existe: restaurar
2. Se não: usar Point-in-Time Recovery (Neon) ou backup do volume Docker

### Cenário 3: Migração falhou

1. Restaurar backup anterior à migração
2. Corrigir migration
3. Re-executar

## Cronograma de Backup

| Tipo | Frequência | Retenção |
|------|------------|----------|
| SQL completo | Manual (antes de mudanças) | Indefinido |
| Custom completo | Manual | Indefinido |
| Neon branching | Automático (Neon) | 7 dias (free tier) |

## Cuidados

- **NUNCA** armazenar backups no Git
- **NUNCA** compartilhar backups com dados sensíveis
- **SEMPRE** testar restore em ambiente de staging
- **SEMPRE** verificar integridade do backup
- Manter cópias em local fora do servidor
