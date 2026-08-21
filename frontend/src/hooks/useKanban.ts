import { useState, useCallback } from 'react';
import api from '../services/api';
import type { KanbanBoard, KanbanTask, KanbanColumn } from '../types/kanban';

export function useKanban() {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [currentBoard, setCurrentBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/boards');
      setBoards(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar boards');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBoard = useCallback(async (boardId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/kanban/boards/${boardId}`);
      setCurrentBoard(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar board');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBoard = useCallback(async (data: { nome: string; descricao?: string; icone?: string; cor?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/kanban/boards', data);
      setBoards(prev => [...prev, response.data]);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar board');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBoard = useCallback(async (boardId: string, data: Partial<KanbanBoard>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/boards/${boardId}`, data);
      setBoards(prev => prev.map(b => b.id === boardId ? response.data : b));
      if (currentBoard?.id === boardId) {
        setCurrentBoard(response.data);
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar board');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const deleteBoard = useCallback(async (boardId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/boards/${boardId}`);
      setBoards(prev => prev.filter(b => b.id !== boardId));
      if (currentBoard?.id === boardId) {
        setCurrentBoard(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao deletar board');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const createTask = useCallback(async (boardId: string, data: { titulo: string; columnId: string; descricao?: string; prioridade?: string; responsavelId?: string; categoria?: string; classificacao?: string; dataInicio?: string; prazoEntrega?: string; tags?: string[] }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/boards/${boardId}/tasks`, data);
      if (currentBoard?.id === boardId) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col =>
              col.id === data.columnId
                ? { ...col, tasks: [...col.tasks, response.data] }
                : col
            ),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const updateTask = useCallback(async (taskId: string, data: Partial<KanbanTask>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/tasks/${taskId}`, data);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.map(task =>
                task.id === taskId ? response.data : task
              ),
            })),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const deleteTask = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/tasks/${taskId}`);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.filter(task => task.id !== taskId),
            })),
          };
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao deletar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const moveTask = useCallback(async (taskId: string, targetColumnId: string, targetOrdem?: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/tasks/${taskId}/move`, {
        targetColumnId,
        targetOrdem,
      });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          let movedTask: KanbanTask | null = null;
          const columnsWithoutTask = prev.columns.map(col => ({
            ...col,
            tasks: col.tasks.filter(task => {
              if (task.id === taskId) {
                movedTask = { ...task, ...response.data };
                return false;
              }
              return true;
            }),
          }));
          if (!movedTask) return prev;
          const updatedColumns = columnsWithoutTask.map(col =>
            col.id === targetColumnId
              ? { ...col, tasks: [...col.tasks, movedTask!].sort((a, b) => a.ordem - b.ordem) }
              : col
          );
          return { ...prev, columns: updatedColumns };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao mover tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const reorderTasks = useCallback(async (columnId: string, taskIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/columns/${columnId}/tasks/reorder`, {
        taskIds,
      });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => {
              if (col.id !== columnId) return col;
              return {
                ...col,
                tasks: response.data,
              };
            }),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao reordenar tarefas');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const createColumn = useCallback(async (boardId: string, data: { nome: string; cor?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/boards/${boardId}/columns`, data);
      if (currentBoard?.id === boardId) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: [...prev.columns, response.data],
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar coluna');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const deleteColumn = useCallback(async (columnId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/columns/${columnId}`);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.filter(col => col.id !== columnId),
          };
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao deletar coluna');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const createSubtask = useCallback(async (taskId: string, titulo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/subtasks`, { titulo });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.map(task =>
                task.id === taskId
                  ? { ...task, subtasks: [...(task.subtasks || []), response.data] }
                  : task
              ),
            })),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar subtarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const toggleSubtask = useCallback(async (subtaskId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/subtasks/${subtaskId}/toggle`);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.map(task => ({
                ...task,
                subtasks: (task.subtasks || []).map(sub =>
                  sub.id === subtaskId ? response.data : sub
                ),
              })),
            })),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao alternar subtarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const addComment = useCallback(async (taskId: string, texto: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/comments`, { texto });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao adicionar comentário');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getActivityLog = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/kanban/tasks/${taskId}/activity`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar atividades');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/templates');
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar templates');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBoardFromTemplate = useCallback(async (templateId: string, nome?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/boards/from-template/${templateId}`, { nome });
      setBoards(prev => [...prev, response.data]);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar board a partir do template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAttachments = useCallback(async (taskId: string, files: FileList) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const response = await api.post(`/kanban/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newAttachments = response.data;
      setCurrentBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map(col => ({
            ...col,
            tasks: col.tasks.map(task =>
              task.id === taskId
                ? { ...task, attachments: [...(task.attachments || []), ...(Array.isArray(newAttachments) ? newAttachments : [newAttachments])] }
                : task
            ),
          })),
        };
      });
      return newAttachments;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar arquivos');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/attachments/${attachmentId}`);
      setCurrentBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map(col => ({
            ...col,
            tasks: col.tasks.map(task => ({
              ...task,
              attachments: (task.attachments || []).filter((a: any) => a.id !== attachmentId),
            })),
          })),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao deletar anexo');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(async (boardId: string, data: { nome: string; cor?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/boards/${boardId}/tags`, data);
      if (currentBoard?.id === boardId) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            tags: [...(prev.tags || []), response.data],
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar tag');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const deleteTag = useCallback(async (tagId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/tags/${tagId}`);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            tags: (prev.tags || []).filter(t => t.id !== tagId),
          };
        });
      }
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao deletar tag');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const createTaskFromTicket = useCallback(async (boardId: string, ticketId: string, data?: { titulo?: string; columnId?: string; prioridade?: string; descricao?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/boards/${boardId}/tickets/${ticketId}`, data || {});
      if (currentBoard?.id === boardId) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          const colId = data?.columnId || prev.columns[0]?.id;
          return {
            ...prev,
            columns: prev.columns.map(col =>
              col.id === colId
                ? { ...col, tasks: [...col.tasks, response.data] }
                : col
            ),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar tarefa do ticket');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const transferTask = useCallback(async (taskId: string, targetBoardId: string, targetColumnId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/tasks/${taskId}/transfer`, { targetBoardId, targetColumnId });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.filter(t => t.id !== taskId),
            })),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao transferir tarefa');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const duplicateTask = useCallback(async (taskId: string, targetColumnId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/duplicate`, { targetColumnId });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col =>
              col.id === response.data.columnId
                ? { ...col, tasks: [...col.tasks, response.data] }
                : col
            ),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao duplicar tarefa');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/subtasks/${subtaskId}`);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              tasks: col.tasks.map(task => ({
                ...task,
                subtasks: (task.subtasks || []).filter(s => s.id !== subtaskId),
              })),
            })),
          };
        });
      }
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao deletar subtarefa');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const updateColumn = useCallback(async (columnId: string, data: { nome?: string; cor?: string; ordem?: number; hidden?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/kanban/columns/${columnId}`, data);
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map(col =>
              col.id === columnId ? { ...col, ...data } : col
            ),
          };
        });
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar coluna');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const reorderColumns = useCallback(async (columnIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      if (!currentBoard) return;
      await api.patch(`/kanban/boards/${currentBoard.id}/columns/reorder`, { columnIds });
      if (currentBoard) {
        setCurrentBoard(prev => {
          if (!prev) return prev;
          const reordered = columnIds.map((id, idx) => {
            const col = prev.columns.find(c => c.id === id);
            return col ? { ...col, ordem: idx } : null;
          }).filter(Boolean) as typeof prev.columns;
          return { ...prev, columns: reordered };
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao reordenar colunas');
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  // ── Ciclo de vida da tarefa (arquivar/restaurar/reabrir/excluir) ──
  const archiveTask = useCallback(async (taskId: string, motivo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/archive`, { motivo });
      if (currentBoard) {
        setCurrentBoard(prev => ({
          ...prev!,
          columns: prev!.columns.map(col => ({
            ...col,
            tasks: col.tasks.filter(t => t.id !== taskId),
          })),
        }));
      }
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao arquivar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentBoard]);

  const restoreTask = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/restore`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao restaurar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reopenTask = useCallback(async (taskId: string, motivo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/tasks/${taskId}/reopen`, { motivo });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao reabrir tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTaskDefinitive = useCallback(async (taskId: string, motivo?: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/kanban/tasks/${taskId}/definitive`, { data: { motivo } });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir tarefa definitivamente');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const listArchivedTasks = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/tasks/archived', { params });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao listar tarefas arquivadas');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTaskDetail = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/kanban/tasks/${taskId}`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Tempo da tarefa (pausar/retomar/ajustar) ──
  const getTaskTimeSummary = useCallback(async (tarefaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/timetracking/task/${tarefaId}/summary`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar tempo da tarefa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pauseTimer = useCallback(async (timeEntryId: string, motivo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/timetracking/${timeEntryId}/pause`, { motivo });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao pausar tempo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resumeTimer = useCallback(async (timeEntryId: string, motivo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/timetracking/${timeEntryId}/resume`, { motivo });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao retomar tempo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const adjustTime = useCallback(async (timeEntryId: string, novoDuracaoMin: number, motivo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/timetracking/${timeEntryId}/adjust`, { novoDuracaoMin, motivo });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao ajustar tempo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Relatório / Dashboard ──
  const getTaskDashboard = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/report/dashboard', { params });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar dashboard de tarefas');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTaskReport = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/report/tasks', { params });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao gerar relatório');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Alertas ──
  const listAlerts = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/alerts', { params });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao listar alertas');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUnreadAlertsCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/kanban/alerts/unread-count');
      return response.data.total;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao contar alertas');
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  const markAlertRead = useCallback(async (alertaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/kanban/alerts/${alertaId}/read`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao marcar alerta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Equipes ──
  const listTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/teams');
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao listar equipes');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTeam = useCallback(async (data: { nome: string; descricao?: string; departamentoId?: string; liderId?: string; membros?: string[] }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/teams', data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar equipe');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTeam = useCallback(async (teamId: string, data: Partial<{ nome: string; descricao?: string; departamentoId?: string; liderId?: string; ativo?: boolean }>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/teams/${teamId}`, data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar equipe');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTeam = useCallback(async (teamId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/teams/${teamId}`);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao deletar equipe');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTeamMember = useCallback(async (teamId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/teams/${teamId}/membros`, { userId });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar membro');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTeamMember = useCallback(async (teamId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/teams/${teamId}/membros/${userId}`);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover membro');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    boards,
    currentBoard,
    loading,
    error,
    fetchBoards,
    fetchBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
    createColumn,
    deleteColumn,
    updateColumn,
    reorderColumns,
    createSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    getActivityLog,
    fetchTemplates,
    createBoardFromTemplate,
    uploadAttachments,
    deleteAttachment,
    createTag,
    deleteTag,
    createTaskFromTicket,
    transferTask,
    duplicateTask,
    setCurrentBoard,
    archiveTask,
    restoreTask,
    reopenTask,
    deleteTaskDefinitive,
    listArchivedTasks,
    getTaskDetail,
    getTaskTimeSummary,
    pauseTimer,
    resumeTimer,
    adjustTime,
    getTaskDashboard,
    getTaskReport,
    listAlerts,
    getUnreadAlertsCount,
    markAlertRead,
    listTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
  };
}
