import app from './app';
import { env } from './config/env';
import { startScheduler } from './modules/alerts/scheduler';
import { whatsappProviderFactory } from './modules/integrations/whatsapp/whatsapp-provider-factory';
import { ensureHelpdeskConfigs, migrateLegacyTickets, migrateLegacyTriagemConfig } from './modules/helpdesk/helpdesk.service';

const MAX_DB_RETRIES = 10;
const DB_RETRY_DELAY_MS = 3000;

let dbConnected = false;
let isShuttingDown = false;

async function connectToDatabaseWithRetry(): Promise<void> {
  const { default: prisma } = await import('./config/database');
  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    try {
      await prisma.$connect();
      console.log(`[DB] Conectado (tentativa ${attempt}/${MAX_DB_RETRIES})`);
      dbConnected = true;
      return;
    } catch (error: any) {
      console.error(`[DB] Tentativa ${attempt}/${MAX_DB_RETRIES} falhou: ${error.message || error}`);
      if (attempt < MAX_DB_RETRIES) {
        await new Promise((r) => setTimeout(r, DB_RETRY_DELAY_MS));
      }
    }
  }
  console.warn('[DB] Banco indisponivel — servidor rodando sem banco. Algumas rotas retornarao erro.');
}

async function runBackgroundInit() {
  try { const { redis } = await import('./config/redis'); } catch { /* no redis */ }

  await Promise.all([
    ensureHelpdeskConfigs(),
    migrateLegacyTickets(),
    migrateLegacyTriagemConfig(),
    import('./modules/helpdesk/rules.service').then(m => m.ensureHelpdeskRules()),
    import('./modules/helpdesk/seed.service').then(async m => {
      await m.ensureHelpdeskEntities();
      await m.migrateCategoriaStringToFK();
    }),
    import('./modules/helpdesk/status.service').then(m => m.migrarStatusETickets()),
  ]);
  console.log('[Startup] Seed/migrate concluido');

  startScheduler();
  const { startSlaScheduler } = await import('./modules/helpdesk/sla.scheduler');
  startSlaScheduler();
  const { startResponseTimer } = await import('./modules/helpdesk/responseTimer.service');
  startResponseTimer();
  const { startCsatScheduler } = await import('./modules/csat/csat.scheduler');
  startCsatScheduler();
  const { startBillingScheduler } = await import('./modules/billing/billing.scheduler');
  startBillingScheduler();
  const { startTaskAlertScheduler } = await import('./modules/kanban/taskAlert.scheduler');
  startTaskAlertScheduler();
  const { startRobotScheduler } = await import('./modules/ai/robot.scheduler');
  startRobotScheduler();

  // WhatsApp — reconexao automatica usando o factory (provider por conexao)
  try {
    await whatsappProviderFactory.reconnectAllActive();
    console.log('[Startup] WhatsApp: reconexao automatica concluida');
  } catch (err: any) {
    console.error('[Startup] WhatsApp reconexao falhou:', err?.message || err);
  }

  console.log('[Startup] Background init completo');
}

async function start() {
  // Start DB connection in background (non-blocking)
  connectToDatabaseWithRetry().catch(() => {});

  // Start server immediately — don't wait for DB
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`Codemed Hub API running on http://0.0.0.0:${env.port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPorta ${env.port} ja esta em uso.`);
      process.exit(1);
    }
    throw err;
  });

  // ── Graceful shutdown ────────────────────────────────────────────────
  // Only clean up Baileys/whatsapp-web connections (in-memory).
  // Evolution API sessions are external and persist across Node restarts.
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    const isHotReload = process.env.NODE_ENV !== 'production';
    console.log(`[Shutdown] ${signal} recebido. Modo: ${isHotReload ? 'hot-reload (dev)' : 'producao'}`);

    // Close HTTP server (stop accepting new requests)
    server.close(() => {
      console.log('[Shutdown] HTTP server fechado');
    });

    // Disconnect all WhatsApp connections using the factory
    try {
      await whatsappProviderFactory.disconnectAll();
      console.log('[Shutdown] WhatsApp disconnect OK');
    } catch { /* ignore */ }

    // Force exit after 5s if cleanup hangs
    setTimeout(() => {
      console.warn('[Shutdown] Timeout — force exit');
      process.exit(0);
    }, 5000).unref();

    // If hot-reload, exit immediately (tsx watch will restart)
    if (isHotReload) {
      console.log('[Shutdown] Hot-reload detectado — exit imediato');
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Wait for DB, then run background init
  (async () => {
    // Wait up to 40s for DB to connect
    for (let i = 0; i < 40; i++) {
      if (dbConnected) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!dbConnected) {
      console.warn('[Startup] DB nao conectou em 40s — pulando background init');
      return;
    }
    await runBackgroundInit();
  })().catch(err => console.error('[Startup] Background init error:', err));
}

start();
