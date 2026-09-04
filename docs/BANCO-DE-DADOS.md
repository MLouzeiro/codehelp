# Banco de Dados

## Resumo

| Item | Local | Web |
|------|-------|-----|
| **Engine** | PostgreSQL 15.18 | PostgreSQL 18.6 |
| **Host** | Docker `evolution-db` | Neon Serverless |
| **Porta** | 5434 (host) | 5432 (internamente) |
| **Banco** | `codemed_hub` | `neondb` |
| **Usuário** | `evolution` | `neondb_owner` |
| **Tabelas** | 89 | 89 |
| **Registros** | ~18.400 | ~18.800 |
| **Tamanho** | 32 MB | ~34 MB |
| **Volume** | `code-help_evolution-db-data` | Neon storage |

## Schema

- **Arquivo**: `backend/prisma/schema.prisma` (2.117 linhas)
- **Gerador**: `prisma-client-js`
- **Datasource**: PostgreSQL com `url` (pooled) + `directUrl` (direto)

## Tabelas Principais (36 com dados)

| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| Notificacao | 12.222 | Notificações do sistema |
| AuditLog | 2.783 | Logs de auditoria |
| Message | 1.550 | Mensagens WhatsApp |
| TicketStageEvent | 690 | Eventos de etapa |
| User | 352 | Usuários |
| Ticket | 168 | Chamados |
| KanbanActivity | 137 | Atividades kanban |
| CSATResposta | 100 | Respostas de satisfação |
| KanbanBoard | 67 | Boards kanban |
| Client | 64 | Clientes |
| KanbanTask | 62 | Tarefas kanban |
| AIAgentClosureAudit | 37 | Auditoria de encerramento IA |
| ServiceOrder | 8 | Ordens de serviço |
| Signature | 6 | Assinaturas digitais |

## Índices

- **Total**: 328 índices
- **Primary keys**: 89 (uma por tabela)
- **Unique**: ~30 (email, slug, token, etc.)
- **Ordinários**: ~209 (foreign keys + campos de busca)

## Foreign Keys

- **Total**: 228 constraints
- ** CASCADE**: Apenas em `UserDepartamento` (tabela pivô)
- **RESTRICT**: Demais relações (impede delete físico)

## Triggers

- **Nenhum**: Sistema não usa triggers do banco

## Funções/Procedures

- **Nenhum**: Toda lógica está no backend (TypeScript)

## Sequences

- Gerenciadas automaticamente pelo Prisma

## Extensões

- Apenas `plpgsql` (padrão PostgreSQL)

## Seed

- **Arquivo**: `backend/prisma/seed.ts` (419 linhas)
- **Idempotente**: Usa `upsert` e `findFirst`
- **Dados**: 5 usuários, 3 clientes, 3 tickets, 2 OS, 4 robôs

## Backup

- **Localização**: `backups/`
- **Formato**: SQL (27MB) + Custom (11MB)
- **Data**: 2026-09-01
- **Método**: `pg_dump` via Docker
