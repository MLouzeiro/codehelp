# Squad CodeHelp Full-Stack — Memorias

## Padroes do Projeto
- Backend: Node.js + Express + TypeScript + Prisma + SQLite
- Frontend: React 18 + Vite + TypeScript + Tailwind
- Auth: JWT (access 15min + refresh 7d) + bcrypt cost 12
- RBAC: admin / vendedor (filtro no WHERE do Prisma)

## Licoes Aprendidas
- NUNCA commitar em main sem autorizacao
- whatsapp-web.js: 1 Chromium por Client (nao rodar multiplos simultaneos)
- Race conditions em protocolo: usar lock serializavel
- "Nao Mexer no Que Funciona" e regra absoluta
- Frontend sempre chama /api/whatsapp/send (nao /api/whatsapp/tickets/:id/send)
- Multi-conexoes devem ser serializadas (1 Puppeteer por vez)
- Usar React.lazy() para code splitting em todas as paginas
- N+1 queries sao o maior gargalo de performance no backend
- Polling intervals: minimo 10s para kanbans, 15s para status boards
- Prisma schema precisa de indices em campos de WHERE frequente

## Execucoes Anteriores

### Run #1 (2026-07-06) — Melhoria Completa
- Code splitting com React.lazy()
- 4 novos endpoints de BI
- N+1 query fix
- 17 indices de banco
- 12 menus renomeados
- Grid responsivo
- Polling otimizado
- Resultado: 293/295 testes, typecheck limpo
