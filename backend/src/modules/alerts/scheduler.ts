import cron from 'node-cron';
import { env } from '../../config/env';
import { sendWeeklyAlert } from './alerts.service';

export function startScheduler(): void {
  const cronExpression = `0 ${env.alertHour} * * ${env.alertDay}`;

  const valid = cron.validate(cronExpression);
  if (!valid) {
    console.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Running weekly alert...`);
    try {
      await sendWeeklyAlert();
      console.log(`[${new Date().toISOString()}] Weekly alert completed`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Weekly alert failed:`, error);
    }
  }, {
    timezone: env.timezone,
  });

  console.log(`Scheduler started: ${cronExpression} (${env.timezone})`);
}
