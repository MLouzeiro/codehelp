export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchSearch(text: string | null | undefined, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!text) return false;
  return normalizeText(text).includes(normalizeText(query));
}

export function matchSearchMultiple(fields: (string | null | undefined)[], query: string): boolean {
  if (!query || !query.trim()) return true;
  return fields.some(field => matchSearch(field, query));
}
