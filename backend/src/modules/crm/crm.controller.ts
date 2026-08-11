import { Response, Request } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';

export async function listClients(req: AuthRequest, res: Response) {
  try {
    const { status, segmento, cidade, responsavel, search, page = '1', limit = '20', includeInativos } = req.query;
    const where: any = {};

    if (!includeInativos) where.ativo = true;
    if (status) where.status = status;
    if (segmento) where.segmento = segmento;
    if (cidade) where.cidade = { contains: cidade as string, mode: 'insensitive' };
    if (responsavel) where.responsavelTecnicoId = responsavel;
    if (search) {
      where.OR = [
        { razaoSocial: { contains: search as string, mode: 'insensitive' } },
        { nomeFantasia: { contains: search as string, mode: 'insensitive' } },
        { cnpjCpf: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { telefone: { contains: search as string } },
      ];
    }

    // Filtro por responsavel so aplica quando explicitamente solicitado
    // Tecnicos veem TODOS os clientes (nao apenas os atribuidos a eles)

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { responsavelTecnico: { select: { id: true, name: true } } },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    return res.json({ clients, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

export async function getClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        responsavelTecnico: { select: { id: true, name: true } },
        contacts: { include: { usuario: { select: { name: true } } }, orderBy: { data: 'desc' } },
        opportunities: { include: { responsavel: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        serviceOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, protocolo: true, contactName: true, assunto: true, status: true, etapa: true, prioridade: true, categoria: true, dataAbertura: true, updatedAt: true, assignee: { select: { name: true } } } },
        colaboradores: { orderBy: [{ principal: 'desc' }, { nome: 'asc' }] },
        ativos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
}

export async function createClient(req: AuthRequest, res: Response) {
  try {
    const { razaoSocial, nomeFantasia, cnpjCpf, segmento, responsavelTecnicoId, telefone, email, cidade, estado, status, origem } = req.body;
    if (!razaoSocial) return res.status(400).json({ error: 'Razão social é obrigatória' });

    if (cnpjCpf?.trim()) {
      const existing = await prisma.client.findFirst({
        where: { cnpjCpf: cnpjCpf.trim(), ativo: true },
      });
      if (existing) return res.status(409).json({ error: 'Já existe um cliente ativo com este CNPJ/CPF' });
    }

    const client = await prisma.client.create({
      data: {
        razaoSocial, nomeFantasia, cnpjCpf: cnpjCpf?.trim() || null, segmento,
        responsavelTecnicoId: responsavelTecnicoId || req.user?.id,
        telefone, email, cidade, estado,
        status: status || 'ativo',
        origem: origem || 'manual',
      },
    });
    return res.status(201).json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar cliente' });
  }
}

export async function updateClient(req: AuthRequest, res: Response) {
  try {
    const { razaoSocial, nomeFantasia, cnpjCpf, segmento, origem, status, ativo, observacoes, telefone, email, cidade, estado, responsavelTecnicoId } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...(razaoSocial !== undefined && { razaoSocial }),
        ...(nomeFantasia !== undefined && { nomeFantasia }),
        ...(cnpjCpf !== undefined && { cnpjCpf: cnpjCpf?.trim() || null }),
        ...(segmento !== undefined && { segmento }),
        ...(origem !== undefined && { origem }),
        ...(status !== undefined && { status }),
        ...(ativo !== undefined && { ativo }),
        ...(observacoes !== undefined && { observacoes }),
        ...(telefone !== undefined && { telefone }),
        ...(email !== undefined && { email }),
        ...(cidade !== undefined && { cidade }),
        ...(estado !== undefined && { estado }),
        ...(responsavelTecnicoId !== undefined && { responsavelTecnicoId }),
      },
    });
    return res.json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id }, select: { id: true, ativo: true } });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    await prisma.client.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar cliente' });
  }
}

export async function listContacts(req: AuthRequest, res: Response) {
  try {
    const contacts = await prisma.contact.findMany({
      where: { clientId: req.params.clientId },
      include: { usuario: { select: { name: true } } },
      orderBy: { data: 'desc' },
    });
    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar contatos' });
  }
}

export async function createContact(req: AuthRequest, res: Response) {
  try {
    const { clientId, tipo, descricao, data, duracaoMinutos } = req.body;
    if (!clientId || !tipo) return res.status(400).json({ error: 'Cliente e tipo são obrigatórios' });

    const contact = await prisma.contact.create({
      data: {
        clientId, tipo, descricao,
        data: data ? new Date(data) : new Date(),
        usuarioId: req.user!.id,
        duracaoMinutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
      },
    });
    return res.status(201).json(contact);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar contato' });
  }
}

export async function listOpportunities(req: AuthRequest, res: Response) {
  try {
    const { etapa, responsavelId } = req.query;
    const where: any = {};
    if (etapa) where.etapa = etapa;
    if (responsavelId) where.responsavelId = responsavelId;
    if (req.user?.role === 'comercial') where.responsavelId = req.user.id;

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: { client: { select: { razaoSocial: true } }, responsavel: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(opportunities);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar oportunidades' });
  }
}

export async function createOpportunity(req: AuthRequest, res: Response) {
  try {
    const { clientId, titulo, valorEstimado, etapa, probabilidade, dataFechamentoPrevista, responsavelId } = req.body;
    if (!clientId || !titulo) return res.status(400).json({ error: 'Cliente e título são obrigatórios' });

    const opportunity = await prisma.opportunity.create({
      data: {
        clientId, titulo,
        valorEstimado: valorEstimado ? parseFloat(valorEstimado) : null,
        etapa: etapa || 'prospeccao',
        probabilidade: probabilidade ? parseInt(probabilidade) : 50,
        dataFechamentoPrevista: dataFechamentoPrevista ? new Date(dataFechamentoPrevista) : null,
        responsavelId: responsavelId || req.user!.id,
      },
    });
    return res.status(201).json(opportunity);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar oportunidade' });
  }
}

export async function updateOpportunity(req: AuthRequest, res: Response) {
  try {
    const { titulo, valorEstimado, etapa, probabilidade, dataFechamentoPrevista, responsavelId, clientId } = req.body;
    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(valorEstimado !== undefined && { valorEstimado: valorEstimado ? parseFloat(valorEstimado) : null }),
        ...(etapa !== undefined && { etapa }),
        ...(probabilidade !== undefined && { probabilidade: parseInt(probabilidade) }),
        ...(dataFechamentoPrevista !== undefined && { dataFechamentoPrevista: dataFechamentoPrevista ? new Date(dataFechamentoPrevista) : null }),
        ...(responsavelId !== undefined && { responsavelId }),
        ...(clientId !== undefined && { clientId }),
      },
    });
    return res.json(opportunity);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar oportunidade' });
  }
}

export async function getPipeline(req: AuthRequest, res: Response) {
  try {
    const stages = ['prospeccao', 'proposta', 'negociacao', 'ganho', 'perdido'];
    const pipeline = await Promise.all(
      stages.map(async (etapa) => {
        const items = await prisma.opportunity.findMany({
          where: { etapa: etapa as any },
          include: { client: { select: { razaoSocial: true } }, responsavel: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
        });
        const totalValor = items.reduce((sum, item) => sum + (item.valorEstimado || 0), 0);
        return { etapa, items, total: items.length, totalValor };
      })
    );
    return res.json(pipeline);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar pipeline' });
  }
}

export async function deleteOpportunity(req: AuthRequest, res: Response) {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!opportunity) return res.status(404).json({ error: 'Oportunidade não encontrada' });

    await prisma.opportunity.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar oportunidade' });
  }
}

export async function deleteContact(req: AuthRequest, res: Response) {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

    await prisma.contact.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar contato' });
  }
}

export async function listThemes(req: AuthRequest, res: Response) {
  try {
    const where: any = { ativo: true };
    if (req.user?.role === 'vendedor') {
      where.ativo = true;
    }
    const temas = await prisma.helpdeskConfig.findMany({
      where,
      orderBy: { ordem: 'asc' },
    });
    return res.json(temas);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar temas' });
  }
}

export async function createTheme(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isMaster && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const { slug, nome, descricao, cor, icone, ordem, ativo } = req.body;
    if (!slug || !nome) {
      return res.status(400).json({ error: 'Slug e nome são obrigatórios' });
    }

    const existing = await prisma.helpdeskConfig.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Tema com este slug já existe' });
    }

    const tema = await prisma.helpdeskConfig.create({
      data: {
        slug,
        nome,
        descricao,
        cor,
        icone,
        ordem,
        ativo,
      },
    });

    return res.status(201).json(tema);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar tema' });
  }
}

export async function updateTheme(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isMaster && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const { id } = req.params;
    const { slug, nome, descricao, cor, icone, ordem, ativo } = req.body;

    const existing = await prisma.helpdeskConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Tema não encontrado' });
    }

    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.helpdeskConfig.findUnique({ where: { slug } });
      if (slugExists) {
        return res.status(409).json({ error: 'Tema com este slug já existe' });
      }
    }

    const tema = await prisma.helpdeskConfig.update({
      where: { id },
      data: {
        slug: slug ?? existing.slug,
        nome: nome ?? existing.nome,
        descricao: descricao ?? existing.descricao,
        cor: cor ?? existing.cor,
        icone: icone ?? existing.icone,
        ordem: ordem ?? existing.ordem,
        ativo: ativo ?? existing.ativo,
      },
    });

    return res.json(tema);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar tema' });
  }
}

export async function deleteTheme(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isMaster && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const { id } = req.params;

    const existing = await prisma.helpdeskConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Tema não encontrado' });
    }

    await prisma.helpdeskConfig.delete({ where: { id } });

    return res.json({ message: 'Tema excluído com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir tema' });
  }
}
