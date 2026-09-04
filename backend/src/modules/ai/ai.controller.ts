import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import prisma from '../../config/database';
import {
  gerarSugestoesVendas,
  classificarTicketsPendentes,
  analisarOsAtrasadas,
  sugerirPrioridadesTarefas,
} from './ai.service';
import { env } from '../../config/env';

export async function getVendasSugestoes(req: AuthRequest, res: Response) {
  try {
    const result = await gerarSugestoesVendas();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar sugestões de vendas' });
  }
}

export async function runClassificarTickets(req: AuthRequest, res: Response) {
  try {
    const result = await classificarTicketsPendentes();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao classificar tickets' });
  }
}

export async function getOsAlerts(req: AuthRequest, res: Response) {
  try {
    const alerts = await analisarOsAtrasadas();
    return res.json({ alerts, total: alerts.length });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao analisar OS' });
  }
}

export async function getTarefasSugestoes(req: AuthRequest, res: Response) {
  try {
    const sugestoes = await sugerirPrioridadesTarefas();
    return res.json({ sugestoes, total: sugestoes.length });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar sugestões de tarefas' });
  }
}

export async function getRobosStatus(req: AuthRequest, res: Response) {
  try {
    const robos = await prisma.robot.findMany({
      orderBy: { ordem: 'asc' },
      include: { rules: { orderBy: { ordem: 'asc' } } },
    });
    return res.json({ robos });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar robôs' });
  }
}

export async function updateRobot(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { ativo, horarioAtivo, diasSemana, horaInicio, horaFim, fusoHorario, config } = req.body;
    const data: any = {};
    if (ativo !== undefined) data.ativo = ativo;
    if (horarioAtivo !== undefined) data.horarioAtivo = horarioAtivo;
    if (diasSemana !== undefined) data.diasSemana = diasSemana;
    if (horaInicio !== undefined) data.horaInicio = horaInicio;
    if (horaFim !== undefined) data.horaFim = horaFim;
    if (fusoHorario !== undefined) data.fusoHorario = fusoHorario;
    if (config !== undefined) data.config = typeof config === 'string' ? config : JSON.stringify(config);
    data.updatedAt = new Date();
    const robot = await prisma.robot.update({
      where: { id },
      data,
      include: { rules: { orderBy: { ordem: 'asc' } } },
    });
    return res.json(robot);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar robô' });
  }
}

export async function createRule(req: AuthRequest, res: Response) {
  try {
    const { robotId } = req.params;
    const { nome, descricao, trigger, conditions, actions, logicOperator } = req.body;
    const maxOrdem = await prisma.robotRule.aggregate({
      where: { robotId },
      _max: { ordem: true },
    });
    const rule = await prisma.robotRule.create({
      data: {
        robotId,
        nome: nome || 'Nova Regra',
        descricao: descricao || null,
        trigger: JSON.stringify(trigger || { type: 'new_ticket' }),
        conditions: JSON.stringify(conditions || []),
        actions: JSON.stringify(actions || []),
        logicOperator: logicOperator || 'all',
        ordem: (maxOrdem._max.ordem ?? -1) + 1,
      },
    });
    return res.status(201).json(rule);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar regra' });
  }
}

export async function updateRule(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, descricao, ativo, trigger, conditions, actions, logicOperator, ordem } = req.body;
    const data: any = {};
    if (nome !== undefined) data.nome = nome;
    if (descricao !== undefined) data.descricao = descricao;
    if (ativo !== undefined) data.ativo = ativo;
    if (trigger !== undefined) data.trigger = typeof trigger === 'string' ? trigger : JSON.stringify(trigger);
    if (conditions !== undefined) data.conditions = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
    if (actions !== undefined) data.actions = typeof actions === 'string' ? actions : JSON.stringify(actions);
    if (logicOperator !== undefined) data.logicOperator = logicOperator;
    if (ordem !== undefined) data.ordem = ordem;
    data.updatedAt = new Date();
    const rule = await prisma.robotRule.update({ where: { id }, data });
    return res.json(rule);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar regra' });
  }
}

export async function deleteRule(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await prisma.robotRule.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir regra' });
  }
}

export async function createRobot(req: AuthRequest, res: Response) {
  try {
    const { nome, descricao, slug, icone, inteligente, config } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const robotSlug = slug || nome.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const existing = await prisma.robot.findFirst({ where: { slug: robotSlug } });
    if (existing) {
      return res.status(409).json({ error: 'Já existe um robô com este slug' });
    }
    const maxOrdem = await prisma.robot.aggregate({ _max: { ordem: true } });
    const robot = await prisma.robot.create({
      data: {
        slug: robotSlug,
        nome,
        descricao: descricao || '',
        icone: icone || 'bot',
        inteligente: inteligente || false,
        ordem: (maxOrdem._max.ordem ?? -1) + 1,
        config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : '{}',
      },
    });
    return res.status(201).json(robot);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar robô' });
  }
}

export async function deleteRobot(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await prisma.robot.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir robô' });
  }
}

export async function reorderRules(req: AuthRequest, res: Response) {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'Lista de regras é obrigatória' });
    }
    await Promise.all(
      rules.map((r: { id: string; ordem: number }) =>
        prisma.robotRule.update({ where: { id: r.id }, data: { ordem: r.ordem } })
      )
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao reordenar regras' });
  }
}
