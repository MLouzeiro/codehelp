import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';

import authRoutes from './modules/auth/auth.routes';
import crmRoutes from './modules/crm/crm.routes';
import ordersRoutes from './modules/orders/orders.routes';
import whatsappRoutes from './modules/integrations/whatsapp/whatsapp.routes';
import whatsappConnectionsRoutes from './modules/integrations/whatsapp/whatsapp-connections.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import weeklyReportRoutes from './modules/analytics/weeklyReport.routes';
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
import searchRoutes from './modules/search/search.routes';
import aprovacoesRoutes from './modules/aprovacoes/aprovacao.routes';
import billingRoutes from './modules/billing/billing.routes';
import timetrackingRoutes from './modules/timetracking/timetracking.routes';
import auditTicketRoutes from './modules/helpdesk/auditTicket.routes';
import checklistRoutes from './modules/helpdesk/checklist.routes';
import checklistTemplateRoutes from './modules/helpdesk/checklist-template.routes';
import channelRoutes from './modules/integrations/channels/channel.routes';
import channelMessageRoutes from './modules/integrations/channels/channel-message.routes';
import emailRoutes from './modules/integrations/email/email.routes';
import instagramRoutes from './modules/integrations/instagram/instagram.routes';
import facebookRoutes from './modules/integrations/facebook/facebook.routes';
import telegramRoutes from './modules/integrations/telegram/telegram.routes';

const isVercel = !!process.env.VERCEL;

const app = express();

// ── Security Headers (Helmet) ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isVercel ? undefined : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS — Whitelist de origens (nao usar wildcard em producao) ─────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    console.warn(`[CORS] Requisicao bloqueada de origem: ${origin}`);
    return callback(new Error('Origem nao permitida pelo CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── CSRF Protection ──────────────────────────────────────────────────
// Ignorar CSRF para webhooks (Meta, Evolution) e login (primeira autenticacao)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

const csrfExcludedPaths = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/me',
  '/api/whatsapp/cloud/webhook',
  '/api/whatsapp/evolution/webhook',
  '/api/channels/webhook',
  '/api/health',
  '/api/csrf-token',
];

// ── CSRF: so aplicar em rotas que NAO tem autenticacao JWT ───────────
// Rotas com authenticate ja estao protegidas por JWT — CSRF e redundante
app.use((req, res, next) => {
  // Ignorar CSRF para metodos seguros
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  // Ignorar para paths excluidos
  if (csrfExcludedPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }
  // Ignorar para rotas autenticadas (ja tem JWT)
  // O token JWT no header Authorization protege contra CSRF
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }
  // Aplicar CSRF apenas para requisicoes sem autenticacao
  return csrfProtection(req, res, next);
});

// Endpoint para obter o token CSRF (frontend chama isso ao carregar)
// Executa o middleware CSRF apenas neste endpoint para gerar o token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: (req as any).csrfToken() });
});

// ── Global Rate Limiter ──────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em 1 minuto.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Muitas tentativas de refresh. Tente novamente.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics', weeklyReportRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/helpdesk', checklistRoutes);
app.use('/api/helpdesk', checklistTemplateRoutes);
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
app.use('/api/whatsapp', whatsappConnectionsRoutes);
app.use('/api/aprovacoes', aprovacoesRoutes);
app.use('/api/timetracking', timetrackingRoutes);
app.use('/api/audit-ticket', auditTicketRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/channels/messages', channelMessageRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api', billingRoutes);
app.use('/api', searchRoutes);

if (!isVercel) {
  // ── Static files com autenticacao ──────────────────────────────────
  // Proteger /storage e /uploads com verificacao de token
  const staticAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Permitir acesso sem auth para arquivos publicos (avatars, etc)
    // Mas bloquear acesso a PDFs e docs sensiveis
    const filePath = req.path.toLowerCase();
    const isSensitive = filePath.endsWith('.pdf') || filePath.endsWith('.doc') || filePath.endsWith('.docx');

    if (isSensitive) {
      // Verificar token via query param ou cookie
      const token = req.query.token as string || req.cookies?.csrfToken;
      if (!token) {
        return res.status(401).json({ error: 'Autenticacao necessaria para acessar este arquivo' });
      }
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, env.jwtSecret);
        next();
      } catch {
        return res.status(401).json({ error: 'Token invalido' });
      }
    } else {
      next();
    }
  };

  app.use('/storage', staticAuth, express.static(path.resolve(__dirname, '../storage')));
  app.use('/uploads', staticAuth, express.static(path.resolve(__dirname, '../uploads')));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

export default app;
