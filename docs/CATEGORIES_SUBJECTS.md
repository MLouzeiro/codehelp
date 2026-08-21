# Categorias e Assuntos do Helpdesk (Fase A)

> Referência técnica da implementação de classificação estruturada de chamados.
> Fase A da spec **CATEGORIAS E ASSUNTOS DO HELPDESK** — implementada em 2026-08-19.

## Modelo de dados

```
Categoria (Categoria) 1 ── n Assunto (Assunto)
Departamento 1 ── n Categoria          (departamentoId em Categoria)
Departamento 1 ── n Assunto            (departamentoId em Assunto — padrão por assunto)
Fila 1 ── n Assunto                    (idFila em Assunto — padrão por assunto)
Ticket n ── 1 Assunto                  (assuntoId + assuntoRef)
Ticket n ── 1 Categoria                (categoriaId, legado: categoria string)
```

- **Categoria**: `id, slug (único), nome, descricao, cor, icone, ordem, ativo, departamentoId, createdAt, updatedAt`. Índice em `ativo`. `_count`: `assuntos`, `tickets`.
- **Assunto**: `id, slug (único), nome, descricao, categoriaId (FK), icone, cor, prioridadePadrao (default 'media'), slaPadraoMin, departamentoId, idFila, ordem, ativo, createdAt, updatedAt`. Índices em `categoriaId, departamentoId, idFila, ativo`. `_count`: `tickets`.
- **Ticket**: `assuntoId String?` + `assuntoRef` (relação) + índice `@@index([assuntoId])`. Mantém os campos string `assunto` e `categoria` (espelho legado — compatível com relatórios e bot).

## APIs

Todas sob `/api/helpdesk` (ver `helpdesk.routes.ts`). Autenticação obrigatória.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/categorias` | autenticado | Lista ativas; `?todas=true` inclui inativas. Retorna `_count.assuntos` e `_count.tickets`, inclui `departamento`. |
| POST | `/categorias` | admin/gerente | Cria (slug auto via `slugify`; duplicata → 409). |
| PUT | `/categorias/:id` | admin/gerente | Edita nome/descricao/cor/icone/ordem/departamentoId. |
| PATCH | `/categorias/:id/ativar` | admin/gerente | Ativa/desativa (`body: { ativo }`). |
| DELETE | `/categorias/:id` | admin/gerente | Exclusão física **bloqueada (409)** se houver histórico (tickets/assuntos vinculados). |
| GET | `/assuntos` | autenticado | Lista ativos; filtros `?categoriaId=` e `?todas=true`. |
| POST | `/assuntos` | admin/gerente | Cria (slug `categoria__nome`; duplicata → 409). |
| PUT | `/assuntos/:id` | admin/gerente | Edita. |
| PATCH | `/assuntos/:id/ativar` | admin/gerente | Ativa/desativa. |
| GET | `/categorias/config` | autenticado | `{ exigirClassificacao }`. |
| PUT | `/categorias/config` | **admin** | `body: { exigirClassificacao }`. |
| GET | `/categorias/options` | autenticado | `{ categorias, assuntos, departamentos, filas }` ativos — dropdowns. |
| POST | `/tickets/:id/classificacao/sugerir` | acesso view | Sugestão IA (regex + fallback Claude). |
| PATCH | `/tickets/:id/classificacao` | acesso edit | `body: { categoriaId?, assuntoId?, motivo? }`. |

## Classificação de ticket (`aplicarClassificacao`)

1. Resolve **categoria a partir do assunto** quando só `assuntoId` é informado.
2. Valida que o assunto pertence à categoria informada (senão 400 `Assunto nao pertence a categoria informada`).
3. Aplica defaults do assunto/categoria quando não preenchidos no ticket: `departamentoId`, `idFila`, `prioridade`, `slaTotalMinutos` (via `sla.service`).
4. Grava `TicketEvent` `classificacao_alterada` com JSON `{ categoriaAnterior, categoriaNova, assuntoAnterior, assuntoNova }` e descrição legível.
5. Grava `AuditLog` (`acao: 'classificar_ticket'`, `entidade: 'Ticket'`, `detalhes` com antes×depois+motivo+origem).
6. Se nada muda → `{ semAlteracao: true }`.

## Sugestão IA (`sugerirClassificacao`)

- **Regex (sempre)**: normaliza texto (assunto + observações + últimas 8 mensagens), casa por palavra-chave contra nomes de categorias e assuntos (score ≥ 0.5). Retorna `{ categoriaId, categoria, assuntoId, assunto, confianca, metodo: 'regex', motivo }`.
- **Claude (se `hasClaude()`)**: prompt com categorias/assuntos disponíveis, resposta JSON validada contra slugs reais. `metodo: 'hibrido'`. Fallback local em erro/JSON inválido.
- Nenhum dado é gravado pela sugestão — apenas retorna proposta para o usuário **ACEITAR** (aplica via PATCH) ou **ALTERAR**.

## Obrigatoriedade no encerramento

- Config `exigir_classificacao` (HelpdeskConfig slug `exigir_classificacao`, JSON em `descricao`).
- Quando ativa, `moveTicketEtapa` (etapa `concluido`) e `postResolverTicket` validam categoria+assunto do ticket.
- **Admin fica isento** (role admin/master). Não-admin sem classificação recebe HTTP 400 `Classifique o chamado (categoria e assunto) antes de encerrar`.
- **Fluxo do bot/WhatsApp NÃO alterado** — a validação só ocorre em fechamento manual via API/UI.

## Seed

- `CATEGORIAS_PADRAO` (11): suporte_tecnico, financeiro, comercial, cancelamento, impressoras, banco_de_dados, integracoes, procedimentos, desenvolvimento, implantacao, outros.
- `ASSUNTOS_PADRAO` (~30) com `prioridadePadrao`/`slaPadraoMin` por categoria (ex.: `impressoras__impressora_nao_imprime` alta/240min, `banco_de_dados__erro_conexao` urgente/120min).
- `ensureCategoriasAssuntos()` idempotente chamado por `ensureHelpdeskEntities()`.
- Migração legada `migrateCategoriaStringToFK` continua criando categorias novas para slugs desconhecidos (não quebra).

## Frontend

- **`/app/settings/categorias-assuntos`** (`CategoriasAssuntosPage`): lista hierárquica Categoria ▸ Assuntos, toggle "Classificação obrigatória ao concluir" (admin), editores modal (categoria: nome/cor/ícone/ordem/departamento; assunto: nome/categoria/prioridade/SLA/ordem/cor), ativar/desativar, excluir categoria (confirmação, bloqueado se histórico). Rota lazy + card em Settings.
- **`ClassificationPanel`** (`TicketAtendimentoPage`): selects Categoria/Assunto pré-preenchidos, badges de defaults do assunto (prioridade/SLA), botão "Sugerir com IA" → banner com `confianca%` + `metodo` + motivo + **Aceitar**/**Alterar**; salva via PATCH e recarrega o ticket. Indicador "Obrigatória ao concluir" quando config ativa.

## Testes

`backend/src/__tests__/categorias-assuntos.test.ts` (16 testes): CRUD categoria/assunto, duplicata, exclusão bloqueada com histórico, assuntos por categoria, categoria inexistente, listas com `_count`, aplicar classificação + TicketEvent + AuditLog, alteração com antes×depois, assunto de outra categoria → erro, categoria resolvida via assunto, sugestão regex, config on/off, validação obrigatória.

## Status

- Backend: 466/467 (1 fail pré-existente time-dependent TESTE #31). tsc 25 pré-existentes (0 novos).
- Frontend: tsc 0, testes 5/5.
- `vite build` bloqueado por erro pré-existente de resolução de `@tiptap/pm` (não relacionado a esta fase).