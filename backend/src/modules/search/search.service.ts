import prisma from '../../config/database';

export interface SearchFilters {
  q: string;
  tipo?: 'todos' | 'clientes' | 'tickets' | 'usuarios' | 'kb';
  limit?: number;
}

export interface SearchResult {
  id: string;
  tipo: 'cliente' | 'ticket' | 'usuario' | 'kb';
  titulo: string;
  subtitulo?: string;
  detalhes?: string;
  rota?: string;
  score: number;
  icone: string;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

function scoreMatch(text: string, terms: string[]): number {
  if (!text) return 0;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let score = 0;
  for (const term of terms) {
    if (normalized.includes(term)) {
      score += 10;
      if (normalized.startsWith(term)) score += 5;
      if (normalized === term) score += 10;
    }
  }
  return score;
}

function orCondition(field: string, terms: string[]) {
  return terms.map(term => ({
    [field]: { contains: term, mode: 'insensitive' as const },
  }));
}

export async function globalSearch(filters: SearchFilters): Promise<SearchResult[]> {
  const { q, tipo = 'todos', limit = 20 } = filters;
  if (!q?.trim()) return [];

  const terms = tokenize(q);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  const searchClients = tipo === 'todos' || tipo === 'clientes';
  const searchTickets = tipo === 'todos' || tipo === 'tickets';
  const searchUsuarios = tipo === 'todos' || tipo === 'usuarios';
  const searchKB = tipo === 'todos' || tipo === 'kb';

  const queries: Promise<any[]>[] = [];

  if (searchClients) {
    queries.push(
      prisma.client.findMany({
        where: {
          OR: [
            ...orCondition('razaoSocial', terms),
            ...orCondition('nomeFantasia', terms),
            ...orCondition('cnpjCpf', terms),
            ...orCondition('email', terms),
            ...orCondition('telefone', terms),
          ],
        },
        take: limit,
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpjCpf: true,
          telefone: true,
          email: true,
          segmento: true,
          cidade: true,
          estado: true,
        },
      })
    );
  }

  if (searchTickets) {
    queries.push(
      prisma.ticket.findMany({
        where: {
          OR: [
            ...orCondition('protocolo', terms),
            ...orCondition('assunto', terms),
            ...orCondition('contactName', terms),
            ...orCondition('contactPhone', terms),
            ...orCondition('observacoes', terms),
            ...orCondition('resumoFinal', terms),
            ...orCondition('motivoStatus', terms),
            ...orCondition('categoria', terms),
          ],
        },
        take: limit,
        include: {
          client: { select: { razaoSocial: true, nomeFantasia: true } },
          assignee: { select: { name: true } },
          departamento: { select: { nome: true, cor: true } },
        },
      })
    );
  }

  if (searchUsuarios) {
    queries.push(
      prisma.user.findMany({
        where: {
          OR: [
            ...orCondition('name', terms),
            ...orCondition('email', terms),
            ...orCondition('phone', terms),
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          active: true,
        },
      })
    );
  }

  if (searchKB) {
    queries.push(
      prisma.kBArticle.findMany({
        where: {
          publicado: true,
          OR: [
            ...orCondition('titulo', terms),
            ...orCondition('conteudo', terms),
            ...orCondition('resumo', terms),
            ...orCondition('tags', terms),
          ],
        },
        take: limit,
        include: {
          categoria: { select: { nome: true, cor: true } },
          autor: { select: { name: true } },
        },
      })
    );
  }

  const allResults = await Promise.all(queries);
  const [clients = [], tickets = [], usuarios = [], kbs = []] = allResults;

  for (const c of clients) {
    const score = scoreMatch(c.razaoSocial, terms) + scoreMatch(c.nomeFantasia, terms) * 0.8 + scoreMatch(c.cnpjCpf, terms) * 0.6 + scoreMatch(c.email, terms) * 0.5;
    results.push({
      id: c.id,
      tipo: 'cliente',
      titulo: c.nomeFantasia || c.razaoSocial,
      subtitulo: c.razaoSocial !== c.nomeFantasia ? c.razaoSocial : undefined,
      detalhes: [c.cnpjCpf, c.telefone, c.email, c.segmento, [c.cidade, c.estado].filter(Boolean).join('-')].filter(Boolean).join(' | '),
      rota: `/app/crm/${c.id}`,
      score,
      icone: 'user',
    });
  }

  for (const t of tickets) {
    const score = scoreMatch(t.protocolo, terms) + scoreMatch(t.assunto, terms) + scoreMatch(t.contactName, terms) * 0.8 + scoreMatch(t.observacoes, terms) * 0.5;
    const deptColor = t.departamento?.cor || '#64748b';
    results.push({
      id: t.id,
      tipo: 'ticket',
      titulo: `${t.protocolo || 'S/PROTOCOLO'} — ${t.assunto || t.contactName || 'Sem assunto'}`,
      subtitulo: t.client?.razaoSocial || t.client?.nomeFantasia || t.contactName || undefined,
      detalhes: [
        t.etapa?.replace(/_/g, ' '),
        t.prioridade,
        t.assignee?.name,
        t.departamento?.nome,
      ].filter(Boolean).join(' | '),
      rota: `/app/helpdesk`,
      score,
      icone: 'ticket',
    });
  }

  for (const u of usuarios) {
    const score = scoreMatch(u.name, terms) + scoreMatch(u.email, terms) + scoreMatch(u.phone, terms) * 0.5;
    results.push({
      id: u.id,
      tipo: 'usuario',
      titulo: u.name,
      subtitulo: u.email,
      detalhes: [u.role, u.phone].filter(Boolean).join(' | '),
      rota: `/app/settings/users`,
      score,
      icone: 'users',
    });
  }

  for (const k of kbs) {
    const score = scoreMatch(k.titulo, terms) * 1.2 + scoreMatch(k.resumo, terms) * 0.8 + scoreMatch(k.tags, terms) * 0.6 + scoreMatch(k.conteudo, terms) * 0.3;
    results.push({
      id: k.id,
      tipo: 'kb',
      titulo: k.titulo,
      subtitulo: k.categoria?.nome || undefined,
      detalhes: [k.resumo?.slice(0, 120), k.autor?.name].filter(Boolean).join(' | '),
      rota: `/app/kb`,
      score,
      icone: 'book',
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function getSearchSuggestions(q: string): Promise<string[]> {
  if (!q?.trim() || q.length < 2) return [];

  const terms = tokenize(q);
  if (terms.length === 0) return [];

  const suggestions: string[] = [];

  const [clients, tickets, kbs] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          ...orCondition('razaoSocial', terms),
          ...orCondition('nomeFantasia', terms),
        ],
      },
      take: 5,
      select: { razaoSocial: true, nomeFantasia: true },
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          ...orCondition('protocolo', terms),
          ...orCondition('assunto', terms),
        ],
      },
      take: 5,
      select: { protocolo: true, assunto: true },
    }),
    prisma.kBArticle.findMany({
      where: {
        publicado: true,
        OR: orCondition('titulo', terms),
      },
      take: 5,
      select: { titulo: true },
    }),
  ]);

  for (const c of clients) {
    if (c.nomeFantasia) suggestions.push(c.nomeFantasia);
    if (c.razaoSocial && c.razaoSocial !== c.nomeFantasia) suggestions.push(c.razaoSocial);
  }
  for (const t of tickets) {
    if (t.protocolo) suggestions.push(t.protocolo);
    if (t.assunto) suggestions.push(t.assunto);
  }
  for (const k of kbs) {
    suggestions.push(k.titulo);
  }

  const unique = [...new Set(suggestions)].slice(0, 8);
  return unique;
}
