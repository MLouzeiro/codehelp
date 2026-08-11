const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();

pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'WIDE';

const COLORS = {
  bg: '0F172A',
  card: '1E293B',
  border: '334155',
  accent: '3B82F6',
  accentLight: '60A5FA',
  accentDark: '1D4ED8',
  text: 'F1F5F9',
  textMuted: '94A3B8',
  textDim: '64748B',
  white: 'FFFFFF',
  green: '10B981',
  purple: '8B5CF6',
  amber: 'F59E0B',
  pink: 'EC4899',
};

function addSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: COLORS.accent } });
  return slide;
}

function addFooter(slide, num, total) {
  slide.addText(`${num} / ${total}`, { x: 11.5, y: 7.0, w: 1.5, h: 0.4, fontSize: 10, color: COLORS.textDim, align: 'right' });
  slide.addText('CodeHelp CRM', { x: 0.5, y: 7.0, w: 2, h: 0.4, fontSize: 10, color: COLORS.accent, bold: true });
}

// ============ SLIDE 1: CAPA ============
{
  const slide = addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLORS.bg } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: '100%', fill: { color: COLORS.accent } });
  
  slide.addText('CodeHelp', { x: 1, y: 0.5, w: 4, h: 0.6, fontSize: 18, color: COLORS.accent, bold: true, fontFace: 'Arial' });
  
  slide.addText('CodeHelp CRM', { x: 1, y: 2.0, w: 11, h: 1.2, fontSize: 54, color: COLORS.white, bold: true, fontFace: 'Arial' });
  slide.addText('Plataforma completa de Helpdesk + CRM para Laboratorios', { x: 1, y: 3.3, w: 10, h: 0.6, fontSize: 22, color: COLORS.textMuted, fontFace: 'Arial' });
  
  slide.addShape(pptx.ShapeType.rect, { x: 1, y: 4.2, w: 11, h: 0.08, fill: { color: COLORS.accent } });
  
  slide.addText('Helpdesk  •  Clientes  •  WhatsApp  •  OS Digital  •  IA', { x: 1, y: 4.6, w: 11, h: 0.5, fontSize: 18, color: COLORS.accentLight, fontFace: 'Arial' });
  
  slide.addText('Codemed Tecnologia - 2026', { x: 1, y: 6.5, w: 5, h: 0.4, fontSize: 12, color: COLORS.textDim, fontFace: 'Arial' });
  addFooter(slide, 1, 12);
}

// ============ SLIDE 2: O QUE E ============
{
  const slide = addSlide();
  slide.addText('Visao Geral', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('O que e o CodeHelp?', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  slide.addText('Uma plataforma integrada que unifica:', { x: 0.8, y: 1.8, w: 5, h: 0.5, fontSize: 18, color: COLORS.textMuted, fontFace: 'Arial' });
  
  const items = [
    'Helpdesk com Kanban e SLA',
    'Gestao de Clientes completa',
    'WhatsApp nativo com menu interativo',
    'OS Digital com assinatura via WhatsApp',
    'Inteligencia Artificial para insights'
  ];
  items.forEach((item, i) => {
    slide.addText(`▸  ${item}`, { x: 1.2, y: 2.5 + i * 0.5, w: 5, h: 0.45, fontSize: 16, color: COLORS.text, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 7, y: 1.8, w: 5.5, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Tecnologias', { x: 7.3, y: 2.0, w: 5, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const techs = ['Node.js + Express + TypeScript', 'React 18 + Vite + Tailwind', 'Prisma ORM + PostgreSQL', 'whatsapp-web.js', 'Anthropic Claude AI'];
  techs.forEach((t, i) => {
    slide.addText(`▸  ${t}`, { x: 7.5, y: 2.7 + i * 0.45, w: 4.8, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 2, 12);
}

// ============ SLIDE 3: MODULOS ============
{
  const slide = addSlide();
  slide.addText('Funcionalidades', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Modulos Principais', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const modules = [
    { icon: '🎧', title: 'Helpdesk', desc: 'Kanban, triagem automatica,\nSLA, escalonamento N1/N2/N3' },
    { icon: '👥', title: 'Clientes', desc: 'CRM completo, contatos,\ncolaboradores, pipeline' },
    { icon: '📱', title: 'WhatsApp', desc: 'Integracao nativa, menu\ninterativo, multi-numero' },
    { icon: '📄', title: 'OS Digital', desc: 'Criacao, assinatura digital\nvia WhatsApp, PDF' },
    { icon: '📚', title: 'Base Conhecimento', desc: 'Artigos com sugestao\npor IA para tickets' },
    { icon: '🤖', title: 'IA e Automacoes', desc: 'Robos WHEN/IF/THEN,\nclassificacao automatica' },
  ];
  
  modules.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 4.1;
    const y = 1.8 + row * 2.6;
    
    slide.addShape(pptx.ShapeType.rect, { x, y, w: 3.8, h: 2.3, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
    slide.addText(m.icon, { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, fontSize: 28 });
    slide.addText(m.title, { x: x + 0.2, y: y + 0.8, w: 3.4, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
    slide.addText(m.desc, { x: x + 0.2, y: y + 1.2, w: 3.4, h: 0.9, fontSize: 12, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 3, 12);
}

// ============ SLIDE 4: HELPDESK ============
{
  const slide = addSlide();
  slide.addText('Helpdesk', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Gestao de Tickets', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const steps = ['WhatsApp', 'Triagem', 'Fila', 'Atendimento', 'Resolvido'];
  steps.forEach((s, i) => {
    const x = 0.8 + i * 2.5;
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.9, w: 2.0, h: 0.6, fill: { color: i === 3 ? COLORS.accent : COLORS.card }, rectRadius: 0.1, line: { color: COLORS.border, width: 1 } });
    slide.addText(s, { x, y: 1.9, w: 2.0, h: 0.6, fontSize: 14, color: COLORS.white, align: 'center', fontFace: 'Arial' });
    if (i < 4) slide.addText('→', { x: x + 2.0, y: 1.9, w: 0.5, h: 0.6, fontSize: 18, color: COLORS.accent, align: 'center' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.0, w: 5.5, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Etapas do Kanban', { x: 1.1, y: 3.2, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const etapas = ['Triagem - Direcionamento', 'Fila de Espera - Aguardando agente', 'Em Atendimento - Sendo processado', 'Aguardando Cliente - Retorno', 'Aguardando OS - Geracao de OS', 'Concluido - Finalizado'];
  etapas.forEach((e, i) => {
    slide.addText(`▸  ${e}`, { x: 1.3, y: 3.7 + i * 0.4, w: 4.8, h: 0.35, fontSize: 13, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 6.8, y: 3.0, w: 5.8, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Recursos de SLA', { x: 7.1, y: 3.2, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const sla = ['Alertas em 75% e 90% do tempo', 'Pausa automatica (aguardando cliente)', 'Escalonamento automatico', 'Considera feriados', 'Configuravel por fila e prioridade'];
  sla.forEach((s, i) => {
    slide.addText(`▸  ${s}`, { x: 7.3, y: 3.7 + i * 0.4, w: 5, h: 0.35, fontSize: 13, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 4, 12);
}

// ============ SLIDE 5: WHATSAPP ============
{
  const slide = addSlide();
  slide.addText('Integracao', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('WhatsApp Nativo', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  slide.addText('Como funciona', { x: 0.8, y: 1.8, w: 5, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const wa = ['Conexao via QR Code', 'Menu interativo por numero', 'Classificacao automatica por IA', 'Follow-up periodico', 'Multi-numero (um por departamento)'];
  wa.forEach((w, i) => {
    slide.addText(`▸  ${w}`, { x: 1.2, y: 2.4 + i * 0.45, w: 5, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 7, y: 1.8, w: 5.5, h: 4.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Fluxo do Cliente', { x: 7.3, y: 2.0, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const fluxo = ['1. Envia mensagem WhatsApp', '2. Recebe menu de departamentos', '3. Seleciona por numero (1-N)', '4. Informa assunto e laboratorio', '5. Posicao na fila exibida', '6. Atendente assume e resolve'];
  fluxo.forEach((f, i) => {
    slide.addText(f, { x: 7.5, y: 2.6 + i * 0.5, w: 4.8, h: 0.45, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 5, 12);
}

// ============ SLIDE 6: OS DIGITAL ============
{
  const slide = addSlide();
  slide.addText('Ordem de Servico', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('OS Digital com Assinatura', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const osSteps = ['Criar OS', 'Gerar Link', 'Enviar WhatsApp', 'Cliente Assina', 'PDF Gerado'];
  osSteps.forEach((s, i) => {
    const x = 0.8 + i * 2.5;
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.9, w: 2.0, h: 0.6, fill: { color: i === 3 ? COLORS.green : COLORS.card }, rectRadius: 0.1, line: { color: COLORS.border, width: 1 } });
    slide.addText(s, { x, y: 1.9, w: 2.0, h: 0.6, fontSize: 14, color: COLORS.white, align: 'center', fontFace: 'Arial' });
    if (i < 4) slide.addText('→', { x: x + 2.0, y: 1.9, w: 0.5, h: 0.6, fontSize: 18, color: COLORS.green, align: 'center' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.0, w: 5.5, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Funcionalidades', { x: 1.1, y: 3.2, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const osFunc = ['Assinatura digital no celular', 'Canvas com deteccao de DPI', 'PDF com valor legal', 'Envio automatico via WhatsApp', 'Historico completo'];
  osFunc.forEach((f, i) => {
    slide.addText(`▸  ${f}`, { x: 1.3, y: 3.7 + i * 0.4, w: 4.8, h: 0.35, fontSize: 13, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 6.8, y: 3.0, w: 5.8, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Status da OS', { x: 7.1, y: 3.2, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const osStatus = ['Rascunho - Sendo editada', 'Em Andamento - Execucao', 'Aguardando Aprovacao - Assinatura', 'Concluido - Finalizada', 'Cancelado - Descartada'];
  osStatus.forEach((s, i) => {
    slide.addText(`▸  ${s}`, { x: 7.3, y: 3.7 + i * 0.4, w: 5, h: 0.35, fontSize: 13, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 6, 12);
}

// ============ SLIDE 7: CLIENTES ============
{
  const slide = addSlide();
  slide.addText('CRM', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Gestao de Clientes', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const crmCards = [
    { title: 'Cadastro Completo', items: ['Razao Social e CNPJ', 'Segmento (Lab, Hospital...)', 'Contrato e valores', 'Status e origem'] },
    { title: 'Colaboradores', items: ['Pessoas do cliente', 'Cargo e departamento', 'Contato principal', 'Vinculo ao ticket'] },
    { title: 'Pipeline de Vendas', items: ['Prospeccao', 'Proposta', 'Negociacao', 'Fechamento'] },
  ];
  
  crmCards.forEach((c, i) => {
    const x = 0.8 + i * 4.1;
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.8, w: 3.8, h: 4.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
    slide.addText(c.title, { x: x + 0.3, y: 2.0, w: 3.2, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
    c.items.forEach((item, j) => {
      slide.addText(`▸  ${item}`, { x: x + 0.3, y: 2.7 + j * 0.5, w: 3.2, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
    });
  });
  
  addFooter(slide, 7, 12);
}

// ============ SLIDE 8: DASHBOARD ============
{
  const slide = addSlide();
  slide.addText('Analytics', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Dashboard e Metricas', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const stats = [
    { num: '8', label: 'Cards de KPI' },
    { num: '8', label: 'Graficos' },
    { num: '3', label: 'Niveis de SLA' },
    { num: '24/7', label: 'Monitoramento' },
  ];
  
  stats.forEach((s, i) => {
    const x = 0.8 + i * 3.1;
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.8, w: 2.8, h: 2.0, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
    slide.addText(s.num, { x, y: 2.0, w: 2.8, h: 1.0, fontSize: 42, color: COLORS.accent, bold: true, align: 'center', fontFace: 'Arial' });
    slide.addText(s.label, { x, y: 3.0, w: 2.8, h: 0.5, fontSize: 14, color: COLORS.textMuted, align: 'center', fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 4.2, w: 11.8, h: 2.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Insights de IA', { x: 1.1, y: 4.4, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const insights = ['Tendencias de atendimento', 'Sugestoes de melhoria', 'Alertas de problemas', 'Analise de satisfacao', 'Previsao de demanda'];
  insights.forEach((ins, i) => {
    slide.addText(`▸  ${ins}`, { x: 1.3, y: 4.9 + i * 0.35, w: 4.5, h: 0.3, fontSize: 13, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  addFooter(slide, 8, 12);
}

// ============ SLIDE 9: AUTOMACOES ============
{
  const slide = addSlide();
  slide.addText('Automacao', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Automacoes e IA', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  slide.addText('Regras WHEN/IF/THEN', { x: 0.8, y: 1.8, w: 5, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 2.4, w: 5.5, h: 1.8, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.accent, width: 2 } });
  slide.addText('QUANDO:  novo_ticket\nSE:  prioridade = urgente\nENTAO:  atribuir_admin + notificar', { x: 1.1, y: 2.5, w: 5, h: 1.5, fontSize: 15, color: COLORS.text, fontFace: 'Courier New' });
  
  slide.addText('Recursos de IA', { x: 7, y: 1.8, w: 5, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const ia = ['Classificacao automatica', 'Sugestoes de vendas', 'Alertas de OS', 'Sugestoes de tarefas', 'Sugestao de artigos KB'];
  ia.forEach((item, i) => {
    slide.addText(`▸  ${item}`, { x: 7.3, y: 2.4 + i * 0.45, w: 5, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 4.6, w: 11.8, h: 2.0, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Configuracoes', { x: 1.1, y: 4.8, w: 5, h: 0.4, fontSize: 16, color: COLORS.white, bold: true, fontFace: 'Arial' });
  const configs = ['Triggers: 6 eventos  |  Condicoes: 8 operadores  |  Acoes: 8 tipos  |  Horarios configuraveis  |  Respeita feriados'];
  slide.addText(configs[0], { x: 1.3, y: 5.3, w: 11, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  
  addFooter(slide, 9, 12);
}

// ============ SLIDE 10: SEGURANCA ============
{
  const slide = addSlide();
  slide.addText('Seguranca', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Seguranca e Controle', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const secCards = [
    { title: 'RBAC', items: ['4 niveis de acesso', 'Permissoes granulares', 'IsMaster para admin total', 'Override por role'] },
    { title: 'JWT Tokens', items: ['Access: 15 minutos', 'Refresh: 7 dias', 'Session: unico por login', 'Auto-refresh'] },
    { title: 'Audit Log', items: ['Todas as acoes registradas', 'Rastreabilidade completa', 'Historico de tickets', 'Logs de envio'] },
  ];
  
  secCards.forEach((c, i) => {
    const x = 0.8 + i * 4.1;
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.8, w: 3.8, h: 4.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
    slide.addText(c.title, { x: x + 0.3, y: 2.0, w: 3.2, h: 0.5, fontSize: 18, color: COLORS.white, bold: true, fontFace: 'Arial' });
    c.items.forEach((item, j) => {
      slide.addText(`▸  ${item}`, { x: x + 0.3, y: 2.7 + j * 0.5, w: 3.2, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
    });
  });
  
  addFooter(slide, 10, 12);
}

// ============ SLIDE 11: NUMEROS ============
{
  const slide = addSlide();
  slide.addText('Numeros', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Numeros do Sistema', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  const numeros = [
    { num: '34', label: 'Tabelas no Banco' },
    { num: '100+', label: 'Endpoints API' },
    { num: '20+', label: 'Paginas Frontend' },
    { num: '5', label: 'Roles de Acesso' },
    { num: '7', label: 'Etapas Kanban' },
    { num: '295', label: 'Testes Automatizados' },
  ];
  
  numeros.forEach((n, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 4.1;
    const y = 1.8 + row * 2.6;
    
    slide.addShape(pptx.ShapeType.rect, { x, y, w: 3.8, h: 2.3, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
    slide.addText(n.num, { x, y: y + 0.3, w: 3.8, h: 1.0, fontSize: 48, color: COLORS.accent, bold: true, align: 'center', fontFace: 'Arial' });
    slide.addText(n.label, { x, y: y + 1.3, w: 3.8, h: 0.5, fontSize: 16, color: COLORS.textMuted, align: 'center', fontFace: 'Arial' });
  });
  
  addFooter(slide, 11, 12);
}

// ============ SLIDE 12: PROXIMOS PASSOS ============
{
  const slide = addSlide();
  slide.addText('Proximos Passos', { x: 0.8, y: 0.3, w: 3, h: 0.4, fontSize: 10, color: COLORS.accentLight, fill: { color: '1E3A5F' }, rectRadius: 0.1 });
  slide.addText('Proximos Passos', { x: 0.8, y: 0.8, w: 11, h: 0.8, fontSize: 36, color: COLORS.white, bold: true, fontFace: 'Arial' });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.8, w: 5.5, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Curto Prazo', { x: 1.1, y: 2.0, w: 5, h: 0.5, fontSize: 18, color: COLORS.accent, bold: true, fontFace: 'Arial' });
  const curto = ['Multi-WhatsApp (multi-numero)', 'Onboarding guiado', 'Esqueci minha senha', 'Notificacoes push mobile'];
  curto.forEach((c, i) => {
    slide.addText(`▸  ${c}`, { x: 1.3, y: 2.6 + i * 0.5, w: 4.8, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 6.8, y: 1.8, w: 5.8, h: 3.5, fill: { color: COLORS.card }, rectRadius: 0.15, line: { color: COLORS.border, width: 1 } });
  slide.addText('Medio Prazo', { x: 7.1, y: 2.0, w: 5, h: 0.5, fontSize: 18, color: COLORS.accent, bold: true, fontFace: 'Arial' });
  const medio = ['Multi-tenant (white-label)', 'App mobile completo', 'Integracao com outros canais', 'Relatorios avancados'];
  medio.forEach((m, i) => {
    slide.addText(`▸  ${m}`, { x: 7.3, y: 2.6 + i * 0.5, w: 5, h: 0.4, fontSize: 14, color: COLORS.textMuted, fontFace: 'Arial' });
  });
  
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 5.6, w: 11.8, h: 1.2, fill: { color: '1E3A5F' }, rectRadius: 0.15, line: { color: COLORS.accent, width: 1 } });
  slide.addText('CodeHelp CRM  •  Codemed Tecnologia  •  contato@codemed.com.br', { x: 1, y: 5.8, w: 11, h: 0.8, fontSize: 16, color: COLORS.accentLight, align: 'center', fontFace: 'Arial' });
  
  addFooter(slide, 12, 12);
}

pptx.writeFile({ fileName: 'C:\\Users\\Louzeiro\\Documents\\Louzeiro\\Projeto\\code-help\\docs\\APRESENTACAO-CODEHELP.pptx' })
  .then(() => console.log('PowerPoint gerado com sucesso!'))
  .catch(err => console.error('Erro:', err));
