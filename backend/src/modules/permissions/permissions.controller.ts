import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import {
  getAllPermissions,
  getRolePermissions,
  getRoleOverrides,
  getResourceCatalog,
  setPermission,
  removePermission,
  bulkUpdatePermissions,
  resetRoleToDefault,
  checkPermission,
  isValidRole,
} from './permissions.service';

function handleError(res: Response, err: any, fallback: string) {
  if (err?.code === 'VALIDATION') {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  console.error(`[permissions] ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

export async function getMatriz(_req: AuthRequest, res: Response) {
  try {
    const matriz = await getAllPermissions();
    const catalog = getResourceCatalog();
    return res.json({ matriz, catalog });
  } catch (err) {
    return handleError(res, err, 'Erro ao listar permissoes');
  }
}

export async function getCatalog(_req: AuthRequest, res: Response) {
  try {
    return res.json(getResourceCatalog());
  } catch (err) {
    return handleError(res, err, 'Erro ao listar catalogo');
  }
}

export async function getByRole(req: AuthRequest, res: Response) {
  try {
    const { role } = req.params;
    if (!isValidRole(role)) return res.status(400).json({ error: 'Role invalida' });
    const effective = await getRolePermissions(role);
    const overrides = await getRoleOverrides(role);
    return res.json({ role, effective, overrides });
  } catch (err) {
    return handleError(res, err, 'Erro ao buscar permissoes da role');
  }
}

export async function getEffectiveMine(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });
    const effective = await getRolePermissions(req.user.role);
    return res.json({ role: req.user.role, effective });
  } catch (err) {
    return handleError(res, err, 'Erro ao buscar permissoes');
  }
}

export async function putRole(req: AuthRequest, res: Response) {
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions deve ser um array' });
    }
    const result = await bulkUpdatePermissions(role, permissions);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'atualizar_matriz_permissoes',
      entidade: 'RolePermission',
      detalhes: { role, total: permissions.length },
      ip: getIpFromRequest(req),
      severity: 'alta',
    });
    return res.json({ ok: true, overrides: result });
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar permissoes');
  }
}

export async function patchPermission(req: AuthRequest, res: Response) {
  try {
    const { role, resource, action } = req.params;
    const { granted } = req.body;
    if (typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'granted deve ser boolean' });
    }
    const p = await setPermission(role, resource, action, granted);
    await logAction({
      usuarioId: req.user?.id,
      acao: granted ? 'liberar_permissao' : 'negar_permissao',
      entidade: 'RolePermission',
      entidadeId: p.id,
      detalhes: { role, resource, action },
      ip: getIpFromRequest(req),
      severity: 'alta',
    });
    return res.json(p);
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar permissao');
  }
}

export async function deletePermission(req: AuthRequest, res: Response) {
  try {
    const { role, resource, action } = req.params;
    await removePermission(role, resource, action);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'remover_override_permissao',
      entidade: 'RolePermission',
      detalhes: { role, resource, action },
      ip: getIpFromRequest(req),
      severity: 'alta',
    });
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err, 'Erro ao remover override');
  }
}

export async function postReset(req: AuthRequest, res: Response) {
  try {
    const { role } = req.params;
    const effective = await resetRoleToDefault(role);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'resetar_permissoes_role',
      entidade: 'RolePermission',
      detalhes: { role },
      ip: getIpFromRequest(req),
      severity: 'alta',
    });
    return res.json({ ok: true, effective });
  } catch (err) {
    return handleError(res, err, 'Erro ao resetar permissoes');
  }
}

export async function postCheck(req: AuthRequest, res: Response) {
  try {
    const role = (req.query.role as string) || req.body?.role;
    const resource = (req.query.resource as string) || req.body?.resource;
    const action = (req.query.action as string) || req.body?.action;
    if (!role || !resource || !action) {
      return res.status(400).json({ error: 'role, resource e action sao obrigatorios' });
    }
    const granted = await checkPermission(role, resource, action);
    return res.json({ granted });
  } catch (err) {
    return handleError(res, err, 'Erro ao verificar permissao');
  }
}
