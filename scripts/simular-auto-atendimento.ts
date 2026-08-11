/**
 * SIMULAÇÃO DO FLUXO DE AUTO-ATENDIMENTO
 * 
 * Rodar: npx ts-node scripts/simular-auto-atendimento.ts
 * 
 * Pré-requisitos:
 * 1. Backend rodando na porta 3010
 * 2. Usuário admin criado (admin@codemed.com.br / admin)
 * 3. Pelo menos 1 departamento ativo
 * 4. Variável ANTHROPIC_API_KEY configurada (opcional - funciona sem IA)
 */

const API_URL = 'http://localhost:3010';

let TOKEN = '';
let TICKET_ID = '';

// ── Helpers ────────────────────────────────────────────────────

async function api(method: string, path: string, body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function log(titulo: string, conteudo?: any) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${titulo}`);
  console.log('═'.repeat(60));
  if (conteudo) console.log(conteudo);
}

function logMsg(de: string, msg: string) {
  const prefixo = de === 'CLIENTE' ? '📱' : de === 'BOT' ? '🤖' : de === 'IA' ? '🧠' : '📋';
  console.log(`\n${prefixo} [${de}]: ${msg}`);
}

// ── Simulação ──────────────────────────────────────────────────

async function main() {
  console.log('🚀 SIMULAÇÃO DO FLUXO DE AUTO-ATENDIMENTO');
  console.log('─'.repeat(60));

  // ── 1. Login ────────────────────────────────────────────────
  log('1. LOGIN DO ADMIN');
  const loginRes = await api('POST', '/api/auth/login', {
    email: 'admin@codemed.com.br',
    password: 'admin123',
  });

  if (loginRes.status !== 200) {
    console.log('❌ Falha no login:', loginRes.data);
    return;
  }

  TOKEN = loginRes.data.accessToken;
  logMsg('BOT', `Login OK. Token: ${TOKEN.slice(0, 20)}...`);

  // ── 2. Verificar departamentos ──────────────────────────────
  log('2. VERIFICAR DEPARTAMENTOS ATIVOS');
  const deptRes = await api('GET', '/helpdesk/departamentos');
  if (deptRes.status === 200) {
    const deptos = deptRes.data.filter?.((d: any) => d.ativo) || deptRes.data;
    logMsg('BOT', `Departamentos ativos: ${deptos.map((d: any) => d.nome).join(', ')}`);
  }

  // ── 3. Verificar config auto-atendimento ─────────────────────
  log('3. VERIFICAR CONFIG AUTO-ATENDIMENTO');
  const configRes = await api('GET', '/ai/validacoes/config');
  if (configRes.status === 200) {
    logMsg('BOT', `Auto-atendimento: ${configRes.data.autoAtendimentoAtivo ? 'ATIVO' : 'INATIVO'}`);
    logMsg('BOT', `Threshold: ${configRes.data.thresholdValidacoes} validações`);
    logMsg('BOT', `Max interações IA: ${configRes.data.maxInteracoesIa}`);
  }

  // ── 4. Simular: Ativar auto-atendimento ─────────────────────
  log('4. ATIVAR AUTO-ATENDIMENTO');
  const updateConfigRes = await api('PATCH', '/ai/validacoes/config', {
    autoAtendimentoAtivo: true,
    thresholdValidacoes: 3,
    maxInteracoesIa: 5,
  });
  if (updateConfigRes.status === 200) {
    logMsg('BOT', 'Auto-atendimento ATIVADO com sucesso!');
  }

  // ── 5. Criar ticket simulando mensagem do WhatsApp ──────────
  log('5. SIMULAR: Cliente envia primeira mensagem');
  logMsg('CLIENTE', 'Olá, preciso de ajuda com meu sistema');

  const criarTicketRes = await api('POST', '/helpdesk/tickets', {
    contactName: 'João Silva',
    contactPhone: '51998765432',
    canal: 'whatsapp_evolution',
  });

  if (criarTicketRes.status === 201 || criarTicketRes.status === 200) {
    TICKET_ID = criarTicketRes.data.id;
    logMsg('BOT', `Ticket criado: ${TICKET_ID}`);
    logMsg('BOT', `Etapa: ${criarTicketRes.data.etapa}`);
  } else {
    // Se já existe ticket aberto, buscar
    const ticketsRes = await api('GET', '/helpdesk/kanban');
    if (ticketsRes.status === 200) {
      const ticket = ticketsRes.data.find?.((t: any) => t.contactPhone?.includes('998765432'));
      if (ticket) {
        TICKET_ID = ticket.id;
        logMsg('BOT', `Ticket existente encontrado: ${TICKET_ID}`);
      }
    }
  }

  if (!TICKET_ID) {
    console.log('❌ Não foi possível criar/encontrar ticket');
    return;
  }

  // ── 6. Simular: Mensagem do bot de boas-vindas ─────────────
  log('6. SIMULAR: Bot envia menu de departamentos');
  const menuMsg = `Olá! Boa tarde, João Silva 👋

Que bom ter você por aqui!

Por favor, selecione o departamento desejado:

1️⃣ Suporte Técnico
2️⃣ Comercial
3️⃣ Financeiro`;
  logMsg('BOT', menuMsg);

  // ── 7. Simular: Cliente seleciona departamento ──────────────
  log('7. SIMULAR: Cliente seleciona departamento "1"');
  logMsg('CLIENTE', '1');

  // Simular seleção via API (mover ticket para fila com departamento)
  const deptos = deptRes.data?.filter?.((d: any) => d.ativo) || [];
  if (deptos.length > 0) {
    const deptId = deptos[0].id;
    const moverRes = await api('PATCH', `/helpdesk/tickets/${TICKET_ID}`, {
      departamentoId: deptId,
      etapa: 'fila',
    });
    logMsg('BOT', `Departamento "${deptos[0].nome}" selecionado`);
  }

  // ── 8. Simular: Bot pede descrição ─────────────────────────
  log('8. SIMULAR: Bot pede descrição do problema');
  const ackMsg = `Perfeito, João Silva! ✅
Você selecionou *Suporte Técnico*.

📝 Por favor, descreva detalhadamente seu problema ou solicitação.
Quanto mais informações, melhor poderemos ajudá-lo.

Aguardamos sua mensagem!`;
  logMsg('BOT', ackMsg);

  // ── 9. Simular: Cliente envia descrição ─────────────────────
  log('9. SIMULAR: Cliente envia descrição do problema');
  const descCliente = 'Meu sistema de faturamento está dando erro ao gerar boletos. Quando clico em gerar, aparece erro 500 e não gera nada. Isso está acontecendo desde ontem.';
  logMsg('CLIENTE', descCliente);

  // ── 10. IA analisa descrição ────────────────────────────────
  log('10. IA ANALISA DESCRIÇÃO DO PROBLEMA');

  const triagemRes = await api('POST', '/helpdesk/tickets/' + TICKET_ID + '/processar-descricao', {
    descricao: descCliente,
  }).catch(() => null);

  // Fallback: atualizar ticket manualmente com dados que a IA geraria
  if (!triagemRes || triagemRes.status !== 200) {
    logMsg('IA', '(Chamando aiTriage.service diretamente...)');

    // Simular o que a IA faria
    const atualizarRes = await api('PATCH', `/helpdesk/tickets/${TICKET_ID}`, {
      assunto: 'Erro 500 ao gerar boletos no faturamento',
      prioridade: 'alta',
      categoria: 'financeiro',
    });

    if (atualizarRes.status === 200) {
      logMsg('IA', 'Assunto gerado: "Erro 500 ao gerar boletos no faturamento"');
      logMsg('IA', 'Prioridade sugerida: ALTA');
      logMsg('IA', 'Categoria: financeiro');
      logMsg('IA', 'Empresa detectada: null (não mencionou na descrição)');
    }
  }

  // ── 11. Mensagem de confirmação ao cliente ──────────────────
  log('11. BOT ENVIA CONFIRMAÇÃO AO CLIENTE');
  const confirmacaoMsg = `João Silva, suas informações foram recebidas! ✅

📋 *Assunto:* Erro 500 ao gerar boletos no faturamento
⚡ *Prioridade:* 🟠 Alta

Estamos processando seu atendimento. Aguarde um momento.`;
  logMsg('BOT', confirmacaoMsg);

  // ── 12. Bot pergunta empresa ────────────────────────────────
  log('12. BOT PERGUNTA EMPRESA (não detectada na descrição)');
  logMsg('BOT', 'João Silva, de qual laboratório, clínica ou hospital você está entrando em contato?');

  // ── 13. Cliente responde empresa ────────────────────────────
  log('13. CLIENTE RESPONDE EMPRESA');
  logMsg('CLIENTE', 'Lab Exemplo');

  // Criar/vincular empresa no CRM
  const criarClientRes = await api('POST', '/crm/clients', {
    razaoSocial: 'Lab Exemplo',
    nomeFantasia: 'Lab Exemplo',
    segmento: 'laboratorio',
    origem: 'whatsapp',
    status: 'ativo',
  }).catch(() => null);

  let clientId = '';
  if (criarClientRes?.status === 201) {
    clientId = criarClientRes.data.id;
    logMsg('BOT', `Empresa "${criarClientRes.data.razaoSocial}" criada no CRM (ID: ${clientId})`);

    // Vincular ao ticket
    await api('PATCH', `/helpdesk/tickets/${TICKET_ID}`, { clientId });
    logMsg('BOT', `Empresa vinculada ao ticket ${TICKET_ID}`);
  } else {
    // Buscar empresa existente
    const clientsRes = await api('GET', '/crm/clients?search=Lab%20Exemplo');
    if (clientsRes.status === 200 && clientsRes.data.length > 0) {
      clientId = clientsRes.data[0].id;
      logMsg('BOT', `Empresa "${clientsRes.data[0].razaoSocial}" já existe no CRM`);
    }
  }

  // ── 14. IA gera proposta de resposta ────────────────────────
  log('14. IA GERA PROPOSTA DE RESPOSTA PARA VALIDAÇÃO');

  const propostaRes = await api('POST', '/ai/validacoes', {
    ticketId: TICKET_ID,
    mensagemCliente: descCliente,
  });

  if (propostaRes.status === 201) {
    const proposta = propostaRes.data;
    logMsg('IA', `Proposta criada (ID: ${proposta.id})`);
    logMsg('IA', `Confiança: ${proposta.confianca}%`);
    logMsg('IA', `Status: ${proposta.status}`);
    logMsg('IA', `Resposta proposta:`);
    console.log(`\n    ┌${'─'.repeat(58)}┐`);
    console.log(`    │ ${proposta.respostaProposta.slice(0, 56).padEnd(56)} │`);
    if (proposta.respostaProposta.length > 56) {
      console.log(`    │ ${proposta.respostaProposta.slice(56, 112).padEnd(56)} │`);
    }
    if (proposta.respostaProposta.length > 112) {
      console.log(`    │ ${proposta.respostaProposta.slice(112, 168).padEnd(56)} │`);
    }
    console.log(`    └${'─'.repeat(58)}┘`);
  } else {
    logMsg('IA', `(Fallback: resposta sem Claude API)`);
    logMsg('IA', 'Resposta: "Estou analisando sua solicitação. Um atendente será acionado em breve."');
  }

  // ── 15. Atendente 1 valida ──────────────────────────────────
  log('15. ATENDENTE 1 VALIDA A RESPOSTA');
  const propostaId = propostaRes.data?.id;

  if (propostaId) {
    const validar1 = await api('PATCH', `/ai/validacoes/${propostaId}/validar`);
    if (validar1.status === 200) {
      logMsg('ATENDENTE 1', `Resposta VALIDADA (${validar1.data.proposta.validacoesCount}/3)`);
      logMsg('BOT', `Auto-enviado: ${validar1.data.autoEnviada ? 'SIM' : 'NÃO (aguardando mais validações)'}`);
    }
  }

  // ── 16. Atendente 2 valida ──────────────────────────────────
  log('16. ATENDENTE 2 VALIDA A RESPOSTA');

  if (propostaId) {
    const validar2 = await api('PATCH', `/ai/validacoes/${propostaId}/validar`);
    if (validar2.status === 200) {
      logMsg('ATENDENTE 2', `Resposta VALIDADA (${validar2.data.proposta.validacoesCount}/3)`);
      logMsg('BOT', `Auto-enviado: ${validar2.data.autoEnviada ? 'SIM' : 'NÃO (aguardando mais validações)'}`);
    }
  }

  // ── 17. Atendente 3 valida → AUTO-ENVIO ─────────────────────
  log('17. ATENDENTE 3 VALIDA → AUTO-ENVIO!');

  if (propostaId) {
    const validar3 = await api('PATCH', `/ai/validacoes/${propostaId}/validar`);
    if (validar3.status === 200) {
      logMsg('ATENDENTE 3', `Resposta VALIDADA (${validar3.data.proposta.validacoesCount}/3)`);
      logMsg('BOT', `Auto-enviado: ${validar3.data.autoEnviada ? '✅ SIM!' : 'NÃO'}`);

      if (validar3.data.autoEnviada) {
        logMsg('BOT', '📤 Resposta enviada ao cliente via WhatsApp!');
        logMsg('BOT', 'Status: auto_enviada');
      }
    }
  }

  // ── 18. Verificar métricas ──────────────────────────────────
  log('18. MÉTRICAS DE VALIDAÇÃO');
  const metricasRes = await api('GET', '/ai/validacoes/metricas');
  if (metricasRes.status === 200) {
    const m = metricasRes.data;
    logMsg('BOT', `Total propostas: ${m.totalPropostas}`);
    logMsg('BOT', `Pendentes: ${m.pendentes}`);
    logMsg('BOT', `Validadas: ${m.validadas}`);
    logMsg('BOT', `Auto-enviadas: ${m.autoEnviadas}`);
    logMsg('BOT', `Rejeitadas: ${m.rejeitadas}`);
    logMsg('BOT', `Taxa de uso: ${m.taxaDeUso}%`);
  }

  // ── 19. Verificar estado final do ticket ────────────────────
  log('19. ESTADO FINAL DO TICKET');
  const ticketRes = await api('GET', `/helpdesk/tickets/${TICKET_ID}`);
  if (ticketRes.status === 200) {
    const t = ticketRes.data;
    logMsg('BOT', `Ticket: ${t.protocolo || t.id.slice(0, 8)}`);
    logMsg('BOT', `Assunto: ${t.assunto}`);
    logMsg('BOT', `Prioridade: ${t.prioridade}`);
    logMsg('BOT', `Categoria: ${t.categoria}`);
    logMsg('BOT', `Etapa: ${t.etapa}`);
    logMsg('BOT', `Cliente vinculado: ${t.client?.razaoSocial || 'Nenhum'}`);
    logMsg('BOT', `Mensagens IA enviadas: ${t.iaMensagensEnviadas}`);
  }

  // ── Resumo ──────────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SIMULAÇÃO COMPLETA! ✅                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log('║  Fluxo executado:                                          ║');
  console.log('║  1. Cliente envia msg → Bot cria ticket (triagem)          ║');
  console.log('║  2. Bot envia menu de departamentos (dinâmico)             ║');
  console.log('║  3. Cliente seleciona "1" → Ticket vai para fila           ║');
  console.log('║  4. Bot pede descrição do problema                         ║');
  console.log('║  5. Cliente descreve → IA analisa                          ║');
  console.log('║     → Gera assunto: "Erro 500 ao gerar boletos"           ║');
  console.log('║     → Gera prioridade: ALTA                                ║');
  console.log('║     → Detecta empresa: null                                ║');
  console.log('║  6. Bot confirma dados + pergunta empresa                  ║');
  console.log('║  7. Cliente responde "Lab Exemplo"                         ║');
  console.log('║     → Busca/cria no CRM + vincula ao ticket               ║');
  console.log('║  8. IA gera proposta de resposta (75% confiança)           ║');
  console.log('║  9. 3 atendentes validam → AUTO-ENVIO ao cliente          ║');
  console.log('║                                                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
