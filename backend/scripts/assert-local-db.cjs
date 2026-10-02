#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function readEnvValue(file, key) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[1] === key) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  }
  return null;
}

function parseUrl(url) {
  const m = /^postgres(?:ql)?:\/\/(?:[^@/]+)@([^/:]+)(?::(\d+))?\/([^?\s]*)/.exec(url || '');
  if (!m) return null;
  return { host: m[1], port: m[2] || '5432', database: (m[3] || '').split('?')[0] };
}

function main() {
  const file = path.resolve(__dirname, '..', '.env');
  const url = readEnvValue(file, 'DATABASE_URL') || process.env.DATABASE_URL;
  if (!url) {
    console.error('[DB-GUARD] DATABASE_URL nao encontrada em backend/.env');
    process.exit(1);
  }
  const info = parseUrl(url);
  if (!info) {
    console.error('[DB-GUARD] DATABASE_URL com formato nao reconhecido');
    process.exit(1);
  }
  const isLocal = LOCAL_HOSTS.has(info.host);
  if (isLocal) {
    console.log(`[DB-GUARD] OK - banco LOCAL (${info.host}:${info.port}/${info.database})`);
    process.exit(0);
  }
  if (process.env.ALLOW_REMOTE_DB === '1') {
    console.warn(`[DB-GUARD] AVISO - banco REMOTO (${info.host}) liberado por ALLOW_REMOTE_DB=1`);
    process.exit(0);
  }
  console.error(`[DB-GUARD] BLOQUEADO - DATABASE_URL aponta para banco REMOTO (${info.host}).`);
  console.error('[DB-GUARD] Operacoes de desenvolvimento rodam apenas contra banco LOCAL (Docker).');
  console.error('[DB-GUARD] Se realmente for necessario, execute com ALLOW_REMOTE_DB=1.');
  process.exit(1);
}

main();
