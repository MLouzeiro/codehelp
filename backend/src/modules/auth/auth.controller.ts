import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AuthRequest } from '../../shared/middleware/auth';

function generateTokens(user: { id: string; email: string; role: string; sessionToken: string }) {
  const accessOptions: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  const refreshOptions: SignOptions = { expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'] };
  const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role, sessionToken: user.sessionToken }, env.jwtSecret, accessOptions);
  const refreshToken = jwt.sign({ id: user.id }, env.jwtRefreshSecret, refreshOptions);
  return { accessToken, refreshToken };
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const sessionToken = uuidv4();
    await prisma.user.update({ where: { id: user.id }, data: { sessionToken } });

    const tokens = generateTokens({ ...user, sessionToken });
    return res.json({
      ...tokens,
      sessionToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isMaster: user.isMaster, phone: user.phone },
    });
  } catch {
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken, sessionToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token é obrigatório' });
    if (!sessionToken) return res.status(400).json({ error: 'Session token é obrigatório' });

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inválido' });

    // Session token binding: refresh só funciona se o sessionToken bater
    if (user.sessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Sessão encerrada em outro dispositivo' });
    }

    // NÃO rotacionar sessionToken no refresh — só no login.
    // Isso evita que um refresh em uma aba invalide o token de outra aba.
    const tokens = generateTokens({ ...user, sessionToken: user.sessionToken || '' });
    return res.json({ ...tokens, sessionToken: user.sessionToken });
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    // Invalidar sessionToken no banco — qualquer refresh futuro falhará
    await prisma.user.update({
      where: { id: userId },
      data: { sessionToken: null as any },
    });

    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Erro ao fazer logout' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  return res.json({ user: req.user });
}

export async function listUsers(req: Request, res: Response) {
  try {
    const { active } = req.query;

    const where: any = {};
    if (active === 'true') where.active = true;
    else if (active === 'false') where.active = false;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true, signature: true, createdAt: true,
        departamentos: {
          select: {
            departamento: { select: { id: true, slug: true, nome: true, cor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = users.map((u) => ({
      ...u,
      departamentos: u.departamentos.map((d) => d.departamento),
    }));
    return res.json(mapped);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { name, email, password, role, isMaster, departamentoIds } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email ja cadastrado' });

    // ── Seguranca: validacao de role ──────────────────────────────────
    const requestingUser = (req as AuthRequest).user;
    const roleHierarchy: Record<string, number> = {
      tecnico: 1,
      comercial: 2,
      gerente: 3,
      admin: 4,
    };
    const requesterLevel = roleHierarchy[requestingUser?.role || 'tecnico'] || 1;
    const requestedRole = role || 'tecnico';
    const requestedLevel = roleHierarchy[requestedRole] || 1;

    // Gerente so pode criar tecnicos e comerciais
    if (requesterLevel < roleHierarchy.admin && requestedLevel > requesterLevel) {
      return res.status(403).json({ error: `Voce nao pode criar usuarios com role "${requestedRole}". Roles permitidas: ${Object.entries(roleHierarchy).filter(([, v]) => v <= requesterLevel).map(([k]) => k).join(', ')}` });
    }

    // So admin/master pode criar admin
    if (requestedLevel >= roleHierarchy.admin && !requestingUser?.isMaster && requestingUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem criar outros administradores' });
    }

    // So master pode setar isMaster
    const canSetMaster = requestingUser?.isMaster || requestingUser?.role === 'admin';
    const finalIsMaster = canSetMaster && isMaster ? true : false;

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'tecnico',
        phone: req.body.phone || null,
        isMaster: finalIsMaster,
        ...(departamentoIds && departamentoIds.length > 0
          ? {
              departamentos: {
                create: departamentoIds.map((id: string) => ({ departamentoId: id })),
              },
            }
          : {}),
      },
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true,
        departamentos: { select: { departamento: { select: { id: true, slug: true, nome: true, cor: true } } } },
      },
    });

    return res.status(201).json({
      ...user,
      departamentos: user.departamentos.map((d) => d.departamento),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, active, password, isMaster, departamentoIds } = req.body;

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 12);
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (req.body.signature !== undefined) data.signature = req.body.signature;

    // ── Seguranca: validacao de role ──────────────────────────────────
    const requestingUser = (req as AuthRequest).user;
    const roleHierarchy: Record<string, number> = {
      tecnico: 1,
      comercial: 2,
      gerente: 3,
      admin: 4,
    };
    const requesterLevel = roleHierarchy[requestingUser?.role || 'tecnico'] || 1;

    // Validar role
    if (role) {
      const requestedLevel = roleHierarchy[role] || 1;
      if (requesterLevel < roleHierarchy.admin && requestedLevel > requesterLevel) {
        return res.status(403).json({ error: `Voce nao pode atribuir role "${role}"` });
      }
      data.role = role;
    }

    // Validar active
    if (active !== undefined) {
      // So admin/master pode desativar/ativar usuarios
      if (requesterLevel < roleHierarchy.admin) {
        return res.status(403).json({ error: 'Apenas administradores podem ativar/desativar usuarios' });
      }
      data.active = active;
    }

    // Validar isMaster — so master pode alterar isMaster
    const canSetMaster = requestingUser?.isMaster || requestingUser?.role === 'admin';
    if (isMaster !== undefined && canSetMaster) {
      data.isMaster = isMaster;
    }

    // Atualizar departamentos (tabela pivo)
    if (departamentoIds !== undefined) {
      await prisma.userDepartamento.deleteMany({ where: { userId: id } });
      if (departamentoIds.length > 0) {
        await prisma.userDepartamento.createMany({
          data: departamentoIds.map((departamentoId: string) => ({ userId: id, departamentoId })),
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, active: true, isMaster: true, phone: true, signature: true,
        departamentos: { select: { departamento: { select: { id: true, slug: true, nome: true, cor: true } } } },
      },
    });

    return res.json({
      ...user,
      departamentos: user.departamentos.map((d) => d.departamento),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function archiveUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (id === requestingUser?.id) {
      return res.status(400).json({ error: 'Você não pode arquivar a si mesmo' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (existing.isMaster) {
      return res.status(403).json({ error: 'O usuário master não pode ser arquivado' });
    }

    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao arquivar usuário' });
  }
}

export async function bulkArchiveUsers(req: AuthRequest, res: Response) {
  try {
    const { ids } = req.body;
    const requestingUser = req.user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum ID fornecido' });
    }

    if (ids.length > 50) {
      return res.status(400).json({ error: 'Limite de 50 usuários por operação' });
    }

    const uniqueIds = [...new Set(ids)];
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, isMaster: true, active: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const archived: { id: string; name: string }[] = [];
    const failed: { id: string; name: string; reason: string }[] = [];

    for (const id of uniqueIds) {
      const user = userMap.get(id);
      if (!user) {
        failed.push({ id, name: 'Desconhecido', reason: 'Usuário não encontrado' });
        continue;
      }
      if (id === requestingUser?.id) {
        failed.push({ id, name: user.name, reason: 'Você não pode arquivar a si mesmo' });
        continue;
      }
      if (user.isMaster) {
        failed.push({ id, name: user.name, reason: 'Usuário master não pode ser arquivado' });
        continue;
      }
      if (!user.active) {
        failed.push({ id, name: user.name, reason: 'Usuário já está arquivado' });
        continue;
      }
      archived.push({ id, name: user.name });
    }

    if (archived.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: archived.map(a => a.id) } },
        data: { active: false },
      });
    }

    return res.json({
      total: uniqueIds.length,
      archivedCount: archived.length,
      failedCount: failed.length,
      archived,
      failed,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao arquivar usuários' });
  }
}

export async function deleteUserPermanently(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (id === requestingUser?.id) {
      return res.status(400).json({ error: 'Você não pode excluir o próprio usuário' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (existing.isMaster) {
      return res.status(403).json({ error: 'O usuário master não pode ser excluído' });
    }

    const [
      auditLogCount,
      messageCount,
      ticketCount,
      ticketAssigneeCount,
      ticketFirstAgentCount,
      orderCreatorCount,
      orderTechCount,
      contactCount,
      opportunityCount,
      taskCount,
      kanbanTaskCount,
      kanbanSubtaskCount,
      kanbanActivityCount,
      kanbanAttachmentCount,
      kanbanBoardCount,
      kanbanTemplateCount,
      aiCorrectionCount,
      aiAgentAuditCount,
      auditoriaProfCount,
      aprovacaoSolicitadaCount,
      aprovacaoDecididaCount,
      serviceOrderEventCount,
      timeEntryCount,
      notificacaoCount,
      teamMemberCount,
      teamLiderCount,
      contatosIgnoradosCount,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { usuarioId: id } }),
      prisma.message.count({ where: { usuarioId: id } }),
      prisma.ticket.count({ where: { usuarioId: id } }),
      prisma.ticket.count({ where: { assigneeId: id } }),
      prisma.ticket.count({ where: { primeiroAgenteId: id } }),
      prisma.serviceOrder.count({ where: { criadoPorId: id } }),
      prisma.serviceOrder.count({ where: { tecnicoResponsavelId: id } }),
      prisma.contact.count({ where: { usuarioId: id } }),
      prisma.opportunity.count({ where: { responsavelId: id } }),
      prisma.task.count({ where: { responsavelId: id } }),
      prisma.kanbanTask.count({ where: { responsavelId: id } }),
      prisma.kanbanSubtask.count({ where: { responsavelId: id } }),
      prisma.kanbanActivity.count({ where: { usuarioId: id } }),
      prisma.kanbanAttachment.count({ where: { usuarioId: id } }),
      prisma.kanbanBoard.count({ where: { criadorId: id } }),
      prisma.kanbanTemplate.count({ where: { criadorId: id } }),
      prisma.aICorrection.count({ where: { corrigidoPorId: id } }),
      prisma.aIAgentAudit.count({ where: { agentId: id } }),
      prisma.auditoriaProfissional.count({ where: { agenteId: id } }),
      prisma.aprovacao.count({ where: { solicitadoPorId: id } }),
      prisma.aprovacao.count({ where: { aprovadoPorId: id } }),
      prisma.serviceOrderStatusEvent.count({ where: { usuarioId: id } }),
      prisma.timeEntry.count({ where: { usuarioId: id } }),
      prisma.notificacao.count({ where: { destinatarioId: id } }),
      prisma.teamMember.count({ where: { userId: id } }),
      prisma.team.count({ where: { liderId: id } }),
      prisma.contatoIgnorado.count({ where: { criadoPorId: id } }),
    ]);

    const blocking: string[] = [];
    if (auditLogCount > 0) blocking.push(`${auditLogCount} log(s) de auditoria`);
    if (messageCount > 0) blocking.push(`${messageCount} mensagem(ns)`);
    if (ticketCount > 0) blocking.push(`${ticketCount} ticket(s) criado(s)`);
    if (ticketAssigneeCount > 0) blocking.push(`${ticketAssigneeCount} ticket(s) atribuído(s)`);
    if (ticketFirstAgentCount > 0) blocking.push(`${ticketFirstAgentCount} ticket(s) como primeiro agente`);
    if (orderCreatorCount > 0) blocking.push(`${orderCreatorCount} OS(s) criada(s)`);
    if (orderTechCount > 0) blocking.push(`${orderTechCount} OS(s) como técnico`);
    if (contactCount > 0) blocking.push(`${contactCount} contato(s) registrado(s)`);
    if (opportunityCount > 0) blocking.push(`${opportunityCount} oportunidade(s)`);
    if (taskCount > 0) blocking.push(`${taskCount} tarefa(s)`);
    if (kanbanTaskCount > 0) blocking.push(`${kanbanTaskCount} tarefa(s) kanban`);
    if (kanbanSubtaskCount > 0) blocking.push(`${kanbanTaskCount} subtarefa(s) kanban`);
    if (kanbanActivityCount > 0) blocking.push(`${kanbanActivityCount} atividade(s) kanban`);
    if (kanbanAttachmentCount > 0) blocking.push(`${kanbanAttachmentCount} anexo(s) kanban`);
    if (kanbanBoardCount > 0) blocking.push(`${kanbanBoardCount} board(s) criado(s)`);
    if (kanbanTemplateCount > 0) blocking.push(`${kanbanTemplateCount} template(s) criado(s)`);
    if (aiCorrectionCount > 0) blocking.push(`${aiCorrectionCount} correção(ões) IA`);
    if (aiAgentAuditCount > 0) blocking.push(`${aiAgentAuditCount} auditoria(s) de agente IA`);
    if (auditoriaProfCount > 0) blocking.push(`${auditoriaProfCount} auditoria(s) profissional(is)`);
    if (aprovacaoSolicitadaCount > 0) blocking.push(`${aprovacaoSolicitadaCount} aprovação(ões) solicitada(s)`);
    if (aprovacaoDecididaCount > 0) blocking.push(`${aprovacaoDecididaCount} aprovação(ões) decidida(s)`);
    if (serviceOrderEventCount > 0) blocking.push(`${serviceOrderEventCount} evento(s) de OS`);
    if (timeEntryCount > 0) blocking.push(`${timeEntryCount} registro(s) de tempo`);
    if (notificacaoCount > 0) blocking.push(`${notificacaoCount} notificação(ões)`);
    if (teamMemberCount > 0) blocking.push(`${teamMemberCount} vínculo(s) de equipe`);
    if (teamLiderCount > 0) blocking.push(`${teamLiderCount} equipe(s) como líder`);
    if (contatosIgnoradosCount > 0) blocking.push(`${contatosIgnoradosCount} contato(s) ignorado(s)`);

    if (blocking.length > 0) {
      return res.status(409).json({
        error: 'Não foi possível excluir o usuário porque existem registros vinculados.',
        blocking,
        message: 'O usuário possui registros históricos que impedem a exclusão física. Mantenha-o como arquivado.',
      });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Delete user permanently error:', error);
    return res.status(500).json({ error: 'Não foi possível excluir o usuário' });
  }
}
