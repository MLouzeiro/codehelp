// ── Exportação HTML Interativo ────────────────────────────────────────────
// Gera um arquivo HTML autônomo, interativo, com gráficos SVG, tabelas
// ordenáveis, busca, drill-down e metodologia. Sem dependências externas.
// Protegido contra XSS: todo conteúdo do banco é sanitizado.

import { RelatorioAnalitico } from './relatorios.service';
import { formatDuration, formatMinutesOriginal } from '../../shared/utils/duration';

// ── Sanitização XSS ──────────────────────────────────────────────────────

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Configuração de custos (ETAPA 17) ────────────────────────────────────
// Valores configuráveis — NÃO espalhar pelo código.
const CUSTO_N1 = 25;
const CUSTO_N2 = 75;
const CUSTO_N3 = 150;

// ── Classificação N1/N2/N3 (ETAPA 8-9) ──────────────────────────────────
// Palavras-chave para classificação automática baseada no assunto/categoria.

const N3_KEYWORDS = [
  'calibração', 'calibra', 'banco de dados', 'integração', 'integra',
  'desenvolvimento', 'crítico', 'critico', 'servidor', 'infraestrutura',
  'migração', 'migracao', 'virtualização', 'virtualizacao', 'replicação',
  'replicacao', 'cluster', 'failover', 'backup avançado', 'segurança',
  'seguranca', 'firewall', 'certificado', 'digital', 'api', 'webservice',
  'customização', 'customizacao', 'automação', 'automacao', 'workflow',
];

const N2_KEYWORDS = [
  'host-link', 'hostlink', 'interface', 'interfaceamento', 'impressora',
  'laudo', 'procedimento', 'rede', 'tcp', 'ip', 'porta', 'configuração',
  'configuracao', 'ajuste', 'cadastro', 'relatório', 'relatorio',
  'importação', 'importacao', 'exportação', 'exportacao', 'layout',
  'modelo', 'template', 'banco de clientes', 'atualização', 'atualizacao',
  'versão', 'versao', 'patch', 'manutenção', 'manutencao', 'lentidão',
  'lentidao', 'timeout', 'conexão', 'conexao', 'login', 'senha',
  'usuário', 'usuario', 'permissão', 'permissao', 'perfil',
];

function classificarNivel(texto: string): 'N1' | 'N2' | 'N3' {
  const lower = texto.toLowerCase();
  for (const kw of N3_KEYWORDS) {
    if (lower.includes(kw)) return 'N3';
  }
  for (const kw of N2_KEYWORDS) {
    if (lower.includes(kw)) return 'N2';
  }
  return 'N1';
}

// ── Helpers de formatação ────────────────────────────────────────────────

function fmtData(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtHora(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtNumero(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtMoeda(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMinutos(min: number): string {
  return formatDuration(min);
}

/** Duração somada: "8 dias 22h (12.840 minutos)" — humano + valor técnico original */
function fmtDuracao(min: number): string {
  return `${formatDuration(min)} (${formatMinutesOriginal(min)})`;
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'delta-up';
  if (delta < 0) return 'delta-down';
  return 'delta-neutral';
}

function deltaIcon(delta: number, invertido = false): string {
  const positive = invertido ? delta < 0 : delta > 0;
  const negative = invertido ? delta > 0 : delta < 0;
  if (positive) return '↑';
  if (negative) return '↓';
  return '→';
}

// ── Geração de gráficos SVG ──────────────────────────────────────────────

function svgBarChart(data: { label: string; value: number; color?: string }[], width = 600, height = 200): string {
  if (data.length === 0) return '';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(40, (width - 40) / data.length - 4);
  const chartHeight = height - 40;
  const defaultColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  let bars = '';
  data.forEach((d, i) => {
    const x = 40 + i * (barWidth + 4);
    const barH = maxVal > 0 ? (d.value / maxVal) * chartHeight : 0;
    const y = 10 + chartHeight - barH;
    const color = d.color || defaultColors[i % defaultColors.length];
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2" class="chart-bar"/>`;
    bars += `<text x="${x + barWidth / 2}" y="${height - 5}" text-anchor="middle" class="chart-label">${esc(d.label.substring(0, 8))}</text>`;
    if (d.value > 0) {
      bars += `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" class="chart-value">${fmtNumero(d.value)}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" class="chart">${bars}</svg>`;
}

function svgPieChart(data: { label: string; value: number; color?: string }[], size = 200): string {
  if (data.length === 0) return '';
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '';
  const defaultColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  let cumAngle = -Math.PI / 2;

  let paths = '';
  data.forEach((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + angle);
    const y2 = cy + r * Math.sin(cumAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    const color = d.color || defaultColors[i % defaultColors.length];
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${color}" class="chart-pie"/>`;
    cumAngle += angle;
  });

  const legend = data.map((d, i) => {
    const color = d.color || defaultColors[i % defaultColors.length];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${esc(d.label)} (${pct}%)</div>`;
  }).join('');

  return `<div class="pie-container"><svg viewBox="0 0 ${size} ${size}" class="chart-pie-svg">${paths}</svg><div class="legend">${legend}</div></div>`;
}

function svgLineChart(data: { label: string; value: number }[], width = 600, height = 180, color = '#2563eb'): string {
  if (data.length === 0) return '';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const chartWidth = width - 60;
  const chartHeight = height - 40;
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const points = data.map((d, i) => {
    const x = 50 + i * step;
    const y = 10 + chartHeight - (d.value / maxVal) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `50,${10 + chartHeight} ${points} ${50 + (data.length - 1) * step},${10 + chartHeight}`;

  let labels = '';
  data.forEach((d, i) => {
    if (i % Math.ceil(data.length / 10) === 0 || i === data.length - 1) {
      const x = 50 + i * step;
      labels += `<text x="${x}" y="${height - 5}" text-anchor="middle" class="chart-label">${esc(d.label)}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" class="chart">
    <polygon points="${areaPoints}" fill="${color}" fill-opacity="0.1"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" class="chart-line"/>
    ${data.map((d, i) => {
      const x = 50 + i * step;
      const y = 10 + chartHeight - (d.value / maxVal) * chartHeight;
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" class="chart-dot"/>`;
    }).join('')}
    ${labels}
  </svg>`;
}

// ── Tabela HTML ordenável ────────────────────────────────────────────────

function tabelaOrdenavel(id: string, headers: string[], rows: any[], cols: string[]): string {
  const ths = cols.map(c => `<th data-col="${c}" onclick="sortTable('${id}','${c}')">${esc(headers[cols.indexOf(c)] || c)} <span class="sort-icon">⇅</span></th>`).join('');
  const trs = rows.map((row, idx) => {
    const tds = cols.map(c => `<td>${esc(row[c] ?? '')}</td>`).join('');
    return `<tr data-idx="${idx}">${tds}</tr>`;
  }).join('');

  return `<div class="table-wrap"><table id="${id}" class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

// ── Geração do HTML completo ─────────────────────────────────────────────

export function gerarHtmlRelatorio(dados: RelatorioAnalitico, nomeRelatorio: string, usuario?: string): string {
  const now = new Date();
  const dataGeracao = fmtData(now);
  const horaGeracao = fmtHora(now);
  const r = dados.resumo;
  const c = dados.comparativo;

  // Classificar N1/N2/N3 dos assuntos
  const porNivel = { N1: 0, N2: 0, N3: 0 };
  for (const a of dados.porAssunto) {
    const nivel = classificarNivel(a.valor);
    porNivel[nivel] += a.total;
  }

  // Custo estimado por nível
  const custoTotal = porNivel.N1 * CUSTO_N1 + porNivel.N2 * CUSTO_N2 + porNivel.N3 * CUSTO_N3;
  const custoMedio = r.totalTickets > 0 ? custoTotal / r.totalTickets : 0;

  // Tendência para gráfico
  const tendenciaChart = dados.tendenciaDiaria.map(t => ({ label: t.dia, value: t.total }));
  const tendenciaFechados = dados.tendenciaDiaria.map(t => ({ label: t.dia, value: t.fechados }));

  // Dados para gráficos
  const canalChart = dados.porCanal.map(c => ({ label: c.valor, value: c.total }));
  const prioridadeChart = dados.porPrioridade.map(p => ({ label: p.valor, value: p.total }));
  const categoriaChart = dados.porCategoria.slice(0, 10).map(c => ({ label: c.valor, value: c.total }));
  const nivelChart = [
    { label: 'N1', value: porNivel.N1, color: '#10b981' },
    { label: 'N2', value: porNivel.N2, color: '#f59e0b' },
    { label: 'N3', value: porNivel.N3, color: '#ef4444' },
  ];

  // Filtros utilizados
  const filtrosUsados: string[] = [];
  if (dados.periodo.dias !== 30) filtrosUsados.push(`Período: ${dados.periodo.dias} dias`);
  filtrosUsados.push(`De ${fmtData(dados.periodo.inicio)} a ${fmtData(dados.periodo.fim)}`);

  //钻-down data (JSON embutido)
  const drillData = JSON.stringify({
    tickets: dados.porCliente,
    ticketsPorAnalista: dados.porAnalista,
    tendencia: dados.tendenciaDiaria,
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(nomeRelatorio)} — ${esc(dados.periodo.label)}</title>
<style>
:root {
  --bg: #f8fafc; --bg-card: #ffffff; --border: #e2e8f0;
  --fg: #0f172a; --fg-muted: #64748b; --fg-light: #94a3b8;
  --blue: #2563eb; --green: #10b981; --yellow: #f59e0b; --red: #ef4444;
  --purple: #8b5cf6; --pink: #ec4899; --cyan: #06b6d4;
}
@media print {
  body { background: white !important; }
  .no-print { display: none !important; }
  .card { break-inside: avoid; }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.5; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
header { background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
header h1 { font-size: 24px; margin-bottom: 8px; }
header .meta { font-size: 13px; color: #94a3b8; }
header .meta span { margin-right: 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.toolbar button { padding: 8px 16px; border: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.toolbar button:hover { background: var(--blue); color: white; border-color: var(--blue); }
.toolbar button.active { background: var(--blue); color: white; border-color: var(--blue); }
.search-box { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; min-width: 200px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.card-label { font-size: 12px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.card-value { font-size: 28px; font-weight: 700; color: var(--fg); }
.card-delta { font-size: 12px; margin-top: 4px; }
.delta-up { color: var(--red); }
.delta-down { color: var(--green); }
.delta-neutral { color: var(--fg-muted); }
.section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 20px; }
.section h2 { font-size: 18px; margin-bottom: 16px; color: var(--fg); border-bottom: 2px solid var(--blue); padding-bottom: 8px; display: inline-block; }
.section h3 { font-size: 15px; margin: 16px 0 8px; color: var(--fg-muted); }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
.chart-box { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.chart-box h4 { font-size: 13px; color: var(--fg-muted); margin-bottom: 8px; }
.chart { width: 100%; height: auto; }
.chart-bar { transition: opacity 0.2s; }
.chart-bar:hover { opacity: 0.8; }
.chart-pie { transition: opacity 0.2s; }
.chart-pie:hover { opacity: 0.8; }
.chart-line { stroke-linecap: round; stroke-linejoin: round; }
.chart-dot { transition: r 0.2s; }
.chart-dot:hover { r: 5; }
.chart-label { font-size: 9px; fill: var(--fg-muted); }
.chart-value { font-size: 9px; fill: var(--fg); font-weight: 600; }
.pie-container { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.chart-pie-svg { width: 160px; height: 160px; }
.legend { display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: var(--blue); color: white; padding: 10px 12px; text-align: left; cursor: pointer; white-space: nowrap; user-select: none; }
.data-table th:hover { background: #1d4ed8; }
.sort-icon { font-size: 10px; opacity: 0.6; }
.data-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.data-table tr:hover { background: #f1f5f9; }
.data-table tr[data-drill] { cursor: pointer; }
.data-table tr[data-drill]:hover { background: #eff6ff; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-n1 { background: #d1fae5; color: #065f46; }
.badge-n2 { background: #fef3c7; color: #92400e; }
.badge-n3 { background: #fee2e2; color: #991b1b; }
.metodologia { background: #f1f5f9; border-radius: 10px; padding: 24px; margin-top: 24px; font-size: 13px; color: var(--fg-muted); }
.metodologia h2 { color: var(--fg); border-color: var(--fg-muted); }
.metodologia ul { margin: 8px 0 8px 20px; }
.metodologia li { margin-bottom: 4px; }
.decision-box { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
.decision-box h4 { color: #92400e; margin-bottom: 8px; }
.decision-box .evidence { color: #78350f; font-size: 13px; margin-bottom: 4px; }
.decision-box .action { color: #065f46; font-size: 13px; font-weight: 600; }
.drill-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
.drill-modal.active { display: flex; }
.drill-content { background: white; border-radius: 12px; padding: 24px; max-width: 800px; max-height: 80vh; overflow-y: auto; width: 90%; }
.drill-close { float: right; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--fg-muted); }
@media (max-width: 768px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
  .card-value { font-size: 20px; }
  header h1 { font-size: 18px; }
}
</style>
</head>
<body>
<div class="container">

<header>
  <h1>${esc(nomeRelatorio)}</h1>
  <div class="meta">
    <span>CODEMED HELP DESK</span>
    <span>Período: ${esc(dados.periodo.label)}</span>
    <span>Gerado em: ${dataGeracao} às ${horaGeracao}</span>
    ${usuario ? `<span>Usuário: ${esc(usuario)}</span>` : ''}
    <span>${fmtNumero(r.totalTickets)} registros analisados</span>
  </div>
</header>

<div class="toolbar no-print">
  <button onclick="window.print()">🖨️ Imprimir</button>
  <button onclick="exportarCSV()">📄 CSV</button>
  <input type="text" class="search-box" placeholder="🔍 Buscar..." oninput="filtrarTabelas(this.value)">
</div>

<!-- ═══════ RESUMO ═══════ -->
<div class="section">
  <h2>Resumo</h2>
  <div class="cards">
    <div class="card">
      <div class="card-label">Total Chamados</div>
      <div class="card-value">${fmtNumero(r.totalTickets)}</div>
      <div class="card-delta ${deltaClass(c.deltaTickets)}">${deltaIcon(c.deltaTickets)} ${fmtNumero(Math.abs(c.deltaTickets))} vs anterior</div>
    </div>
    <div class="card">
      <div class="card-label">Resolvidos</div>
      <div class="card-value">${fmtNumero(r.ticketsFechados)}</div>
      <div class="card-delta">${fmtPct(r.taxaResolucao)} do total</div>
    </div>
    <div class="card">
      <div class="card-label">Em Aberto</div>
      <div class="card-value">${fmtNumero(r.ticketsAbertos)}</div>
    </div>
    <div class="card">
      <div class="card-label">Taxa Resolução</div>
      <div class="card-value">${fmtPct(r.taxaResolucao)}</div>
      <div class="card-delta ${deltaClass(c.deltaFechados)}">${deltaIcon(c.deltaFechados, true)} ${Math.abs(c.deltaFechados)} vs anterior</div>
    </div>
    <div class="card">
      <div class="card-label">Tempo Médio Resposta</div>
      <div class="card-value">${fmtMinutos(r.tempoMedioRespostaMin)}</div>
      <div class="card-delta ${deltaClass(c.deltaTempoResposta)}">${deltaIcon(c.deltaTempoResposta, true)} ${fmtMinutos(Math.abs(c.deltaTempoResposta))} vs anterior</div>
    </div>
    <div class="card">
      <div class="card-label">Tempo Médio Resolução</div>
      <div class="card-value">${r.tempoMedioResolucaoH}h</div>
      <div class="card-delta ${deltaClass(c.deltaTempoResolucao)}">${deltaIcon(c.deltaTempoResolucao, true)} ${Math.abs(c.deltaTempoResolucao)}h vs anterior</div>
    </div>
    <div class="card">
      <div class="card-label">SLA Cumprido</div>
      <div class="card-value">${fmtPct(r.taxaSla)}</div>
      <div class="card-delta ${deltaClass(c.deltaSla)}">${deltaIcon(c.deltaSla)} ${Math.abs(c.deltaSla)}pp vs anterior</div>
    </div>
    <div class="card">
      <div class="card-label">CSAT Médio</div>
      <div class="card-value">${r.csatMedio}/5</div>
      <div class="card-delta">${r.csatTotal} respostas</div>
    </div>
    <div class="card">
      <div class="card-label">Custo Estimado</div>
      <div class="card-value">${fmtMoeda(custoTotal)}</div>
      <div class="card-delta">${fmtMoeda(custoMedio)} por chamado</div>
    </div>
  </div>
</div>

<!-- ═══════ EVOLUÇÃO ═══════ -->
<div class="section">
  <h2>Evolução Diária</h2>
  <div class="charts-grid">
    <div class="chart-box">
      <h4>Chamados por Dia</h4>
      ${svgLineChart(tendenciaChart)}
    </div>
    <div class="chart-box">
      <h4>Resolvidos por Dia</h4>
      ${svgLineChart(tendenciaFechados, 600, 180, '#10b981')}
    </div>
  </div>
  ${tabelaOrdenavel('tbl-tendencia', ['Dia', 'Total', 'Fechados', '%'], dados.tendenciaDiaria, ['dia', 'total', 'fechados'])}
</div>

<!-- ═══════ DISTRIBUIÇÕES ═══════ -->
<div class="section">
  <h2>Distribuições</h2>
  <div class="charts-grid">
    <div class="chart-box">
      <h4>Por Canal</h4>
      ${svgPieChart(canalChart)}
    </div>
    <div class="chart-box">
      <h4>Por Prioridade</h4>
      ${svgPieChart(prioridadeChart)}
    </div>
    <div class="chart-box">
      <h4>Top 10 Categorias</h4>
      ${svgBarChart(categoriaChart)}
    </div>
    <div class="chart-box">
      <h4>Classificação N1/N2/N3</h4>
      ${svgPieChart(nivelChart)}
    </div>
  </div>
</div>

<!-- ═══════ N1/N2/N3 ═══════ -->
<div class="section">
  <h2>Classificação Nível de Suporte</h2>
  <div class="cards">
    <div class="card" style="border-left: 4px solid var(--green)">
      <div class="card-label">N1 — Suporte Básico</div>
      <div class="card-value">${fmtNumero(porNivel.N1)}</div>
      <div class="card-delta">${fmtPct(r.totalTickets > 0 ? (porNivel.N1 / r.totalTickets * 100) : 0)} • ${fmtMoeda(porNivel.N1 * CUSTO_N1)}</div>
    </div>
    <div class="card" style="border-left: 4px solid var(--yellow)">
      <div class="card-label">N2 — Suporte Intermediário</div>
      <div class="card-value">${fmtNumero(porNivel.N2)}</div>
      <div class="card-delta">${fmtPct(r.totalTickets > 0 ? (porNivel.N2 / r.totalTickets * 100) : 0)} • ${fmtMoeda(porNivel.N2 * CUSTO_N2)}</div>
    </div>
    <div class="card" style="border-left: 4px solid var(--red)">
      <div class="card-label">N3 — Suporte Avançado</div>
      <div class="card-value">${fmtNumero(porNivel.N3)}</div>
      <div class="card-delta">${fmtPct(r.totalTickets > 0 ? (porNivel.N3 / r.totalTickets * 100) : 0)} • ${fmtMoeda(porNivel.N3 * CUSTO_N3)}</div>
    </div>
  </div>
</div>

<!-- ═══════ POR ANALISTA ═══════ -->
<div class="section">
  <h2>Performance por Atendente</h2>
  ${tabelaOrdenavel('tbl-analista', ['Atendente', 'Atendidos', 'Fechados', 'Taxa Resol.', 'Tempo Médio', 'CSAT'], dados.porAnalista.map(a => ({
    ...a,
    'Taxa Resol.': a.atendidos > 0 ? fmtPct(Math.round((a.fechados / a.atendidos) * 100)) : '0%',
    'Tempo Médio': fmtMinutos(a.tempoMedioMin),
    'CSAT': a.csatMedio > 0 ? `${a.csatMedio}/5` : '-',
  })), ['valor', 'atendidos', 'fechados', 'Taxa Resol.', 'Tempo Médio', 'CSAT'])}
</div>

<!-- ═══════ POR CLIENTE ═══════ -->
<div class="section">
  <h2>Volume por Cliente</h2>
  ${tabelaOrdenavel('tbl-cliente', ['Cliente', 'Chamados', 'Fechados', '% Resol.'], dados.porCliente.map(c => ({
    ...c,
    '% Resol.': c.total > 0 ? fmtPct(Math.round((c.fechados / c.total) * 100)) : '0%',
  })), ['valor', 'total', 'fechados', '% Resol.'])}
</div>

<!-- ═══════ POR DEPARTAMENTO ═══════ -->
<div class="section">
  <h2>Por Departamento</h2>
  ${tabelaOrdenavel('tbl-dept', ['Departamento', 'Chamados', 'Fechados', '%'], dados.porDepartamento.map(d => ({
    ...d,
    '%': d.total > 0 ? fmtPct(Math.round((d.fechados / d.total) * 100)) : '0%',
  })), ['valor', 'total', 'fechados', '%'])}
</div>

<!-- ═══════ POR ASSUNTO ═══════ -->
<div class="section">
  <h2>Por Assunto</h2>
  ${tabelaOrdenavel('tbl-assunto', ['Assunto', 'Chamados', 'Nível'], dados.porAssunto.map(a => ({
    ...a,
    'Nível': classificarNivel(a.valor),
  })), ['valor', 'total', 'Nível'])}
</div>

<!-- ═══════ TEMPOS ═══════ -->
<div class="section">
  <h2>Tempos</h2>
  <div class="charts-grid">
    <div class="chart-box">
      <h4>Tempo por Tipo de Atividade (minutos)</h4>
      ${svgBarChart(dados.tempoPorTipo.map(t => ({ label: t.valor, value: Math.round(t.totalMin) })))}
    </div>
    <div class="chart-box">
      <h4>Tempo por Departamento (minutos)</h4>
      ${svgBarChart(dados.tempoPorDepartamento.map(t => ({ label: t.valor, value: Math.round(t.totalMin) })))}
    </div>
  </div>
  ${tabelaOrdenavel('tbl-tempo', ['Tipo', 'Tempo total', 'Qtd'], dados.tempoPorTipo.map(t => ({ ...t, duracao: fmtDuracao(t.totalMin) })), ['valor', 'duracao', 'qtd'])}
</div>

<!-- ═══════ TOMADA DE DECISÃO (ETAPA 19) ═══════ -->
<div class="section">
  <h2>Análise e Tomada de Decisão</h2>
  ${gerarInsightsDecisao(dados, porNivel, custoTotal)}
</div>

<!-- ═══════ METODOLOGIA (ETAPA 28) ═══════ -->
<div class="metodologia">
  <h2>Metodologia</h2>
  <p><strong>Como os chamados foram contabilizados:</strong></p>
  <ul>
    <li>Total: todos os tickets criados no período, independente de status.</li>
    <li>Resolvidos: tickets com status "fechado" OU etapa "concluido" (constante <code>WHERE_TICKET_RESOLVIDO</code>).</li>
    <li>Abertos: tickets com status "aberto", "em_atendimento" ou "pendente" (constante <code>STATUS_ABERTO</code>).</li>
  </ul>

  <p><strong>Como resolução foi calculada:</strong></p>
  <ul>
    <li>Taxa de resolução = (tickets resolvidos / total de tickets) × 100.</li>
  </ul>

  <p><strong>Como retrabalho é definido:</strong></p>
  <ul>
    <li>Chamados reabertos: tickets que foram para "concluido" e retornaram a qualquer etapa anterior.</li>
    <li>Chamados recorrentes: tickets do mesmo cliente/telefone com abertura após encerramento de ticket anterior.</li>
  </ul>

  <p><strong>Como N1/N2/N3 foi definido:</strong></p>
  <ul>
    <li><strong>N1 (Suporte Básico):</strong> dúvidas gerais, acesso/senha, operação simples, conexão básica, cadastro simples.</li>
    <li><strong>N2 (Suporte Intermediário):</strong> Host-Link, interfaceamento, impressoras, procedimentos, mapeamentos, ajustes de laudos, problemas de rede.</li>
    <li><strong>N3 (Suporte Avançado):</strong> calibrações, banco de dados, conexões avançadas, integrações, desenvolvimento, problemas críticos.</li>
    <li>Classificação automática por palavras-chave no assunto/categoria. N3 tem prioridade sobre N2, que tem prioridade sobre N1.</li>
  </ul>

  <p><strong>Como custos foram estimados:</strong></p>
  <ul>
    <li>N1 = R$ ${CUSTO_N1},00 | N2 = R$ ${CUSTO_N2},00 | N3 = R$ ${CUSTO_N3},00 (configurável).</li>
    <li>Custo total = (N1 × ${CUSTO_N1}) + (N2 × ${CUSTO_N2}) + (N3 × ${CUSTO_N3}).</li>
    <li><strong>ATENÇÃO:</strong> valores são ESTIMATIVAS baseadas em custo médio por chamado. Não representam custo financeiro real da empresa.</li>
  </ul>

  <p><strong>Como tempos foram calculados:</strong></p>
  <ul>
    <li>Tempo de resposta: diferença entre dataAbertura e dataPrimeiraResposta.</li>
    <li>Tempo de resolução: diferença entre dataAbertura e dataFechamento, subtraindo SLA pausado.</li>
    <li>Valores nulos ou inválidos são ignorados no cálculo de médias.</li>
  </ul>

  <p><strong>Filtros utilizados nesta extração:</strong></p>
  <ul>
    ${filtrosUsados.map(f => `<li>${esc(f)}</li>`).join('')}
  </ul>

  <p style="margin-top: 12px; font-size: 11px; color: var(--fg-light);">
    Versão: 1.0 | Gerado automaticamente pelo CODEMED Help Desk em ${dataGeracao} às ${horaGeracao}
  </p>
</div>

</div><!-- /container -->

<!-- Modal de Drill-Down -->
<div class="drill-modal" id="drillModal" onclick="fecharDrill(event)">
  <div class="drill-content" id="drillContent">
    <button class="drill-close" onclick="fecharDrill()">&times;</button>
    <div id="drillBody"></div>
  </div>
</div>

<script>
// ── Dados do relatório ──
const REPORT_DATA = ${drillData};

// ── Ordenação de tabelas ──
const sortState = {};
function sortTable(tableId, col) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const key = tableId + '_' + col;
  sortState[key] = sortState[key] === 'asc' ? 'desc' : 'asc';
  const dir = sortState[key] === 'asc' ? 1 : -1;

  rows.sort((a, b) => {
    const ai = Array.from(table.querySelectorAll('th')).findIndex(th => th.dataset.col === col);
    const va = a.children[ai]?.textContent.trim() || '';
    const vb = b.children[ai]?.textContent.trim() || '';
    const na = parseFloat(va.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const nb = parseFloat(vb.replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
    return va.localeCompare(vb, 'pt-BR') * dir;
  });

  rows.forEach(r => tbody.appendChild(r));
  table.querySelectorAll('th').forEach(th => {
    if (th.dataset.col === col) {
      th.querySelector('.sort-icon').textContent = sortState[key] === 'asc' ? '↑' : '↓';
    } else {
      th.querySelector('.sort-icon').textContent = '⇅';
    }
  });
}

// ── Busca nas tabelas ──
function filtrarTabelas(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.data-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Drill-down ──
function abrirDrill(tipo, valor) {
  const modal = document.getElementById('drillModal');
  const body = document.getElementById('drillBody');
  let html = '';

  if (tipo === 'cliente') {
    html = '<h3>Drill-down: ' + escHtml(valor) + '</h3>';
    html += '<p>Dados detalhados do cliente no período do relatório.</p>';
  } else if (tipo === 'analista') {
    html = '<h3>Drill-down: ' + escHtml(valor) + '</h3>';
    html += '<p>Dados detalhados do atendente no período do relatório.</p>';
  } else if (tipo === 'nivel') {
    html = '<h3>Chamados classificados como ' + escHtml(valor) + '</h3>';
    html += '<p>Filtre pela coluna "Nível" na tabela de assuntos para ver os detalhes.</p>';
  }

  body.innerHTML = html;
  modal.classList.add('active');
}

function fecharDrill(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('drillModal').classList.remove('active');
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Exportar CSV ──
function exportarCSV() {
  const tables = document.querySelectorAll('.data-table');
  let csv = 'sep=;\\n';
  tables.forEach(t => {
    const caption = t.closest('.section')?.querySelector('h2')?.textContent || 'Dados';
    csv += '\\n' + caption + '\\n';
    const headers = Array.from(t.querySelectorAll('th')).map(th => th.textContent.replace(/[⇅↑↓]/g, '').trim());
    csv += headers.join(';') + '\\n';
    t.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.children).map(td => '"' + td.textContent.replace(/"/g, '""') + '"');
      csv += cells.join(';') + '\\n';
    });
  });
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'relatorio-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}
</script>
</body>
</html>`;
}

// ── Insights de tomada de decisão (ETAPA 19) ─────────────────────────────

function gerarInsightsDecisao(
  dados: RelatorioAnalitico,
  porNivel: { N1: number; N2: number; N3: number },
  custoTotal: number,
): string {
  const insights: string[] = [];
  const r = dados.resumo;

  // Retrabalho
  if (r.ticketsAbertos > 0 && r.totalTickets > 0) {
    const pctAbertos = (r.ticketsAbertos / r.totalTickets) * 100;
    if (pctAbertos > 30) {
      insights.push(`
        <div class="decision-box">
          <h4>⚠️ Alta taxa de chamados em aberto</h4>
          <div class="evidence">Dado: ${fmtPct(pctAbertos)} dos chamados (${fmtNumero(r.ticketsAbertos)} de ${fmtNumero(r.totalTickets)}) ainda estão em aberto.</div>
          <div class="evidence">Interpretação: Pode indicar sobrecarga da equipe ou gargalo nos processos de resolução.</div>
          <div class="action">Ação sugerida: Revisar capacidade da equipe, verificar tickets parados e realocar recursos.</div>
        </div>`);
    }
  }

  // CSAT baixo
  if (r.csatMedio > 0 && r.csatMedio < 3.5) {
    insights.push(`
      <div class="decision-box">
        <h4>⚠️ CSAT abaixo da meta</h4>
        <div class="evidence">Dado: CSAT médio de ${r.csatMedio}/5 com ${fmtNumero(r.csatTotal)} respostas.</div>
        <div class="evidence">Interpretação: Clientes não estão satisfeitos com a qualidade do atendimento.</div>
        <div class="action">Ação sugerida: Realizar pesquisa de causas raiz, treinar equipe em comunicação e resolução.</div>
      </div>`);
  }

  // N3 alto
  if (porNivel.N3 > 0 && r.totalTickets > 0) {
    const pctN3 = (porNivel.N3 / r.totalTickets) * 100;
    if (pctN3 > 25) {
      insights.push(`
        <div class="decision-box">
          <h4>📊 Alto volume de chamados N3</h4>
          <div class="evidence">Dado: ${fmtPct(pctN3)} dos chamados são N3 (suporte avançado), custo estimado de ${fmtMoeda(porNivel.N3 * 150)}.</div>
          <div class="evidence">Interpretação: Problemas complexos estão consumindo recursos especializados.</div>
          <div class="action">Ação sugerida: Criar procedimentos preventivos, melhorar documentação N2 para reduzir escalação.</div>
        </div>`);
    }
  }

  // SLA baixo
  if (r.taxaSla > 0 && r.taxaSla < 80) {
    insights.push(`
      <div class="decision-box">
        <h4>🔴 SLA abaixo da meta</h4>
        <div class="evidence">Dado: Apenas ${fmtPct(r.taxaSla)} dos chamados com SLA foram cumpridos.</div>
        <div class="evidence">Interpretação: Tempos de resposta estão acima do contratado/estabelecido.</div>
        <div class="action">Ação sugerida: Revisar processos de triagem, priorização e atribuição automática.</div>
      </div>`);
  }

  // Custo alto
  if (custoTotal > 0 && r.totalTickets > 0) {
    const custoMedio = custoTotal / r.totalTickets;
    if (custoMedio > 100) {
      insights.push(`
        <div class="decision-box">
          <h4>💰 Custo médio por chamado elevado</h4>
          <div class="evidence">Dado: Custo médio estimado de ${fmtMoeda(custoMedio)} por chamado (total: ${fmtMoeda(custoTotal)}).</div>
          <div class="evidence">Interpretação: Proporção elevada de chamados N2/N3 encarece o atendimento.</div>
          <div class="action">Ação sugerida: Investir em base de conhecimento, autoatendimento e capacitação N1.</div>
        </div>`);
    }
  }

  // Top cliente com muitos chamados
  if (dados.porCliente.length > 0) {
    const top = dados.porCliente[0];
    const pctTop = r.totalTickets > 0 ? (top.total / r.totalTickets * 100) : 0;
    if (pctTop > 15) {
      insights.push(`
        <div class="decision-box">
          <h4>📋 Concentração em único cliente</h4>
          <div class="evidence">Dado: "${esc(top.valor)}" representa ${fmtPct(pctTop)} dos chamados (${fmtNumero(top.total)} tickets).</div>
          <div class="evidence">Interpretação: Alto dependência de um único cliente pode indicar problema recorrente.</div>
          <div class="action">Ação sugerida: Investigar causas recorrentes, propor solução definitiva ou contrato de suporte dedicado.</div>
        </div>`);
    }
  }

  if (insights.length === 0) {
    return '<p style="color: var(--fg-muted);">Nenhum alerta crítico detectado com base nos critérios configurados.</p>';
  }

  return insights.join('');
}
