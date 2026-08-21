import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as svc from './teams.service';

export async function listTeams(req: AuthRequest, res: Response) {
  try {
    const teams = await svc.listTeams();
    return res.json(teams);
  } catch (error) {
    console.error('Erro ao listar equipes:', error);
    return res.status(500).json({ error: 'Erro ao listar equipes' });
  }
}

export async function getTeam(req: AuthRequest, res: Response) {
  try {
    const team = await svc.getTeam(req.params.teamId);
    return res.json(team);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao buscar equipe:', error);
    return res.status(500).json({ error: 'Erro ao buscar equipe' });
  }
}

export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const team = await svc.createTeam(req.body, req.user?.id ?? null);
    return res.status(201).json(team);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar equipe:', error);
    return res.status(500).json({ error: 'Erro ao criar equipe' });
  }
}

export async function updateTeam(req: AuthRequest, res: Response) {
  try {
    const team = await svc.updateTeam(req.params.teamId, req.body, req.user?.id ?? null);
    return res.json(team);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao atualizar equipe:', error);
    return res.status(500).json({ error: 'Erro ao atualizar equipe' });
  }
}

export async function deleteTeam(req: AuthRequest, res: Response) {
  try {
    await svc.deleteTeam(req.params.teamId, req.user?.id ?? null);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar equipe:', error);
    return res.status(500).json({ error: 'Erro ao deletar equipe' });
  }
}

export async function addMember(req: AuthRequest, res: Response) {
  try {
    const member = await svc.addMember(req.params.teamId, req.body.userId, req.user?.id ?? null);
    return res.status(201).json(member);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao adicionar membro:', error);
    return res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    await svc.removeMember(req.params.teamId, req.params.userId, req.user?.id ?? null);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao remover membro:', error);
    return res.status(500).json({ error: 'Erro ao remover membro' });
  }
}