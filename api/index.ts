import type { IncomingMessage, ServerResponse } from 'http';
import app from '../backend/src/app';

let prismaConnected = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!prismaConnected) {
    try {
      const { default: prisma } = await import('../backend/src/config/database');
      await prisma.$connect();
      prismaConnected = true;
    } catch (err) {
      console.error('Prisma connect error:', err);
    }
  }

  return app(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
