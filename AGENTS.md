# AGENTS.md — code-help CRM Kanban

## Versionamento (regra absoluta)

| Branch / Tag | Significado | Pode mexer? |
|--------------|-------------|-------------|
| `main`       | Versão **em uso** (estável)            | **NÃO** sem autorização explícita do usuário |
| `develop`    | Próxima versão em desenvolvimento      | SIM — todo trabalho novo vai aqui |
| `v1.x`       | Tag de marco estável                   | NÃO — apenas referência histórica |
| `v1.x.y`     | Tag de patch/bugfix                   | NÃO — apenas referência histórica |

### Fluxo de desenvolvimento

1. Usuário marca uma versão como "em uso" (ex: v1.3)
2. Tag `v1.3` é criada e o usuário é avisado: "v1.3 estável, a partir de agora desenvolver em `develop`"
3. Próximas features/bugs vão em branch `develop` (commits com prefixo `v1.4-dev:`)
4. Quando o usuário testar e aprovar a `develop`:
   - Cria tag `v1.4` na develop
   - Merge da develop em main
   - Próximo ciclo recomeça

### Regra de ouro

> **NUNCA commitar em `main` sem que o usuário diga "pode atualizar" / "merge em main" / "tag v1.4" / similar.**
>
> **NUNCA alterar tag já existente (v1.0, v1.1, v1.2, v1.3, etc) — tags são imutáveis.**

### Checklist antes de commitar em `develop`

- [ ] Branch atual é `develop` (não `main`)
- [ ] `npx tsc --noEmit` limpo no backend e frontend
- [ ] `npm test` backend: 32/32 OK
- [ ] Mudança escopada (não mexe em código que está funcionando, ver regra abaixo)
- [ ] Commit message começa com `v1.4-dev:` (ou versão atual da develop)

### Exceções (únicas situações em que posso mexer em main sem autorização)

- **Bugs críticos de segurança** (vazamento de token, SQL injection, etc) — posso corrigir direto em main E na develop
- **Pedido explícito do usuário** — quando ele disser "pode commitar em main" / "merge em main agora"

## Stack

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma + SQLite |
| Auth | JWT (access 15min + refresh 7d) + bcrypt cost 12 |
| Frontend | React 18 + Vite + TypeScript |
| Estilização | Tailwind CSS |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Roteamento | React Router DOM |
| HTTP | Axios com interceptor de refresh |

## Estrutura do projeto

```
code-help/
├── backend/
│   ├── prisma/          # Schema + migrations + seed
│   ├── src/
│   │   ├── config/      # database.ts, env.ts, redis.ts
│   │   ├── modules/     # auth, users, clients, tasks, dashboard
│   │   ├── shared/      # middleware (auth, error)
│   │   └── server.ts    # Entry point
│   ├── storage/pdfs/    # Uploads (gitignored)
│   ├── whatsapp-session/ # Sessão WhatsApp (gitignored)
│   └── dist/            # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/  # UI components, KanbanBoard, Layout
│   │   ├── pages/       # Login, Dashboard, Clients, Kanban, Users
│   │   ├── services/    # api.ts, auth.tsx (context)
│   │   └── types/       # TypeScript interfaces
│   └── dist/            # Build (gitignored)
├── squads/              # ExpxAgents (estado/output gitignored)
├── agents/              # Catálogo de agentes ExpxAgents
├── mcps/                # Configs MCP
├── .claude/             # Skills
├── SPEC.md              # Documento de especificação
├── AGENTS.md            # Este arquivo
├── .claudeignore        # Exclusão de contexto Claude Code
└── .gitignore           # Exclusão git/OpenCode
```

## Comandos principais

```bash
npm run dev               # Backend + frontend em paralelo
npm run dev:backend       # Apenas backend (tsx watch, porta 3001)
npm run dev:frontend      # Apenas frontend (vite, porta 5173)
npm run build             # Build de ambos
npm run db:migrate        # Prisma migrate dev
npm run db:push           # Prisma db push
npm run db:seed           # Executar seed
npm run db:studio         # Prisma Studio
npm run reset             # Encerra node, libera portas, limpa sessão WA e inicia dev (requer Admin)
npm run reset:keep-session # Reset sem apagar sessão WA
```

> `reset-dev.ps1` precisa ser executado como **Administrador** (encerra processos node e remove locks do Chrome na pasta `backend/whatsapp-session`).

## Padrões de código

- **Rotas Express:** `authenticate` global, `authorize('admin')` para rotas restritas
- **Controllers:** `async (req: AuthRequest, res: Response)` com try/catch retornando `{ error: "mensagem" }`
- **Contexto do usuário:** `req.user` tipado como `AuthRequest['user']` (id, email, role)
- **Frontend:** Componentes funcionais, Axios com interceptor 401 → refresh → retry
- **RBAC:** admin (tudo) / vendedor (próprios dados apenas) — filtro no WHERE do Prisma

## Regra de Implementação: Não Mexer no Que Funciona

> **Princípio absoluto:** ao implementar uma feature nova ou corrigir um bug, **não tocar em código que já está funcionando** sem necessidade. Cada linha alterada é uma linha que pode quebrar algo que estava verde.

### Checklist pré-mudança (obrigatório)

Antes de abrir o editor, responder por escrito:

1. **Qual é o escopo?** — Listar arquivo(s) e linha(s) que serão alteradas
2. **Por que cada linha fora do escopo precisa mudar?** — Se não souber responder, **não mexe**
3. **Existe alternativa que adiciona código sem editar o existente?** — Preferir SEMPRE essa via
4. **Se quebrar, como detecto?** — Teste cobrindo o comportamento anterior existe? Se não, **criar antes**

### Checklist pós-mudança (obrigatório)

1. `npx tsc --noEmit` limpo no backend e frontend
2. `npm test` no backend: **todos** os testes passam (atualmente 32/32)
3. `npm test` no frontend: **todos** os testes passam (atualmente 5/5)
4. Se mudou biblioteca externa: validar que a API usada ainda existe no `node_modules/<lib>/index.d.ts`
5. Se mudou schema Prisma: `npx prisma generate` + `npx prisma db push`

### Anti-padrões proibidos (lista negra)

- "Já que estou aqui, vou melhorar X" — **proibido**
- "Esse código está feio, vou reformatar" — **proibido**
- "Vou unificar Y e Z" sem que Y ou Z tenha bug — **proibido**
- Mudar de `var` para `const` em arquivo funcional sem motivo — **proibido**
- Adicionar "proteções" extras em código validado por testes — **proibido**
- "Vou só consertar esse typo que vi de passagem" sem ser o escopo — **proibido**
- Trocar versão de biblioteca para "atualizar" sem motivo de bug — **proibido**

### Hierarquia: estender > substituir > reformatar

- **Estender (preferido):** criar nova função/arquivo e chamar do novo lugar
- **Substituir (aceitável se justificado):** editar função existente quando é o ÚNICO caminho
- **Reformatar (proibido):** renomear, mover, mudar estilo sem motivo funcional

### Regras específicas por categoria

**Integrações externas (whatsapp-web.js, axios, etc.):**
- Mudar de versão **só** se há bug confirmado na versão atual
- Sempre validar API usada no `index.d.ts` da nova versão
- Quando a integração envolve sessão/auth (ex: `whatsapp-session/`), mudanças podem exigir **reset completo da sessão** — avisar o usuário antes

**Geração de identificadores únicos (protocolo, código, sequence):**
- Qualquer função que faça read-modify-write de sequência **deve ter lock** (JS mutex OU transação serializável)
- Validar que o parse da string existente retorna o índice certo (off-by-one é fácil)
- Testar com chamadas paralelas explícitas

**Typo pré-existente:**
- Se um typecheck começou a falhar por código que ninguém mexeu recentemente, **é bug pré-existente** — pode consertar **só o que está bloqueando o build**, nada mais

### Quando a mudança é inevitável

- Documentar no commit: "tocado arquivo X fora do escopo porque Y"
- Garantir cobertura de teste do comportamento anterior **antes** da mudança
- Se quebrar teste existente, **parar e questionar** antes de corrigir o teste

### Casos reais desta jornada (não repetir)

| Data | Bug | Como foi introduzido | Como evitar |
|------|-----|----------------------|-------------|
| 2026-06 | `whatsapp-web.js@1.25.0` quebrou stream de mensagens silenciosamente | Lib desatualizada incompatível com protocolo WA 2024+ | Manter libs de integração atualizadas; reagir a `ultimaMensagem: null` como sinal de incompatibilidade |
| 2026-06 | Race condition `P2002 protocolo` em paralelo | Lock per-chatId não cobre contatos distintos | Qualquer geração de ID sequencial precisa de lock global OU `prisma.$transaction` |
| 2026-06 | Off-by-one `partes[3]` vs `partes[2]` | Bug pré-existente; só manifestou quando WA voltou a funcionar | Validar split com `console.log(partes)` antes de usar índice |
| 2026-06 | Typo `setTimeout(r, r)` no `sleep` | Pré-existente; typecheck começou a reclamar após mudanças | Não ignorar typecheck errors mesmo em código "que funcionava" |

### Frase de efeito

> **"Funcionando é o estado natural. Quebrando é que precisa de motivo."**

## Regras de segurança

- Vendedor só vê/altera próprios registros (filtro `where.sellerId` ou `where.assigneeId`)
- Vendedor não pode criar tasks para outros usuários (forçar `assigneeId = req.user.id`)
- Vendedor não pode criar clientes para outros vendedores (forçar `sellerId = req.user.id`)
- DELETE de clientes/tasks: somente admin (`authorize('admin')`)
- Login com rate limit: 5 tentativas/hora
- Senhas com bcrypt cost 12

## TDD (se aplicável)

- Seed padrão: admin@codemed.com.br / admin123 (role: admin)
- Seed padrão: vendedor@codemed.com.br / admin123 (role: vendedor)
- Rodar seed antes de testar: `npm run db:seed`

## Nunca fazer

- Usar nomes "Leticia" ou "Rafael" em qualquer saída do sistema
- Usar JS puro no backend (sempre TypeScript)
- Expor senhas ou tokens em logs ou respostas de erro
- Dependências externas desnecessárias (preferir drag nativo do HTML5 a bibliotecas)
- Mensagens, textos ou variáveis em inglês no output do sistema (sempre pt-BR)
