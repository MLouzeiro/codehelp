import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const templates = [
  {
    nome: 'Geral',
    descricao: 'Quadro geral para gerenciar demandas de qualquer área',
    categoria: 'geral',
    icone: 'layout',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'A Fazer', cor: '#6b7280', ordem: 0 },
      { nome: 'Em Andamento', cor: '#3b82f6', ordem: 1 },
      { nome: 'Aguardando', cor: '#f59e0b', ordem: 2 },
      { nome: 'Concluído', cor: '#10b981', ordem: 3 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'Urgente', cor: '#ef4444' },
      { nome: 'Bug', cor: '#f97316' },
      { nome: 'Feature', cor: '#8b5cf6' },
    ]),
  },
  {
    nome: 'Marketing',
    descricao: 'Gestão de campanhas e ações de marketing',
    categoria: 'marketing',
    icone: 'megaphone',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'Ideia', cor: '#8b5cf6', ordem: 0 },
      { nome: 'Planejamento', cor: '#3b82f6', ordem: 1 },
      { nome: 'Execução', cor: '#f59e0b', ordem: 2 },
      { nome: 'Análise', cor: '#06b6d4', ordem: 3 },
      { nome: 'Concluído', cor: '#10b981', ordem: 4 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'Redes Sociais', cor: '#ec4899' },
      { nome: 'Email', cor: '#3b82f6' },
      { nome: 'SEO', cor: '#10b981' },
      { nome: 'Conteúdo', cor: '#f59e0b' },
    ]),
  },
  {
    nome: 'Financeiro',
    descricao: 'Controle de processos financeiros e faturamento',
    categoria: 'financeiro',
    icone: 'dollar-sign',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'Pendente', cor: '#f59e0b', ordem: 0 },
      { nome: 'Em Análise', cor: '#3b82f6', ordem: 1 },
      { nome: 'Aprovado', cor: '#10b981', ordem: 2 },
      { nome: 'Rejeitado', cor: '#ef4444', ordem: 3 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'Boleto', cor: '#3b82f6' },
      { nome: 'NF-e', cor: '#10b981' },
      { nome: 'Revisão', cor: '#f59e0b' },
    ]),
  },
  {
    nome: 'Comercial',
    descricao: 'Pipeline de vendas e oportunidades comerciais',
    categoria: 'comercial',
    icone: 'briefcase',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'Prospecção', cor: '#6b7280', ordem: 0 },
      { nome: 'Qualificação', cor: '#8b5cf6', ordem: 1 },
      { nome: 'Proposta', cor: '#3b82f6', ordem: 2 },
      { nome: 'Negociação', cor: '#f59e0b', ordem: 3 },
      { nome: 'Fechamento', cor: '#10b981', ordem: 4 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'Quente', cor: '#ef4444' },
      { nome: 'Frio', cor: '#3b82f6' },
      { nome: 'Retorno', cor: '#f59e0b' },
    ]),
  },
  {
    nome: 'Suporte / Helpdesk',
    descricao: 'Gestão de tickets e chamados de suporte',
    categoria: 'suporte',
    icone: 'headphones',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'Fila', cor: '#6b7280', ordem: 0 },
      { nome: 'Triagem', cor: '#f59e0b', ordem: 1 },
      { nome: 'Em Atendimento', cor: '#3b82f6', ordem: 2 },
      { nome: 'Aguardando Cliente', cor: '#8b5cf6', ordem: 3 },
      { nome: 'Concluído', cor: '#10b981', ordem: 4 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'N1', cor: '#10b981' },
      { nome: 'N2', cor: '#f59e0b' },
      { nome: 'N3', cor: '#ef4444' },
    ]),
  },
  {
    nome: 'Desenvolvimento',
    descricao: 'Quadro de desenvolvimento de software (sprint/board)',
    categoria: 'desenvolvimento',
    icone: 'code',
    publico: true,
    colunas: JSON.stringify([
      { nome: 'Backlog', cor: '#6b7280', ordem: 0 },
      { nome: 'Sprint', cor: '#8b5cf6', ordem: 1 },
      { nome: 'Em Dev', cor: '#3b82f6', ordem: 2 },
      { nome: 'Code Review', cor: '#06b6d4', ordem: 3 },
      { nome: 'Teste', cor: '#f59e0b', ordem: 4 },
      { nome: 'Deploy', cor: '#10b981', ordem: 5 },
    ]),
    tagsPadrao: JSON.stringify([
      { nome: 'Frontend', cor: '#3b82f6' },
      { nome: 'Backend', cor: '#10b981' },
      { nome: 'DevOps', cor: '#f59e0b' },
      { nome: 'Docs', cor: '#8b5cf6' },
    ]),
  },
]

async function main() {
  console.log('🌱 Iniciando seed de templates Kanban...\n')

  for (const template of templates) {
    try {
      const result = await prisma.kanbanTemplate.upsert({
        where: { nome: template.nome },
        update: {},
        create: template,
      })

      console.log(`✅ Template "${result.nome}" carregado com sucesso`)
    } catch (error) {
      console.error(`❌ Erro ao carregar template "${template.nome}":`, error)
    }
  }

  console.log('\n🏁 Seed de templates Kanban finalizado.')
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal no seed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
