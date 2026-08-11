import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';

export async function listEnquetes(req: Request, res: Response) {
  try {
    const enquetes = await prisma.enquete.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(enquetes);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar enquetes' });
  }
}

export async function getEnquete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const enquete = await prisma.enquete.findUnique({ where: { id } });
    if (!enquete) return res.status(404).json({ error: 'Enquete não encontrada' });
    return res.json(enquete);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar enquete' });
  }
}

export async function createEnquete(req: Request, res: Response) {
  try {
    const { nome, descricao, tipo, mensagem, opcoes, enviarComo } = req.body;
    if (!nome || !opcoes || !Array.isArray(opcoes) || opcoes.length < 2) {
      return res.status(400).json({ error: 'Nome e pelo menos 2 opções são obrigatórios' });
    }
    const enquete = await prisma.enquete.create({
      data: {
        nome,
        descricao,
        tipo: tipo || 'lista',
        mensagem,
        opcoes: JSON.stringify(opcoes),
        enviarComo: enviarComo || 'texto',
      },
    });
    return res.status(201).json(enquete);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar enquete' });
  }
}

export async function updateEnquete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nome, descricao, tipo, mensagem, opcoes, enviarComo, ativo } = req.body;
    const data: any = {};
    if (nome !== undefined) data.nome = nome;
    if (descricao !== undefined) data.descricao = descricao;
    if (tipo !== undefined) data.tipo = tipo;
    if (mensagem !== undefined) data.mensagem = mensagem;
    if (opcoes !== undefined) data.opcoes = JSON.stringify(opcoes);
    if (enviarComo !== undefined) data.enviarComo = enviarComo;
    if (ativo !== undefined) data.ativo = ativo;
    const enquete = await prisma.enquete.update({ where: { id }, data });
    return res.json(enquete);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar enquete' });
  }
}

export async function deleteEnquete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.enquete.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar enquete' });
  }
}

export async function enviarEnquete(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { ticketId, whatsappConnectionId } = req.body;
    
    const enquete = await prisma.enquete.findUnique({ where: { id } });
    if (!enquete) return res.status(404).json({ error: 'Enquete não encontrada' });
    
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || !ticket.contactPhone) {
      return res.status(400).json({ error: 'Ticket não encontrado ou sem telefone' });
    }
    
    const opcoes = JSON.parse(enquete.opcoes as string);
    const { sendWhatsAppMessage, sendWhatsAppListMessage } = await import('../integrations/whatsapp/whatsapp.service');
    
    let result;
    if (enquete.enviarComo === 'lista') {
      const sections = [{
        title: enquete.nome,
        rows: opcoes.map((o: any) => ({
          id: String(o.id),
          title: o.titulo,
          description: o.descricao || undefined,
        })),
      }];
      result = await sendWhatsAppListMessage(
        ticket.contactPhone,
        enquete.nome,
        enquete.mensagem || `Por favor, selecione uma opção:`,
        sections,
        whatsappConnectionId || (ticket as any).whatsappConnectionId || undefined,
        ticket.contactJid || undefined,
      );
    } else {
      const opcoesTexto = opcoes.map((o: any) => `*${o.id}* - ${o.titulo}`).join('\n');
      const texto = `${enquete.mensagem || 'Por favor, selecione uma opção:'}\n\n${opcoesTexto}\n\nResponda com o *número* da opção.`;
      result = await sendWhatsAppMessage(
        ticket.contactPhone,
        texto,
        whatsappConnectionId || (ticket as any).whatsappConnectionId || undefined,
        ticket.contactJid || undefined,
      );
    }
    
    if (result.success) {
      await prisma.enquete.update({
        where: { id },
        data: { usoCount: { increment: 1 } },
      });
      await prisma.message.create({
        data: {
          ticketId,
          fromMe: true,
          content: `[Enquete] ${enquete.nome}`,
          source: 'bot',
          tipo: 'system',
        },
      });
    }
    
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar enquete' });
  }
}
