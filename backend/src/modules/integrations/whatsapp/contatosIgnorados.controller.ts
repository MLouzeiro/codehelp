import { Request, Response } from 'express';
import {
  listarContatosIgnorados,
  criarContatoIgnorado,
  atualizarContatoIgnorado,
  reativarContatoIgnorado,
  alternarStatusContatoIgnorado,
  excluirContatoIgnorado,
  getResumoContatosIgnorados,
} from './contatosIgnorados.service';

type AuthRequest = Request & { user?: { id: string; role: string } };

export async function getListaContatosIgnorados(req: AuthRequest, res: Response) {
  try {
    const resultado = await listarContatosIgnorados({
      tipo: (req.query.tipo as any) || 'todos',
      status: (req.query.status as any) || 'todos',
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao listar contatos ignorados' });
  }
}

export async function getResumoContatosIgnoradosHandler(req: AuthRequest, res: Response) {
  try {
    const resumo = await getResumoContatosIgnorados();
    res.json(resumo);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao calcular resumo' });
  }
}

export async function postCriarContatoIgnorado(req: AuthRequest, res: Response) {
  try {
    const { tipo, chave, nome, motivo, regra } = req.body;
    const criado = await criarContatoIgnorado(
      { tipo, chave, nome, motivo, regra },
      req.user?.id,
    );
    res.status(201).json(criado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao adicionar contato ignorado' });
  }
}

export async function patchAtualizarContatoIgnorado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, motivo, regra } = req.body;
    const atualizado = await atualizarContatoIgnorado(id, { nome, motivo, regra }, req.user?.id);
    res.json(atualizado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar contato ignorado' });
  }
}

export async function postReativarContatoIgnorado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const reativado = await reativarContatoIgnorado(id, req.user?.id);
    res.json(reativado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao reativar contato' });
  }
}

export async function postAlternarStatusContatoIgnorado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const alternado = await alternarStatusContatoIgnorado(id, req.user?.id);
    res.json(alternado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao alternar status' });
  }
}

export async function deleteContatoIgnorado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const resultado = await excluirContatoIgnorado(id);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao excluir contato ignorado' });
  }
}