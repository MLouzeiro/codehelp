// ── Normalização de Texto (UTF-8 / Acentuação) ──────────────────────────
// Utilitário centralizado para busca tolerante a acentos.
// NUNCA usar para alterar dados exibidos — apenas para comparação/busca.

/**
 * Remove acentos/diacríticos de um texto via Unicode NFD.
 * Preserva o texto original; use APENAS para comparação.
 *
 * Exemplo:
 *   normalizeText('São Luís')  → 'sao luis'
 *   normalizeText('Márcio')    → 'marcio'
 *   normalizeText('Conexão')   → 'conexao'
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Gera slug acento-safe (para URLs, identifiers).
 * Remove acentos, converte para kebab-case, limita tamanho.
 */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/**
 * Gera slug kebab-case (para identifiers internos).
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Busca tolerante a acentos: verifica se a query (normalizada)
 * aparece dentro do texto (normalizado).
 *
 * Exemplo:
 *   matchAccent('São Luís', 'Sao Luis')  → true
 *   matchAccent('Márcio', 'Marcio')       → true
 *   matchAccent('Conexão', 'Conexao')     → true
 */
export function matchAccent(text: string | null | undefined, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!text) return false;
  return normalizeText(text).includes(normalizeText(query));
}

/**
 * Busca em múltiplos campos, tolerante a acentos.
 */
export function matchAccentMultiple(fields: (string | null | undefined)[], query: string): boolean {
  if (!query || !query.trim()) return true;
  return fields.some(field => matchAccent(field, query));
}

/**
 * Comparação locale-aware para português brasileiro.
 * Use para ordenação alfabética de nomes em PT-BR.
 *
 * Exemplo:
 *   items.sort((a, b) => comparePtBR(a.name, b.name))
 */
export function comparePtBR(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Tokeniza texto para busca: normaliza, separa por espaços, filtra tokens curtos.
 */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length >= 2);
}
