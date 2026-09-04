# Changelog

## 2026-09-02

### Layouts de OS (v1.7.0)
- Schema: model `OSLayout` com configuração visual (cores, cabeçalho, rodapé, seções, margens) e suporte a timbrado PDF importado
- Campo `layoutId` em `ServiceOrder` para associação de layout ao documento
- Backend: CRUD completo (`os-layout.service.ts`, `os-layout.controller.ts`, `os-layout.routes.ts`) — 9 endpoints
- Upload de timbrado PDF via multipart/form-data (max 10MB, validação MIME type)
- PDF generator refatorado: suporta layout personalizado e timbrado via `pdf-lib` merge
- Configuração de margens reservadas (topo/baixo/esquerda/direita em mm) para timbrado
- Suporte a timbrado de 1 página ou múltiplas páginas (primeira ou todas)
- Frontend: página de listagem e editor de layouts (`OSLayoutsPage.tsx`)
- Seletor de layout no formulário de OS e no detalhe da OS
- Download de PDF com layout selecionado
- Menu: Configurações → Layouts de OS

### Enriquecimento de Auditoria (Fase 4)
- `LogParams` estendido com `severity` e `clienteId`
- `logAction` wrapper passa os campos para `logAudit`
- 53 call sites enriquecidos em 16 arquivos
- Classificação de severidade: alta (deletar, permissoes, encerrar_sem_resolucao), media (escalar, sla, config), baixa (criar, atualizar, mover_etapa)

## 2026-09-01

### Banco de Dados Web
- Backup completo do banco local (27MB SQL + 11MB Custom)
- Migração para Neon PostgreSQL (89 tabelas, ~18.800 registros)
- Schema `prisma` atualizado com `directUrl` para Neon
- Arquivo `.env.web` criado (em `.gitignore`)
- `.gitignore` atualizado com `backups/` e `.env.web`

### Segurança
- Exclusão de usuários implementada (individual + em massa)
- Backend: `POST /auth/users/bulk-archive` com proteções
- Frontend: Checkboxes, barra de ações, modais de confirmação
- Validação server-side: self-archive, master, já arquivado

### Documentação
- Criada pasta `docs/` com 11 arquivos
- História do projeto baseada em git log real
- Arquitetura, banco de dados, ambientes, segurança
- Migração, deploy, changelog, decisões técnicas

## 2026-08-21

- v1.5.0: Deploy prep (Vercel + Fly.io + Neon)
- Sistema de auditoria de sistema profissional
- Orders/OS completo com assinatura digital

## 2026-08-18

- FASE 13-15: Full-height ticket, arquivamento de usuários
- Auditoria por analista com ranking e filtros

## 2026-08-15–17

- Auditoria IA Profissional (14 categorias)
- Guardrail anti-alucinação
- Tomada de decisão + relatórios
- Artefatos comerciais (HTML, PDF, demo)

## 2026-08-14

- CSAT flow completo
- Time Tracking integrado
- Aprovações via WhatsApp
- Relatório gerencial + Dashboard Executivo
- Auditoria de Encerramento (IA)
- Auditoria por Analista
- v1.4 completo (348/348 testes backend, 5/5 frontend)

## 2026-08-11

- Assinatura personalizada do analista
- Enquetes e listas interativas
- Editor de mensagens automáticas

## 2026-07-30–31

- LID handling, contactJid, heartbeat
- Auto-move ticket on agent reply
- Kanban: painel flutuante, checklist, IA auto-categorize

## 2026-06-09

- Multi-departamento + ticket access
- Filas CRUD + department selectors
- Multi-WhatsApp connections
- Busca inteligente + CRM-Helpdesk link

## 2026-06-05–07

- v1.0–v1.7: Fundação do sistema
- Helpdesk core (SLA, RBAC, AuditLog, KB)
- Dashboard de métricas
- Automations WHEN/IF/THEN
- Dark Mode + Feriados
