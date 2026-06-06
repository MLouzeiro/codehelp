import cron from 'node-cron';
import { processarAgendamentosCsat } from './csat.service';

const CRON_EXPRESSION = '*/10 * * * *';

let started = false;

export function startCsatScheduler(): void {
  if (started) return;
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[CSAT Scheduler] Expressao cron invalida: ${CRON_EXPRESSION}`);
    return;
  }
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const r = await processarAgendamentosCsat();
      if (r.agendados > 0 || r.enviados > 0) {
        console.log(`[CSAT Scheduler] ${r.agendados} agendados, ${r.enviados} enviados, ${r.erros} erros`);
      }
    } catch (err: any) {
      console.error('[CSAT Scheduler] Erro:', err?.message || err);
    }
  });
  started = true;
  console.log(`[CSAT Scheduler] Iniciado (${CRON_EXPRESSION})`);
}
