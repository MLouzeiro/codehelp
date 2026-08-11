# CodeHelp — Script de Vídeo de Demonstração

## Pré-requisitos
- Backend rodando (`npm run dev:backend`)
- Frontend rodando (`npm run dev:frontend`)
- Usuário admin logado
- WhatsApp conectado (pelo menos 1 conexão)
- Dados de teste no banco (rodar `npm run db:seed`)

---

## Cena 1: Login e Dashboard (0:00 - 0:30)

### Ação
1. Acessar `http://localhost:5173/login`
2. Fazer login com admin@codemed.com.br / admin123
3. Dashboard carrega automaticamente

### Narração
> "Bem-vindo ao CodeHelp CRM/Helpdesk. Ao fazer login, somos direcionados ao Painel Geral com visão completa das operações."

### Destaque
- 8 cards de KPIs no topo
- Gráficos de chamados por período, categoria, status
- Novos gráficos: Chamados por Departamento e CSAT Trending
- Painel de Insights de IA

---

## Cena 2: Menu e Navegação (0:30 - 1:00)

### Ação
1. Mostrar sidebar com todos os menus
2. Passar o mouse sobre cada menu mostrando os nomes claros
3. Abrir o menu "Configurações" mostrando os submenus

### Narração
> "A sidebar possui 16 menus organizados por funcionalidade. Os nomes foram simplificados para fácil entendimento: Painel Geral, Chamados, Atendimento Ao Vivo, Relatórios e Métricas, e assim por diante."

### Destaque
- Nomes em português claro
- Ícones ilustrativos
- Hierarquia de permissões (alguns menus só aparecem para admin/gerente)

---

## Cena 3: Chamados - Kanban (1:00 - 2:00)

### Ação
1. Clicar em "Chamados"
2. Mostrar o kanban com colunas (Triagem, Fila, Em Atendimento, etc.)
3. Clicar em um ticket para ver detalhes
4. Mostrar o painel lateral com informações do ticket
5. Mostrar as mensagens/conversa

### Narração
> "O Kanban de Chamados é o centro de operações. Cada card representa um ticket com prioridade, cliente e tempo. Ao clicar, vemos detalhes completos incluindo conversa, dados do cliente e ações disponíveis."

### Destaque
- Drag-and-drop entre colunas
- Filtro por departamento
- Indicador de conexão WhatsApp
- Botões de ação: Assumir, Atribuir, Resolver

---

## Cena 4: Envio de Mensagem (2:00 - 2:30)

### Ação
1. Abrir um ticket em atendimento
2. Digitar uma mensagem na caixa de texto
3. Enviar a mensagem
4. Mostrar a mensagem aparecendo na conversa

### Narração
> "O atendente pode responder diretamente pelo sistema. A mensagem é enviada via WhatsApp e fica registrada no histórico do ticket."

### Destaque
- Input com placeholder "Digite sua mensagem..."
- Botão de envio
- Mensagem aparece na conversa com indicador "Você"
- Loading state durante envio

---

## Cena 5: Relatórios e Métricas (2:30 - 3:15)

### Ação
1. Clicar em "Relatórios e Métricas"
2. Mostrar os KPIs: MTTR, MTFA, SLA, FCR, CSAT
3. Mostrar gráficos: backlog por etapa, por prioridade, por fila
4. Mostrar tabela de performance por agente

### Narração
> "A tela de Métricas oferece visão detalhada do desempenho. Temos MTTR, MTFA, compliance de SLA, resolução no primeiro contato e satisfação do cliente. Os gráficos mostram backlog por etapa, prioridade e fila."

### Destaque
- Seletor de período
- Gráficos interativos
- Tabela de performance com ordenação

---

## Cena 6: WhatsApp e Multi-Conexão (3:15 - 4:00)

### Ação
1. Clicar em "WhatsApp"
2. Mostrar a interface de chat
3. Selecionar uma conversa
4. Enviar uma mensagem
5. Clicar em "Conexão WhatsApp"
6. Mostrar as conexões cadastradas
7. Conectar uma nova conexão (mostrar QR Code)

### Narração
> "A integração WhatsApp permite atender clientes diretamente pelo sistema. Cada mensagem recebe um ticket automaticamente. Na tela de Conexões, podemos gerenciar múltiplos números WhatsApp, conectando cada um a um departamento específico."

### Destaque
- Lista de conversas com preview
- Chat em tempo real
- QR Code para pareamento
- Status de cada conexão (conectado/desconectado)
- Ação de conectar/desconectar

---

## Cena 7: Atendimento Ao Vivo (4:00 - 4:30)

### Ação
1. Clicar em "Atendimento Ao Vivo"
2. Mostrar o painel operacional
3. Destacar tickets em atendimento com tempo decorrido
4. Mostrar status dos atendentes

### Narração
> "O Painel Ao Vivo dá visibilidade em tempo real para supervisores. Vemos quem está atendendo, há quanto tempo, e quantos tickets estão na fila de espera."

### Destaque
- Tickets com tempo decorrido (cor por urgência)
- Status dos atendentes (online/offline)
- Contadores de fila e conclusões

---

## Cena 8: Configurações (4:30 - 5:00)

### Ação
1. Clicar em "Configurações"
2. Mostrar os 11 submenus
3. Abrir "Helpdesk" mostrando mensagens automáticas
4. Abrir "Departamentos" mostrando a lista

### Narração
> "As Configurações centralizam toda a administração do sistema. Podemos gerenciar usuários, permissões, mensagens automáticas, departamentos, filas, níveis de suporte e muito mais."

### Destaque
- Grid de opções com ícones e descrições
- Formulários de edição
- Toggle de ativar/desativar

---

## Cena 9: Performance e Responsividade (5:00 - 5:15)

### Ação
1. Redimensionar o navegador para 320px (mobile)
2. Mostrar o menu hamburger
3. Mostrar o kanban com scroll horizontal
4. Voltar para 1440px (desktop)

### Narração
> "O sistema é totalmente responsivo. Em dispositivos móveis, o menu se adapta com hamburger, e o kanban funciona com scroll horizontal. A performance foi otimizada com code splitting e polling inteligente."

### Destaque
- Menu hamburger em mobile
- Grid responsivo (2/3/4/7 colunas)
- Carregamento sob demanda (React.lazy)

---

## Cena 10: Encerramento (5:15 - 5:30)

### Ação
1. Voltar ao Dashboard
2. Mostrar os gráficos carregando suavemente
3. Fade out

### Narração
> "CodeHelp CRM/Helpdesk — sistema completo para gestão de atendimento. Visão geral, chamados, WhatsApp, relatórios e configurações, tudo em uma plataforma integrada."

---

## Dicas de Gravação

### Ferramentas Recomendadas
- **OBS Studio** (gratuito) para gravar tela
- **CapCut** ou **DaVinci Resolve** para edição
- **Loom** para gravação rápida com narração

### Configurações de Gravação
- Resolução: 1920x1080 (Full HD)
- FPS: 30
- Formato: MP4 (H.264)

### Ritmo
- Cenas 1-3: Ritmo normal (mostrar funcionalidade)
- Cenas 4-6: Ritmo mais lento (detalhar ações)
- Cenas 7-10: Ritmo rápido (resumo visual)

### Música de Fundo
- Lo-fi ou ambient (sem letra)
- Volume baixo (10-20% do áudio)

### Legendas
- Adicionar legendas em português
- Fonte: sans-serif, fundo semi-transparente
- Tamanho: 24px

---

## Versões do Vídeo

| Versão | Duração | Público |
|--------|---------|---------|
| Completa | 5:30 | Clientes, equipe |
| Resumida | 2:00 | Demonstrações rápidas |
| Feature Focus | 1:00 | WhatsApp, Relatórios |

---

## Checklist Pós-Gravação

- [ ] Áudio limpo e claro
- [ ] Legendas adicionadas
- [ ] Música de fundo no volume certo
- [ ] Transições suaves
- [ ] Logo/marca d'água
- [ ] Call to action no final
- [ ] Exportar em 1080p
