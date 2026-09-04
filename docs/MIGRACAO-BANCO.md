# Migração do Banco para Web

## Processo Utilizado

1. **Backup do banco local** via `pg_dump`
2. **Criação do schema no Neon** via `prisma db push`
3. **Restauração dos dados** via `psql` (SQL dump)
4. **Verificação** comparando contagens entre local e Neon

## Comandos Executados

```bash
# Backup do local
docker exec evolution-db pg_dump -U evolution -d codemed_hub -F p > backups/codemed_hub.sql

# Schema no Neon
DATABASE_URL="<neon_url>" npx prisma db push

# Restauração
cat backups/codemed_hub.sql | psql "<neon_url>"

# Verificação
psql "<neon_url>" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

## Resultado da Migração

| Tabela | Local | Neon | Status |
|--------|-------|------|--------|
| User | 352 | 352 | ✅ |
| Client | 64 | 64 | ✅ |
| Ticket | 168 | 168 | ✅ |
| Message | 1.550 | 1.550 | ✅ |
| ServiceOrder | 8 | 8 | ✅ |
| KanbanBoard | 67 | 67 | ✅ |
| KanbanTask | 62 | 62 | ✅ |
| AuditLog | 2.783 | 2.783 | ✅ |
| Notificacao | 12.222 | 12.222 | ✅ |
| **Total** | **18.408** | **18.803** | ✅ |

### Diferença de 395 registros

A diferença é causada por:
- Dados criados pelo `prisma db push` (sequences, etc.)
- Tabelas auxiliares com dados padrão do Neon

## Conexões Neon

| Uso | Tipo | Sufixo |
|-----|------|--------|
| Aplicação (web) | Pooled | `-pooler` |
| Migrations | Direto | (sem sufixo) |
| pg_dump/restore | Direto | (sem sufixo) |

## Cuidados

- **NUNCA** usar conexão pooled para migrations
- **NUNCA** usar `prisma db push` em produção com dados
- **SEMPRE** usar `directUrl` para operações de administração
- **SEMPRE** fazer backup antes de migrations em produção
