import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3010', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
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
};
