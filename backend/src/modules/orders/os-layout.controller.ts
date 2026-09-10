import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as layoutService from './os-layout.service';

export async function listLayouts(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const layouts = await layoutService.listLayouts(orgId);
    return res.json(layouts);
  } catch (error: any) {
    console.error('Erro ao listar layouts:', error);
    return res.status(500).json({ error: 'Erro ao listar layouts' });
  }
}

export async function getLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const layout = await layoutService.getLayout(req.params.id);
    if (orgId && layout.organizationId && layout.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    return res.json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao buscar layout:', error);
    return res.status(500).json({ error: 'Erro ao buscar layout' });
  }
}

export async function createLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const layout = await layoutService.createLayout(req.body, orgId);
    return res.status(201).json(layout);
  } catch (error: any) {
    console.error('Erro ao criar layout:', error);
    return res.status(400).json({ error: error.message || 'Erro ao criar layout' });
  }
}

export async function updateLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.updateLayout(req.params.id, req.body);
    return res.json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao atualizar layout:', error);
    return res.status(400).json({ error: error.message || 'Erro ao atualizar layout' });
  }
}

export async function deleteLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    await layoutService.deleteLayout(req.params.id);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('sendo utilizado')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao excluir layout:', error);
    return res.status(500).json({ error: 'Erro ao excluir layout' });
  }
}

export async function setDefaultLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.setDefaultLayout(req.params.id);
    return res.json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao definir layout padrão:', error);
    return res.status(500).json({ error: 'Erro ao definir layout padrão' });
  }
}

export async function duplicateLayout(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.duplicateLayout(req.params.id);
    return res.status(201).json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao duplicar layout:', error);
    return res.status(500).json({ error: 'Erro ao duplicar layout' });
  }
}

export async function uploadTimbrado(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.uploadTimbrado(req.params.id, req.file);
    return res.json(layout);
  } catch (error: any) {
    console.error('Erro ao fazer upload do timbrado:', error);
    return res.status(400).json({ error: error.message || 'Erro ao fazer upload do timbrado' });
  }
}

export async function deleteTimbrado(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.deleteTimbrado(req.params.id);
    return res.json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao remover timbrado:', error);
    return res.status(500).json({ error: 'Erro ao remover timbrado' });
  }
}

export async function getDefaultLayoutHandler(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const layout = await layoutService.getDefaultLayout(orgId);
    return res.json(layout || null);
  } catch (error: any) {
    console.error('Erro ao buscar layout padrão:', error);
    return res.status(500).json({ error: 'Erro ao buscar layout padrão' });
  }
}

export async function uploadLogo(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.uploadLogo(req.params.id, req.file);
    return res.json(layout);
  } catch (error: any) {
    console.error('Erro ao fazer upload do logo:', error);
    return res.status(400).json({ error: error.message || 'Erro ao fazer upload do logo' });
  }
}

export async function deleteLogo(req: AuthRequest, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId;
    const existing = await layoutService.getLayout(req.params.id);
    if (orgId && existing.organizationId && existing.organizationId !== orgId) {
      return res.status(403).json({ error: 'Acesso negado a este layout' });
    }
    const layout = await layoutService.deleteLogo(req.params.id);
    return res.json(layout);
  } catch (error: any) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao remover logo:', error);
    return res.status(500).json({ error: 'Erro ao remover logo' });
  }
}
