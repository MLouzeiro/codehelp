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
    const existing = await prisma.fila.findUnique({ where: { slug: fila.slug } });
    if (!existing) {
      await prisma.fila.create({ data: fila });
      console.log(`[Helpdesk] Fila criada: ${fila.slug} (${fila.nome})`);
    } else {
      const data: any = {};
      if (existing.nome !== fila.nome) data.nome = fila.nome;
      if (existing.descricao !== fila.descricao) data.descricao = fila.descricao;
      if (existing.nivel !== fila.nivel) data.nivel = fila.nivel;
      if (existing.slaMinutos !== fila.slaMinutos) data.slaMinutos = fila.slaMinutos;
      if (Object.keys(data).length > 0) {
        await prisma.fila.update({ where: { id: existing.id }, data });
      }
    }
  }
}

export async function ensureSLAConfigs() {
  for (const sla of SLA_PADRAO) {
    const existing = await prisma.sLAConfig.findUnique({ where: { prioridade: sla.prioridade } });
    if (!existing) {
      await prisma.sLAConfig.create({ data: sla });
      console.log(`[Helpdesk] SLAConfig criado: ${sla.prioridade}`);
    } else {
      const data: any = {};
      if (existing.slaMinutosPrimeiraResposta !== sla.slaMinutosPrimeiraResposta) {
        data.slaMinutosPrimeiraResposta = sla.slaMinutosPrimeiraResposta;
      }
      if (existing.slaMinutosResolucao !== sla.slaMinutosResolucao) {
        data.slaMinutosResolucao = sla.slaMinutosResolucao;
      }
      if (Object.keys(data).length > 0) {
        await prisma.sLAConfig.update({ where: { id: existing.id }, data });
      }
    }
  }
}

export async function ensureCategorias() {
  for (const cat of CATEGORIAS_PADRAO) {
    const existing = await prisma.categoria.findUnique({ where: { slug: cat.slug } });
    if (!existing) {
      await prisma.categoria.create({ data: cat });
      console.log(`[Helpdesk] Categoria criada: ${cat.slug} (${cat.nome})`);
    } else {
      const data: any = {};
      if (existing.nome !== cat.nome) data.nome = cat.nome;
      if (existing.descricao !== cat.descricao) data.descricao = cat.descricao;
      if (Object.keys(data).length > 0) {
        await prisma.categoria.update({ where: { id: existing.id }, data });
      }
    }
  }
}

export async function ensureHelpdeskEntities() {
  await ensureFilas();
  await ensureSLAConfigs();
  await ensureCategorias();
}
