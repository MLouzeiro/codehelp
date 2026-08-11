const API_URL = 'http://localhost:3010';
let TOKEN = '';
let TICKET_ID = '';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token || TOKEN) headers['Authorization'] = 'Bearer ' + (token || TOKEN);
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function log(t) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + t);
  console.log('='.repeat(60));
}

function logMsg(de, msg) {
  const p = de === 'CLIENTE' ? '\x1b[36m📱' : de === 'BOT' ? '\x1b[33m🤖' : de === 'IA' ? '\x1b[35m🧠' : de === 'ERRO' ? '\x1b[31m❌' : '\x1b[32m📋';
  console.log(p + ' [' + de + ']:\x1b[0m ' + msg);
}

async function main() {
  console.log('\x1b[1m\x1b[36m🚀 SIMULAÇÃO DO FLUXO DE AUTO-ATENDIMENTO\x1b[0m');
  console.log('-'.repeat(60));

  // 1. Login
  log('1. LOGIN DO ADMIN');
  const loginRes = await api('POST', '/api/auth/login', { email: 'admin@codemed.com.br', password: 'admin123' });
  if (loginRes.status !== 200) { console.log('❌ Falha no login:', JSON.stringify(loginRes.data)); return; }
  TOKEN = loginRes.data.accessToken;
  logMsg('BOT', 'Login OK. Usuário: ' + loginRes.data.user.name);

  // 2. Departamentos
  log('2. DEPARTAMENTOS ATIVOS');
  const deptRes = await api('GET', '/api/helpdesk/departamentos');
  let deptos = Array.isArray(deptRes.data) ? deptRes.data.filter(d => d.ativo) : [];
  deptos.forEach((d, i) => logMsg('BOT', (i+1) + '️⃣  ' + d.nome));

  // 3. Config auto-atendimento
  log('3. CONFIG AUTO-ATENDIMENTO');
  const configRes = await api('GET', '/api/ai/validacoes/config');
  if (configRes.data) {
    logMsg('BOT', 'Auto-atendimento: ' + (configRes.data.autoAtendimentoAtivo ? 'ATIVO' : 'INATIVO'));
    logMsg('BOT', 'Threshold: ' + configRes.data.thresholdValidacoes + ' validações');
  }

  // 4. Ativar auto-atendimento
  log('4. ATIVAR AUTO-ATENDIMENTO');
  await api('PATCH', '/api/ai/validacoes/config', { autoAtendimentoAtivo: true, thresholdValidacoes: 3, maxInteracoesIa: 5 });
  logMsg('BOT', '✅ Auto-atendimento ATIVADO');

  // 5. Criar ticket via WhatsApp
  log('5. CLIENTE ENVIA PRIMEIRA MENSAGEM');
  logMsg('CLIENTE', 'Olá, preciso de ajuda com meu sistema');
  const criarRes = await api('POST', '/api/whatsapp/tickets', { contactName: 'João Silva', contactPhone: '51998765432' });
  if (criarRes.status === 201) {
    TICKET_ID = criarRes.data.id;
    logMsg('BOT', 'Ticket criado: ' + TICKET_ID.slice(0,8) + ' | Etapa: ' + criarRes.data.etapa);
  } else if (criarRes.status === 409 && criarRes.data.ticket) {
    TICKET_ID = criarRes.data.ticket.id;
    logMsg('BOT', 'Ticket já existe: ' + TICKET_ID.slice(0,8) + ' | Reutilizando...');
  } else {
    logMsg('ERRO', 'Falha ao criar ticket: ' + JSON.stringify(criarRes.data));
    return;
  }

  // 6. Menu de departamentos
  log('6. BOT ENVIA MENU DE DEPARTAMENTOS');
  const opcoes = deptos.map((d,i) => (i+1) + '️⃣  ' + d.nome).join('\n');
  logMsg('BOT', 'Olá! Boa tarde, João Silva 👋\n\nQue bom ter você por aqui!\n\nPor favor, selecione o departamento desejado:\n\n' + opcoes);

  // 7. Cliente seleciona departamento
  log('7. CLIENTE SELECIONA DEPARTAMENTO');
  logMsg('CLIENTE', '1');
  if (deptos.length > 0) {
    await api('PATCH', '/api/whatsapp/tickets/' + TICKET_ID, { departamentoId: deptos[0].id, etapa: 'fila' });
    logMsg('BOT', 'Departamento "' + deptos[0].nome + '" selecionado!');
  }

  // 8. Bot pede descrição
  log('8. BOT PEDE DESCRIÇÃO DO PROBLEMA');
  logMsg('BOT', 'Perfeito, João Silva! ✅\nVocê selecionou *' + deptos[0].nome + '*.\n\n📝 Por favor, descreva detalhadamente seu problema ou solicitação.\nQuanto mais informações, melhor poderemos ajudá-lo.\n\nAguardamos sua mensagem!');

  // 9. Cliente descreve problema
  const descCliente = 'Meu sistema de faturamento está dando erro ao gerar boletos. Quando clico em gerar, aparece erro 500 e não gera nada. Isso está acontecendo desde ontem.';
  log('9. CLIENTE ENVIA DESCRIÇÃO DO PROBLEMA');
  logMsg('CLIENTE', descCliente);

  // 10. IA analisa
  log('10. IA ANALISA DESCRIÇÃO DO PROBLEMA');
  await api('PATCH', '/api/whatsapp/tickets/' + TICKET_ID, { assunto: 'Erro 500 ao gerar boletos no faturamento', prioridade: 'alta', categoria: 'financeiro' });
  logMsg('IA', '✅ Análise concluída:');
  logMsg('IA', '   Assunto: "Erro 500 ao gerar boletos no faturamento"');
  logMsg('IA', '   Prioridade: ALTA');
  logMsg('IA', '   Categoria: financeiro');
  logMsg('IA', '   Empresa detectada: null (não mencionou na descrição)');

  // 11. Confirmação
  log('11. BOT ENVIA CONFIRMAÇÃO AO CLIENTE');
  logMsg('BOT', 'João Silva, suas informações foram recebidas! ✅\n\n📋 *Assunto:* Erro 500 ao gerar boletos no faturamento\n⚡ *Prioridade:* 🟠 Alta\n\nEstamos processando seu atendimento. Aguarde um momento.');

  // 12. Pergunta empresa
  log('12. BOT PERGUNTA EMPRESA');
  logMsg('BOT', 'João Silva, de qual laboratório, clínica ou hospital você está entrando em contato?');

  // 13. Cliente responde empresa
  log('13. CLIENTE RESPONDE EMPRESA');
  logMsg('CLIENTE', 'Lab Exemplo');
  const clientRes = await api('POST', '/api/crm/clients', { razaoSocial: 'Lab Exemplo', nomeFantasia: 'Lab Exemplo', segmento: 'laboratorio', origem: 'whatsapp', status: 'ativo' });
  if (clientRes.status === 201) {
    await api('PATCH', '/api/whatsapp/tickets/' + TICKET_ID, { clientId: clientRes.data.id });
    logMsg('BOT', 'Empresa "Lab Exemplo" criada no CRM (ID: ' + clientRes.data.id.slice(0,8) + ')');
    logMsg('BOT', '✅ Empresa vinculada ao ticket');
  } else if (clientRes.status === 409) {
    logMsg('BOT', 'Empresa já existe no CRM');
  } else {
    logMsg('ERRO', 'Falha ao criar cliente: ' + JSON.stringify(clientRes.data));
  }

  // 14. IA gera proposta
  log('14. IA GERA PROPOSTA DE RESPOSTA PARA VALIDAÇÃO');
  const propostaRes = await api('POST', '/api/ai/validacoes', { ticketId: TICKET_ID, mensagemCliente: descCliente });
  if (propostaRes.status === 201 || propostaRes.status === 200) {
    logMsg('IA', 'Proposta criada (ID: ' + propostaRes.data.id.slice(0,8) + ')');
    logMsg('IA', 'Confiança: ' + propostaRes.data.confianca + '%');
    logMsg('IA', 'Status: pendente');
    logMsg('IA', 'Resposta proposta:');
    console.log('\x1b[90m    ┌' + '─'.repeat(58) + '┐\x1b[0m');
    const linhas = (propostaRes.data.respostaProposta || '').match(/.{1,56}/g) || ['(sem resposta)'];
    linhas.slice(0, 4).forEach(l => console.log('\x1b[90m    │\x1b[0m ' + l.padEnd(56) + ' \x1b[90m│\x1b[0m'));
    console.log('\x1b[90m    └' + '─'.repeat(58) + '┘\x1b[0m');
  } else {
    logMsg('IA', 'Fallback: resposta sem Claude API');
    logMsg('IA', 'Resposta: "Estou analisando sua solicitação. Um atendente será acionado em breve."');
  }

  // 15. Criar 3 atendentes para validar (dedup exige usuários diferentes)
  log('15. CRIANDO ATENDENTES PARA VALIDAÇÃO');
  const atendentes = [];
  for (let i = 1; i <= 3; i++) {
    const userRes = await api('POST', '/api/users', { name: 'Atendente ' + i, email: 'atendente' + i + '@teste.com', password: 'teste123', role: 'tecnico' });
    if (userRes.status === 201) {
      const loginA = await api('POST', '/api/auth/login', { email: 'atendente' + i + '@teste.com', password: 'teste123' });
      if (loginA.status === 200) {
        atendentes.push({ id: userRes.data.id, token: loginA.data.accessToken });
        logMsg('BOT', 'Atendente ' + i + ' criado e logado (ID: ' + userRes.data.id.slice(0,8) + ')');
      }
    } else if (userRes.status === 409) {
      const loginA = await api('POST', '/api/auth/login', { email: 'atendente' + i + '@teste.com', password: 'teste123' });
      if (loginA.status === 200) {
        atendentes.push({ id: userRes.data.id || 'existente', token: loginA.data.accessToken });
        logMsg('BOT', 'Atendente ' + i + ' já existe, logado');
      }
    }
  }

  // 16. Validações com usuários diferentes
  const propostaId = propostaRes.data?.id;
  if (propostaId && atendentes.length >= 3) {
    log('16. ATENDENTE 1 VALIDA A RESPOSTA');
    const v1 = await api('PATCH', '/api/ai/validacoes/' + propostaId + '/validar', null, atendentes[0].token);
    if (v1.status === 200) {
      logMsg('ATENDENTE 1', '✅ Resposta VALIDADA (' + v1.data.proposta.validacoesCount + '/3)');
      logMsg('BOT', 'Auto-enviado: ' + (v1.data.autoEnviada ? 'SIM' : 'NÃO (aguardando mais validações)'));
    } else {
      logMsg('ERRO', JSON.stringify(v1.data));
    }

    log('17. ATENDENTE 2 VALIDA A RESPOSTA');
    const v2 = await api('PATCH', '/api/ai/validacoes/' + propostaId + '/validar', null, atendentes[1].token);
    if (v2.status === 200) {
      logMsg('ATENDENTE 2', '✅ Resposta VALIDADA (' + v2.data.proposta.validacoesCount + '/3)');
      logMsg('BOT', 'Auto-enviado: ' + (v2.data.autoEnviada ? 'SIM' : 'NÃO (aguardando mais validações)'));
    } else {
      logMsg('ERRO', JSON.stringify(v2.data));
    }

    log('18. ATENDENTE 3 VALIDA → AUTO-ENVIO!');
    const v3 = await api('PATCH', '/api/ai/validacoes/' + propostaId + '/validar', null, atendentes[2].token);
    if (v3.status === 200) {
      logMsg('ATENDENTE 3', '✅ Resposta VALIDADA (' + v3.data.proposta.validacoesCount + '/3)');
      if (v3.data.autoEnviada) {
        logMsg('BOT', '📤 RESPOSTA ENVIADA AO CLIENTE VIA WHATSAPP!');
        logMsg('BOT', 'Status: auto_enviada');
      } else {
        logMsg('BOT', 'Auto-enviado: NÃO');
      }
    } else {
      logMsg('ERRO', JSON.stringify(v3.data));
    }
  } else {
    log('16-18. VALIDAÇÕES');
    logMsg('ERRO', 'Não foi possível criar 3 atendentes (' + atendentes.length + ' disponíveis)');
  }

  // 19. Métricas
  log('19. MÉTRICAS DE VALIDAÇÃO');
  const met = await api('GET', '/api/ai/validacoes/metricas');
  if (met.status === 200) {
    logMsg('BOT', 'Total propostas: ' + met.data.totalPropostas);
    logMsg('BOT', 'Pendentes: ' + met.data.pendentes);
    logMsg('BOT', 'Validadas: ' + met.data.validadas);
    logMsg('BOT', 'Auto-enviadas: ' + met.data.autoEnviadas);
    logMsg('BOT', 'Rejeitadas: ' + met.data.rejeitadas);
    logMsg('BOT', 'Taxa de uso: ' + met.data.taxaDeUso + '%');
  }

  // 20. Estado final
  log('20. ESTADO FINAL DO TICKET');
  const ticket = await api('GET', '/api/whatsapp/tickets/' + TICKET_ID);
  if (ticket.status === 200) {
    logMsg('BOT', 'Protocolo: ' + (ticket.data.protocolo || 'N/A'));
    logMsg('BOT', 'Assunto: ' + ticket.data.assunto);
    logMsg('BOT', 'Prioridade: ' + ticket.data.prioridade);
    logMsg('BOT', 'Categoria: ' + ticket.data.categoria);
    logMsg('BOT', 'Etapa: ' + ticket.data.etapa);
    logMsg('BOT', 'Cliente: ' + (ticket.data.client?.razaoSocial || 'N/A'));
    logMsg('BOT', 'Mensagens IA: ' + ticket.data.iaMensagensEnviadas);
  }

  console.log('\n\n\x1b[1m\x1b[32m╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SIMULAÇÃO COMPLETA! ✅                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log('║  Fluxo executado:                                          ║');
  console.log('║  1. Cliente envia msg → Bot cria ticket (triagem)          ║');
  console.log('║  2. Bot envia menu de departamentos (dinâmico)             ║');
  console.log('║  3. Cliente seleciona "1" → Ticket vai para fila           ║');
  console.log('║  4. Bot pede descrição do problema                         ║');
  console.log('║  5. Cliente descreve → IA analisa                          ║');
  console.log('║     → Assunto: "Erro 500 ao gerar boletos"                ║');
  console.log('║     → Prioridade: ALTA                                     ║');
  console.log('║     → Empresa: não detectada na descrição                  ║');
  console.log('║  6. Bot confirma dados + pergunta empresa                  ║');
  console.log('║  7. Cliente responde "Lab Exemplo"                         ║');
  console.log('║     → Cria no CRM + vincula ao ticket                     ║');
  console.log('║  8. IA gera proposta de resposta                           ║');
  console.log('║  9. 3 atendentes validam → AUTO-ENVIO!                    ║');
  console.log('║                                                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');
}

main().catch(console.error);
