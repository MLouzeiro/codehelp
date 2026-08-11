# Step 01 — Análise Técnica (Tech Lead: Ricardo Almeida)

## Escopo Definido

### Fase 1: Performance & Code Splitting
- React.lazy() em App.tsx para todas as páginas
- Memoização no Dashboard (useCallback/useMemo)
- Reduzir polling: HelpdeskKanban 10s→15s, WhatsApp 2s→5s
- Extrair componentes grandes em arquivos separados

### Fase 2: Responsividade
- HelpdeskStatusBoard: grid responsivo com scroll horizontal
- KanbanPage: layout mobile com sidebar colapsável
- Modais: centralizar em mobile

### Fase 3: Refatoração de Menus
- Renomear nomes dos menus para claros em pt-BR
- Reorganizar hierarquia (agrupar helpdesk, crm, whatsapp)

### Fase 4: BI/Gráficos
- Novo gráfico: tickets por departamento (BarChart)
- Novo gráfico: tempo médio por fila (LineChart)
- Novo gráfico: CSAT trending (AreaChart)
- Gráfico de barras empilhado: status por dia

### Fase 5: WhatsApp Multi-conexão
- WhatsAppPage: seletor de conexão no header
- HelpdeskKanban: badge de conexão por ticket
- Roteamento de mensagens por conexão

### Fase 6: Documentação
- Atualizar AGENTS.md
- Criar docs/menus.md com descrição de cada menu

## Arquivos Afetados
- App.tsx (lazy loading)
- Dashboard.tsx (memoização + novos gráficos)
- HelpdeskKanban.tsx (polling + conexão)
- WhatsAppPage.tsx (seletor de conexão + polling)
- HelpdeskStatusBoard.tsx (responsividade)
- KanbanPage.tsx (responsividade)
- Layout.tsx (menus renomeados)
- AGENTS.md (docs)
- docs/menus.md (novo)

## Padrões
- Seguir "Não Mexer no Que Funciona"
- Preferir estender > substituir > reformatar
- Typecheck limpo antes de cada fase
- Testes passando antes de cada fase
