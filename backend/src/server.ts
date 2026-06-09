import app from './app';
import { env } from './config/env';
import { startScheduler } from './modules/alerts/scheduler';
import { initializeClient } from './modules/integrations/whatsapp/whatsapp.service';
import { ensureHelpdeskConfigs, migrateLegacyTickets, migrateLegacyTriagemConfig } from './modules/helpdesk/helpdesk.service';

async function start() {
  try {
    const { default: prisma } = await import('./config/database');
    await prisma.$connect();
    console.log('Database connected');

    try {
      const { redis } = await import('./config/redis');
    } catch {
      console.log('Redis: not available');
    }

    startScheduler();
    await ensureHelpdeskConfigs();
    await migrateLegacyTickets();
    await migrateLegacyTriagemConfig();
    const { ensureHelpdeskRules } = await import('./modules/helpdesk/rules.service');
    await ensureHelpdeskRules();
    const { ensureHelpdeskEntities, migrateCategoriaStringToFK } = await import('./modules/helpdesk/seed.service');
    await ensureHelpdeskEntities();
    await migrateCategoriaStringToFK();
    const { migrarStatusETickets } = await import('./modules/helpdesk/status.service');
    await migrarStatusETickets();
    const { startSlaScheduler } = await import('./modules/helpdesk/sla.scheduler');
    startSlaScheduler();
    const { startCsatScheduler } = await import('./modules/csat/csat.scheduler');
    startCsatScheduler();
    initializeClient().catch((err) => console.error('WhatsApp init error:', err));

    app.listen(env.port, () => {
      console.log(`Codemed Hub API running on http://localhost:${env.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
