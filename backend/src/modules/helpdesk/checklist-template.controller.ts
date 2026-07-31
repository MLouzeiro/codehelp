import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  listChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  importarTemplateParaTicket,
  importarTemplateParaKanbanTask,
} from './checklist-template.service';

export async function getChecklistTemplates(req: AuthRequest, res: Response) {
  try {
    const templates = await listChecklistTemplates({
      categoria: req.query.categoria as string,
      criadorId: req.user?.id,
    });
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar templates' });
  }
}

export async function createChecklistTemplateHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { nome, descricao, categoria, items, publico } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });

    const template = await createChecklistTemplate({
      nome: nome.trim(),
      descricao,
      categoria,
      items: items || [],
      publico,
      criadorId: req.user.id,
    });
    return res.status(201).json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar template' });
  }
}

export async function updateChecklistTemplateHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const template = await updateChecklistTemplate(id, req.body);
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar template' });
  }
}

export async function deleteChecklistTemplateHandler(req: AuthRequest, res: Response) {
  try {
    await deleteChecklistTemplate(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar template' });
  }
}

export async function importarTemplateTicketHandler(req: AuthRequest, res: Response) {
  try {
    const { templateId } = req.params;
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId obrigatório' });

    const result = await importarTemplateParaTicket(templateId, ticketId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Erro ao importar template' });
  }
}

export async function importarTemplateKanbanHandler(req: AuthRequest, res: Response) {
  try {
    const { templateId } = req.params;
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId obrigatório' });

    const result = await importarTemplateParaKanbanTask(templateId, taskId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Erro ao importar template' });
  }
}
