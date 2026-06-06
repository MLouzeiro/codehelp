import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_HIERARCHY,
  LEGACY_ROLE_MAP,
  normalizeRole,
  isValidRole,
  hasAtLeast,
  isAdmin,
  isSupervisorOrAbove,
  isAgentOrAbove,
  canManageUsers,
  canViewDashboard,
  canDeleteTicket,
  canPublishKB,
  canEditKB,
} from '../modules/auth/rbac';

describe('RBAC (Bloco 4)', () => {
  describe('Constantes', () => {
    it('existem 4 roles definidos no documento', () => {
      expect(ROLES.length).toBe(4);
      expect(ROLES).toContain('solicitante');
      expect(ROLES).toContain('agente');
      expect(ROLES).toContain('supervisor');
      expect(ROLES).toContain('admin');
    });

    it('hierarquia esta em ordem crescente (solicitante < agente < supervisor < admin)', () => {
      expect(ROLE_HIERARCHY.solicitante).toBeLessThan(ROLE_HIERARCHY.agente);
      expect(ROLE_HIERARCHY.agente).toBeLessThan(ROLE_HIERARCHY.supervisor);
      expect(ROLE_HIERARCHY.supervisor).toBeLessThan(ROLE_HIERARCHY.admin);
    });
  });

  describe('normalizeRole', () => {
    it('mapeia role legado "tecnico" -> "agente"', () => {
      expect(normalizeRole('tecnico')).toBe('agente');
    });
    it('mapeia role legado "gerente" -> "supervisor"', () => {
      expect(normalizeRole('gerente')).toBe('supervisor');
    });
    it('mapeia role legado "vendedor" -> "agente"', () => {
      expect(normalizeRole('vendedor')).toBe('agente');
    });
    it('mapeia role novo "agente" -> "agente"', () => {
      expect(normalizeRole('agente')).toBe('agente');
    });
    it('mapeia "ADMIN" (maiusculo) -> "admin"', () => {
      expect(normalizeRole('ADMIN')).toBe('admin');
    });
    it('retorna null para role desconhecido', () => {
      expect(normalizeRole('pirata')).toBeNull();
    });
    it('retorna null para null/undefined/vazio', () => {
      expect(normalizeRole(null)).toBeNull();
      expect(normalizeRole(undefined)).toBeNull();
      expect(normalizeRole('')).toBeNull();
    });
  });

  describe('isValidRole', () => {
    it('aceita roles validos (legados e novos)', () => {
      expect(isValidRole('tecnico')).toBe(true);
      expect(isValidRole('gerente')).toBe(true);
      expect(isValidRole('agente')).toBe(true);
      expect(isValidRole('supervisor')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
    });
    it('rejeita roles invalidos', () => {
      expect(isValidRole('pirata')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('hasAtLeast', () => {
    it('admin tem pelo menos qualquer role', () => {
      expect(hasAtLeast('admin', 'solicitante')).toBe(true);
      expect(hasAtLeast('admin', 'agente')).toBe(true);
      expect(hasAtLeast('admin', 'supervisor')).toBe(true);
      expect(hasAtLeast('admin', 'admin')).toBe(true);
    });
    it('supervisor NAO tem role admin', () => {
      expect(hasAtLeast('supervisor', 'admin')).toBe(false);
    });
    it('supervisor tem agente e solicitante', () => {
      expect(hasAtLeast('supervisor', 'agente')).toBe(true);
      expect(hasAtLeast('supervisor', 'solicitante')).toBe(true);
    });
    it('agente tem apenas solicitante', () => {
      expect(hasAtLeast('agente', 'solicitante')).toBe(true);
      expect(hasAtLeast('agente', 'supervisor')).toBe(false);
    });
    it('solicitante nao tem role algum', () => {
      expect(hasAtLeast('solicitante', 'solicitante')).toBe(true);
      expect(hasAtLeast('solicitante', 'agente')).toBe(false);
    });
    it('funciona com roles legados (gerente -> supervisor)', () => {
      expect(hasAtLeast('gerente', 'supervisor')).toBe(true);
      expect(hasAtLeast('tecnico', 'agente')).toBe(true);
    });
  });

  describe('helpers de verificacao', () => {
    it('isAdmin', () => {
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('gerente')).toBe(false);
      expect(isAdmin(null)).toBe(false);
    });
    it('isSupervisorOrAbove aceita gerente legado', () => {
      expect(isSupervisorOrAbove('gerente')).toBe(true);
      expect(isSupervisorOrAbove('supervisor')).toBe(true);
      expect(isSupervisorOrAbove('admin')).toBe(true);
      expect(isSupervisorOrAbove('tecnico')).toBe(false);
    });
    it('isAgentOrAbove', () => {
      expect(isAgentOrAbove('tecnico')).toBe(true);
      expect(isAgentOrAbove('agente')).toBe(true);
      expect(isAgentOrAbove('gerente')).toBe(true);
      expect(isAgentOrAbove('solicitante')).toBe(false);
    });
  });

  describe('permissoes especificas (documento secoes 10 e 12)', () => {
    it('canManageUsers: apenas admin', () => {
      expect(canManageUsers('admin')).toBe(true);
      expect(canManageUsers('supervisor')).toBe(false);
      expect(canManageUsers('agente')).toBe(false);
    });
    it('canViewDashboard: supervisor+', () => {
      expect(canViewDashboard('admin')).toBe(true);
      expect(canViewDashboard('supervisor')).toBe(true);
      expect(canViewDashboard('agente')).toBe(false);
    });
    it('canDeleteTicket: apenas admin', () => {
      expect(canDeleteTicket('admin')).toBe(true);
      expect(canDeleteTicket('supervisor')).toBe(false);
    });
    it('canPublishKB: supervisor+', () => {
      expect(canPublishKB('supervisor')).toBe(true);
      expect(canPublishKB('agente')).toBe(false);
    });
    it('canEditKB: agente+', () => {
      expect(canEditKB('agente')).toBe(true);
      expect(canEditKB('solicitante')).toBe(false);
    });
  });
});
