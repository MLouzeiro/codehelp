// ── Database-level type (for CRUD operations) ─────────────────────────
export interface WhatsAppConnection {
  id: string;
  numero: string;
  slug: string;
  nome: string;
  departamentoId?: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
  departamento?: {
    id: string;
    nome: string;
    slug: string;
    cor: string;
  };
  _count?: {
    tickets: number;
  };
}

export interface WhatsAppConnectionInput {
  nome: string;
  numero: string;
  slug?: string;
  departamentoId?: string;
  ativo?: boolean;
}

// ── Runtime-level type (for in-memory connection state) ───────────────
// Using 'any' for client type to avoid whatsapp-web.js dependency
// Baileys uses WASocket, Evolution uses HTTP client
export interface WhatsAppConnectionRuntime {
  id: string;
  numero: string;
  nome: string;
  departamentoId?: string;
  client: any; // WASocket (Baileys) or null
  connected: boolean;
  qrCode: string | null;
  error: string | null;
  state: string;
  scanning: boolean;
  initializedAt: Date;
  lastMessageAt: Date | null;
  lastHeartbeat: number;
  processing: boolean;
}

export interface WhatsAppConnectionStatus {
  id: string;
  nome: string;
  numero: string;
  departamentoId?: string;
  connected: boolean;
  scanning: boolean;
  state: string;
  error: string | null;
  lastMessageAt: Date | null;
  lastHeartbeat: number;
  qrCode: string | null;
}
