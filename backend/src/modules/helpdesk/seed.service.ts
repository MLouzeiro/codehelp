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
  { slug: 'impressoras', nome: 'Impressoras', descricao: 'Impressoras, etiquetas, calibracao, ribbon', cor: '#f97316', icone: 'printer', ordem: 4 },
  { slug: 'banco_de_dados', nome: 'Banco de Dados', descricao: 'Conexao, lentidao, backup, restauracao, permissoes', cor: '#06b6d4', icone: 'database', ordem: 5 },
  { slug: 'integracoes', nome: 'Integracoes', descricao: 'HL7, ASTM, XML, API, Webhook, interfaceamento', cor: '#8b5cf6', icone: 'plug', ordem: 6 },
  { slug: 'procedimentos', nome: 'Procedimentos', descricao: 'Procedimentos operacionais e de rotina', cor: '#14b8a6', icone: 'clipboard-list', ordem: 7 },
  { slug: 'desenvolvimento', nome: 'Desenvolvimento', descricao: 'Demandas de desenvolvimento e correcoes de sistema', cor: '#3b82f6', icone: 'code', ordem: 8 },
  { slug: 'implantacao', nome: 'Implantacao', descricao: 'Implantacao de sistemas e novos clientes', cor: '#84cc16', icone: 'rocket', ordem: 9 },
  { slug: 'outros', nome: 'Outros', descricao: 'Assuntos gerais que nao se encaixam nas demais categorias', cor: '#64748b', icone: 'help-circle', ordem: 10 },
];

export const ASSUNTOS_PADRAO: Array<{
  slug: string;
  nome: string;
  descricao?: string;
  categoriaSlug: string;
  prioridadePadrao?: string;
  slaPadraoMin?: number | null;
  ordem: number;
}> = [
  // Impressoras
  { slug: 'impressoras__impressora_nao_imprime', nome: 'Impressora não imprime', descricao: 'Impressora parada ou sem imprimir', categoriaSlug: 'impressoras', prioridadePadrao: 'alta', slaPadraoMin: 240, ordem: 0 },
  { slug: 'impressoras__impressora_travada', nome: 'Impressora travada', descricao: 'Impressora travando durante uso', categoriaSlug: 'impressoras', prioridadePadrao: 'media', slaPadraoMin: 240, ordem: 1 },
  { slug: 'impressoras__calibracao', nome: 'Problema de calibração', descricao: 'Calibracao de impressora', categoriaSlug: 'impressoras', slaPadraoMin: 480, ordem: 2 },
  { slug: 'impressoras__etiqueta', nome: 'Problema de etiqueta', descricao: 'Etiquetas saindo erradas ou fora do lugar', categoriaSlug: 'impressoras', slaPadraoMin: 480, ordem: 3 },
  { slug: 'impressoras__troca_ribbon', nome: 'Troca de ribbon', descricao: 'Troca de ribbon/ribbon incorreto', categoriaSlug: 'impressoras', slaPadraoMin: 480, ordem: 4 },
  { slug: 'impressoras__configuracao', nome: 'Configuração de impressora', descricao: 'Configuracao inicial ou ajuste', categoriaSlug: 'impressoras', slaPadraoMin: 480, ordem: 5 },
  { slug: 'impressoras__instalacao', nome: 'Instalação de impressora', descricao: 'Instalacao de nova impressora', categoriaSlug: 'impressoras', slaPadraoMin: 1440, ordem: 6 },
  // Banco de Dados
  { slug: 'banco_de_dados__erro_conexao', nome: 'Erro de conexão', descricao: 'Falha de conexao com banco', categoriaSlug: 'banco_de_dados', prioridadePadrao: 'urgente', slaPadraoMin: 120, ordem: 0 },
  { slug: 'banco_de_dados__lentidao', nome: 'Lentidão', descricao: 'Banco lento', categoriaSlug: 'banco_de_dados', prioridadePadrao: 'alta', slaPadraoMin: 240, ordem: 1 },
  { slug: 'banco_de_dados__backup', nome: 'Backup', descricao: 'Configuracao ou falha de backup', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 2 },
  { slug: 'banco_de_dados__restauracao', nome: 'Restauração', descricao: 'Restauracao de banco', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 3 },
  { slug: 'banco_de_dados__usuario', nome: 'Usuário', descricao: 'Criacao/ajuste de usuario de banco', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 4 },
  { slug: 'banco_de_dados__permissao', nome: 'Permissão', descricao: 'Permissoes de acesso ao banco', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 5 },
  { slug: 'banco_de_dados__oracle', nome: 'Oracle', descricao: 'Problemas com Oracle', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 6 },
  { slug: 'banco_de_dados__postgresql', nome: 'PostgreSQL', descricao: 'Problemas com PostgreSQL', categoriaSlug: 'banco_de_dados', slaPadraoMin: 480, ordem: 7 },
  // Integracoes
  { slug: 'integracoes__hl7', nome: 'HL7', descricao: 'Integracao HL7', categoriaSlug: 'integracoes', prioridadePadrao: 'alta', slaPadraoMin: 240, ordem: 0 },
  { slug: 'integracoes__astm', nome: 'ASTM', descricao: 'Integracao ASTM', categoriaSlug: 'integracoes', prioridadePadrao: 'alta', slaPadraoMin: 240, ordem: 1 },
  { slug: 'integracoes__xml', nome: 'XML', descricao: 'Integracao via XML', categoriaSlug: 'integracoes', slaPadraoMin: 480, ordem: 2 },
  { slug: 'integracoes__api', nome: 'API', descricao: 'Integracao via API', categoriaSlug: 'integracoes', slaPadraoMin: 480, ordem: 3 },
  { slug: 'integracoes__webhook', nome: 'Webhook', descricao: 'Integracao via webhook', categoriaSlug: 'integracoes', slaPadraoMin: 480, ordem: 4 },
  { slug: 'integracoes__interfaceamento', nome: 'Interfaceamento', descricao: 'Interfaceamento entre sistemas', categoriaSlug: 'integracoes', slaPadraoMin: 480, ordem: 5 },
  { slug: 'integracoes__equipamento', nome: 'Integração com equipamento', descricao: 'Integracao com equipamentos', categoriaSlug: 'integracoes', slaPadraoMin: 480, ordem: 6 },
  // Procedimentos
  { slug: 'procedimentos__novo_procedimento', nome: 'Novo procedimento', descricao: 'Criacao de procedimento', categoriaSlug: 'procedimentos', slaPadraoMin: 1440, ordem: 0 },
  { slug: 'procedimentos__ajuste_procedimento', nome: 'Ajuste de procedimento', descricao: 'Alteracao de procedimento', categoriaSlug: 'procedimentos', slaPadraoMin: 1440, ordem: 1 },
  // Desenvolvimento
  { slug: 'desenvolvimento__bug_sistema', nome: 'Bug no sistema', descricao: 'Correcao de bug', categoriaSlug: 'desenvolvimento', prioridadePadrao: 'alta', slaPadraoMin: 1440, ordem: 0 },
  { slug: 'desenvolvimento__melhoria', nome: 'Melhoria', descricao: 'Melhoria no sistema', categoriaSlug: 'desenvolvimento', slaPadraoMin: 2880, ordem: 1 },
  { slug: 'desenvolvimento__relatorio_financeiro', nome: 'Erro no relatório financeiro', descricao: 'Falha em relatorio financeiro', categoriaSlug: 'desenvolvimento', prioridadePadrao: 'alta', slaPadraoMin: 1440, ordem: 2 },
  // Implantacao
  { slug: 'implantacao__implantacao_sistema', nome: 'Implantação de sistema', descricao: 'Implantacao de novo sistema', categoriaSlug: 'implantacao', slaPadraoMin: 4320, ordem: 0 },
  { slug: 'implantacao__correcao_implantacao', nome: 'Correção em implantação', descricao: 'Correcao durante implantacao', categoriaSlug: 'implantacao', slaPadraoMin: 1440, ordem: 1 },
  // Outros
  { slug: 'outros__nao_classificado', nome: 'Não classificado', descricao: 'Aguardando classificacao', categoriaSlug: 'outros', slaPadraoMin: null, ordem: 0 },
];

export async function ensureAssuntos() {
  const categorias = await prisma.categoria.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(categorias.map((c) => [c.slug, c.id]));
  for (const a of ASSUNTOS_PADRAO) {
    const categoriaId = bySlug.get(a.categoriaSlug);
    if (!categoriaId) continue;
    const existing = await prisma.assunto.findFirst({ where: { slug: a.slug } });
    if (existing) {
      await prisma.assunto.update({
        where: { id: existing.id },
        data: {
          nome: a.nome,
          descricao: a.descricao || null,
          categoriaId,
          prioridadePadrao: a.prioridadePadrao || 'media',
          slaPadraoMin: a.slaPadraoMin ?? null,
          ordem: a.ordem,
        },
      });
    } else {
      await prisma.assunto.create({
        data: {
          slug: a.slug,
          nome: a.nome,
          descricao: a.descricao || null,
          categoriaId,
          prioridadePadrao: a.prioridadePadrao || 'media',
          slaPadraoMin: a.slaPadraoMin ?? null,
          ordem: a.ordem,
        },
      });
    }
  }
}

export async function ensureCategoriasAssuntos() {
  await ensureCategorias();
  await ensureAssuntos();
}

export async function ensureFilas() {
  for (const fila of FILAS_PADRAO) {
    const existing = await prisma.fila.findFirst({ where: { slug: fila.slug } });
    if (existing) {
      await prisma.fila.update({
        where: { id: existing.id },
        data: {
          nome: fila.nome,
          descricao: fila.descricao,
          nivel: fila.nivel,
          slaMinutos: fila.slaMinutos,
          cor: fila.cor,
          icone: fila.icone,
          ordem: fila.ordem,
        },
      });
    } else {
      await prisma.fila.create({ data: fila });
    }
  }
}

export async function ensureSLAConfigs() {
  for (const sla of SLA_PADRAO) {
    const existing = await prisma.sLAConfig.findFirst({ where: { prioridade: sla.prioridade } });
    if (existing) {
      await prisma.sLAConfig.update({
        where: { id: existing.id },
        data: {
          slaMinutosPrimeiraResposta: sla.slaMinutosPrimeiraResposta,
          slaMinutosResolucao: sla.slaMinutosResolucao,
          alerta75Porcento: sla.alerta75Porcento,
          alerta90Porcento: sla.alerta90Porcento,
        },
      });
    } else {
      await prisma.sLAConfig.create({ data: sla });
    }
  }
}

export async function ensureCategorias() {
  for (const cat of CATEGORIAS_PADRAO) {
    const existing = await prisma.categoria.findFirst({ where: { slug: cat.slug } });
    if (existing) {
      await prisma.categoria.update({
        where: { id: existing.id },
        data: {
          nome: cat.nome,
          descricao: cat.descricao,
          cor: cat.cor,
          icone: cat.icone,
          ordem: cat.ordem,
        },
      });
    } else {
      await prisma.categoria.create({ data: cat });
    }
  }
}

export async function ensureHelpdeskEntities() {
  await ensureFilas();
  await ensureSLAConfigs();
  await ensureCategoriasAssuntos();
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
      const catExisting = await prisma.categoria.findFirst({ where: { slug } });
      let cat;
      if (catExisting) {
        cat = catExisting;
      } else {
        cat = await prisma.categoria.create({
          data: {
            slug,
            nome: slug.replace(/_/g, ' '),
            ordem: 999,
          },
        });
      }
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
