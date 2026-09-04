import prisma from '../../config/database';
import { env } from '../../config/env';

const CONFIG_SLUG = 'os_assinatura_config';

export interface OsSignatureConfig {
  baseUrl: string;
  tipo: 'dominio' | 'ip_local' | 'ip_publico' | 'automatico';
}

interface ConfigRecord {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  createdAt: Date;
  updatedAt: Date;
  configuradoPor?: string | null;
  configuradoPorNome?: string | null;
}

function sanitizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function isValidUrl(url: string): { ok: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { ok: false, error: 'URL e obrigatoria.' };
  }

  const cleaned = sanitizeUrl(url);

  if (cleaned.includes('javascript:') || cleaned.includes('data:') || cleaned.includes('file:')) {
    return { ok: false, error: 'Protocolo nao permitido.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return { ok: false, error: 'URL com formato invalido. Exemplo valido: https://os.empresa.com.br' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Apenas http:// e https:// sao permitidos.' };
  }

  if (!parsed.hostname || parsed.hostname.length < 3) {
    return { ok: false, error: 'Hostname invalido.' };
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return { ok: false, error: 'A URL base nao deve conter caminho. Use apenas protocolo + host + porta.' };
  }

  return { ok: true };
}

export async function getSignatureConfig(): Promise<{
  configurado: boolean;
  config: OsSignatureConfig | null;
  baseUrl: string;
 fonte: 'banco' | 'variavel_ambiente' | 'localhost';
  registro?: ConfigRecord;
}> {
  const record = await prisma.helpdeskConfig.findFirst({
    where: { slug: CONFIG_SLUG },
  });

  if (record && record.descricao) {
    try {
      const parsed = JSON.parse(record.descricao) as OsSignatureConfig;
      if (parsed.baseUrl) {
        const sanitized = sanitizeUrl(parsed.baseUrl);
        return {
          configurado: true,
          config: { baseUrl: sanitized, tipo: parsed.tipo || 'dominio' },
          baseUrl: sanitized,
         fonte: 'banco',
          registro: {
            id: record.id,
            slug: record.slug,
            nome: record.nome,
            descricao: record.descricao,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        };
      }
    } catch {
      // JSON invalido, ignora
    }
  }

  if (env.appUrl && !env.appUrl.includes('localhost')) {
    return {
      configurado: false,
      config: null,
      baseUrl: env.appUrl,
      fonte: 'variavel_ambiente',
    };
  }

  return {
    configurado: false,
    config: null,
    baseUrl: env.appUrl || 'http://localhost:3000',
    fonte: 'localhost',
  };
}

export async function getSignatureBaseUrl(): Promise<string> {
  const result = await getSignatureConfig();
  return result.baseUrl;
}

export async function updateSignatureConfig(
  data: OsSignatureConfig,
  usuarioId: string,
  usuarioNome: string,
): Promise<{ ok: boolean; config: OsSignatureConfig; baseUrl: string; error?: string }> {
  const cleaned = sanitizeUrl(data.baseUrl);
  const validation = isValidUrl(cleaned);
  if (!validation.ok) {
    return { ok: false, config: data, baseUrl: cleaned, error: validation.error };
  }

  const validTypes = ['dominio', 'ip_local', 'ip_publico', 'automatico'];
  const tipo = validTypes.includes(data.tipo) ? data.tipo : 'dominio';

  const payload: OsSignatureConfig = { baseUrl: cleaned, tipo };
  const jsonPayload = JSON.stringify(payload);

  const existing = await prisma.helpdeskConfig.findFirst({
    where: { slug: CONFIG_SLUG },
  });

  if (existing) {
    await prisma.helpdeskConfig.update({
      where: { id: existing.id },
      data: {
        descricao: jsonPayload,
        nome: 'Configuracao de Endereco Publico das OS',
      },
    });
  } else {
    await prisma.helpdeskConfig.create({
      data: {
        slug: CONFIG_SLUG,
        nome: 'Configuracao de Endereco Publico das OS',
        descricao: jsonPayload,
        cor: '#3b82f6',
        icone: 'link',
        ordem: 99,
      },
    });
  }

  console.log(`[OS SIGNATURE CONFIG] ${usuarioNome} (${usuarioId}) alterou endereco publico: ${cleaned} (${tipo})`);

  return { ok: true, config: payload, baseUrl: cleaned };
}

export async function testSignatureUrl(url: string): Promise<{
  ok: boolean;
  formatoValido: boolean;
  urlTestada: string;
  mensagem: string;
}> {
  const cleaned = sanitizeUrl(url);
  const validation = isValidUrl(cleaned);

  if (!validation.ok) {
    return {
      ok: false,
      formatoValido: false,
      urlTestada: cleaned,
      mensagem: validation.error!,
    };
  }

  const parsed = new URL(cleaned);
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const isPrivateIp = /^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(parsed.hostname);

  let mensagem = 'Formato valido.';
  if (isLocalhost) {
    mensagem += ' Atencao: localhost so funciona na mesma maquina.';
  } else if (isPrivateIp) {
    mensagem += ' IP privado detectado: acessivel apenas na mesma rede local.';
  }

  return {
    ok: true,
    formatoValido: true,
    urlTestada: `${cleaned}/assinar/exemplo-token`,
    mensagem,
  };
}
