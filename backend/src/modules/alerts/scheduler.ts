import cron from 'node-cron';
import { env } from '../../config/env';
import { enviarRelatorioSemanalWhatsApp } from '../analytics/weeklyReport.service';
import { verificarTicketsAtrasados, verificarPrazoProximo } from './alerts.service';

export function startScheduler(): void {
  const cronExpression = `0 ${env.alertHour} * * ${env.alertDay}`;

  const valid = cron.validate(cronExpression);
  if (!valid) {
    console.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Running weekly report...`);
    try {
      await enviarRelatorioSemanalWhatsApp();
      console.log(`[${new Date().toISOString()}] Weekly report completed`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Weekly report failed:`, error);
    }
  }, {
    timezone: env.timezone,
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      await Promise.all([
        verificarTicketsAtrasados(),
        verificarPrazoProximo(),
      ]);
    } catch (error) {
      console.error('[Scheduler] Erro ao verificar prazos:', error);
    }
  });

  console.log(`Scheduler started: ${cronExpression} (${env.timezone})`);
  console.log('Deadline alert scheduler: every 10 minutes');
}
