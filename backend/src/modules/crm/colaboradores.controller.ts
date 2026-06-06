import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  criarColaborador,
  listarColaboradoresPorCliente,
  getColaborador,
  atualizarColaborador,
  deletarColaborador,
  marcarPrincipal,
} from './colaboradores.service';
import { logAction, getIpFromRequest } from '../audit/audit.service';

export async function getColaboradoresPorCliente(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const colaboradores = await listarColaboradoresPorCliente(clientId);
    return res.json({ items: colaboradores });
  } catch (error) {
    console.error('Erro ao listar colaboradores:', error);
    return res.status(500).json({ error: 'Erro ao listar colaboradores' });
  }
}

export async function postColaborador(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const { nome, cargo, setor, email, telefone, whatsapp, principal, observacoes } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: 'Nome do colaborador e obrigatorio' });
    }
    const colab = await criarColaborador(clientId, {
      nome,
      cargo: cargo ?? null,
      setor: setor ?? null,
      email: email ?? null,
      telefone: telefone ?? null,
      whatsapp: whatsapp ?? null,
      principal: principal ?? false,
      observacoes: observacoes ?? null,
    });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_colaborador',
      entidade: 'Colaborador',
      entidadeId: colab.id,
      detalhes: { clientId, nome: colab.nome },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(colab);
  } catch (error: any) {
    if (/cliente nao encontrado/i.test(error?.message)) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }
    console.error('Erro ao criar colaborador:', error);
    return res.status(500).json({ error: 'Erro ao criar colaborador' });
  }
}

export async function putColaborador(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const existente = await getColaborador(id);
    if (!existente) return res.status(404).json({ error: 'Colaborador nao encontrado' });

    const colab = await atualizarColaborador(id, req.body);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'editar_colaborador',
      entidade: 'Colaborador',
      entidadeId: id,
      detalhes: req.body,
      ip: getIpFromRequest(req),
    });
    return res.json(colab);
  } catch (error) {
    console.error('Erro ao atualizar colaborador:', error);
    return res.status(500).json({ error: 'Erro ao atualizar colaborador' });
  }
}

export async function deleteColaborador(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ok = await deletarColaborador(id);
    if (!ok) return res.status(404).json({ error: 'Colaborador nao encontrado' });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'deletar_colaborador',
      entidade: 'Colaborador',
      entidadeId: id,
      ip: getIpFromRequest(req),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar colaborador:', error);
    return res.status(500).json({ error: 'Erro ao deletar colaborador' });
  }
}

export async function postMarcarPrincipal(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { valor } = req.body;
    const existente = await getColaborador(id);
    if (!existente) return res.status(404).json({ error: 'Colaborador nao encontrado' });
    const colab = await marcarPrincipal(id, existente.clientId, valor !== false);
    return res.json(colab);
  } catch (error) {
    console.error('Erro ao marcar principal:', error);
    return res.status(500).json({ error: 'Erro ao marcar principal' });
  }
}
