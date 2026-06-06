import cron from 'node-cron';
import { processarAlertasSLA } from './sla.service';

const CRON_EXPRESSION = '*/5 * * * *';

let started = false;

export function startSlaScheduler(): void {
  if (started) return;
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[SLA Scheduler] Expressao cron invalida: ${CRON_EXPRESSION}`);
    return;
  }
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const gerados = await processarAlertasSLA();
      if (gerados.length > 0) {
        console.log(`[SLA Scheduler] ${gerados.length} alertas gerados em ${new Date().toISOString()}`);
      }
    } catch (err: any) {
      console.error('[SLA Scheduler] Erro ao processar alertas:', err?.message || err);
    }
  });
  started = true;
  console.log(`[SLA Scheduler] Iniciado (${CRON_EXPRESSION})`);
}
