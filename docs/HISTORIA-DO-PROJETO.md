# História do Projeto

## Início

- **Data**: 2026-06-05
- **Primeiro commit**: `26a1356` — v1.0 - WhatsApp funcional: triagem automática + protocolo + race fix
- **Evidência**: `git log --reverse`

## Linha do Tempo

### 2026-06-05 — Fundação (v1.0–v1.3)

- v1.0: WhatsApp funcional com triagem automática
- v1.1: Triagem com follow-up e botão Criar Ticket
- v1.2: Menu numérico 1/2 + modal Abrir Chamado + Transferir
- v1.3: Fluxo sem menu numérico (Fila de Espera)

### 2026-06-05 — Helpdesk Core (v1.4-dev)

- Entidades de helpdesk: Fila, SLA, Categoria, Ativo, KB, CSAT
- Cálculo de SLA com scheduler
- RBAC 4 perfis (solicitante/agente/supervisor/admin)
- AuditLog + KB CRUD completo
- Dashboard de métricas

### 2026-06-06–07 — Módulos Adicionais

- Base de Conhecimento frontend
- Automações WHEN/IF/THEN
- Board por Status
- Notificações
- Colaboradores (CRUD por cliente)
- Etapas helpdesk editáveis
- Permissões dinâmicas
- Feriados + Dark Mode

### 2026-06-09 — Multi-departamento

- Departamentos e níveis de suporte
- Multi-departamento + ticket access
- Filas CRUD + department selectors
- Busca inteligente + CRM-Helpdesk link
- Multi-WhatsApp connections

### 2026-06-16–17 — Features Avançadas

- Aprovações, Alertas, Dashboard, Sessão
- Editor de mensagens automáticas
- Canvas de assinatura mobile
- App React Native + Expo (estrutura completa)
- Skills especialistas

### 2026-07-30–31 — Kanban e Ticket

- LID handling, contactJid, heartbeat
- Auto-move ticket on agent reply
- Ticket history modal
- Kanban: painel flutuante, checklist, IA auto-categorize

### 2026-08-11–14 — CSAT e Auditoria

- CSAT flow completo (state machine)
- Assinatura personalizada do analista
- Enquetes e listas interativas
- Time Tracking integrado
- Aprovações via WhatsApp
- Relatório gerencial + Dashboard Executivo
- Auditoria de Encerramento (IA)
- Auditoria por Analista

### 2026-08-15–18 — Auditoria IA Profissional

- Motor com 14 categorias
- Guardrail anti-alucinação
- Tomada de decisão
- Relatórios interno/cliente
- Arquivamento de usuários

### 2026-08-21 — Deploy Prep (v1.5.0)

- Preparação Vercel + Fly.io + Neon
- Sistema de auditoria de sistema
- Orders/OS completo

### 2026-09-01 — Banco Web

- Migração para Neon PostgreSQL
- Backup completo
- Separação ambientes local/web
- Documentação histórica

## Dados do Repositório

- **Total de commits**: 117
- **Branch principal**: `feature/helpdesk-enhancements`
- **Outras branches**: `main`, `develop`, `agents/whatsapp-mensagens-conectado-erro`
