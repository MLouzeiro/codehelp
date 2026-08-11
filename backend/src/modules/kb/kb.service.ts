import prisma from '../../config/database';

export interface KbCreateInput {
  slug?: string;
  titulo: string;
  conteudo: string;
  resumo?: string | null;
  categoriaId?: string | null;
  tags?: string;
  autorId?: string | null;
  publicado?: boolean;
  ordem?: number;
  passos?: string | null;  // JSON array of { titulo, descricao, imagemUrl? }
  imagens?: string | null; // JSON array of image URLs
}

export interface KbUpdateInput {
  titulo?: string;
  conteudo?: string;
  resumo?: string | null;
  categoriaId?: string | null;
  tags?: string;
  publicado?: boolean;
  ordem?: number;
  passos?: string | null;
  imagens?: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function slugUnico(base: string, ignoreId?: string): Promise<string> {
  let slug = slugify(base) || `kb-${Date.now()}`;
  let tentativas = 0;
  while (tentativas < 100) {
    const existente = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!existente || existente.id === ignoreId) return slug;
    tentativas++;
    slug = `${slugify(base)}-${tentativas}`;
  }
  return `${slugify(base)}-${Date.now()}`;
}

export async function criarKb(input: KbCreateInput) {
  const slugFinal = input.slug ? await slugUnico(input.slug) : await slugUnico(input.titulo);
  const article = await prisma.kBArticle.create({
    data: {
      slug: slugFinal,
      titulo: input.titulo,
      conteudo: input.conteudo,
      resumo: input.resumo ?? null,
      categoriaId: input.categoriaId ?? null,
      tags: input.tags ?? '',
      autorId: input.autorId ?? null,
      publicado: input.publicado ?? false,
      ordem: input.ordem ?? 0,
      passos: input.passos ?? null,
      imagens: input.imagens ?? null,
    },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
  // Create initial version
  await salvarVersao(article.id, article, input.autorId ?? null);
  return article;
}

export async function atualizarKb(id: string, input: KbUpdateInput, autorId?: string | null) {
  const existing = await prisma.kBArticle.findUnique({ where: { id } });
  if (!existing) throw new Error('Artigo nao encontrado');

  const data: any = {};
  if (input.titulo !== undefined) data.titulo = input.titulo;
  if (input.conteudo !== undefined) data.conteudo = input.conteudo;
  if (input.resumo !== undefined) data.resumo = input.resumo;
  if (input.categoriaId !== undefined) data.categoriaId = input.categoriaId;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.publicado !== undefined) data.publicado = input.publicado;
  if (input.ordem !== undefined) data.ordem = input.ordem;
  if (input.passos !== undefined) data.passos = input.passos;
  if (input.imagens !== undefined) data.imagens = input.imagens;

  // Only create version if content actually changed
  const contentChanged = input.titulo !== undefined || input.conteudo !== undefined
    || input.passos !== undefined || input.imagens !== undefined;

  if (contentChanged) {
    const newVersion = existing.versaoAtual + 1;
    data.versaoAtual = newVersion;
    // Save version snapshot before updating
    await salvarVersao(id, {
      titulo: input.titulo ?? existing.titulo,
      conteudo: input.conteudo ?? existing.conteudo,
      resumo: input.resumo ?? existing.resumo,
      passos: input.passos ?? existing.passos,
      imagens: input.imagens ?? existing.imagens,
    }, autorId ?? existing.autorId, newVersion);
  }

  return prisma.kBArticle.update({
    where: { id },
    data,
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function deletarKb(id: string) {
  return prisma.kBArticle.update({ where: { id }, data: { ativo: false } });
}

export async function publicarKb(id: string, publicado: boolean) {
  return prisma.kBArticle.update({
    where: { id },
    data: { publicado },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function marcarUtil(id: string, util: boolean) {
  return prisma.kBArticle.update({
    where: { id },
    data: util ? { util: { increment: 1 } } : { inutil: { increment: 1 } },
  });
}

export async function registrarVisualizacao(id: string) {
  return prisma.kBArticle.update({
    where: { id },
    data: { visualizacoes: { increment: 1 } },
  });
}

export interface KbListFilters {
  categoriaId?: string;
  publicado?: boolean;
  tag?: string;
  busca?: string;
  limit?: number;
  offset?: number;
}

export async function listarKb(filters: KbListFilters = {}) {
  const where: any = { ativo: true };
  if (filters.categoriaId) where.categoriaId = filters.categoriaId;
  if (filters.publicado !== undefined) where.publicado = filters.publicado;
  if (filters.tag) where.tags = { contains: filters.tag };
  if (filters.busca) {
    where.OR = [
      { titulo: { contains: filters.busca } },
      { conteudo: { contains: filters.busca } },
      { resumo: { contains: filters.busca } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.kBArticle.findMany({
      where,
      include: { categoria: true, autor: { select: { id: true, name: true } } },
      orderBy: [{ publicado: 'desc' }, { ordem: 'asc' }, { createdAt: 'desc' }],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.kBArticle.count({ where }),
  ]);
  return { items, total };
}

export async function getKb(id: string) {
  return prisma.kBArticle.findUnique({
    where: { id },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function getKbPorSlug(slug: string) {
  return prisma.kBArticle.findUnique({
    where: { slug },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function sugerirKbParaTicket(ticketId: string, limite: number = 5) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { categoriaRef: true, messages: { orderBy: { createdAt: 'desc' }, take: 3 } },
  });
  if (!ticket) return [];
  const termos: string[] = [];
  if (ticket.assunto) termos.push(ticket.assunto);
  if (ticket.categoriaRef) termos.push(ticket.categoriaRef.nome);
  for (const msg of ticket.messages) {
    if (msg.content) termos.push(msg.content);
  }
  const textoBusca = termos.join(' ').slice(0, 200);
  if (textoBusca.trim().length < 3) return [];
  const where: any = { publicado: true, ativo: true };
  where.OR = [
    { titulo: { contains: textoBusca.split(' ').slice(0, 5).join(' ') } },
    { tags: { contains: textoBusca.split(' ')[0] } },
  ];
  if (ticket.categoriaId) {
    where.OR.push({ categoriaId: ticket.categoriaId });
  }
  return prisma.kBArticle.findMany({
    where,
    include: { categoria: true },
    orderBy: { visualizacoes: 'desc' },
    take: limite,
  });
}

// ── Versioning ──────────────────────────────────────────────────────

async function salvarVersao(
  articleId: string,
  data: { titulo: string; conteudo: string; resumo?: string | null; passos?: string | null; imagens?: string | null },
  autorId?: string | null,
  versao?: number,
): Promise<void> {
  const article = await prisma.kBArticle.findUnique({ where: { id: articleId } });
  const v = versao ?? (article?.versaoAtual ?? 1);
  await prisma.kBArticleVersion.create({
    data: {
      articleId,
      versao: v,
      titulo: data.titulo,
      conteudo: data.conteudo,
      resumo: data.resumo ?? null,
      passos: data.passos ?? null,
      imagens: data.imagens ?? null,
      autorId: autorId ?? null,
    },
  });
}

export async function listarVersoes(articleId: string) {
  return prisma.kBArticleVersion.findMany({
    where: { articleId },
    include: { autor: { select: { id: true, name: true } } },
    orderBy: { versao: 'desc' },
  });
}

export async function getVersao(articleId: string, versao: number) {
  return prisma.kBArticleVersion.findUnique({
    where: { articleId_versao: { articleId, versao } },
    include: { autor: { select: { id: true, name: true } } },
  });
}

// ── Video Generation (HTML presentation) ────────────────────────────

export function gerarVideoHtml(article: {
  titulo: string; conteudo: string; resumo?: string | null;
  passos?: string | null; imagens?: string | null;
}): string {
  let passos: Array<{ titulo: string; descricao: string; imagemUrl?: string }> = [];
  if (article.passos) {
    try { passos = JSON.parse(article.passos); } catch { /* ignore */ }
  }

  // If no structured steps, split content by paragraphs as steps
  if (passos.length === 0) {
    const paragraphs = article.conteudo.split(/\n\n+/).filter(Boolean);
    passos = paragraphs.map((p, i) => ({
      titulo: `Etapa ${i + 1}`,
      descricao: p.trim(),
    }));
  }

  const slidesHtml = passos.map((p, i) => `
    <div class="slide slide-step" data-step="${i}">
      <div class="step-badge">Etapa ${i + 1} de ${passos.length}</div>
      <h2 class="step-title">${escapeHtml(p.titulo)}</h2>
      <p class="step-desc">${escapeHtml(p.descricao)}</p>
      ${p.imagemUrl ? `<img src="${escapeHtml(p.imagemUrl)}" alt="Etapa ${i + 1}" class="step-image" />` : ''}
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(article.titulo)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f1f5f9;height:100vh;overflow:hidden}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;opacity:0;transition:opacity .6s;pointer-events:none;padding:40px}
.slide.active{opacity:1;pointer-events:all}
.slide-intro{text-align:center}
.slide-intro h1{font-size:42px;font-weight:800;background:linear-gradient(90deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}
.slide-intro p{font-size:18px;color:#94a3b8}
.step-badge{display:inline-block;padding:6px 16px;background:rgba(59,130,246,.2);border:1px solid rgba(59,130,246,.3);border-radius:16px;font-size:13px;color:#60a5fa;margin-bottom:20px;text-transform:uppercase;letter-spacing:1px}
.step-title{font-size:32px;font-weight:700;margin-bottom:16px;text-align:center}
.step-desc{font-size:18px;color:#cbd5e1;max-width:700px;text-align:center;line-height:1.7}
.step-image{max-width:500px;max-height:300px;border-radius:12px;margin-top:24px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.controls{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;z-index:10}
.btn{width:44px;height:44px;border:none;border-radius:50%;background:rgba(30,41,59,.9);color:#f1f5f9;font-size:18px;cursor:pointer;border:1px solid rgba(148,163,184,.2)}
.btn:hover{background:rgba(59,130,246,.3)}
.dots{display:flex;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(148,163,184,.3);cursor:pointer;transition:all .3s}
.dot.active{background:#3b82f6;transform:scale(1.4)}
.counter{position:fixed;top:16px;right:16px;background:rgba(30,41,59,.9);padding:6px 14px;border-radius:8px;font-size:13px;color:#94a3b8;border:1px solid rgba(148,163,184,.1)}
</style>
</head>
<body>
<div class="counter"><span id="cur">1</span> / <span id="tot"></span></div>
<div class="slide slide-intro active" data-step="-1">
  <h1>${escapeHtml(article.titulo)}</h1>
  <p>${escapeHtml(article.resumo || article.conteudo.slice(0, 150))}</p>
</div>
${slidesHtml}
<div class="controls">
  <button class="btn" onclick="go(-1)">&#9664;</button>
  <div class="dots" id="dots"></div>
  <button class="btn" onclick="go(1)">&#9654;</button>
</div>
<script>
let cur=0;const slides=document.querySelectorAll('.slide'),tot=slides.length;
document.getElementById('tot').textContent=tot;
const dots=document.getElementById('dots');
for(let i=0;i<tot;i++){const d=document.createElement('div');d.className='dot'+(i===0?' active');d.onclick=()=>{cur=i;show()};dots.appendChild(d)}
function show(){slides.forEach((s,i)=>{s.classList.toggle('active',i===cur)});document.querySelectorAll('.dot').forEach((d,i)=>{d.classList.toggle('active',i===cur)});document.getElementById('cur').textContent=cur+1}
function go(d){cur=Math.max(0,Math.min(tot-1,cur+d));show()}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1)});
</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
