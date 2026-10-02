/* Recupera quadros de tarefas internas (Desenvolvimento, Eu, Interfaceamento)
 * da Neon CodeHelp (.env.web) para o banco local (.env).
 * Uso: node scripts/recover-kanban-boards.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BOARDS = ['Desenvolvimento', 'Eu', 'Interfaceamento'];
const DRY = process.argv.includes('--dry-run');

function readUrl(file, key = 'DATABASE_URL') {
  const txt = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const line = txt.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`));
  if (!line) throw new Error(`${key} nao encontrado em ${file}`);
  return line.slice(line.indexOf('=') + 1).trim();
}

const src = new PrismaClient({ datasources: { db: { url: readUrl('.env.web') } } });
const dst = new PrismaClient();

const norm = (s) => (s || '').toString().trim().toLowerCase();
// repara mojibake UTF-8-decodificado-como-cp437: '├¡'(í) '├º'(ç) '├ú'(ã)
const repair = (s) =>
  (s || '')
    .replace(/├¡/g, 'í')
    .replace(/├º/g, 'ç')
    .replace(/├ú/g, 'ã')
    .replace(/├£/g, 'ã');
// nome canonico: repara mojibake, remove acentos/simbolos (casamento tolerante)
const canon = (s) =>
  norm(repair(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

async function main() {
  // ---------- LEITURA DA FONTE ----------
  const boards = await src.kanbanBoard.findMany({
    where: { nome: { in: BOARDS } },
    include: { columns: true, tags: true },
  });
  const boardIds = boards.map((b) => b.id);
  const tasks = await src.kanbanTask.findMany({
    where: { boardId: { in: boardIds }, ativo: true, arquivado: false },
    orderBy: { ordem: 'asc' },
  });
  const taskIds = tasks.map((t) => t.id);
  const subtasks = await src.kanbanSubtask.findMany({ where: { taskId: { in: taskIds } } });
  const activities = await src.kanbanActivity.findMany({ where: { taskId: { in: taskIds } } });
  const taskTags = await src.kanbanTaskTag.findMany({ where: { taskId: { in: taskIds } } });

  console.log(`FONTE (Neon CodeHelp): ${boards.length} boards, ${tasks.length} cards ativos, ${subtasks.length} subtarefas, ${activities.length} activities, ${taskTags.length} task-tags`);

  const srcColById = new Map();
  for (const b of boards) for (const c of b.columns) srcColById.set(c.id, { ...c, boardNome: b.nome });

  // ---------- MAPEAMENTO DE FKs ----------
  const srcUserIds = [
    ...new Set([
      ...tasks.map((t) => t.responsavelId),
      ...subtasks.map((s) => s.responsavelId),
      ...activities.map((a) => a.usuarioId),
      ...boards.map((b) => b.criadorId),
    ].filter(Boolean)),
  ];
  const srcUsers = await src.user.findMany({ where: { id: { in: srcUserIds } }, select: { id: true, email: true } });
  const localUsersByEmail = await dst.user.findMany({
    where: { email: { in: srcUsers.map((u) => u.email).filter(Boolean) } },
    select: { id: true, email: true },
  });
  const emailToLocal = new Map(localUsersByEmail.map((u) => [norm(u.email), u.id]));
  const localUserIds = new Set(localUsersByEmail.map((u) => u.id));
  const userIdMap = new Map();
  for (const u of srcUsers) {
    const byEmail = emailToLocal.get(norm(u.email));
    if (byEmail) userIdMap.set(u.id, byEmail);
    else if (localUserIds.has(u.id)) userIdMap.set(u.id, u.id);
    else userIdMap.set(u.id, null); // usuario nao existe localmente -> null
  }
  const mapUser = (id) => (id ? userIdMap.get(id) ?? null : null);

  const ticketIds = [...new Set(tasks.map((t) => t.ticketId).filter(Boolean))];
  const localTickets = await dst.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true } });
  const localTicketSet = new Set(localTickets.map((t) => t.id));
  const mapTicket = (id) => (id && localTicketSet.has(id) ? id : null);

  const clientIds = [...new Set(tasks.map((t) => t.clientId).filter(Boolean))];
  const localClients = await dst.client.findMany({ where: { id: { in: clientIds } }, select: { id: true } });
  const localClientSet = new Set(localClients.map((c) => c.id));
  const mapClient = (id) => (id && localClientSet.has(id) ? id : null);

  const depIds = [...new Set(tasks.map((t) => t.departamentoId).filter(Boolean))];
  const localDeps = await dst.departamento.findMany({ where: { id: { in: depIds } }, select: { id: true } });
  const localDepSet = new Set(localDeps.map((d) => d.id));
  const mapDep = (id) => (id && localDepSet.has(id) ? id : null);

  const orderIds = [...new Set(tasks.map((t) => t.orderId).filter(Boolean))];
  const localOrders = orderIds.length
    ? await dst.serviceOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true } })
    : [];
  const localOrderSet = new Set(localOrders.map((o) => o.id));
  const mapOrder = (id) => (id && localOrderSet.has(id) ? id : null);

  const relatorio = [];
  const warnings = [];
  const stats = { boardsCriados: 0, boardsReaproveitados: 0, colunasCriadas: 0, tasksCriadas: 0, tasksIgnoradas: 0, subtasks: 0, activities: 0, taskTags: 0, tags: 0, fkNulas: [] };

  const run = async (tx) => {
    for (const board of boards) {
      // ---------- BOARD ----------
      let localBoard = await tx.kanbanBoard.findFirst({ where: { nome: board.nome } });
      const colMap = new Map(); // coluna fonte id -> coluna local id
      const colByName = new Map(); // nome canonico -> coluna local id

      if (localBoard) {
        stats.boardsReaproveitados++;
        const localCols = await tx.kanbanColumn.findMany({ where: { boardId: localBoard.id }, orderBy: { ordem: 'asc' } });
        for (const lc of localCols) colByName.set(canon(lc.nome), lc.id);
        for (const sc of board.columns) {
          const match = localCols.find((lc) => canon(lc.nome) === canon(sc.nome));
          if (match) colMap.set(sc.id, match.id);
          else {
            warnings.push(`board '${board.nome}': coluna fonte '${sc.nome}' (canon '${canon(sc.nome)}') sem correspondente local [${localCols.map((l) => `${l.nome}=>${canon(l.nome)}`).join(', ')}] -> criada`);
            const created = await tx.kanbanColumn.create({
              data: { boardId: localBoard.id, nome: repair(sc.nome), cor: sc.cor, icone: sc.icone, ordem: sc.ordem, wipLimit: sc.wipLimit, hidden: sc.hidden },
            });
            colMap.set(sc.id, created.id);
            colByName.set(canon(sc.nome), created.id);
            stats.colunasCriadas++;
          }
        }
        relatorio.push(`board '${board.nome}' reaproveitado (id local ${localBoard.id}) + ${board.columns.length} colunas mapeadas`);
      } else {
        const existsId = await tx.kanbanBoard.findUnique({ where: { id: board.id } });
        if (existsId) throw new Error(`id ${board.id} ja existe localmente com outro nome`);
        localBoard = await tx.kanbanBoard.create({
          data: {
            id: board.id,
            nome: board.nome,
            descricao: board.descricao,
            icone: board.icone,
            cor: board.cor,
            criadorId: mapUser(board.criadorId),
            ativo: board.ativo,
            ordem: board.ordem,
            templateId: board.templateId,
            organizationId: null,
            createdAt: board.createdAt,
            updatedAt: board.updatedAt,
          },
        });
        stats.boardsCriados++;
        for (const sc of board.columns) {
          await tx.kanbanColumn.create({
            data: {
              id: sc.id, boardId: localBoard.id, nome: repair(sc.nome), cor: sc.cor, icone: sc.icone,
              ordem: sc.ordem, wipLimit: sc.wipLimit, hidden: sc.hidden,
              createdAt: sc.createdAt, updatedAt: sc.updatedAt,
            },
          });
          colMap.set(sc.id, sc.id);
          colByName.set(canon(repair(sc.nome)), sc.id);
          stats.colunasCriadas++;
        }
        relatorio.push(`board '${board.nome}' CRIADO (id ${localBoard.id}) + ${board.columns.length} colunas`);
      }

      // tags do board (ambos os caminhos)
      for (const tag of board.tags) {
        const tagExists = await tx.kanbanTag.findUnique({ where: { id: tag.id } });
        if (!tagExists) {
          await tx.kanbanTag.create({ data: { id: tag.id, nome: repair(tag.nome), cor: tag.cor, boardId: localBoard.id, createdAt: tag.createdAt } });
          stats.tags++;
        }
      }

      // ---------- CARDS ----------
      for (const task of tasks.filter((t) => t.boardId === board.id)) {
        const dup = await tx.kanbanTask.findUnique({ where: { id: task.id } });
        if (dup) { stats.tasksIgnoradas++; continue; }

        let columnId = colMap.get(task.columnId);
        if (!columnId) {
          // Dados da fonte tem cards apontando para colunas de OUTRO board:
          // fallback -> coluna de mesmo nome neste board (senao, 1a coluna)
          const sc = srcColById.get(task.columnId);
          columnId = sc ? colByName.get(canon(repair(sc.nome))) : undefined;
          if (!columnId) columnId = [...colByName.values()][0];
          warnings.push(
            `card '${task.titulo}' (${board.nome}): coluna fonte ${task.columnId}${sc ? ` ('${sc.nome}' do board '${sc.boardNome}')` : ' (desconhecida)'} -> realocada`,
          );
          if (!columnId) throw new Error(`sem coluna destino para o card '${task.titulo}'`);
        }

        const responsavelId = mapUser(task.responsavelId);
        const ticketId = mapTicket(task.ticketId);
        const clientId = mapClient(task.clientId);
        const departamentoId = mapDep(task.departamentoId);
        const orderId = mapOrder(task.orderId);
        if (task.responsavelId && !responsavelId) stats.fkNulas.push(`responsavelId ${task.responsavelId} (${task.titulo})`);
        if (task.ticketId && !ticketId) stats.fkNulas.push(`ticketId ${task.ticketId} (${task.titulo})`);

        await tx.kanbanTask.create({
          data: {
            ...task,
            titulo: repair(task.titulo),
            descricao: task.descricao ? repair(task.descricao) : task.descricao,
            boardId: localBoard.id,
            columnId,
            responsavelId,
            ticketId,
            clientId,
            departamentoId,
            orderId,
          },
        });
        stats.tasksCriadas++;
      }
    }

    // ---------- FILHOS (subtasks / activities / task-tags) ----------
    const localTaskIds = new Set((await tx.kanbanTask.findMany({ where: { id: { in: taskIds } }, select: { id: true } })).map((t) => t.id));

    for (const s of subtasks) {
      if (!localTaskIds.has(s.taskId)) continue;
      const dup = await tx.kanbanSubtask.findUnique({ where: { id: s.id } });
      if (dup) continue;
      await tx.kanbanSubtask.create({
        data: {
          id: s.id, taskId: s.taskId, titulo: repair(s.titulo), concluida: s.concluida, ordem: s.ordem,
          responsavelId: mapUser(s.responsavelId), createdAt: s.createdAt, updatedAt: s.updatedAt,
        },
      });
      stats.subtasks++;
    }

    for (const a of activities) {
      if (!localTaskIds.has(a.taskId)) continue;
      const dup = await tx.kanbanActivity.findUnique({ where: { id: a.id } });
      if (dup) continue;
      await tx.kanbanActivity.create({
        data: {
          id: a.id, taskId: a.taskId, usuarioId: mapUser(a.usuarioId), tipo: a.tipo,
          descricao: a.descricao, deColuna: a.deColuna, paraColuna: a.paraColuna,
          dados: a.dados, visivelCliente: a.visivelCliente, createdAt: a.createdAt,
          metadata: a.metadata, motivo: a.motivo, origem: a.origem,
          valorAnterior: a.valorAnterior, valorNovo: a.valorNovo,
        },
      });
      stats.activities++;
    }

    for (const tt of taskTags) {
      if (!localTaskIds.has(tt.taskId)) continue;
      const tagOk = await tx.kanbanTag.findUnique({ where: { id: tt.tagId } });
      if (!tagOk) continue;
      const dup = await tx.kanbanTaskTag.findUnique({ where: { id: tt.id } });
      if (dup) continue;
      await tx.kanbanTaskTag.create({ data: { id: tt.id, taskId: tt.taskId, tagId: tt.tagId } });
      stats.taskTags++;
    }

    return true;
  };

  if (DRY) {
    console.log('--- DRY RUN (transacao executada e revertida) ---');
    try {
      await dst.$transaction(async (tx) => {
        await run(tx);
        throw new Error('__DRY_ROLLBACK__');
      }, { timeout: 120000 });
    } catch (e) {
      if (e.message !== '__DRY_ROLLBACK__') throw e;
    }
  } else {
    await dst.$transaction(run, { timeout: 120000 });
  }
  console.log(relatorio.join('\n'));
  console.log(JSON.stringify(stats, null, 2));
  if (warnings.length) {
    console.log('\nAVISOS:');
    for (const w of warnings) console.log(`  - ${w}`);
  }

  // ---------- VERIFICACAO ----------
  const pos = await dst.kanbanBoard.findMany({
    where: { nome: { in: BOARDS } },
    include: { _count: { select: { columns: true, tasks: true } } },
    orderBy: { nome: 'asc' },
  });
  console.log(`\n${DRY ? 'ESTADO ATUAL (dry-run nao grava)' : 'POS-RECUPERACAO (local)'}:`);
  for (const b of pos) console.log(`  ${b.nome} | ativo=${b.ativo} | colunas=${b._count.columns} | cards=${b._count.tasks}`);
}

main()
  .catch((e) => { console.error('ERRO:', e.message || e); process.exitCode = 1; })
  .finally(async () => { await src.$disconnect(); await dst.$disconnect(); });
