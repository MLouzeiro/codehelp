import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  criarColaborador,
  listarColaboradoresPorCliente,
  getColaborador,
  atualizarColaborador,
  deletarColaborador,
  marcarPrincipal,
} from '../modules/crm/colaboradores.service';

let clienteTeste: { id: string };

beforeAll(async () => {
  clienteTeste = await prisma.client.create({
    data: { razaoSocial: 'Cliente Teste Colaborador' },
  });
});

afterAll(async () => {
  await prisma.colaborador.deleteMany({ where: { clientId: clienteTeste.id } });
  await prisma.client.delete({ where: { id: clienteTeste.id } });
});

describe('Colaboradores Service (Bloco 16)', () => {
  describe('criarColaborador', () => {
    it('cria com dados minimos (apenas nome)', async () => {
      const c = await criarColaborador(clienteTeste.id, { nome: 'Ana Souza' });
      expect(c.id).toBeTruthy();
      expect(c.nome).toBe('Ana Souza');
      expect(c.clientId).toBe(clienteTeste.id);
      expect(c.ativo).toBe(true);
      expect(c.principal).toBe(false);
      await prisma.colaborador.delete({ where: { id: c.id } });
    });

    it('cria com todos os campos', async () => {
      const c = await criarColaborador(clienteTeste.id, {
        nome: 'Carlos Lima',
        cargo: 'Gerente Financeiro',
        setor: 'Financeiro',
        email: 'carlos@empresa.com',
        telefone: '8533334444',
        whatsapp: '85999998888',
        principal: true,
        observacoes: 'Contato preferencial',
      });
      expect(c.cargo).toBe('Gerente Financeiro');
      expect(c.email).toBe('carlos@empresa.com');
      expect(c.principal).toBe(true);
      await prisma.colaborador.delete({ where: { id: c.id } });
    });

    it('rejeita nome vazio', async () => {
      await expect(criarColaborador(clienteTeste.id, { nome: '' }))
        .rejects.toThrow(/nome/i);
    });

    it('rejeita se cliente nao existe', async () => {
      await expect(criarColaborador('cliente-inexistente-xyz', { nome: 'Teste' }))
        .rejects.toThrow(/cliente/i);
    });
  });

  describe('listarColaboradoresPorCliente', () => {
    it('lista apenas colaboradores ativos do cliente', async () => {
      const a = await criarColaborador(clienteTeste.id, { nome: 'Ativo A' });
      const i = await criarColaborador(clienteTeste.id, { nome: 'Inativo I' });
      await prisma.colaborador.update({ where: { id: i.id }, data: { ativo: false } });
      const lista = await listarColaboradoresPorCliente(clienteTeste.id);
      const ids = lista.map((x) => x.id);
      expect(ids).toContain(a.id);
      expect(ids).not.toContain(i.id);
      expect(lista.length).toBeGreaterThanOrEqual(1);
    });

    it('ordena por principal primeiro, depois nome', async () => {
      const x = await criarColaborador(clienteTeste.id, { nome: 'Zeca' });
      const y = await criarColaborador(clienteTeste.id, { nome: 'Bruno', principal: true });
      const lista = await listarColaboradoresPorCliente(clienteTeste.id);
      const idxY = lista.findIndex((c) => c.id === y.id);
      const idxX = lista.findIndex((c) => c.id === x.id);
      expect(idxY).toBeLessThan(idxX);
      await prisma.colaborador.deleteMany({ where: { id: { in: [x.id, y.id] } } });
    });

    it('retorna array vazio para cliente sem colaboradores', async () => {
      const vazio = await prisma.client.create({
        data: { razaoSocial: 'Cliente Vazio Colab' },
      });
      const lista = await listarColaboradoresPorCliente(vazio.id);
      expect(lista).toEqual([]);
      await prisma.client.delete({ where: { id: vazio.id } });
    });
  });

  describe('getColaborador', () => {
    it('busca por id', async () => {
      const c = await criarColaborador(clienteTeste.id, { nome: 'Buscar Get' });
      const found = await getColaborador(c.id);
      expect(found?.id).toBe(c.id);
      expect(found?.nome).toBe('Buscar Get');
      await prisma.colaborador.delete({ where: { id: c.id } });
    });

    it('retorna null para id inexistente', async () => {
      const found = await getColaborador('id-inexistente-xyz');
      expect(found).toBeNull();
    });
  });

  describe('atualizarColaborador', () => {
    it('atualiza apenas campos fornecidos', async () => {
      const c = await criarColaborador(clienteTeste.id, { nome: 'Original', cargo: 'Cargo A' });
      const upd = await atualizarColaborador(c.id, { nome: 'Atualizado' });
      expect(upd).not.toBeNull();
      expect(upd!.nome).toBe('Atualizado');
      expect(upd!.cargo).toBe('Cargo A');
      await prisma.colaborador.delete({ where: { id: c.id } });
    });

    it('atualiza todos os campos', async () => {
      const c = await criarColaborador(clienteTeste.id, { nome: 'X' });
      const upd = await atualizarColaborador(c.id, {
        nome: 'Y',
        cargo: 'Cargo B',
        setor: 'TI',
        email: 'y@x.com',
        telefone: '1111',
        whatsapp: '2222',
        observacoes: 'obs',
        ativo: false,
      });
      expect(upd).not.toBeNull();
      expect(upd!.cargo).toBe('Cargo B');
      expect(upd!.ativo).toBe(false);
      await prisma.colaborador.delete({ where: { id: c.id } });
    });

    it('retorna null se id nao existe', async () => {
      const upd = await atualizarColaborador('id-inexistente-xyz', { nome: 'N' });
      expect(upd).toBeNull();
    });
  });

  describe('deletarColaborador', () => {
    it('remove o colaborador', async () => {
      const c = await criarColaborador(clienteTeste.id, { nome: 'Apagar' });
      const ok = await deletarColaborador(c.id);
      expect(ok).toBe(true);
      const found = await getColaborador(c.id);
      expect(found).toBeNull();
    });

    it('retorna false se id nao existe', async () => {
      const ok = await deletarColaborador('id-inexistente-xyz');
      expect(ok).toBe(false);
    });
  });

  describe('marcarPrincipal', () => {
    it('garante que apenas 1 colaborador e principal', async () => {
      const a = await criarColaborador(clienteTeste.id, { nome: 'A principal' });
      const b = await criarColaborador(clienteTeste.id, { nome: 'B nao principal' });
      await marcarPrincipal(b.id, clienteTeste.id);
      const lista = await listarColaboradoresPorCliente(clienteTeste.id);
      const principals = lista.filter((c) => c.principal);
      expect(principals.length).toBe(1);
      expect(principals[0].id).toBe(b.id);
      const aReload = await getColaborador(a.id);
      expect(aReload?.principal).toBe(false);
      await prisma.colaborador.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    });

    it('desmarca principal quando passado false', async () => {
      const a = await criarColaborador(clienteTeste.id, { nome: 'X', principal: true });
      await marcarPrincipal(a.id, clienteTeste.id, false);
      const reload = await getColaborador(a.id);
      expect(reload?.principal).toBe(false);
      await prisma.colaborador.delete({ where: { id: a.id } });
    });
  });
});
