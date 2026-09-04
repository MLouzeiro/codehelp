import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../config/database';
import { logAudit, getLogs, getAuditDashboardStats } from '../modules/audit/audit.service';
import { getSecurityIndicators, getAnomalias, getUserTimeline } from '../modules/audit/audit-security.service';
import { getAuditAlerts, getAuditAlertStats, criarAlerta, marcarAlertaAnalisado, arquivarAlerta, detectarEGerarAlertas } from '../modules/audit/audit-alerts.service';

let testUserId: string;

beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  testUserId = admin!.id;
});

describe('AuditLog Estendido', () => {
  describe('logAudit com novos campos', () => {
    it('cria log com severity, clienteId, fonte, success', async () => {
      await logAudit({
        usuarioId: testUserId,
        acao: 'criar',
        entidade: 'Ticket',
        entidadeId: 'ext-test-1',
        severity: 'alta',
        fonte: 'manual',
        success: true,
        modulo: 'Ticket',
        ip: '10.0.0.1',
      });
      const log = await prisma.auditLog.findFirst({
        where: { entidadeId: 'ext-test-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeTruthy();
      expect(log?.severity).toBe('alta');
      expect(log?.fonte).toBe('manual');
      expect(log?.success).toBe(true);
      expect(log?.ip).toBe('10.0.0.1');
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('cria log com fonte ia e errorMessage', async () => {
      await logAudit({
        acao: 'classificar',
        entidade: 'Ticket',
        entidadeId: 'ext-test-2',
        fonte: 'ia',
        success: false,
        errorMessage: 'API timeout',
        severity: 'critica',
      });
      const log = await prisma.auditLog.findFirst({
        where: { entidadeId: 'ext-test-2' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.fonte).toBe('ia');
      expect(log?.success).toBe(false);
      expect(log?.errorMessage).toBe('API timeout');
      expect(log?.severity).toBe('critica');
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });

    it('cria log com entidadeRelacionada', async () => {
      await logAudit({
        acao: 'criar',
        entidade: 'ServiceOrder',
        entidadeId: 'os-1',
        entidadeRelacionada: 'Ticket',
        entidadeRelacionadaId: 'tk-99',
        fonte: 'api',
      });
      const log = await prisma.auditLog.findFirst({
        where: { entidadeId: 'os-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.entidadeRelacionada).toBe('Ticket');
      expect(log?.entidadeRelacionadaId).toBe('tk-99');
      expect(log?.fonte).toBe('api');
      await prisma.auditLog.delete({ where: { id: log!.id } });
    });
  });

  describe('getLogs com novos filtros', () => {
    it('filtra por severity', async () => {
      await logAudit({ acao: 'deletar', entidade: 'Ticket', entidadeId: 'sev-test', severity: 'critica' });
      const r = await getLogs({ severity: 'critica', limit: 10 });
      expect(r.logs.some((l) => l.entidadeId === 'sev-test')).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'sev-test' } });
    });

    it('filtra por fonte', async () => {
      await logAudit({ acao: 'criar', entidade: 'Ticket', entidadeId: 'fonte-test', fonte: 'api' });
      const r = await getLogs({ fonte: 'api', limit: 10 });
      expect(r.logs.some((l) => l.entidadeId === 'fonte-test')).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'fonte-test' } });
    });

    it('filtra por success', async () => {
      await logAudit({ acao: 'login_falha', entidade: 'Session', entidadeId: 'fail-test', success: false });
      const r = await getLogs({ success: false, limit: 10 });
      expect(r.logs.some((l) => l.entidadeId === 'fail-test')).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'fail-test' } });
    });

    it('busca por errorMessage', async () => {
      await logAudit({ acao: 'erro', entidade: 'Ticket', entidadeId: 'err-test', errorMessage: 'Timeout na conexao' });
      const r = await getLogs({ search: 'Timeout', limit: 10 });
      expect(r.logs.some((l) => l.entidadeId === 'err-test')).toBe(true);
      await prisma.auditLog.deleteMany({ where: { entidadeId: 'err-test' } });
    });
  });

  describe('getAuditDashboardStats expandido', () => {
    it('retorna novos campos de indicadores', async () => {
      const stats = await getAuditDashboardStats();
      expect(stats).toHaveProperty('totalEventos');
      expect(stats).toHaveProperty('deltaTotal');
      expect(stats).toHaveProperty('falhasAuth');
      expect(stats).toHaveProperty('deltaFalhasAuth');
      expect(stats).toHaveProperty('tentativasBloqueadas');
      expect(stats).toHaveProperty('logins');
      expect(stats).toHaveProperty('alteracoesPermissao');
      expect(stats).toHaveProperty('exclusoes');
      expect(stats).toHaveProperty('acoesApi');
      expect(stats).toHaveProperty('acoesAutomaticas');
      expect(stats).toHaveProperty('acoesIa');
      expect(stats).toHaveProperty('eventosSuspeitos');
      expect(stats).toHaveProperty('eventosCriticos');
      expect(typeof stats.totalEventos).toBe('number');
      expect(typeof stats.deltaTotal).toBe('number');
    });
  });
});

describe('AuditSecurity Service', () => {
  describe('getSecurityIndicators', () => {
    it('retorna todos os indicadores de segurança', async () => {
      const sec = await getSecurityIndicators();
      expect(sec).toHaveProperty('tentativasLogin');
      expect(sec).toHaveProperty('loginsSucesso');
      expect(sec).toHaveProperty('loginsRecusados');
      expect(sec).toHaveProperty('falhasConsecutivas');
      expect(sec).toHaveProperty('acessoNegadoModulos');
      expect(sec).toHaveProperty('acessoNegadoRegistros');
      expect(sec).toHaveProperty('alteracoesSenha');
      expect(sec).toHaveProperty('alteracoesPermissoes');
      expect(sec).toHaveProperty('criacaoUsuarios');
      expect(sec).toHaveProperty('exclusaoUsuarios');
      expect(sec).toHaveProperty('tentativasBloqueadas');
      expect(sec).toHaveProperty('eventosCriticos');
      expect(sec).toHaveProperty('ipsMultiplos');
      expect(typeof sec.tentativasLogin).toBe('number');
    });

    it('filtra por usuarioId', async () => {
      const sec = await getSecurityIndicators({ usuarioId: testUserId });
      expect(typeof sec.tentativasLogin).toBe('number');
    });

    it('filtra por periodo', async () => {
      const atras = new Date(Date.now() - 7 * 86400000);
      const sec = await getSecurityIndicators({ dataInicio: atras });
      expect(typeof sec.tentativasLogin).toBe('number');
    });
  });

  describe('getAnomalias', () => {
    it('retorna array de anomalias', async () => {
      const a = await getAnomalias();
      expect(Array.isArray(a)).toBe(true);
    });

    it('cada anomalias tem campos obrigatorios', async () => {
      const a = await getAnomalias();
      for (const item of a) {
        expect(item).toHaveProperty('tipo');
        expect(item).toHaveProperty('titulo');
        expect(item).toHaveProperty('descricao');
        expect(item).toHaveProperty('severidade');
        expect(item).toHaveProperty('motivo');
        expect(item).toHaveProperty('acaoRecomendada');
      }
    });
  });

  describe('getUserTimeline', () => {
    it('retorna timeline e resumo para um usuario', async () => {
      const r = await getUserTimeline(testUserId);
      expect(r).toHaveProperty('timeline');
      expect(r).toHaveProperty('resumo');
      expect(Array.isArray(r.timeline)).toBe(true);
      expect(r.resumo).toHaveProperty('totalAcoes');
      expect(r.resumo).toHaveProperty('porAcao');
      expect(r.resumo).toHaveProperty('porModulo');
      expect(r.resumo).toHaveProperty('horariosAtividade');
    });

    it('filtra por periodo', async () => {
      const atras = new Date(Date.now() - 7 * 86400000);
      const r = await getUserTimeline(testUserId, { dataInicio: atras });
      expect(Array.isArray(r.timeline)).toBe(true);
    });
  });
});

describe('AuditAlerts Service', () => {
  let alertId: string;

  describe('criarAlerta', () => {
    it('cria alerta com campos obrigatorios', async () => {
      const alerta = await criarAlerta({
        tipo: 'teste_alerta',
        titulo: 'Alerta de teste',
        descricao: 'Descricao do alerta de teste',
        severidade: 'media',
      });
      expect(alerta).toBeTruthy();
      expect(alerta.tipo).toBe('teste_alerta');
      expect(alerta.titulo).toBe('Alerta de teste');
      expect(alerta.status).toBe('pendente');
      alertId = alerta.id;
    });
  });

  describe('getAuditAlerts', () => {
    it('retorna alertas criados', async () => {
      const r = await getAuditAlerts({ tipo: 'teste_alerta' });
      expect(r.alerts.length).toBeGreaterThanOrEqual(1);
      expect(r.total).toBeGreaterThanOrEqual(1);
    });

    it('filtra por severidade', async () => {
      const r = await getAuditAlerts({ severidade: 'media' });
      expect(r.alerts.every((a) => a.severidade === 'media')).toBe(true);
    });

    it('filtra por status', async () => {
      const r = await getAuditAlerts({ status: 'pendente' });
      expect(r.alerts.every((a) => a.status === 'pendente')).toBe(true);
    });
  });

  describe('getAuditAlertStats', () => {
    it('retorna estatisticas de alertas', async () => {
      const s = await getAuditAlertStats();
      expect(s).toHaveProperty('pendentes');
      expect(s).toHaveProperty('analisados');
      expect(s).toHaveProperty('arquivados');
      expect(s).toHaveProperty('total');
      expect(s).toHaveProperty('porSeveridade');
      expect(s).toHaveProperty('ultimas24h');
      expect(typeof s.pendentes).toBe('number');
    });
  });

  describe('marcarAlertaAnalisado', () => {
    it('atualiza status para analisado', async () => {
      const updated = await marcarAlertaAnalisado(alertId, testUserId, 'Teste de analise');
      expect(updated.status).toBe('analisado');
      expect(updated.analisadoPor).toBe(testUserId);
      expect(updated.justificativa).toBe('Teste de analise');
      expect(updated.analisadoEm).toBeTruthy();
    });
  });

  describe('arquivarAlerta', () => {
    it('atualiza status para arquivado', async () => {
      const updated = await arquivarAlerta(alertId);
      expect(updated.status).toBe('arquivado');
      expect(updated.arquivadoEm).toBeTruthy();
    });
  });

  describe('detectarEGerarAlertas', () => {
    it('retorna numero de alertas criados', async () => {
      const n = await detectarEGerarAlertas();
      expect(typeof n).toBe('number');
      expect(n).toBeGreaterThanOrEqual(0);
    });
  });

  afterAll(async () => {
    if (alertId) {
      await prisma.auditAlert.delete({ where: { id: alertId } }).catch(() => {});
    }
  });
});
