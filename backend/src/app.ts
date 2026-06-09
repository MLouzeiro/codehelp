import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';

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
import departamentosRoutes from './modules/helpdesk/departamentos.routes';
import filasRoutes from './modules/helpdesk/filas.routes';
import auditRoutes from './modules/audit/audit.routes';
import kbRoutes from './modules/kb/kb.routes';
import csatRoutes from './modules/csat/csat.routes';
import automationsRoutes from './modules/automations/automations.routes';
import notificacoesRoutes from './modules/notificacoes/notificacoes.routes';
import permissionsRoutes from './modules/permissions/permissions.routes';
import feriadosRoutes from './modules/feriados/feriados.routes';

const isVercel = !!process.env.VERCEL;

const app = express();

app.use(cors({ origin: true, credentials: true }));
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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/helpdesk', departamentosRoutes);
app.use('/api/helpdesk', filasRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/csat', csatRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/feriados', feriadosRoutes);
app.use('/api/whatsapp', whatsappRoutes);

if (!isVercel) {
  app.use('/storage', express.static(path.resolve(__dirname, '../storage')));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

export default app;
