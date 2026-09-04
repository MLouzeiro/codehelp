import { env } from '../../config/env';
import prisma from '../../config/database';
import { callClaude } from '../../shared/aiClient';

interface AiCategorization {
  prioridade: string;
  classificacao: string;
  categoria: string;
  confianca: number;
  raciocinio: string;
}

export async function autoCategorizeTask(taskId: string): Promise<AiCategorization> {
  const task = await prisma.kanbanTask.findUnique({
    where: { id: taskId },
    select: {
      titulo: true,
      descricao: true,
      categoria: true,
      prioridade: true,
      classificacao: true,
      board: { select: { nome: true } },
    },
  });
  if (!task) throw new Error('Tarefa não encontrada');

  if (!env.anthropicKey) {
    return categorizeLocal(task);
  }

  const prompt = `Analise a tarefa abaixo e retorne APENAS um JSON válido com categorização:
- prioridade: "baixa", "media", "alta" ou "urgente"
- classificacao: "Bug", "Melhoria", "Feature", "Manutenção", "Correção", "Implantação", "Treinamento" ou "Outros"
- categoria: "Outros", "Suporte", "Desenvolvimento", "Marketing", "Financeiro" ou "Comercial"
- confianca: número de 0 a 100
- raciocinio: breve explicação

Tarefa: ${task.titulo}
Descrição: ${task.descricao || 'Sem descrição'}
Quadro: ${task.board?.nome || 'Não definido'}
Categoria atual: ${task.categoria || 'Não definida'}
Prioridade atual: ${task.prioridade}

Responda APENAS com o JSON, sem texto adicional.`;

  try {
    const text = await callClaude(prompt, 300, 'kanban-categorize');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta não é JSON válido');

    const result = JSON.parse(jsonMatch[0]);
    return {
      prioridade: result.prioridade || task.prioridade,
      classificacao: result.classificacao || task.classificacao || '',
      categoria: result.categoria || task.categoria || '',
      confianca: result.confianca || 0,
      raciocinio: result.raciocinio || '',
    };
  } catch (err) {
    console.error('[AI] Erro ao categorizar:', err);
    return categorizeLocal(task);
  }
}

function categorizeLocal(task: { titulo: string; descricao: string | null; categoria: string | null; prioridade: string }): AiCategorization {
  const text = `${task.titulo} ${task.descricao || ''}`.toLowerCase();

  let classificacao = 'Outros';
  if (text.includes('bug') || text.includes('erro') || text.includes('quebra') || text.includes('falha')) classificacao = 'Bug';
  else if (text.includes('melhoria') || text.includes('otimizar') || text.includes('melhorar')) classificacao = 'Melhoria';
  else if (text.includes('feature') || text.includes('novo') || text.includes('nova') || text.includes('adicionar')) classificacao = 'Feature';
  else if (text.includes('manutenção') || text.includes('manutencao') || text.includes('atualizar')) classificacao = 'Manutenção';
  else if (text.includes('correção') || text.includes('correcao') || text.includes('corrigir')) classificacao = 'Correção';
  else if (text.includes('implantação') || text.includes('implantacao') || text.includes('deploy')) classificacao = 'Implantação';
  else if (text.includes('treinamento') || text.includes('treinar') || text.includes('capacitação')) classificacao = 'Treinamento';

  let categoria = task.categoria || 'Outros';
  if (text.includes('desenvolv') || text.includes('código') || text.includes('sistema') || text.includes('programa')) categoria = 'Desenvolvimento';
  else if (text.includes('marketing') || text.includes('campanha') || text.includes('publicidade')) categoria = 'Marketing';
  else if (text.includes('suporte') || text.includes('atendimento') || text.includes('cliente')) categoria = 'Suporte';
  else if (text.includes('financeiro') || text.includes('financeira') || text.includes('pagamento')) categoria = 'Financeiro';
  else if (text.includes('comercial') || text.includes('venda') || text.includes('proposta')) categoria = 'Comercial';

  let prioridade = task.prioridade;
  if (text.includes('urgente') || text.includes('crítico') || text.includes('critico') || text.includes('emergência')) prioridade = 'urgente';
  else if (text.includes('importante') || text.includes('alta') || text.includes('prioridade')) prioridade = 'alta';

  return {
    prioridade,
    classificacao,
    categoria,
    confianca: 65,
    raciocinio: 'Categorização por análise local de palavras-chave (API Claude indisponível)',
  };
}

export async function applyCategorization(taskId: string, categorization: AiCategorization) {
  return prisma.kanbanTask.update({
    where: { id: taskId },
    data: {
      prioridade: categorization.prioridade,
      classificacao: categorization.classificacao,
      categoria: categorization.categoria,
    },
  });
}
