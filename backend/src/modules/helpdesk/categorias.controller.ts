import type { Request, Response } from 'express';
import prisma from '../../config/database';
import { getIpFromRequest } from '../audit/audit.service';
import {
  listarCategorias,
  listarAssuntos,
  criarCategoria,
  atualizarCategoria,
  inativarCategoria,
  excluirCategoria,
  criarAssunto,
  atualizarAssunto,
  inativarAssunto,
  getExigirClassificacao,
  setExigirClassificacao,
  aplicarClassificacao,
  sugerirClassificacao,
} from './categorias.service';

function mapErro(error: any): { status: number; mensagem: string } {
  const msg: string = error?.message || 'Erro interno';
  if (msg.includes('nao encontrado')) return { status: 404, mensagem: msg };
  if (msg.includes('Ja existe')) return { status: 409, mensagem: msg };
  if (msg.includes('historico')) return { status: 409, mensagem: msg };
  if (msg.includes('inativa')) return { status: 400, mensagem: msg };
  if (msg.includes('nao pertence')) return { status: 400, mensagem: msg };
  return { status: 500, mensagem: msg };
}

// ── Categorias ────────────────────────────────────────────────────────

export async function getCategoriasHandler(req: Request, res: Response) {
  try {
    const todas = req.query.todas === 'true';
    const cats = await listarCategorias({ incluirInativos: todas });
    return res.json(cats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar categorias' });
  }
}

export async function postCategoria(req: Request, res: Response) {
  try {
    const cat = await criarCategoria(req.body);
    return res.status(201).json(cat);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function putCategoria(req: Request, res: Response) {
  try {
    const cat = await atualizarCategoria(req.params.id, req.body);
    return res.json(cat);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function patchCategoriaAtivo(req: Request, res: Response) {
  try {
    const ativo = req.body.ativo === true;
    const cat = await inativarCategoria(req.params.id, ativo);
    return res.json(cat);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function deleteCategoria(req: Request, res: Response) {
  try {
    await excluirCategoria(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

// ── Assuntos ──────────────────────────────────────────────────────────

export async function getAssuntosHandler(req: Request, res: Response) {
  try {
    const assuntos = await listarAssuntos({
      categoriaId: typeof req.query.categoriaId === 'string' ? req.query.categoriaId : undefined,
      incluirInativos: req.query.todas === 'true',
    });
    return res.json(assuntos);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar assuntos' });
  }
}

export async function postAssunto(req: Request, res: Response) {
  try {
    const asst = await criarAssunto(req.body);
    return res.status(201).json(asst);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function putAssunto(req: Request, res: Response) {
  try {
    const asst = await atualizarAssunto(req.params.id, req.body);
    return res.json(asst);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function patchAssuntoAtivo(req: Request, res: Response) {
  try {
    const ativo = req.body.ativo === true;
    const asst = await inativarAssunto(req.params.id, ativo);
    return res.json(asst);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

// ── Configuracao ──────────────────────────────────────────────────────

export async function getConfigClassificacao(_req: Request, res: Response) {
  try {
    const ativo = await getExigirClassificacao();
    return res.json({ exigirClassificacao: ativo });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao obter configuracao' });
  }
}

export async function putConfigClassificacao(req: Request, res: Response) {
  try {
    const ativo = req.body.exigirClassificacao === true;
    await setExigirClassificacao(ativo);
    return res.json({ exigirClassificacao: ativo });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao salvar configuracao' });
  }
}

// ── Classificacao de ticket ───────────────────────────────────────────

export async function postSugerirClassificacao(req: Request, res: Response) {
  try {
    const sugestao = await sugerirClassificacao(req.params.id);
    return res.json(sugestao);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function patchTicketClassificacao(req: Request, res: Response) {
  try {
    const { categoriaId, assuntoId, motivo } = req.body;
    if (!categoriaId && !assuntoId) {
      return res.status(400).json({ error: 'Informe categoriaId ou assuntoId' });
    }
    const result = await aplicarClassificacao({
      ticketId: req.params.id,
      categoriaId: categoriaId !== undefined ? categoriaId : undefined,
      assuntoId: assuntoId !== undefined ? assuntoId : undefined,
      usuarioId: (req as any).user?.id,
      motivo,
      origem: 'manual',
      ip: getIpFromRequest(req),
    });
    return res.json(result);
  } catch (error) {
    const e = mapErro(error);
    return res.status(e.status).json({ error: e.mensagem });
  }
}

export async function getCategoriasOptions(_req: Request, res: Response) {
  try {
    const [categorias, assuntos, departamentos, filas] = await Promise.all([
      prisma.categoria.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' }, select: { id: true, nome: true, slug: true, cor: true } }),
      prisma.assunto.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' }, select: { id: true, nome: true, categoriaId: true } }),
      prisma.departamento.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      prisma.fila.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    ]);
    return res.json({ categorias, assuntos, departamentos, filas });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar opcoes' });
  }
}