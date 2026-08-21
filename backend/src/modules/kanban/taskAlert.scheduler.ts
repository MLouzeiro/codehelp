import { verificarAlertas } from './taskAlert.service';

let taskAlertTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Roda a verificacao de alertas de tarefas periodicamente.
 * - A cada 30 minutos: prazo proximo/atencao/atrasada, sem movimentacao, reaberta.
 */
export function startTaskAlertScheduler() {
  if (taskAlertTimer) return;

  const run = async () => {
    try {
      const criados = await verificarAlertas();
      if (criados.length > 0) {
        console.log(`[TaskAlert] ${criados.length} alerta(s) gerado(s)`);
      }
    } catch (err: any) {
      console.error('[TaskAlert] Erro no scheduler de alertas:', err?.message || err);
    }
  };

  // Roda uma vez logo ao iniciar e depois a cada 30 minutos
  setTimeout(run, 15 * 1000);
  taskAlertTimer = setInterval(run, 30 * 60 * 1000);
}

export function stopTaskAlertScheduler() {
  if (taskAlertTimer) {
    clearInterval(taskAlertTimer);
    taskAlertTimer = null;
  }
}