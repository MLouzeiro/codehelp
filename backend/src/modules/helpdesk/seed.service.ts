import prisma from '../../config/database';

export const FILAS_PADRAO = [
  {
    slug: 'n1',
    nome: 'N1 - Suporte Inicial',
    descricao: 'Atendimento de primeiro nivel - triagem, duvidas gerais e chamados simples',
    nivel: 'N1',
    slaMinutos: 60,
    cor: '#10b981',
    icone: 'headphones',
    ordem: 0,
  },
  {
    slug: 'n2',
    nome: 'N2 - Suporte Tecnico',
    descricao: 'Suporte tecnico avancado - problemas nao resolvidos pelo N1',
    nivel: 'N2',
    slaMinutos: 180,
    cor: '#f59e0b',
    icone: 'wrench',
    ordem: 1,
  },
  {
    slug: 'n3',
    nome: 'N3 - Engenharia / Fornecedor',
    descricao: 'Casos criticos e de baixa recorrencia, escalonados para engenharia ou fornecedor',
    nivel: 'N3',
    slaMinutos: 480,
    cor: '#ef4444',
    icone: 'alert-triangle',
    ordem: 2,
  },
];

export const SLA_PADRAO = [
  {
    prioridade: 'baixa',
    slaMinutosPrimeiraResposta: 240,
    slaMinutosResolucao: 1440,
    alerta75Porcento: true,
    alerta90Porcento: true,
  },
  {
    prioridade: 'media',
    slaMinutosPrimeiraResposta: 60,
    slaMinutosResolucao: 480,
    alerta75Porcento: true,
    alerta90Porcento: true,
  },
  {
    prioridade: 'alta',
    slaMinutosPrimeiraResposta: 30,
    slaMinutosResolucao: 240,
    alerta75Porcento: true,
    alerta90Porcento: true,
  },
  {
    prioridade: 'urgente',
    slaMinutosPrimeiraResposta: 15,
    slaMinutosResolucao: 120,
    alerta75Porcento: true,
    alerta90Porcento: true,
  },
];

export const CATEGORIAS_PADRAO = [
  { slug: 'suporte_tecnico', nome: 'Suporte Tecnico', descricao: 'Problemas tecnicos, erros, falhas', cor: '#0ea5e9', icone: 'wrench', ordem: 0 },
  { slug: 'financeiro', nome: 'Financeiro', descricao: 'Boletos, faturas, cobrancas, pagamentos', cor: '#22c55e', icone: 'dollar-sign', ordem: 1 },
  { slug: 'comercial', nome: 'Comercial', descricao: 'Orcamentos, propostas, contratacoes', cor: '#a855f7', icone: 'briefcase', ordem: 2 },
  { slug: 'cancelamento', nome: 'Cancelamento', descricao: 'Cancelamentos, rescisoes, reembolsos', cor: '#ef4444', icone: 'x-circle', ordem: 3 },
  { slug: 'outros', nome: 'Outros', descricao: 'Assuntos gerais que nao se encaixam nas demais categorias', cor: '#64748b', icone: 'help-circle', ordem: 4 },
];

export async function ensureFilas() {
  for (const fila of FILAS_PADRAO) {
    await prisma.fila.upsert({
      where: { slug: fila.slug },
      create: fila,
      update: {
        nome: fila.nome,
        descricao: fila.descricao,
        nivel: fila.nivel,
        slaMinutos: fila.slaMinutos,
        cor: fila.cor,
        icone: fila.icone,
        ordem: fila.ordem,
      },
    });
  }
}

export async function ensureSLAConfigs() {
  for (const sla of SLA_PADRAO) {
    await prisma.sLAConfig.upsert({
      where: { prioridade: sla.prioridade },
      create: sla,
      update: {
        slaMinutosPrimeiraResposta: sla.slaMinutosPrimeiraResposta,
        slaMinutosResolucao: sla.slaMinutosResolucao,
        alerta75Porcento: sla.alerta75Porcento,
        alerta90Porcento: sla.alerta90Porcento,
      },
    });
  }
}

export async function ensureCategorias() {
  for (const cat of CATEGORIAS_PADRAO) {
    await prisma.categoria.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: {
        nome: cat.nome,
        descricao: cat.descricao,
        cor: cat.cor,
        icone: cat.icone,
        ordem: cat.ordem,
      },
    });
  }
}

export async function ensureHelpdeskEntities() {
  await ensureFilas();
  await ensureSLAConfigs();
  await ensureCategorias();
}

export async function migrateCategoriaStringToFK() {
  try {
    const ticketsSemFK = await prisma.ticket.findMany({
      where: { categoriaId: null, categoria: { not: null } },
      select: { id: true, categoria: true },
    });
    if (ticketsSemFK.length === 0) return;
    let atualizados = 0;
    for (const t of ticketsSemFK) {
      const slug = t.categoria as string;
      const cat = await prisma.categoria.upsert({
        where: { slug },
        create: {
          slug,
          nome: slug.replace(/_/g, ' '),
          ordem: 999,
        },
        update: {},
      });
      await prisma.ticket.update({
        where: { id: t.id },
        data: { categoriaId: cat.id },
      });
      atualizados++;
    }
    if (atualizados > 0) {
      console.log(`[Helpdesk] Migracao: ${atualizados} tickets com categoriaId preenchido`);
    }
  } catch (err: any) {
    console.warn('[Helpdesk] Migracao categoriaId falhou (nao-critico):', err?.message || err);
  }
}
