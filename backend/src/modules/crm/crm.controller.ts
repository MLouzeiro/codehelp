import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';

export async function listClients(req: AuthRequest, res: Response) {
  try {
    const { status, segmento, cidade, responsavel, search, page = '1', limit = '20' } = req.query;
    const where: any = {};

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

    if (req.user?.role === 'tecnico') {
      where.responsavelTecnicoId = req.user.id;
    }

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

    const client = await prisma.client.create({
      data: {
        razaoSocial, nomeFantasia, cnpjCpf, segmento,
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
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
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
    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: req.body,
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
