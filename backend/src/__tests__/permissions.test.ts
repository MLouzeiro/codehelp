import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  isValidRole,
  isValidResource,
  isValidAction,
  getDefaultPermissions,
  getRolePermissions,
  getAllPermissions,
  setPermission,
  removePermission,
  bulkUpdatePermissions,
  resetRoleToDefault,
  checkPermission,
  ROLES_VALIDAS,
  RESOURCES_CATALOG,
} from '../modules/permissions/permissions.service';

beforeEach(async () => {
  await prisma.rolePermission.deleteMany({});
});

afterAll(async () => {
  await prisma.rolePermission.deleteMany({});
});

describe('Permissions Service (Bloco 18)', () => {
  describe('catalogos e validacao', () => {
    it('ROLES_VALIDAS contem os 5 roles principais', () => {
      expect(ROLES_VALIDAS).toEqual(expect.arrayContaining(['admin', 'gerente', 'tecnico', 'comercial', 'vendedor']));
    });

    it('isValidRole aceita apenas roles do catalogo', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('master')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });

    it('isValidResource aceita resources do catalogo', () => {
      expect(isValidResource('client')).toBe(true);
      expect(isValidResource('inexistente')).toBe(false);
    });

    it('isValidAction aceita apenas acoes definidas para o resource', () => {
      expect(isValidAction('client', 'read')).toBe(true);
      expect(isValidAction('client', 'move')).toBe(false);
      expect(isValidAction('ticket', 'move')).toBe(true);
    });

    it('RESOURCES_CATALOG tem pelo menos 10 recursos', () => {
      expect(RESOURCES_CATALOG.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getDefaultPermissions', () => {
    it('admin tem todas as acoes de todos os recursos', () => {
      const d = getDefaultPermissions('admin');
      for (const r of RESOURCES_CATALOG) {
        for (const a of r.actions) {
          expect(d[r.key]).toContain(a);
        }
      }
    });

    it('vendedor tem permissao minima (apenas read)', () => {
      const d = getDefaultPermissions('vendedor');
      expect(d.client).toEqual(['read']);
      expect(d.order).toEqual(['read']);
      expect(d.ticket).toEqual(['read']);
    });

    it('gerente tem permissoes amplas mas nao manage tudo', () => {
      const d = getDefaultPermissions('gerente');
      expect(d.client).toContain('delete');
      expect(d.permission).toEqual(['read']);
    });
  });

  describe('getRolePermissions', () => {
    it('retorna mapa resource -> action -> bool', async () => {
      const m = await getRolePermissions('tecnico');
      expect(m.client.read).toBe(true);
      expect(m.client.delete).toBe(false);
      expect(m.ticket.move).toBe(true);
    });

    it('rejeita role invalida', async () => {
      await expect(getRolePermissions('master')).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  describe('getAllPermissions', () => {
    it('retorna mapa para todas as roles', async () => {
      const all = await getAllPermissions();
      for (const r of ROLES_VALIDAS) {
        expect(all[r]).toBeDefined();
        expect(all[r].client).toBeDefined();
      }
    });
  });

  describe('setPermission', () => {
    it('cria override novo', async () => {
      const p = await setPermission('tecnico', 'client', 'delete', true);
      expect(p.granted).toBe(true);
      const m = await getRolePermissions('tecnico');
      expect(m.client.delete).toBe(true);
    });

    it('sobrescreve override existente', async () => {
      await setPermission('tecnico', 'client', 'delete', true);
      await setPermission('tecnico', 'client', 'delete', false);
      const m = await getRolePermissions('tecnico');
      expect(m.client.delete).toBe(false);
    });

    it('override false tem precedencia sobre default true', async () => {
      await setPermission('admin', 'client', 'delete', false);
      const m = await getRolePermissions('admin');
      expect(m.client.delete).toBe(false);
    });

    it('rejeita role invalida', async () => {
      await expect(setPermission('master', 'client', 'read', true)).rejects.toMatchObject({ code: 'VALIDATION', field: 'role' });
    });

    it('rejeita resource invalido', async () => {
      await expect(setPermission('admin', 'inexistente', 'read', true)).rejects.toMatchObject({ code: 'VALIDATION', field: 'resource' });
    });

    it('rejeita action invalida para o resource', async () => {
      await expect(setPermission('admin', 'client', 'move', true)).rejects.toMatchObject({ code: 'VALIDATION', field: 'action' });
    });
  });

  describe('removePermission', () => {
    it('remove override existente e volta ao default', async () => {
      await setPermission('tecnico', 'client', 'delete', true);
      await removePermission('tecnico', 'client', 'delete');
      const m = await getRolePermissions('tecnico');
      expect(m.client.delete).toBe(false);
    });
  });

  describe('bulkUpdatePermissions', () => {
    it('substitui TODOS os overrides da role', async () => {
      await setPermission('tecnico', 'client', 'delete', true);
      const novos = [
        { resource: 'client', action: 'delete', granted: true },
        { resource: 'order', action: 'delete', granted: true },
        { resource: 'client', action: 'create', granted: true },
      ];
      await bulkUpdatePermissions('tecnico', novos);
      const m = await getRolePermissions('tecnico');
      expect(m.client.delete).toBe(true);
      expect(m.order.delete).toBe(true);
      expect(m.client.create).toBe(true);
      const overrides = await prisma.rolePermission.findMany({ where: { role: 'tecnico' } });
      expect(overrides).toHaveLength(3);
    });

    it('rejeita role invalida', async () => {
      await expect(bulkUpdatePermissions('master', [])).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejeita resource invalido na lista', async () => {
      await expect(bulkUpdatePermissions('admin', [{ resource: 'fake', action: 'read', granted: true }]))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  describe('resetRoleToDefault', () => {
    it('remove todos os overrides e volta aos defaults', async () => {
      await setPermission('tecnico', 'client', 'delete', true);
      await setPermission('tecnico', 'order', 'delete', true);
      const m = await resetRoleToDefault('tecnico');
      expect(m.client.delete).toBe(false);
      expect(m.order.delete).toBe(false);
      const overrides = await prisma.rolePermission.findMany({ where: { role: 'tecnico' } });
      expect(overrides).toHaveLength(0);
    });
  });

  describe('checkPermission', () => {
    it('retorna true para permissao default true', async () => {
      expect(await checkPermission('tecnico', 'client', 'read')).toBe(true);
    });

    it('retorna false para permissao default false', async () => {
      expect(await checkPermission('tecnico', 'client', 'delete')).toBe(false);
    });

    it('override true libera', async () => {
      await setPermission('tecnico', 'client', 'delete', true);
      expect(await checkPermission('tecnico', 'client', 'delete')).toBe(true);
    });

    it('override false bloqueia mesmo se default e true', async () => {
      await setPermission('admin', 'client', 'read', false);
      expect(await checkPermission('admin', 'client', 'read')).toBe(false);
    });

    it('retorna false para role invalida', async () => {
      expect(await checkPermission('master', 'client', 'read')).toBe(false);
    });

    it('retorna false para resource invalido', async () => {
      expect(await checkPermission('admin', 'fake', 'read')).toBe(false);
    });
  });
});
