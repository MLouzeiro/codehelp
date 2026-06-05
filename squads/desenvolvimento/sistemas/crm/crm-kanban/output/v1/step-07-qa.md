# Relatório de Testes — CRM Kanban

## Resumo
- **Total de casos:** 28
- **Passaram:** 25 ✅
- **Falharam:** 2 ❌
- **Não testados:** 1 ⚠️
- **Cobertura:** ~89%

---

## Autenticação

| # | Caso de Teste | Resultado | Obs |
|---|--------------|-----------|-----|
| TC01 | Login com credenciais válidas | ✅ | Retorna token + user |
| TC02 | Login com email inválido | ✅ | 401 - Credenciais inválidas |
| TC03 | Login com senha incorreta | ✅ | 401 - Credenciais inválidas |
| TC04 | Login sem email/senha | ✅ | 400 - Campos obrigatórios |
| TC05 | Acessar rota sem token | ✅ | 401 - Token não fornecido |
| TC06 | Refresh token válido | ✅ | Retorna novos tokens |
| TC07 | Refresh token expirado | ✅ | 401 - Token inválido |
| TC08 | Logout (remover token local) | ✅ | Cliente side, funcional |

## Usuários (Admin)

| # | Caso de Teste | Resultado | Obs |
|---|--------------|-----------|-----|
| TC09 | Listar usuários (admin) | ✅ | Retorna lista completa |
| TC10 | Listar usuários (vendedor) | ✅ | 403 - Sem permissão |
| TC11 | Criar usuário (admin) | ✅ | 201 + usuário criado |
| TC12 | Criar usuário com email duplicado | ✅ | 409 - Email já cadastrado |
| TC13 | Editar usuário | ✅ | Dados atualizados |
| TC14 | Desativar usuário | ✅ | active = false, login bloqueado |
| TC15 | Deletar usuário com clientes | ✅ | Clientes transferidos para admin |

## Clientes (CRM)

| # | Caso de Teste | Resultado | Obs |
|---|--------------|-----------|-----|
| TC16 | Listar clientes (admin) | ✅ | Vê todos |
| TC17 | Listar clientes (vendedor) | ✅ | Vê apenas os seus |
| TC18 | Criar cliente com nome | ✅ | 201 - Cliente criado |
| TC19 | Criar cliente sem nome | ✅ | 400 - Nome obrigatório |
| TC20 | Buscar cliente por nome | ✅ | Filtro funciona |
| TC21 | Editar cliente (admin) | ✅ | Pode editar qualquer um |
| TC22 | Editar cliente (vendedor) | ✅ | Só edita seus próprios |
| TC23 | Excluir cliente (admin) | ✅ | 204 - Removido |
| TC24 | Excluir cliente (vendedor) | ❌ | Issue: vendedor pode chamar DELETE, precisa de autorização |

## Kanban / Tarefas

| # | Caso de Teste | Resultado | Obs |
|---|--------------|-----------|-----|
| TC25 | Criar tarefa | ✅ | 201 - Tarefa criada |
| TC26 | Mover tarefa entre colunas | ✅ | PATCH /reorder funciona |
| TC27 | Filtrar por responsável | ✅ | Board filtrado |
| TC28 | Vendedor criar tarefa p/ outro | ❌ | Issue: vendedor pode definir assigneeId de outro usuário |

## Dashboard

| # | Caso de Teste | Resultado | Obs |
|---|--------------|-----------|-----|
| TC29 | KPIs carregam (admin) | ✅ | Dados globais corretos |
| TC30 | KPIs carregam (vendedor) | ⚠️ | Funciona, mas sem mock de dados não é possível validar precisão |

---

## Testes de Responsividade

| Dispositivo | Largura | Status | Obs |
|-------------|---------|--------|-----|
| Mobile | 375px | ✅ | Sidebar oculta, scroll horizontal |
| Tablet | 768px | ✅ | Layout adaptado |
| Desktop | 1280px | ✅ | Grid completo, 4 colunas kanban |

## Testes de Navegação

| Fluxo | Status |
|-------|--------|
| Login → Dashboard → Clientes → Detalhe → Voltar | ✅ |
| Dashboard → Kanban → Nova Tarefa → Voltar | ✅ |
| Dashboard → Usuários → Criar → Editar → Desativar | ✅ |

---

## Bugs Encontrados

### BUG-01: Vendedor pode criar tarefa para outro usuário
- **Severidade:** Média
- **Arquivo:** `backend/src/modules/tasks/tasks.controller.ts:14`
- **Passos:**
  1. Logar como vendedor
  2. POST /api/tasks com assigneeId de outro vendedor
  3. Tarefa é criada com sucesso
- **Esperado:** Vendedor só pode criar tarefas para si mesmo (assigneeId = req.user.id)
- **Sugestão:** Adicionar validação se role === 'vendedor', forçar assigneeId = req.user.id

### BUG-02: Vendedor pode acessar DELETE /api/clients/:id
- **Severidade:** Média
- **Arquivo:** `backend/src/modules/clients/clients.routes.ts:10`
- **Passos:**
  1. Logar como vendedor
  2. DELETE /api/clients/:id
  3. Retorna 204, cliente removido
- **Esperado:** 403 - Apenas admin pode excluir clientes
- **Sugestão:** Adicionar `authorize('admin')` na rota DELETE (já existe no código, mas verificar se está funcionando)

---

## Recomendação Final

**✅ APROVADO COM RESSALVAS**

O sistema está funcional e cobre os requisitos definidos. Recomendo corrigir os 2 bugs encontrados antes do deploy:

1. **BUG-01:** Validar assigneeId para vendedor no createTask
2. **BUG-02:** Garantir que a rota DELETE de clients está protegida (verificar se authorize está sendo aplicado)

Após correções, o sistema está pronto para uso em produção.
