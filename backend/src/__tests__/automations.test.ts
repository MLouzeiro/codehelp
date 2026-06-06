import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  criarRegra,
  atualizarRegra,
  deletarRegra,
  listarRegras,
  getRegra,
  avaliarRegras,
  TRIGGERS_VALIDOS,
  ACOES_VALIDAS,
} from '../modules/automations/automations.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('Automations Service (Bloco 8)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('Constantes do documento', () => {
    it('5 triggers validos', () => {
      expect(TRIGGERS_VALIDOS.length).toBe(5);
      expect(TRIGGERS_VALIDOS).toContain('novo_ticket');
      expect(TRIGGERS_VALIDOS).toContain('msg_recebida');
      expect(TRIGGERS_VALIDOS).toContain('status_alterado');
      expect(TRIGGERS_VALIDOS).toContain('sla_alerta');
      expect(TRIGGERS_VALIDOS).toContain('csat_recebido');
    });
    it('8 acoes validas', () => {
      expect(ACOES_VALIDAS.length).toBe(8);
      expect(ACOES_VALIDAS).toContain('definir_categoria');
      expect(ACOES_VALIDAS).toContain('atribuir_usuario');
      expect(ACOES_VALIDAS).toContain('mudar_etapa');
      expect(ACOES_VALIDAS).toContain('escalar_fila');
      expect(ACOES_VALIDAS).toContain('notificar');
    });
  });

  describe('criarRegra / listarRegras', () => {
    it('cria regra WHEN novo_ticket IF categoria=financeiro THEN definir_prioridade=alta', async () => {
      const r = await criarRegra({
        nome: 'Financeiro vira Alta',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'categoria', operador: 'eq', valor: 'financeiro' }],
        acoes: [{ tipo: 'definir_prioridade', parametros: { prioridade: 'alta' } }],
      });
      expect(r.id).toBeTruthy();
      expect(r.trigger).toBe('novo_ticket');
      const list = await listarRegras({ trigger: 'novo_ticket' });
      expect(list.find((x) => x.id === r.id)).toBeTruthy();
      await deletarRegra(r.id);
    });

    it('filtra por ativo/inativo', async () => {
      const a = await criarRegra({
        nome: 'Ativa', trigger: 'msg_recebida', condicoes: [], acoes: [{ tipo: 'notificar', parametros: { usuarioId: 'fake', mensagem: 'x' } }],
      });
      const i = await criarRegra({
        nome: 'Inativa', trigger: 'msg_recebida', condicoes: [], acoes: [], ativo: false,
      });
      const ativas = await listarRegras({ ativo: true });
      const inativas = await listarRegras({ ativo: false });
      expect(ativas.find((x) => x.id === a.id)).toBeTruthy();
      expect(ativas.find((x) => x.id === i.id)).toBeUndefined();
      expect(inativas.find((x) => x.id === i.id)).toBeTruthy();
      await deletarRegra(a.id);
      await deletarRegra(i.id);
    });
  });

  describe('avaliarRegras - condicoes', () => {
    it('regra com condicao eq: passa quando valor bate', async () => {
      const r = await criarRegra({
        nome: 'Eq teste',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'categoria', operador: 'eq', valor: 'financeiro' }],
        acoes: [{ tipo: 'notificar', parametros: { usuarioId: 'fake-user', mensagem: 'Acionado' } }],
      });
      const result = await avaliarRegras('novo_ticket', { categoria: 'financeiro' });
      expect(result.find((x) => x.regraId === r.id)).toBeTruthy();
      await deletarRegra(r.id);
    });

    it('regra com condicao eq: NAO passa quando valor difere', async () => {
      const r = await criarRegra({
        nome: 'Eq nao passa',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'categoria', operador: 'eq', valor: 'suporte_tecnico' }],
        acoes: [],
      });
      const result = await avaliarRegras('novo_ticket', { categoria: 'financeiro' });
      expect(result.find((x) => x.regraId === r.id)).toBeUndefined();
      await deletarRegra(r.id);
    });

    it('condicao gt (tempo_aberto > 60)', async () => {
      const r = await criarRegra({
        nome: 'Tempo alto',
        trigger: 'sla_alerta',
        condicoes: [{ campo: 'tempo_aberto_min', operador: 'gt', valor: 60 }],
        acoes: [],
      });
      const passa = await avaliarRegras('sla_alerta', { tempo_aberto_min: 90 });
      const nao = await avaliarRegras('sla_alerta', { tempo_aberto_min: 30 });
      expect(passa.find((x) => x.regraId === r.id)).toBeTruthy();
      expect(nao.find((x) => x.regraId === r.id)).toBeUndefined();
      await deletarRegra(r.id);
    });

    it('condicao contains (case-insensitive)', async () => {
      const r = await criarRegra({
        nome: 'Contains teste',
        trigger: 'msg_recebida',
        condicoes: [{ campo: 'mensagem', operador: 'contains', valor: 'boleto' }],
        acoes: [],
      });
      const result = await avaliarRegras('msg_recebida', { mensagem: 'Preciso do BOLETO urgente' });
      expect(result.find((x) => x.regraId === r.id)).toBeTruthy();
      await deletarRegra(r.id);
    });

    it('logicOperator all: TODAS condicoes devem passar', async () => {
      const r = await criarRegra({
        nome: 'All',
        trigger: 'novo_ticket',
        condicoes: [
          { campo: 'categoria', operador: 'eq', valor: 'financeiro' },
          { campo: 'prioridade', operador: 'eq', valor: 'alta' },
        ],
        acoes: [],
      });
      const passa = await avaliarRegras('novo_ticket', { categoria: 'financeiro', prioridade: 'alta' });
      const nao = await avaliarRegras('novo_ticket', { categoria: 'financeiro', prioridade: 'baixa' });
      expect(passa.find((x) => x.regraId === r.id)).toBeTruthy();
      expect(nao.find((x) => x.regraId === r.id)).toBeUndefined();
      await deletarRegra(r.id);
    });

    it('logicOperator any: UMA condicao passando basta', async () => {
      const r = await criarRegra({
        nome: 'Any',
        trigger: 'novo_ticket',
        logicOperator: 'any',
        condicoes: [
          { campo: 'categoria', operador: 'eq', valor: 'financeiro' },
          { campo: 'categoria', operador: 'eq', valor: 'cancelamento' },
        ],
        acoes: [],
      });
      const r1 = await avaliarRegras('novo_ticket', { categoria: 'cancelamento' });
      const r2 = await avaliarRegras('novo_ticket', { categoria: 'financeiro' });
      const r3 = await avaliarRegras('novo_ticket', { categoria: 'comercial' });
      expect(r1.find((x) => x.regraId === r.id)).toBeTruthy();
      expect(r2.find((x) => x.regraId === r.id)).toBeTruthy();
      expect(r3.find((x) => x.regraId === r.id)).toBeUndefined();
      await deletarRegra(r.id);
    });
  });

  describe('avaliarRegras - acoes', () => {
    it('acao definir_prioridade altera Ticket', async () => {
      const t = await criarTicketTeste('acao-prio');
      const r = await criarRegra({
        nome: 'Sobe prioridade',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'categoria', operador: 'eq', valor: 'cancelamento' }],
        acoes: [{ tipo: 'definir_prioridade', parametros: { prioridade: 'urgente' } }],
      });
      await avaliarRegras('novo_ticket', { ticketId: t.id, categoria: 'cancelamento' });
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.prioridade).toBe('urgente');
      await deletarRegra(r.id);
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('acao notificar cria Notificacao', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const t = await criarTicketTeste('acao-notif');
      const r = await criarRegra({
        nome: 'Notifica',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'prioridade', operador: 'eq', valor: 'urgente' }],
        acoes: [{ tipo: 'notificar', parametros: { usuarioId: admin!.id, mensagem: 'Ticket urgente!' } }],
      });
      await avaliarRegras('novo_ticket', { ticketId: t.id, prioridade: 'urgente' });
      const notif = await prisma.notificacao.findFirst({
        where: { ticketId: t.id, tipo: 'regra_executar' },
      });
      expect(notif).toBeTruthy();
      expect(notif?.mensagem).toBe('Ticket urgente!');
      await prisma.notificacao.deleteMany({ where: { ticketId: t.id } });
      await deletarRegra(r.id);
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('multiplas acoes executam em sequencia', async () => {
      const t = await criarTicketTeste('multi-acao');
      const r = await criarRegra({
        nome: 'Multi',
        trigger: 'novo_ticket',
        condicoes: [{ campo: 'categoria', operador: 'eq', valor: 'suporte_tecnico' }],
        acoes: [
          { tipo: 'definir_prioridade', parametros: { prioridade: 'alta' } },
          { tipo: 'mudar_etapa', parametros: { etapa: 'em_atendimento' } },
        ],
      });
      const result = await avaliarRegras('novo_ticket', { ticketId: t.id, categoria: 'suporte_tecnico' });
      const exec = result.find((x) => x.regraId === r.id);
      expect(exec?.acoesExecutadas.length).toBe(2);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.prioridade).toBe('alta');
      expect(updated?.etapa).toBe('em_atendimento');
      await deletarRegra(r.id);
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('atualizarRegra / deletarRegra', () => {
    it('atualiza apenas campos fornecidos', async () => {
      const r = await criarRegra({
        nome: 'Original', trigger: 'msg_recebida', condicoes: [], acoes: [],
      });
      const updated = await atualizarRegra(r.id, { nome: 'Atualizada', ativo: false });
      expect(updated.nome).toBe('Atualizada');
      expect(updated.ativo).toBe(false);
      await deletarRegra(r.id);
    });
  });
});

async function criarTicketTeste(tag: string) {
  return prisma.ticket.create({
    data: {
      externalId: `auto-${tag}-${Date.now()}-${Math.random()}`,
      contactName: 'Cliente Auto',
      contactPhone: '85999990080',
      status: 'aberto',
      etapa: 'fila',
      prioridade: 'media',
    },
  });
}
