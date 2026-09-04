import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { classificarStatusPrazo, calcularPrazo, atualizarStatusPrazo } from '../modules/kanban/taskDeadline.service';
import { registrarEvento, getTaskTimeline, diferenciarCampos } from '../modules/kanban/taskTimeline.service';
import * as kanban from '../modules/kanban/kanban.service';
import * as tt from '../modules/timetracking/timetracking.service';
import * as teams from '../modules/teams/teams.service';
import { verificarAlertas, listTaskAlerts, marcarAlertaLida } from '../modules/kanban/taskAlert.service';
import { getTaskDashboard, exportTasksCsv } from '../modules/kanban/taskReport.service';
import { getLogs, getAuditDashboardStats } from '../modules/audit/audit.service';

let boardId: string;
let column1Id: string;
let column2Id: string;
let userAId: string;
let userBId: string;
let clientId: string;
let taskId: string;
let teamId: string;
let timeEntryId: string;

beforeAll(async () => {
  await ensureHelpdeskEntities();

  const board = await prisma.kanbanBoard.create({
    data: { nome: `Board Teste ${Date.now()}` },
  });
  boardId = board.id;

  const c1 = await prisma.kanbanColumn.create({ data: { boardId, nome: 'A Fazer', ordem: 0 } });
  const c2 = await prisma.kanbanColumn.create({ data: { boardId, nome: 'Concluído', ordem: 1 } });
  column1Id = c1.id;
  column2Id = c2.id;

  const userA = await prisma.user.create({
    data: { name: 'Tarefa User A', email: `ta-${Date.now()}@test.dev`, password: 'hash', role: 'agente' },
  });
  const userB = await prisma.user.create({
    data: { name: 'Tarefa User B', email: `tb-${Date.now()}@test.dev`, password: 'hash', role: 'agente' },
  });
  userAId = userA.id;
  userBId = userB.id;

  const client = await prisma.client.create({ data: { razaoSocial: 'Cliente Tarefa', status: 'ativo' } });
  clientId = client.id;
});

afterEach(async () => {
  if (timeEntryId) {
    await prisma.timeEntryBlock.deleteMany({ where: { timeEntryId } });
    await prisma.timeEntry.deleteMany({ where: { id: timeEntryId } });
    timeEntryId = '';
  }
  if (taskId) {
    await prisma.kanbanStageTime.deleteMany({ where: { taskId } });
    await prisma.taskAlert.deleteMany({ where: { taskId } });
    await prisma.kanbanActivity.deleteMany({ where: { taskId } });
    await prisma.kanbanTaskTag.deleteMany({ where: { taskId } });
    await prisma.kanbanTask.deleteMany({ where: { id: taskId } });
    taskId = '';
  }
  if (teamId) {
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    teamId = '';
  }
});

describe('Prazo — classificação (spec §4)', () => {
  it('sem prazo é no_prazo', () => {
    expect(classificarStatusPrazo({})).toBe('no_prazo');
  });

  it('tarefa concluída nunca conta como atrasada', () => {
    expect(
      classificarStatusPrazo({
        prazoEntrega: new Date(Date.now() - 5 * 86400000),
        dataConclusao: new Date(),
      })
    ).toBe('concluida');
  });

  it('prazo vencido sem conclusão é atrasada', () => {
    expect(
      classificarStatusPrazo({ prazoEntrega: new Date(Date.now() - 3600000) })
    ).toBe('atrasada');
  });

  it('menos de 6h para o prazo é atencao', () => {
    expect(
      classificarStatusPrazo({ prazoEntrega: new Date(Date.now() + 3 * 3600000) })
    ).toBe('atencao');
  });

  it('menos de 24h é proxima', () => {
    expect(
      classificarStatusPrazo({ prazoEntrega: new Date(Date.now() + 12 * 3600000) })
    ).toBe('proxima');
  });

  it('mais de 24h é no_prazo', () => {
    expect(
      classificarStatusPrazo({ prazoEntrega: new Date(Date.now() + 48 * 3600000) })
    ).toBe('no_prazo');
  });

  it('calcularPrazo expõe restante/excedido/percentual', () => {
    const res = calcularPrazo({ prazoEntrega: new Date(Date.now() + 3600000), estimativaHoras: 10, horasTrabalhadas: 5 });
    expect(res.status).toBe('atencao');
    expect(res.percentualConsumido).toBe(50);
    expect(res.restanteLabel).toMatch(/h|min/);
  });

  it('atualizarStatusPrazo persiste na tarefa', async () => {
    const task = await prisma.kanbanTask.create({
      data: { numero: 9990, titulo: 'Prazo teste', columnId: column1Id, boardId, prazoEntrega: new Date(Date.now() - 3600000) },
    });
    taskId = task.id;
    const status = await atualizarStatusPrazo(task.id, 'A Fazer');
    const persisted = await prisma.kanbanTask.findUnique({ where: { id: task.id } });
    expect(status).toBe('atrasada');
    expect(persisted?.statusPrazo).toBe('atrasada');
  });
});

describe('Timeline estruturada (spec §19/§20)', () => {
  it('registrarEvento grava antes/depois/origem/motivo e auditoria', async () => {
    const task = await prisma.kanbanTask.create({
      data: { numero: 9991, titulo: 'Timeline teste', columnId: column1Id, boardId },
    });
    taskId = task.id;

    await registrarEvento({
      taskId: task.id,
      numero: task.numero,
      usuarioId: userAId,
      tipo: 'alterou_campo',
      descricao: 'Tarefa atualizada',
      valorAnterior: 'Baixa',
      valorNovo: 'Alta',
      origem: 'manual',
      motivo: 'prioridade corrigida',
      metadata: { campo: 'prioridade' },
    });

    const timeline = await getTaskTimeline(task.id);
    expect(timeline.length).toBe(1);
    expect(timeline[0].valorAnterior).toBe('Baixa');
    expect(timeline[0].valorNovo).toBe('Alta');
    expect(timeline[0].origem).toBe('manual');
    expect(timeline[0].motivo).toBe('prioridade corrigida');

    const audit = await prisma.auditLog.findFirst({
      where: { entidade: 'KanbanTask', entidadeId: task.id, acao: 'alterou_campo' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.valorAnterior).toBe('Baixa');
    expect(audit?.novoValor).toBe('Alta');
  });

  it('diferenciarCampos gera eventos só para campos alterados', () => {
    const eventos = diferenciarCampos(
      { titulo: 'A', responsavelId: 'x', prazoEntrega: 'd1' },
      { titulo: 'B', responsavelId: 'x', prazoEntrega: 'd2' },
      ['titulo', 'responsavelId', 'prazoEntrega'],
      1,
      'task-1',
      null
    );
    expect(eventos.length).toBe(2);
    expect(eventos.find((e) => e.metadata?.campo === 'titulo')?.valorAnterior).toBe('A');
    expect(eventos.find((e) => e.metadata?.campo === 'prazoEntrega')?.valorNovo).toBe('d2');
  });
});

describe('Kanban service — evolução', () => {
  it('createTask grava evento criou + tempo de etapa + campos novos', async () => {
    const task = await kanban.createTask(
      boardId,
      {
        titulo: 'Tarefa completa',
        columnId: column1Id,
        responsavelId: userAId,
        clientId,
        tipoTarefa: 'dev',
        prioridade: 'alta',
        estimativaHoras: 8,
        prazoEntrega: new Date(Date.now() + 48 * 3600000),
      },
      userBId
    );
    taskId = task.id;

    expect(task.tipoTarefa).toBe('dev');
    expect(task.statusPrazo).toBe('no_prazo');
    expect(task.numero).toBeGreaterThan(0);

    const etapa = await prisma.kanbanStageTime.findFirst({ where: { taskId: task.id } });
    expect(etapa?.columnNome).toBe('A Fazer');
    expect(etapa?.dataSaida).toBeNull();

    const timeline = await getTaskTimeline(task.id);
    expect(timeline.some((e) => e.tipo === 'criou')).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { entidade: 'KanbanTask', entidadeId: task.id, acao: 'criar' },
    });
    expect(audit).toBeTruthy();
  });

  it('updateTask grava eventos por campo com antes/depois', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Edição teste', columnId: column1Id, responsavelId: userAId },
      userBId
    );
    taskId = task.id;

    await kanban.updateTask(task.id, { titulo: 'Edição teste 2', responsavelId: userBId }, userBId);

    const alterados = await getTaskTimeline(task.id);
    const campo = alterados.find((e) => e.tipo === 'alterou_campo' && e.metadata?.includes('titulo'));
    expect(campo).toBeTruthy();
    expect(campo?.valorAnterior).toBe('Edição teste');
    expect(campo?.valorNovo).toBe('Edição teste 2');

    const audit = await prisma.auditLog.findFirst({
      where: { entidade: 'KanbanTask', entidadeId: task.id, acao: 'atualizar' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('moveTask fecha etapa anterior e abre nova + recalcula statusPrazo', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Movimentação teste', columnId: column1Id, prazoEntrega: new Date(Date.now() + 1000000) },
      userAId
    );
    taskId = task.id;

    await kanban.moveTask(task.id, column2Id, undefined, userAId);

    const etapas = await prisma.kanbanStageTime.findMany({ where: { taskId: task.id }, orderBy: { dataEntrada: 'asc' } });
    expect(etapas.length).toBe(2);
    expect(etapas[0].dataSaida).not.toBeNull();
    expect(etapas[1].columnNome).toBe('Concluído');
    expect(etapas[1].dataSaida).toBeNull();

    const updated = await prisma.kanbanTask.findUnique({ where: { id: task.id } });
    expect(updated?.statusPrazo).toBe('concluida');

    const timeline = await getTaskTimeline(task.id);
    const moveu = timeline.find((e) => e.tipo === 'moveu');
    expect(moveu?.deColuna).toBe('A Fazer');
    expect(moveu?.paraColuna).toBe('Concluído');
  });

  it('archive → restore → reopen exige motivo → definitive delete', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Ciclo de vida', columnId: column1Id, responsavelId: userAId },
      userAId
    );
    taskId = task.id;

    const archived = await kanban.archiveTask(task.id, userBId, 'arquivando');
    expect(archived.arquivado).toBe(true);
    expect(archived.arquivadoEm).toBeInstanceOf(Date);
    expect(archived.arquivadoPorId).toBe(userBId);

    const archivedList = await kanban.listArchivedTasks({ busca: 'Ciclo de vida' });
    expect(archivedList.items.some((t) => t.id === task.id)).toBe(true);

    const restored = await kanban.restoreTask(task.id, userAId);
    expect(restored.arquivado).toBe(false);
    expect(restored.restauradoEm).toBeInstanceOf(Date);

    await expect(kanban.reopenTask(task.id, userAId, '')).rejects.toThrow('obrigatório');
    const reopened = await kanban.reopenTask(task.id, userAId, 'cliente reclamou');
    expect(reopened.reabertoMotivo).toBe('cliente reclamou');
    expect(reopened.columnId).toBe(column1Id);

    await expect(kanban.deleteTaskDefinitive(task.id, userAId)).rejects.toThrow('arquivadas');

    await kanban.archiveTask(task.id, userAId, 'para excluir');
    await kanban.deleteTaskDefinitive(task.id, userAId, 'limpeza');
    const gone = await prisma.kanbanTask.findUnique({ where: { id: task.id } });
    expect(gone).toBeNull();
    taskId = '';
  });
});

describe('Controle de tempo da tarefa (spec §5/§6/§9/§10/§12/§41)', () => {
  it('pause/resume registram blocos e duracao líquida exclui pausas', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Tempo teste', columnId: column1Id, responsavelId: userAId },
      userAId
    );
    taskId = task.id;

    const entry = await tt.startTimer({ usuarioId: userAId, tarefaId: task.id, tipo: 'dev' });
    timeEntryId = entry.id;

    const paused = await tt.pauseTimer(entry.id, userAId, 'almoco');
    expect(paused!.pausado).toBe(true);

    await new Promise((r) => setTimeout(r, 30));

    const resumed = await tt.resumeTimer(entry.id, userAId, 'voltou');
    expect(resumed!.pausado).toBe(false);
    expect(resumed!.pausadoTotalMin).toBeGreaterThanOrEqual(0);

    await new Promise((r) => setTimeout(r, 30));
    const stopped = await tt.stopTimer(entry.id, userAId);
    expect(stopped.dataFim).toBeInstanceOf(Date);

    const blocks = await prisma.timeEntryBlock.findMany({ where: { timeEntryId: entry.id }, orderBy: { createdAt: 'asc' } });
    expect(blocks.map((b) => b.tipo)).toEqual(['inicio', 'pausa', 'retomada', 'fim']);

    const summary = await tt.getTaskTimeSummary(task.id);
    expect(summary.porTipo.desenvolvimento).toBe(stopped!.duracaoMin);
    expect(summary.blocos.length).toBe(1);

    const taskUpdated = await prisma.kanbanTask.findUnique({ where: { id: task.id } });
    expect(taskUpdated?.horasTrabalhadas).toBe(Math.round((stopped!.duracaoMin! / 60) * 100) / 100);
  });

  it('ajuste manual de tempo é auditado com antes/depois e motivo obrigatório', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Ajuste teste', columnId: column1Id, responsavelId: userAId },
      userAId
    );
    taskId = task.id;

    const entry = await tt.createManualEntry({
      usuarioId: userAId,
      tarefaId: task.id,
      tipo: 'dev',
      descricao: 'apontamento',
      duracaoMin: 120,
    });
    timeEntryId = entry.id;

    await expect(tt.ajustarTempo(entry.id, 60, '')).rejects.toThrow('obrigatório');

    const adjusted = await tt.ajustarTempo(entry.id, 90, 'correção de apontamento', userBId);
    expect(adjusted!.duracaoMin).toBe(90);

    const audit = await prisma.auditLog.findFirst({
      where: { entidade: 'TimeEntry', entidadeId: entry.id, acao: 'ajuste_manual_tempo' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.valorAnterior).toBe('120min');
    expect(audit?.novoValor).toBe('90min');
  });

  it('detectarSobreposicao sinaliza registros concorrentes', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Sobreposição', columnId: column1Id, responsavelId: userAId },
      userAId
    );
    taskId = task.id;

    const agora = Date.now();
    const entry = await tt.createManualEntry({
      usuarioId: userAId,
      tarefaId: task.id,
      tipo: 'dev',
      dataInicio: new Date(agora - 3600000).toISOString(),
      duracaoMin: 120,
    });
    timeEntryId = entry.id;

    const overlap = await tt.detectarSobreposicao(userAId, new Date(agora - 1800000), new Date(agora));
    expect(overlap.length).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { acao: 'sobreposicao_tempo', usuarioId: userAId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.resultado).toBe('alerta');
  });
});

describe('Equipes (spec §3/§34)', () => {
  it('CRUD de equipe com membros e auditoria', async () => {
    const team = await teams.createTeam(
      { nome: `Equipe ${Date.now()}`, descricao: 'Equipe de teste', liderId: userAId, membros: [userAId, userBId] },
      userAId
    );
    teamId = team.id;

    expect(team.membros.length).toBe(2);

    const listed = await teams.listTeams();
    expect(listed.some((t) => t.id === team.id)).toBe(true);

    const updated = await teams.updateTeam(team.id, { descricao: 'Atualizada' }, userBId);
    expect(updated.descricao).toBe('Atualizada');

    await teams.removeMember(team.id, userBId, userAId);
    const after = await teams.getTeam(team.id);
    expect(after.membros.length).toBe(1);

    await teams.deleteTeam(team.id, userAId);
    const audit = await prisma.auditLog.findFirst({
      where: { entidade: 'Team', entidadeId: team.id, acao: 'equipe_deletada' },
    });
    expect(audit).toBeTruthy();
    teamId = '';
  });
});

describe('Alertas (spec §35/§36)', () => {
  it('verificarAlertas detecta tarefa atrasada e evita duplicados', async () => {
    const task = await prisma.kanbanTask.create({
      data: {
        numero: 9992,
        titulo: 'Tarefa atrasada',
        columnId: column1Id,
        boardId,
        responsavelId: userAId,
        prazoEntrega: new Date(Date.now() - 7200000),
        statusPrazo: 'atrasada',
      },
    });
    taskId = task.id;

    const criados = await verificarAlertas();
    expect(criados.some((a) => a.taskId === task.id && a.tipo === 'atrasada')).toBe(true);

    const again = await verificarAlertas();
    const duplicados = again.filter((a) => a.taskId === task.id && a.tipo === 'atrasada').length;
    expect(duplicados).toBe(0);

    const alerts = await listTaskAlerts({ taskId: task.id });
    const alert = alerts.find((a) => a.tipo === 'atrasada');
    expect(alert).toBeTruthy();
    expect(alert!.lida).toBe(false);

    const marked = await marcarAlertaLida(alert!.id);
    expect(marked.lida).toBe(true);
  });
});

describe('Relatório e auditoria global (spec §37/§38/§43/§44)', () => {
  it('getTaskDashboard calcula indicadores e exporta CSV com BOM', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Tarefa relatório', columnId: column2Id, responsavelId: userAId, tipoTarefa: 'implantacao' },
      userAId
    );
    taskId = task.id;

    const dash = await getTaskDashboard({ boardId });
    expect(dash.totalTarefas).toBeGreaterThan(0);
    expect(dash.taxaConclusao).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(dash.porTipo)).toBe(true);

    const tasks = await kanban.listArchivedTasks({});
    const csv = exportTasksCsv(tasks.items as any);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Numero');
  });

  it('auditoria global filtra por módulo e usuário', async () => {
    const task = await kanban.createTask(
      boardId,
      { titulo: 'Tarefa auditoria', columnId: column1Id, responsavelId: userAId },
      userAId
    );
    taskId = task.id;

    const byModulo = await getLogs({ modulo: 'Tarefas', entidade: 'KanbanTask', entidadeId: task.id });
    expect(byModulo.logs.length).toBeGreaterThan(0);

    const byUser = await getLogs({ usuarioId: userAId, modulo: 'Tarefas' });
    expect(byUser.logs.length).toBeGreaterThan(0);

    const stats = await getAuditDashboardStats();
    expect(typeof stats.eventosHoje).toBe('number');
    expect(typeof stats.eventos30dias).toBe('number');
    expect(Array.isArray(stats.topAcoes)).toBe(true);
  });
});