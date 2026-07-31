import prisma from '../../config/database';

interface ChecklistTemplateItem {
  titulo: string;
  ordem: number;
}

/**
 * Lista templates de checklist
 */
export async function listChecklistTemplates(filtro?: { categoria?: string; criadorId?: string }) {
  const where: any = { };
  if (filtro?.categoria) where.categoria = filtro.categoria;
  if (filtro?.criadorId) where.OR = [{ publico: true }, { criadorId: filtro.criadorId }];

  return prisma.checklistTemplate.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: { criador: { select: { id: true, name: true } } },
  });
}

/**
 * Cria template de checklist
 */
export async function createChecklistTemplate(params: {
  nome: string;
  descricao?: string;
  categoria?: string;
  items: ChecklistTemplateItem[];
  publico?: boolean;
  criadorId: string;
}) {
  return prisma.checklistTemplate.create({
    data: {
      nome: params.nome,
      descricao: params.descricao,
      categoria: params.categoria || 'geral',
      items: JSON.stringify(params.items),
      publico: params.publico ?? false,
      criadorId: params.criadorId,
    },
  });
}

/**
 * Atualiza template de checklist
 */
export async function updateChecklistTemplate(id: string, data: {
  nome?: string;
  descricao?: string;
  categoria?: string;
  items?: ChecklistTemplateItem[];
  publico?: boolean;
}) {
  const updateData: any = {};
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.categoria !== undefined) updateData.categoria = data.categoria;
  if (data.items !== undefined) updateData.items = JSON.stringify(data.items);
  if (data.publico !== undefined) updateData.publico = data.publico;

  return prisma.checklistTemplate.update({ where: { id }, data: updateData });
}

/**
 * Deleta template de checklist
 */
export async function deleteChecklistTemplate(id: string) {
  return prisma.checklistTemplate.delete({ where: { id } });
}

/**
 * Importa template para um ticket
 */
export async function importarTemplateParaTicket(templateId: string, ticketId: string) {
  const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error('Template não encontrado');

  const items: ChecklistTemplateItem[] = JSON.parse(template.items);
  const existingItems = await prisma.ticketChecklist.findMany({
    where: { ticketId },
    select: { ordem: true },
  });
  const maxOrdem = existingItems.reduce((max, i) => Math.max(max, i.ordem), -1);

  const created = await prisma.ticketChecklist.createMany({
    data: items.map((item, idx) => ({
      ticketId,
      titulo: item.titulo,
      ordem: maxOrdem + idx + 1,
    })),
  });

  return { count: created.count, template: template.nome };
}

/**
 * Importa template para uma KanbanTask (via subtasks)
 */
export async function importarTemplateParaKanbanTask(templateId: string, taskId: string) {
  const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error('Template não encontrado');

  const items: ChecklistTemplateItem[] = JSON.parse(template.items);
  const existing = await prisma.kanbanSubtask.findMany({
    where: { taskId },
    select: { ordem: true },
  });
  const maxOrdem = existing.reduce((max, i) => Math.max(max, i.ordem), -1);

  const created = await prisma.kanbanSubtask.createMany({
    data: items.map((item, idx) => ({
      taskId,
      titulo: item.titulo,
      ordem: maxOrdem + idx + 1,
    })),
  });

  return { count: created.count, template: template.nome };
}
