import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

// ── JWT Secrets — SEMPRE definir via env, sem fallback hardcoded ─────
if (!process.env.JWT_SECRET) {
  if (isProduction) {
    console.error('[ENV] ERRO CRITICO: JWT_SECRET nao definido em producao!');
    process.exit(1);
  } else {
    // Em dev, gerar secret aleatorio (nao reutilizar entre reinicios)
    const devSecret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = devSecret;
    console.warn('[ENV] JWT_SECRET nao definido — gerado secret aleatorio para dev. Adicione JWT_SECRET no .env para persistir.');
  }
}

if (!process.env.JWT_REFRESH_SECRET) {
  if (isProduction) {
    console.error('[ENV] ERRO CRITICO: JWT_REFRESH_SECRET nao definido em producao!');
    process.exit(1);
  } else {
    const devRefreshSecret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_REFRESH_SECRET = devRefreshSecret;
    console.warn('[ENV] JWT_REFRESH_SECRET nao definido — gerado secret aleatorio para dev.');
  }
}

// ── Webhook verify token — NUNCA usar valor previsivel ───────────────
if (!process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN) {
  if (isProduction) {
    console.error('[ENV] ERRO CRITICO: WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN nao definido!');
    process.exit(1);
  } else {
    process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN = crypto.randomBytes(24).toString('hex');
    console.warn('[ENV] WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN nao definido — gerado token aleatorio.');
  }
}

export const env = {
  port: parseInt(process.env.PORT || '3010', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:3010',
  alertWhatsappNumbers: (process.env.ALERT_WHATSAPP_NUMBERS || '').split(',').filter(Boolean),
  alertDay: parseInt(process.env.ALERT_DAY || '1', 10),
  alertHour: parseInt(process.env.ALERT_HOUR || '8', 10),
  timezone: process.env.TIMEZONE || 'America/Fortaleza',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  whatsappSessionPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session',
  whatsappChromePath: process.env.WHATSAPP_CHROME_PATH || '',
  // Evolution API (self-hosted Docker) - URL vazia = nao configurado
  evolutionApiUrl: process.env.EVOLUTION_API_URL || '',
  evolutionApiKey: process.env.EVOLUTION_API_KEY || '',
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || 'codehelp',
  // WhatsApp Cloud API (Meta Official)
  whatsappCloudPhoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || '',
  whatsappCloudAccessToken: process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || '',
  whatsappCloudApiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || 'v19.0',
  whatsappCloudWebhookVerifyToken: process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN,
  // Backend URL for webhooks
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3010',
};
