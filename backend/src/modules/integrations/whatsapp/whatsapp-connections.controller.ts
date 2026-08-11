import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as svc from './whatsapp-connections.service';
import { whatsappConnectionManager } from './whatsapp.service';
import { baileysProviderService } from './baileys-provider.service';

import { whatsappProviderFactory } from './whatsapp-provider-factory';
import prisma from '../../../config/database';
import path from 'path';
import fs from 'fs';

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listConnections(req: AuthRequest, res: Response) {
  try {
    const includeInativos = req.query.includeInativos === 'true';
    const connections = await svc.listConnections(includeInativos);
    return res.json(connections);
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao listar:', err?.message);
    return res.status(500).json({ error: 'Erro ao listar conexoes' });
  }
}

export async function getConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.getConnectionById(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar conexao' });
  }
}

export async function createConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.createConnection(req.body);
    return res.status(201).json(conn);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao criar conexao' });
  }
}

export async function updateConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.updateConnection(req.params.id, req.body);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar conexao' });
  }
}

export async function toggleConnection(req: AuthRequest, res: Response) {
  try {
    const conn = await svc.toggleConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json(conn);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao alternar conexao' });
  }
}

export async function deleteConnection(req: AuthRequest, res: Response) {
  try {
    const result = await svc.deleteConnection(req.params.id);
    if (!result) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.status(204).send();
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao deletar conexao' });
  }
}

// ── Runtime Operations (connect / disconnect / QR / status) ───────────

export async function connectConnection(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const dbConn = await svc.getConnectionById(id);
    if (!dbConn) return res.status(404).json({ error: 'Conexao nao encontrada' });

    const providerType = dbConn.provider || 'baileys';

    // Check if already connected for this connection
    const status = await whatsappProviderFactory.getConnectionStatus(id);
    if (status.connected) {
      return res.json({ message: `Conexao ${providerType} ja esta ativa`, provider: status.provider });
    }

    // Delegate to the correct provider
    whatsappProviderFactory.connectConnection(id).catch((err) => {
      console.error(`[WhatsAppConnections] Erro na conexao ${providerType} (${id}):`, err?.message || err);
    });

    res.json({ message: `Conexao ${providerType} iniciada. Aguardando QR Code...`, provider: providerType });
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao conectar:', err?.message);
    return res.status(500).json({ error: err.message || 'Erro ao conectar' });
  }
}

export async function disconnectConnection(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await whatsappProviderFactory.disconnectConnection(id);
    return res.json({ message: 'Conexao desconectada' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao desconectar' });
  }
}

export async function getConnectionStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const status = await whatsappProviderFactory.getConnectionStatus(id);
    
    // Get full connection details from DB
    const dbConn = await svc.getConnectionById(id);
    if (!dbConn) return res.status(404).json({ error: 'Conexao nao encontrada' });

    return res.json({
      id: dbConn.id,
      nome: dbConn.nome,
      numero: dbConn.numero,
      departamentoId: dbConn.departamentoId,
      connected: status.connected,
      scanning: !status.connected && !!status.qrCode,
      state: status.connected ? 'CONNECTED' : status.qrCode ? 'QR_RECEIVED' : 'DISCONNECTED',
      provider: status.provider,
      error: status.error,
      lastMessageAt: null,
      lastHeartbeat: null,
      qrCode: status.qrCode,
    });
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao buscar status:', err?.message);
    return res.status(500).json({ error: 'Erro ao buscar status' });
  }
}

export async function getQrCode(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const status = await whatsappProviderFactory.getConnectionStatus(id);
    
    return res.json({
      qrCode: status.qrCode || null,
      connected: status.connected || false,
      scanning: !status.connected && !!status.qrCode,
      provider: status.provider,
      error: status.error || null,
    });
  } catch {
    // Connection not in runtime yet — check if it exists in DB
    const dbConn = await svc.getConnectionById(req.params.id);
    if (!dbConn) return res.status(404).json({ error: 'Conexao nao encontrada' });
    return res.json({
      qrCode: null,
      connected: false,
      scanning: false,
      initializing: true,
      provider: dbConn.provider || 'baileys',
      error: null,
    });
  }
}

export async function regenerateQrCode(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const dbConn = await svc.getConnectionById(id);
    if (!dbConn) return res.status(404).json({ error: 'Conexao nao encontrada' });

    const providerType = dbConn.provider || 'baileys';

    // Return immediately — fire-and-forget
    res.json({ message: `Novo QR Code sendo gerado (${providerType}). Aguarde...`, provider: providerType });

    // Disconnect and reconnect via the correct provider in background
    (async () => {
      try {
        await whatsappProviderFactory.disconnectConnection(id);
        await new Promise((r) => setTimeout(r, 1000));
        await whatsappProviderFactory.connectConnection(id);
      } catch (err: any) {
        console.error(`[WhatsAppConnections] Erro ao regenerar QR ${providerType} (${id}):`, err?.message);
      }
    })();
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao regenerar QR Code' });
  }
}

export async function getAllConnectionsStatus(req: AuthRequest, res: Response) {
  try {
    const statuses = await whatsappProviderFactory.getAllConnectionsStatus();
    
    // Enrich with DB details
    const enrichedStatuses = await Promise.all(statuses.map(async (status) => {
      const dbConn = await svc.getConnectionById(status.connectionId);
      return {
        id: status.connectionId,
        nome: status.nome || dbConn?.nome || status.connectionId,
        numero: status.numero || dbConn?.numero || '',
        departamentoId: dbConn?.departamentoId || null,
        connected: status.connected,
        scanning: !status.connected && !!status.qrCode,
        state: status.connected ? 'CONNECTED' : status.qrCode ? 'QR_RECEIVED' : 'DISCONNECTED',
        provider: status.provider,
        error: status.error,
        lastMessageAt: null,
        lastHeartbeat: 0,
        qrCode: status.qrCode,
      };
    }));

    return res.json(enrichedStatuses);
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao buscar status das conexoes:', err?.message);
    return res.status(500).json({ error: 'Erro ao buscar status das conexoes' });
  }
}

// ── Force Reconnect: clean session + reconnect fresh ──────────────────

const SESSION_BASE_DIR_BAILEYS = path.resolve(process.env.WHATSAPP_SESSION_PATH || './whatsapp-session', 'baileys');
const SESSION_BASE_DIR_WEBJS = path.resolve(process.env.WHATSAPP_SESSION_PATH || './whatsapp-session', 'whatsapp-webjs');

export async function forceReconnect(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const dbConn = await svc.getConnectionById(id);
    if (!dbConn) return res.status(404).json({ error: 'Conexao nao encontrada' });

    const providerType = (dbConn.provider || 'baileys') as 'baileys' | 'whatsapp-webjs';

    // 1. Disconnect current session
    await whatsappProviderFactory.disconnectConnection(id);

    // 2. Clean session files for the correct provider
    const sessionDir = providerType === 'baileys'
      ? path.join(SESSION_BASE_DIR_BAILEYS, id)
      : path.join(SESSION_BASE_DIR_WEBJS, `session-${id.slice(0, 16)}`);

    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[WhatsAppConnections] Session ${providerType} cleaned for ${dbConn.nome} (${id})`);
      }
    } catch (err: any) {
      console.error(`[WhatsAppConnections] Error cleaning ${providerType} session:`, err?.message);
    }

    // 3. Wait a moment
    await new Promise((r) => setTimeout(r, 2000));

    // 4. Reconnect fresh via the correct provider
    whatsappProviderFactory.connectConnection(id).catch((err) => {
      console.error(`[WhatsAppConnections] Erro na reconexao forceada ${providerType} (${id}):`, err?.message || err);
    });

    return res.json({ message: `Sessao ${providerType} limpa. Novo QR Code sendo gerado...`, provider: providerType });
  } catch (err: any) {
    console.error('[WhatsAppConnections] Erro ao forcar reconexao:', err?.message);
    return res.status(500).json({ error: err.message || 'Erro ao forcar reconexao' });
  }
}
