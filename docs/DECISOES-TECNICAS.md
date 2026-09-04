# Decisões Técnicas (ADR)

## ADR-001 — PostgreSQL como banco principal

- **Data**: 2026-06-05
- **Decisão**: Usar PostgreSQL para todos os ambientes
- **Motivo**: Compatibilidade com Prisma, suporte a JSON, full-text search, arrays nativos
- **Impacto**: Escolha do Neon para banco web (serverless PostgreSQL)

## ADR-002 — Prisma ORM

- **Data**: 2026-06-05
- **Decisão**: Usar Prisma como ORM
- **Motivo**: Type safety, migrations automáticas, DX excelente
- **Impacto**: Schema-first (`db push`) em vez de migration-based

## ADR-003 — Soft Delete

- **Data**: 2026-06-05
- **Decisão**: Usar campo `active` para exclusão lógica
- **Motivo**: Preservar dados históricos, auditoria, integridade referencial
- **Impacto**: Nenhum DELETE físico em dados de produção

## ADR-004 — JWT com Session Token

- **Data**: 2026-06-05
- **Decisão**: JWT com session token binding (UUID)
- **Motivo**: Impedir multi-dispositivo, invalidação server-side
- **Impacto**: Logout limpa sessionToken no banco

## ADR-005 — Multi-Provider WhatsApp

- **Data**: 2026-06-09
- **Decisão**: Suportar 3 providers (Baileys, Evolution, Cloud API)
- **Motivo**: Flexibilidade, redundância, custo
- **Impacto**: Handler compartilhado entre providers

## ADR-006 — Banco Local + Web

- **Data**: 2026-09-01
- **Decisão**: Manter banco local (Docker) + criar banco web (Neon)
- **Motivo**: Desenvolvimento independente de produção
- **Impacto**: Dois ambientes com dados espelhados

## ADR-007 — Neon PostgreSQL

- **Data**: 2026-09-01
- **Decisão**: Usar Neon como banco web
- **Motivo**: Serverless, escala zero, branching, gratuito para início
- **Impacto**: Conexão pooled (app) + direta (migrations)

## ADR-008 — Vercel + Fly.io

- **Data**: 2026-08-21
- **Decisão**: Frontend na Vercel, Backend no Fly.io
- **Motivo**: Vercel ótimo para estáticos, Fly.io suporta WebSocket (WhatsApp)
- **Impacto**: Dois serviços de deploy separados

## ADR-009 — Single-Tenant

- **Data**: 2026-09-01
- **Decisão**: Sistema é single-tenant (sem isolamento por organização)
- **Motivo**: Projeto em fase inicial, complexidade desnecessária
- **Impacto**: Quando multi-tenant for necessário, adicionar `organizationId` + RLS
