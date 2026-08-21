import prisma from '../../config/database';
import { logAudit } from '../audit/audit.service';

export interface TeamCreateInput {
  nome: string;
  descricao?: string | null;
  departamentoId?: string | null;
  liderId?: string | null;
  membros?: string[];
  ativo?: boolean;
}

export async function listTeams() {
  return prisma.team.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    include: {
      departamento: { select: { id: true, nome: true } },
      lider: { select: { id: true, name: true, email: true } },
      membros: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      _count: { select: { membros: true, kanbanTasks: true } },
    },
  });
}

export async function getTeam(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      departamento: { select: { id: true, nome: true } },
      lider: { select: { id: true, name: true, email: true } },
      membros: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      _count: { select: { membros: true, kanbanTasks: true } },
    },
  });
  if (!team) throw new Error('Equipe não encontrada');
  return team;
}

export async function createTeam(data: TeamCreateInput, usuarioId?: string | null) {
  if (!data.nome || !data.nome.trim()) throw new Error('Nome da equipe é obrigatório');

  const team = await prisma.team.create({
    data: {
      nome: data.nome.trim(),
      descricao: data.descricao ?? null,
      departamentoId: data.departamentoId ?? null,
      liderId: data.liderId ?? null,
      membros: data.membros?.length
        ? { create: data.membros.map((userId) => ({ userId })) }
        : undefined,
    },
    include: { membros: { include: { user: { select: { id: true, name: true } } } } },
  });

  await logAudit({
    usuarioId: usuarioId ?? null,
    modulo: 'Tarefas',
    entidade: 'Team',
    entidadeId: team.id,
    acao: 'equipe_criada',
    descricao: `Equipe "${team.nome}" criada`,
    origem: 'web',
  });

  return team;
}

export async function updateTeam(teamId: string, data: Partial<TeamCreateInput>, usuarioId?: string | null) {
  const existing = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, nome: true } });
  if (!existing) throw new Error('Equipe não encontrada');

  const updateData: any = {};
  if (data.nome !== undefined) updateData.nome = data.nome.trim();
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.departamentoId !== undefined) updateData.departamentoId = data.departamentoId;
  if (data.liderId !== undefined) updateData.liderId = data.liderId;
  if (data.ativo !== undefined) updateData.ativo = data.ativo;

  const team = await prisma.team.update({
    where: { id: teamId },
    data: updateData,
    include: { membros: { include: { user: { select: { id: true, name: true } } } } },
  });

  await logAudit({
    usuarioId: usuarioId ?? null,
    modulo: 'Tarefas',
    entidade: 'Team',
    entidadeId: teamId,
    acao: 'equipe_alterada',
    descricao: `Equipe "${existing.nome}" atualizada`,
    origem: 'web',
  });

  return team;
}

export async function deleteTeam(teamId: string, usuarioId?: string | null) {
  const existing = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, nome: true } });
  if (!existing) throw new Error('Equipe não encontrada');

  await prisma.team.update({
    where: { id: teamId },
    data: { ativo: false },
  });

  await logAudit({
    usuarioId: usuarioId ?? null,
    modulo: 'Tarefas',
    entidade: 'Team',
    entidadeId: teamId,
    acao: 'equipe_deletada',
    descricao: `Equipe "${existing.nome}" desativada`,
    origem: 'web',
  });

  return true;
}

export async function addMember(teamId: string, userId: string, usuarioId?: string | null) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, nome: true } });
  if (!team) throw new Error('Equipe não encontrada');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) throw new Error('Usuário não encontrado');

  const member = await prisma.teamMember.create({
    data: { teamId, userId },
  });

  await logAudit({
    usuarioId: usuarioId ?? null,
    modulo: 'Tarefas',
    entidade: 'Team',
    entidadeId: teamId,
    acao: 'membro_adicionado',
    descricao: `Membro "${user.name}" adicionado à equipe "${team.nome}"`,
    origem: 'web',
  });

  return member;
}

export async function removeMember(teamId: string, userId: string, usuarioId?: string | null) {
  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId },
    include: { team: { select: { nome: true } }, user: { select: { name: true } } },
  });
  if (!member) throw new Error('Membro não encontrado na equipe');

  await prisma.teamMember.delete({ where: { id: member.id } });

  await logAudit({
    usuarioId: usuarioId ?? null,
    modulo: 'Tarefas',
    entidade: 'Team',
    entidadeId: teamId,
    acao: 'membro_removido',
    descricao: `Membro "${member.user.name}" removido da equipe "${member.team.nome}"`,
    origem: 'web',
  });

  return true;
}