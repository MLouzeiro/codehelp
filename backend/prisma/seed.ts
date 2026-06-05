import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 12);
  const techPassword = await bcrypt.hash('tecnico123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@codemed.com.br' },
    update: {},
    create: { name: 'Admin Codemed', email: 'admin@codemed.com.br', password: adminPassword, role: 'admin' },
  });

  const gerente = await prisma.user.upsert({
    where: { email: 'gerente@codemed.com.br' },
    update: {},
    create: { name: 'Carlos Gerente', email: 'gerente@codemed.com.br', password: techPassword, role: 'gerente' },
  });

  const tecnico1 = await prisma.user.upsert({
    where: { email: 'joao@codemed.com.br' },
    update: {},
    create: { name: 'João Técnico', email: 'joao@codemed.com.br', password: techPassword, role: 'tecnico' },
  });

  const tecnico2 = await prisma.user.upsert({
    where: { email: 'maria@codemed.com.br' },
    update: {},
    create: { name: 'Maria Técnica', email: 'maria@codemed.com.br', password: techPassword, role: 'tecnico' },
  });

  const comercial = await prisma.user.upsert({
    where: { email: 'comercial@codemed.com.br' },
    update: {},
    create: { name: 'Pedro Comercial', email: 'comercial@codemed.com.br', password: techPassword, role: 'comercial' },
  });

  const client1 = await prisma.client.create({
    data: {
      razaoSocial: 'Laboratório São Lucas Ltda',
      nomeFantasia: 'Lab São Lucas',
      cnpjCpf: '11.222.333/0001-44',
      segmento: 'laboratorio',
      responsavelTecnicoId: tecnico1.id,
      telefone: '5585999991111',
      email: 'contato@saolucas.com.br',
      cidade: 'Fortaleza',
      estado: 'CE',
      status: 'ativo',
      origem: 'whatsapp',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      razaoSocial: 'Hospital Geral de Messejana',
      nomeFantasia: 'HGM',
      cnpjCpf: '22.333.444/0001-55',
      segmento: 'hospital',
      responsavelTecnicoId: tecnico2.id,
      telefone: '5585999992222',
      email: 'ti@hgm.ce.gov.br',
      cidade: 'Fortaleza',
      estado: 'CE',
      status: 'ativo',
      origem: 'manual',
    },
  });

  const client3 = await prisma.client.create({
    data: {
      razaoSocial: 'Clínica Saúde Total',
      cnpjCpf: '33.444.555/0001-66',
      segmento: 'clinica',
      responsavelTecnicoId: tecnico1.id,
      telefone: '5585999993333',
      cidade: 'Caucaia',
      estado: 'CE',
      status: 'prospecto',
      origem: 'manual',
    },
  });

  await prisma.ticket.create({
    data: {
      clientId: client1.id,
      contactName: 'Dr. Roberto',
      contactPhone: '5585999991111',
      assunto: 'Problema no módulo LIS',
      status: 'aberto',
      canal: 'whatsapp',
      usuarioId: tecnico1.id,
    },
  });

  await prisma.ticket.create({
    data: {
      clientId: client2.id,
      contactName: 'Enf. Ana Paula',
      contactPhone: '5585999992222',
      assunto: 'Sistema lento no GLPI',
      status: 'em_andamento',
      canal: 'whatsapp',
      usuarioId: tecnico2.id,
    },
  });

  await prisma.ticket.create({
    data: {
      contactName: 'Dr. Marcos',
      contactPhone: '5585999994444',
      assunto: 'Orçamento de implantação',
      status: 'aberto',
      canal: 'whatsapp',
      usuarioId: comercial.id,
    },
  });

  const os1 = await prisma.serviceOrder.upsert({
    where: { numeroOs: 'OS-2024-0001' },
    update: {},
    create: {
      numeroOs: 'OS-2024-0001',
      clientId: client1.id,
      tipoServico: 'implantacao',
      descricaoServico: 'Implantação do módulo LIS integrado ao sistema de faturamento',
      sistemasEnvolvidos: '["LIS", "Módulo Fiscal"]',
      tecnicoResponsavelId: tecnico1.id,
      valorServico: 15000.0,
      dataPrevistaEntrega: new Date('2024-12-31'),
      status: 'assinada',
      criadoPorId: tecnico1.id,
    },
  });

  await prisma.signature.upsert({
    where: { orderId: os1.id },
    update: {},
    create: {
      orderId: os1.id,
      assinanteNome: 'Dr. Roberto Almeida',
      assinanteCpf: '123.456.789-00',
      assinanteCargo: 'Diretor Técnico',
      assinaturaBase64: '',
      ipAssinante: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      tokenAssinatura: 'demo-token-signature',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      assinadoEm: new Date(),
    },
  });

  await prisma.serviceOrder.upsert({
    where: { numeroOs: 'OS-2024-0002' },
    update: {},
    create: {
      numeroOs: 'OS-2024-0002',
      clientId: client2.id,
      tipoServico: 'suporte',
      descricaoServico: 'Suporte emergencial ao GLPI - lentidão no acesso',
      tecnicoResponsavelId: tecnico2.id,
      valorServico: 2500.0,
      status: 'aguardando_assinatura',
      criadoPorId: tecnico2.id,
    },
  });

  await prisma.opportunity.create({
    data: {
      clientId: client3.id,
      titulo: 'Implantação completa LIS + GLPI',
      valorEstimado: 45000.0,
      etapa: 'negociacao',
      probabilidade: 70,
      responsavelId: comercial.id,
    },
  });

  await prisma.opportunity.create({
    data: {
      clientId: client1.id,
      titulo: 'Upgrade módulo fiscal',
      valorEstimado: 8000.0,
      etapa: 'prospeccao',
      probabilidade: 30,
      responsavelId: comercial.id,
    },
  });

  await prisma.alertRecipient.create({
    data: { nome: 'Admin Codemed', whatsapp: '5585999999999', cargo: 'Gestor', ativo: true },
  });

  await prisma.task.create({
    data: { titulo: 'Finalizar implantação LIS Lab São Lucas', descricao: 'Configurar integração com sistema de faturamento', status: 'em_andamento', prioridade: 'alta', responsavelId: tecnico1.id, projeto: 'Lab São Lucas' },
  });

  await prisma.task.create({
    data: { titulo: 'Corrigir lentidão GLPI HGM', status: 'aberta', prioridade: 'urgente', responsavelId: tecnico2.id, projeto: 'HGM' },
  });

  await prisma.task.create({
    data: { titulo: 'Preparar proposta Clínica Saúde Total', status: 'aberta', prioridade: 'media', responsavelId: comercial.id, projeto: 'Prospecção' },
  });

  await prisma.contact.create({
    data: { clientId: client1.id, tipo: 'ligacao', descricao: 'Ligação para alinhar cronograma de implantação', usuarioId: tecnico1.id, duracaoMinutos: 15 },
  });

  await prisma.contact.create({
    data: { clientId: client2.id, tipo: 'reuniao', descricao: 'Reunião presencial sobre contrato de suporte', usuarioId: tecnico2.id, duracaoMinutos: 60 },
  });

  // Robots
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);

  const roboVendas = await prisma.robot.upsert({
    where: { slug: 'vendas' },
    update: {},
    create: {
      slug: 'vendas', nome: 'Assistente de Vendas', descricao: 'Analisa CRM e sugere ações comerciais',
      icone: 'trending-up', ativo: true, inteligente: hasClaude, ordem: 1,
      horarioAtivo: true, diasSemana: '1,2,3,4,5', horaInicio: '08:00', horaFim: '18:00',
      config: JSON.stringify({ provider: hasClaude ? 'claude' : 'local', daysLookback: 30, minScore: 60 }),
    },
  });

  const roboClass = await prisma.robot.upsert({
    where: { slug: 'classificador' },
    update: {},
    create: {
      slug: 'classificador', nome: 'Classificador de Tickets', descricao: 'Categoriza automaticamente mensagens do WhatsApp',
      icone: 'message-square', ativo: true, inteligente: hasClaude, ordem: 2,
      horarioAtivo: true, diasSemana: '1,2,3,4,5', horaInicio: '08:00', horaFim: '18:00',
      config: JSON.stringify({ provider: hasClaude ? 'claude' : 'local', categorias: ['suporte_tecnico', 'duvida_faturamento', 'solicitacao_mudanca', 'treinamento', 'reclamacao'] }),
    },
  });

  const roboOS = await prisma.robot.upsert({
    where: { slug: 'os-analyst' },
    update: {},
    create: {
      slug: 'os-analyst', nome: 'Analista de OS', descricao: 'Detecta ordens de serviço atrasadas e em risco',
      icone: 'file-text', ativo: true, inteligente: false, ordem: 3,
      horarioAtivo: false, config: JSON.stringify({ maxDiasParada: 5, alertarSe: ['em_andamento', 'aguardando_assinatura'] }),
    },
  });

  const roboTarefas = await prisma.robot.upsert({
    where: { slug: 'tarefas' },
    update: {},
    create: {
      slug: 'tarefas', nome: 'Assistente de Tarefas', descricao: 'Sugere prioridades baseadas em prazos',
      icone: 'check-circle', ativo: true, inteligente: false, ordem: 4,
      horarioAtivo: false, config: JSON.stringify({ diasAntecedencia: 3, prioridadeAlta: 1, prioridadeMedia: 3 }),
    },
  });

  // Regras padrão para o robô de vendas
  const existingVendasRules = await prisma.robotRule.count({ where: { robotId: roboVendas.id } });
  if (existingVendasRules === 0) {
    await prisma.robotRule.create({
      data: {
        robotId: roboVendas.id, nome: 'Cliente sem contato há 30 dias', descricao: 'Dispara ação para contatar cliente inativo',
        ativo: true, ordem: 1,
        trigger: JSON.stringify({ type: 'contact_30days' }),
        conditions: JSON.stringify([{ field: 'client.status', operator: 'equals', value: 'ativo' }]),
        actions: JSON.stringify([{ type: 'create_task', params: { titulo: 'Contatar cliente sem interação', prioridade: 'media' } }]),
        logicOperator: 'all',
      },
    });
    await prisma.robotRule.create({
      data: {
        robotId: roboVendas.id, nome: 'Lead qualificado para follow-up', descricao: 'Cria tarefa de follow-up para leads quentes',
        ativo: true, ordem: 2,
        trigger: JSON.stringify({ type: 'new_ticket' }),
        conditions: JSON.stringify([{ field: 'ticket.categoria', operator: 'equals', value: 'orcamento' }]),
        actions: JSON.stringify([{ type: 'assign_user', params: { userId: 'comercial@codemed.com.br' } }, { type: 'send_message', params: { text: 'Olá {{nome_contato}}, recebemos sua solicitação de orçamento! Nosso time comercial vai analisar e retornar em até 24h.' } }]),
        logicOperator: 'all',
      },
    });
  }

  console.log('✅ Seed completed!');
  console.log('   Admin: admin@codemed.com.br / admin123');
  console.log('   Users: joao@, maria@, gerente@, comercial@ / tecnico123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
