import prisma from '../../config/database';
import ExcelJS from 'exceljs';
import { FiltroAuditoria, getAuditoriaById } from './auditoriaProfissional.service';
import {
  calcularIndicadores,
  calcularRankingAnalistas,
  calcularAssuntos,
} from './auditoriaAgregacao.service';
import { gerarTomadaDecisao } from './auditoriaDecisao.service';

// ── Tipos ───────────────────────────────────────────────────────

export type TipoRelatorio = 'INTERNO' | 'CLIENTE';

export interface RelatorioAuditoriaCompleto {
  tipo: TipoRelatorio;
  geradoEm: string;
  titulo: string;
  confidencial: boolean;
  auditoria: any | null;
  evidencias: Array<{ tipo: string; descricao: string; trecho: string | null; autor: string | null; confianca: number }>;
  recomendacoes: any[];
  planoMelhoria: any[];
}

// ── Relatório individual de um ticket ───────────────────────────

export async function gerarRelatorioTicket(
  auditoriaId: string,
  tipo: TipoRelatorio = 'INTERNO'
): Promise<RelatorioAuditoriaCompleto> {
  const auditoria = await getAuditoriaById(auditoriaId);
  if (!auditoria) throw new Error('Auditoria não encontrada');

  const evidenciaProblemas = parseJson(auditoria.evidenciaProblemas);
  const pontosFortes = parseJson(auditoria.pontosFortes);
  const riscos = parseJson(auditoria.riscos);
  const recomendacoes = parseJson(auditoria.recomendacoes);
  const planoMelhoria = parseJson(auditoria.planoMelhoria);

  const evidencias = [
    ...evidenciaProblemas.map((p: any) => ({
      tipo: 'problema',
      descricao: p.descricao || '',
      trecho: p.trecho || null,
      autor: p.autor || null,
      confianca: p.confianca || 0,
    })),
    ...pontosFortes.map((p: any) => ({
      tipo: 'ponto_forte',
      descricao: p.descricao || '',
      trecho: p.trecho || null,
      autor: null,
      confianca: p.confianca || 0,
    })),
  ];

  const relatorio: RelatorioAuditoriaCompleto = {
    tipo,
    geradoEm: new Date().toISOString(),
    titulo: `Auditoria do Atendimento — ${auditoria.protocolo || auditoria.ticketId}`,
    confidencial: tipo === 'INTERNO',
    auditoria,
    evidencias,
    recomendacoes,
    planoMelhoria,
  };

  if (tipo === 'CLIENTE') {
    relatorio.titulo = `Resumo do Atendimento — ${auditoria.protocolo || auditoria.ticketId}`;
    relatorio.auditoria = {
      protocolo: auditoria.protocolo,
      contactName: auditoria.contactName,
      notaGeral: auditoria.notaGeral,
      classificacao: auditoria.classificacao,
      resumoExecutivo: auditoria.resumoExecutivo,
      explicacaoLeiga: auditoria.explicacaoLeiga,
      analisadoEm: auditoria.analisadoEm,
    };
    relatorio.evidencias = evidencias.filter(e => e.tipo === 'ponto_forte' || e.confianca >= 60).slice(0, 10);
  }

  return relatorio;
}

function parseJson(val: string | null): any[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Relatório consolidado (gerencial) ───────────────────────────

export interface RelatorioConsolidado {
  geradoEm: string;
  tipo: TipoRelatorio;
  confidencial: boolean;
  indicadores: any;
  ranking: any[];
  assuntos: any[];
  tomadaDecisao: any;
}

export async function gerarRelatorioConsolidado(
  filtro: FiltroAuditoria = {},
  tipo: TipoRelatorio = 'INTERNO'
): Promise<RelatorioConsolidado> {
  const [indicadores, ranking, assuntos, tomadaDecisao] = await Promise.all([
    calcularIndicadores(filtro),
    calcularRankingAnalistas(filtro),
    calcularAssuntos(filtro),
    gerarTomadaDecisao(filtro),
  ]);

  const relatorio: RelatorioConsolidado = {
    geradoEm: new Date().toISOString(),
    tipo,
    confidencial: tipo === 'INTERNO',
    indicadores,
    ranking,
    assuntos,
    tomadaDecisao,
  };

  if (tipo === 'CLIENTE') {
    // Para o cliente: apenas visão geral de satisfação, sem dados internos de analistas
    relatorio.ranking = [];
    relatorio.tomadaDecisao = {
      saudeAtendimento: tomadaDecisao.saudeAtendimento,
      iconeSaude: tomadaDecisao.iconeSaude,
      notaGeralMedia: tomadaDecisao.notaGeralMedia,
      resumoExecutivo: tomadaDecisao.resumoExecutivo,
    };
  }

  return relatorio;
}

// ── Exportações ─────────────────────────────────────────────────

export function exportarAuditoriaCsv(items: any[]): string {
  const linhas: string[] = ['SEPARADOR=;'];
  linhas.push('Protocolo;Cliente;Analista;Data auditoria;Nota geral;Classificação;Resolução;Encerramento;Padrão;Risco insatisfação;Retrabalho;Reaberto;Revisão;Status');
  for (const a of items) {
    linhas.push([
      a.protocolo || '',
      a.contactName || '',
      a.agente?.name || '',
      a.auditadoEm ? a.auditadoEm.toISOString().slice(0, 10) : '',
      String(a.notaGeral),
      a.classificacao,
      a.classificacaoResolucao,
      a.classificacaoEncerramento,
      a.padrao,
      a.riscoInsatisfacao,
      a.retrabalho ? 'sim' : 'não',
      a.reaberto ? 'sim' : 'não',
      a.revisaoStatus || '',
      a.status,
    ].join(';'));
  }
  return linhas.join('\r\n');
}

export async function exportarAuditoriaExcel(
  items: any[],
  indicadores: any
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Codemed Hub';
  wb.created = new Date();

  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.addRow(['Auditoria Inteligente de Atendimento']).eachCell(cell => {
    cell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  });
  wsResumo.addRow([`Gerado em: ${new Date().toISOString()}`]);
  const dados: [string, any][] = [
    ['Total auditadas', indicadores.totalAuditadas],
    ['Nota geral média', indicadores.notaGeralMedia],
    ['Classificação geral', indicadores.classificacaoGeral],
    ['Taxa de resolução (%)', indicadores.taxaResolucao],
    ['Taxa de reabertura (%)', indicadores.taxaReabertura],
    ['Taxa de retrabalho (%)', indicadores.taxaRetrabalho],
    ['Custo operacional médio (min)', indicadores.custoOperacionalMedioMin],
    ['CSAT médio', indicadores.csatMedia],
  ];
  wsResumo.addRow([]);
  wsResumo.addRow(['Indicador', 'Valor']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const [label, valor] of dados) wsResumo.addRow([label, valor]);
  wsResumo.getColumn(1).width = 40;
  wsResumo.getColumn(2).width = 20;

  const wsCat = wb.addWorksheet('Médias por Categoria');
  wsCat.addRow(['Categoria', 'Média']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const [cat, valor] of Object.entries(indicadores.mediaCategorias || {})) {
    wsCat.addRow([cat, valor]);
  }

  const wsDetalhe = wb.addWorksheet('Detalhamento');
  wsDetalhe.addRow(['Protocolo', 'Cliente', 'Analista', 'Data auditoria', 'Nota geral', 'Classificação', 'Resolução', 'Encerramento', 'Padrão', 'Risco insatisfação', 'Retrabalho', 'Reaberto', 'Revisão', 'Status']).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  for (const a of items) {
    wsDetalhe.addRow([
      a.protocolo || '',
      a.contactName || '',
      a.agente?.name || '',
      a.auditadoEm ? a.auditadoEm.toISOString().slice(0, 10) : '',
      a.notaGeral,
      a.classificacao,
      a.classificacaoResolucao,
      a.classificacaoEncerramento,
      a.padrao,
      a.riscoInsatisfacao,
      a.retrabalho ? 'sim' : 'não',
      a.reaberto ? 'sim' : 'não',
      a.revisaoStatus || '',
      a.status,
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}