import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { startScheduler } from './modules/alerts/scheduler';
import { initializeClient } from './modules/integrations/whatsapp/whatsapp.service';
import { ensureHelpdeskConfigs, migrateLegacyTickets, migrateLegacyTriagemConfig } from './modules/helpdesk/helpdesk.service';

import authRoutes from './modules/auth/auth.routes';
import crmRoutes from './modules/crm/crm.routes';
import ordersRoutes from './modules/orders/orders.routes';
import whatsappRoutes from './modules/integrations/whatsapp/whatsapp.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import kanbanRoutes from './modules/kanban/kanban.routes';
import alertsRoutes from './modules/alerts/alerts.routes';
import aiRoutes from './modules/ai/ai.routes';
import usersRoutes from './modules/users/users.routes';
import helpdeskRoutes from './modules/helpdesk/helpdesk.routes';
import auditRoutes from './modules/audit/audit.routes';
import kbRoutes from './modules/kb/kb.routes';
import csatRoutes from './modules/csat/csat.routes';
import automationsRoutes from './modules/automations/automations.routes';
import notificacoesRoutes from './modules/notificacoes/notificacoes.routes';

const app = express();

app.use(cors({ origin: env.appUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Tente novamente em 1 hora.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/csat', csatRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/notificacoes', notificacoesRoutes);

app.use('/storage', express.static(path.resolve(__dirname, '../storage')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/whatsapp-public-status', async (req, res) => {
  try {
    const {
      isClientConnected, getQrCodeData, getConnectionError,
      getLastMessageAt, getWhatsAppState, getClient,
    } = await import('./modules/integrations/whatsapp/whatsapp.service');
    let state: string | null = null;
    try {
      const c = getClient();
      if (c) state = await c.getState();
    } catch { /* ignore */ }
    res.json({
      connected: isClientConnected(),
      hasQrCode: !!getQrCodeData(),
      error: getConnectionError(),
      state,
      clientExists: getClient() !== null,
      ultimaMensagem: getLastMessageAt(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro' });
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

async function start() {
  try {
    const { default: prisma } = await import('./config/database');
    await prisma.$connect();
    console.log('SQLite connected');

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
