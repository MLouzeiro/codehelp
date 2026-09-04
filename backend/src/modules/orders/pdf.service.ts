import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { formatDateBR } from '../../shared/utils/helpers';
import { getConfig, getTimbradoBytes } from './os-layout.service';

// ── Cores do timbrado (default) ──────────────────────────────────────
const DEFAULT_COLORS = {
  primary: '#1a56db',
  primaryLight: '#e8eefb',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#d1d5db',
  white: '#ffffff',
};

// ── Public API ────────────────────────────────────────────────────────

export async function generatePdf(orderId: string, layoutId?: string): Promise<string> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      tecnicoResponsavel: { select: { name: true } },
      signature: true,
      criadoPor: { select: { name: true } },
      items: true,
      layout: true,
    },
  });
  if (!order || !order.signature) throw new Error('OS ou assinatura não encontrada');

  const layout = layoutId
    ? await prisma.oSLayout.findUnique({ where: { id: layoutId } })
    : order.layout || null;

  return buildOrderPdf(order, layout);
}

export async function generateOrderPdf(orderId: string, layoutId?: string): Promise<string> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      tecnicoResponsavel: { select: { name: true } },
      signature: true,
      criadoPor: { select: { name: true } },
      items: true,
      layout: true,
    },
  });
  if (!order) throw new Error('OS não encontrada');

  const layout = layoutId
    ? await prisma.oSLayout.findUnique({ where: { id: layoutId } })
    : order.layout || null;

  return buildOrderPdf(order, layout);
}

// ── Helpers ──────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '').substring(0, 80);
}

function safeText(val: string | null | undefined): string {
  if (!val || val === 'undefined' || val === 'null' || val === '[object Object]') return '';
  return String(val).trim();
}

async function getOrganizationData() {
  try {
    const org = await (prisma as any).organization.findFirst({
      where: { ativo: true },
      select: {
        nome: true, cnpjCpf: true, email: true,
        telefone: true, website: true, logo: true,
      },
    });
    return org || null;
  } catch {
    return null;
  }
}

function resolveLogo(): Buffer | null {
  const candidates = [
    path.resolve(__dirname, '../../../storage/logo.png'),
    path.resolve(__dirname, '../../../storage/uploads/logo.png'),
  ];
  for (const lp of candidates) {
    if (fs.existsSync(lp)) {
      return fs.readFileSync(lp);
    }
  }
  return null;
}

function getColors(layout: any) {
  if (!layout) return DEFAULT_COLORS;
  const config = getConfig(layout);
  const c = config.cores || {};
  return {
    primary: c.primaria || DEFAULT_COLORS.primary,
    primaryLight: c.primariaClara || DEFAULT_COLORS.primaryLight,
    text: c.texto || DEFAULT_COLORS.text,
    textLight: c.textoClaro || DEFAULT_COLORS.textLight,
    border: c.borda || DEFAULT_COLORS.border,
    white: DEFAULT_COLORS.white,
  };
}

function getMargins(layout: any) {
  const def = { top: 50, bottom: 70, left: 50, right: 50 };
  if (!layout) return def;
  const config = getConfig(layout);
  const m = config.margens || {};
  const topo = (layout.margemTopo || 0) * 2.835 + (m.topo || 0);
  const baixo = (layout.margemBaixo || 0) * 2.835 + (m.baixo || 0);
  const esq = (layout.margemEsquerda || 0) * 2.835 + (m.esquerda || 0);
  const dir = (layout.margemDireita || 0) * 2.835 + (m.direita || 0);
  return {
    top: Math.max(def.top, topo || def.top),
    bottom: Math.max(def.bottom, baixo || def.bottom),
    left: Math.max(def.left, esq || def.left),
    right: Math.max(def.right, dir || def.right),
  };
}

// ── Main Builder ──────────────────────────────────────────────────────

async function buildOrderPdf(order: any, layout: any): Promise<string> {
  const dir = path.resolve(__dirname, '../../../storage/pdfs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const clienteNome = sanitizeFileName(
    order.client?.nomeFantasia || order.client?.razaoSocial || 'Cliente'
  );
  const filename = `${order.numeroOs.replace(/\//g, '-')}-${clienteNome}.pdf`;
  const filepath = path.join(dir, filename);

  const org = await getOrganizationData();
  const logoBuffer = resolveLogo();

  if (layout?.tipo === 'pdf_importado' && layout.id) {
    const timbradoBytes = await getTimbradoBytes(layout.id);
    if (timbradoBytes) {
      return buildPdfWithTimbrado(order, layout, org, logoBuffer, filepath, timbradoBytes);
    }
    console.warn(`[PDF] Timbrado do layout ${layout.id} não encontrado, usando layout padrão`);
  }

  return buildPdfWithLayout(order, layout, org, logoBuffer, filepath);
}

// ── PDF with custom layout (personalizado) ───────────────────────────

async function buildPdfWithLayout(
  order: any, layout: any, org: any, logoBuffer: Buffer | null, filepath: string,
): Promise<string> {
  const colors = getColors(layout);
  const margins = getMargins(layout);
  const config = layout ? getConfig(layout) : {};
  const headerCfg = config.cabecalho || {};
  const footerCfg = config.rodape || {};
  const secCfg = config.secoes || {};

  const doc = new PDFDocument({
    size: 'A4',
    margins,
    bufferPages: true,
    info: {
      Title: `Ordem de Serviço ${order.numeroOs}`,
      Author: org?.nome || 'Codemed',
      Subject: 'Ordem de Serviço',
      Creator: 'CodeHelp CRM/Helpdesk',
    },
  });

  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  const showHeader = !layout || headerCfg.mostrarLogo !== false || headerCfg.mostrarEmpresa !== false;
  if (showHeader) {
    drawFirstPageHeader(doc, org, logoBuffer, order.numeroOs, order.dataEmissao, colors, headerCfg, config);
  }

  let sectionNum = 0;

  if (secCfg.cliente?.visivel !== false) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. DADOS DO CLIENTE`, colors);
    drawField(doc, 'Razão Social', order.client?.razaoSocial, colors);
    if (order.client?.nomeFantasia) drawField(doc, 'Nome Fantasia', order.client.nomeFantasia, colors);
    if (order.client?.cnpjCpf) drawField(doc, 'CNPJ/CPF', order.client.cnpjCpf, colors);
    if (order.client?.telefone) drawField(doc, 'Telefone', order.client.telefone, colors);
    if (order.client?.email) drawField(doc, 'Email', order.client.email, colors);
    if (order.client?.cidade && order.client?.estado) {
      drawField(doc, 'Cidade/UF', `${order.client.cidade}/${order.client.estado}`, colors);
    }
    drawSeparator(doc, colors);
  }

  if (secCfg.servico?.visivel !== false) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. DADOS DO SERVIÇO`, colors);
    const tipoLabels: Record<string, string> = {
      implantacao: 'Implantação', suporte: 'Suporte', treinamento: 'Treinamento',
      desenvolvimento: 'Desenvolvimento', manutencao: 'Manutenção',
    };
    drawField(doc, 'Tipo de Serviço', tipoLabels[order.tipoServico || ''] || order.tipoServico || '-', colors);
    if (order.descricaoServico) drawField(doc, 'Descrição', order.descricaoServico, colors);
    const sistemas = JSON.parse(order.sistemasEnvolvidos || '[]');
    if (sistemas?.length) drawField(doc, 'Sistemas Envolvidos', sistemas.join(', '), colors);
    if (order.equipamentos) drawField(doc, 'Equipamentos', order.equipamentos, colors);
    if (order.dataPrevistaEntrega) drawField(doc, 'Previsão de Entrega', formatDateBR(order.dataPrevistaEntrega), colors);
    drawSeparator(doc, colors);
  }

  if (secCfg.itens?.visivel !== false && order.items && order.items.length > 0) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. ITENS / MATERIAIS / SERVIÇOS`, colors);
    drawItemsTable(doc, order.items, colors);
    drawSeparator(doc, colors);
  }

  if (secCfg.tecnicoValor?.visivel !== false) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. TÉCNICO RESPONSÁVEL E VALOR`, colors);
    drawField(doc, 'Técnico', order.tecnicoResponsavel.name, colors);
    if (order.valorServico) drawField(doc, 'Valor do Serviço', `R$ ${order.valorServico.toFixed(2)}`, colors);
    drawSeparator(doc, colors);
  }

  if (secCfg.observacoes?.visivel !== false && order.observacoes) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. OBSERVAÇÕES`, colors);
    doc.fontSize(10).font('Helvetica').fillColor(colors.text).text(order.observacoes);
    doc.moveDown(0.5);
    drawSeparator(doc, colors);
  }

  if (secCfg.assinatura?.visivel !== false) {
    sectionNum++;
    drawSectionTitle(doc, `${sectionNum}. ASSINATURA ELETRÔNICA DO CLIENTE`, colors);
    const hasSignature = order.signature && order.signature.assinadoEm;
    if (hasSignature) {
      drawSignatureSection(doc, order.signature, colors);
    } else {
      doc.fontSize(10).font('Helvetica').fillColor(colors.textLight).text('Aguardando assinatura eletrônica do cliente.');
      doc.moveDown(1);
    }
  }

  const totalPages = doc.bufferedPageRange().count;
  const showFooter = !layout || footerCfg.mostrarEmpresa !== false || footerCfg.mostrarPagina !== false;
  if (showFooter) {
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(doc, org, i + 1, totalPages, colors, footerCfg, config);
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

// ── PDF with imported timbrado ────────────────────────────────────────

async function buildPdfWithTimbrado(
  order: any, layout: any, org: any, logoBuffer: Buffer | null, filepath: string,
  timbradoBytes: Buffer,
): Promise<string> {
  const colors = getColors(layout);
  const margins = getMargins(layout);

  const contentDoc = new PDFDocument({
    size: 'A4',
    margins,
    bufferPages: true,
  });

  const tempDir = path.resolve(__dirname, '../../../storage/pdfs');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempFilepath = path.join(tempDir, `temp-${Date.now()}.pdf`);
  const tempStream = fs.createWriteStream(tempFilepath);
  contentDoc.pipe(tempStream);

  drawContentOnly(contentDoc, order, colors);

  const totalPages = contentDoc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    contentDoc.switchToPage(i);
    drawMinimalFooter(contentDoc, i + 1, totalPages, colors);
  }

  contentDoc.end();

  await new Promise<void>((resolve, reject) => {
    tempStream.on('finish', () => resolve());
    tempStream.on('error', reject);
  });

  try {
    const contentBytes = fs.readFileSync(tempFilepath);

    const timbradoPdf = await PDFLibDocument.load(timbradoBytes);
    const contentPdf = await PDFLibDocument.load(contentBytes);

    const mergedPdf = await PDFLibDocument.create();
    const timbradoPages = timbradoPdf.getPageCount();
    const contentPages = contentPdf.getPageCount();
    const applyToAll = layout.timbradoApply === 'todas_paginas';

    // Gerar uma página para cada página de conteúdo (sem páginas em branco)
    for (let i = 0; i < contentPages; i++) {
      const contentPage = contentPdf.getPage(i);
      const contentSize = contentPage.getSize();

      // Determinar se aplicar timbrado nesta página
      const shouldApplyTimbrado = applyToAll || i === 0;

      if (shouldApplyTimbrado && timbradoPages > 0) {
        // Usar timbrado como fundo (ciclar se timbrado tem menos páginas)
        const timbradoIndex = applyToAll ? (i % timbradoPages) : 0;
        const timbradoPage = timbradoPdf.getPage(timbradoIndex);
        const timbradoSize = timbradoPage.getSize();

        const [embeddedTimbrado] = await mergedPdf.embedPages([timbradoPage]);
        const page = mergedPdf.addPage([timbradoSize.width, timbradoSize.height]);
        page.drawPage(embeddedTimbrado);

        // Sobrepor conteúdo na página
        const [embeddedContent] = await mergedPdf.embedPages([contentPage]);
        page.drawPage(embeddedContent);
      } else {
        // Sem timbrado: apenas conteúdo
        const [embeddedContent] = await mergedPdf.embedPages([contentPage]);
        const page = mergedPdf.addPage([contentSize.width, contentSize.height]);
        page.drawPage(embeddedContent);
      }
    }

    const mergedBytes = await mergedPdf.save();
    fs.writeFileSync(filepath, Buffer.from(mergedBytes));

    try { fs.unlinkSync(tempFilepath); } catch {}

    return filepath;
  } catch (error: any) {
    console.error('Erro ao mesclar PDFs:', error);
    try { fs.unlinkSync(tempFilepath); } catch {}
    return buildPdfWithLayout(order, null, org, logoBuffer, filepath);
  }
}

function drawContentOnly(doc: PDFKit.PDFDocument, order: any, colors: typeof DEFAULT_COLORS) {
  const margin = doc.page.margins.left;

  drawSectionTitle(doc, '1. DADOS DO CLIENTE', colors);
  drawField(doc, 'Razão Social', order.client?.razaoSocial, colors);
  if (order.client?.nomeFantasia) drawField(doc, 'Nome Fantasia', order.client.nomeFantasia, colors);
  if (order.client?.cnpjCpf) drawField(doc, 'CNPJ/CPF', order.client.cnpjCpf, colors);
  if (order.client?.telefone) drawField(doc, 'Telefone', order.client.telefone, colors);
  if (order.client?.email) drawField(doc, 'Email', order.client.email, colors);
  if (order.client?.cidade && order.client?.estado) {
    drawField(doc, 'Cidade/UF', `${order.client.cidade}/${order.client.estado}`, colors);
  }
  drawSeparator(doc, colors);

  drawSectionTitle(doc, '2. DADOS DO SERVIÇO', colors);
  const tipoLabels: Record<string, string> = {
    implantacao: 'Implantação', suporte: 'Suporte', treinamento: 'Treinamento',
    desenvolvimento: 'Desenvolvimento', manutencao: 'Manutenção',
  };
  drawField(doc, 'Tipo de Serviço', tipoLabels[order.tipoServico || ''] || order.tipoServico || '-', colors);
  if (order.descricaoServico) drawField(doc, 'Descrição', order.descricaoServico, colors);
  const sistemas = JSON.parse(order.sistemasEnvolvidos || '[]');
  if (sistemas?.length) drawField(doc, 'Sistemas Envolvidos', sistemas.join(', '), colors);
  if (order.equipamentos) drawField(doc, 'Equipamentos', order.equipamentos, colors);
  if (order.dataPrevistaEntrega) drawField(doc, 'Previsão de Entrega', formatDateBR(order.dataPrevistaEntrega), colors);
  drawSeparator(doc, colors);

  if (order.items && order.items.length > 0) {
    drawSectionTitle(doc, '3. ITENS / MATERIAIS / SERVIÇOS', colors);
    drawItemsTable(doc, order.items, colors);
    drawSeparator(doc, colors);
  }

  drawSectionTitle(doc, '4. TÉCNICO RESPONSÁVEL E VALOR', colors);
  drawField(doc, 'Técnico', order.tecnicoResponsavel.name, colors);
  if (order.valorServico) drawField(doc, 'Valor do Serviço', `R$ ${order.valorServico.toFixed(2)}`, colors);
  drawSeparator(doc, colors);

  if (order.observacoes) {
    drawSectionTitle(doc, '5. OBSERVAÇÕES', colors);
    doc.fontSize(10).font('Helvetica').fillColor(colors.text).text(order.observacoes);
    doc.moveDown(0.5);
    drawSeparator(doc, colors);
  }

  const hasSignature = order.signature && order.signature.assinadoEm;
  drawSectionTitle(doc, '6. ASSINATURA ELETRÔNICA DO CLIENTE', colors);
  if (hasSignature) {
    drawSignatureSection(doc, order.signature, colors);
  } else {
    doc.fontSize(10).font('Helvetica').fillColor(colors.textLight).text('Aguardando assinatura eletrônica do cliente.');
    doc.moveDown(1);
  }
}

function drawMinimalFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number, colors: typeof DEFAULT_COLORS) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  const footerY = doc.page.height - 30;

  doc.fontSize(6).font('Helvetica').fillColor(colors.textLight);
  doc.text(`Página ${pageNum} de ${totalPages}`, margin, footerY, { width: contentW, align: 'center' });
}

// ── Drawing Helpers (with colors param) ──────────────────────────────

function drawFirstPageHeader(
  doc: PDFKit.PDFDocument, org: any, logoBuffer: Buffer | null,
  numeroOs: string, dataEmissao: Date, colors: typeof DEFAULT_COLORS,
  headerCfg: any = {}, layoutConfig: any = {},
) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const contentW = pageW - margin * 2;

  const showLogo = headerCfg.mostrarLogo !== false;
  const showCompany = headerCfg.mostrarEmpresa !== false;
  const logoW = headerCfg.logoLargura || 140;
  const logoH = headerCfg.logoAltura || 70;

  doc.save();
  doc.rect(0, 0, pageW, 120).fill(colors.primary);
  doc.restore();

  let hasLogo = false;
  if (showLogo && logoBuffer) {
    try {
      doc.image(logoBuffer, margin, 20, { fit: [logoW, logoH], valign: 'center' });
      hasLogo = true;
    } catch {}
  }

  const companyX = hasLogo ? margin + logoW + 15 : margin;
  if (showCompany && org?.nome) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
    doc.text(org.nome, companyX, 25, { width: contentW - (hasLogo ? logoW + 15 : 0) });
  }

  const orgDetails: string[] = [];
  if (headerCfg.mostrarCnpj !== false && org?.cnpjCpf) orgDetails.push(`CNPJ: ${org.cnpjCpf}`);
  if (headerCfg.mostrarTelefone !== false && org?.telefone) orgDetails.push(`Tel: ${org.telefone}`);
  if (headerCfg.mostrarEmail !== false && org?.email) orgDetails.push(org.email);
  if (orgDetails.length > 0) {
    doc.fontSize(8).font('Helvetica').fillColor(colors.border);
    doc.text(orgDetails.join('  •  '), companyX, 48, { width: contentW - (hasLogo ? logoW + 15 : 0) });
  }

  if (headerCfg.mostrarWebsite !== false && org?.website) {
    doc.fontSize(8).font('Helvetica').fillColor(colors.border);
    doc.text(org.website, companyX, 60, { width: contentW - (hasLogo ? logoW + 15 : 0) });
  }

  doc.save();
  doc.rect(0, 90, pageW, 30).fill(colors.primaryLight);
  doc.restore();

  const titulo = headerCfg.tituloOs || 'ORDEM DE SERVIÇO';
  doc.fontSize(13).font('Helvetica-Bold').fillColor(colors.primary);
  doc.text(titulo, margin, 95, { width: contentW * 0.6 });

  doc.fontSize(10).font('Helvetica').fillColor(colors.textLight);
  doc.text(`Nº ${numeroOs}`, margin + contentW * 0.6, 95, { width: contentW * 0.4, align: 'right' });
  doc.text(`Emissão: ${formatDateBR(dataEmissao)}`, margin + contentW * 0.6, 108, { width: contentW * 0.4, align: 'right' });

  doc.y = 130;
  doc.x = margin;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, colors: typeof DEFAULT_COLORS) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
  doc.text(title, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left * 2 });
  doc.moveDown(0.3);
}

function drawField(doc: PDFKit.PDFDocument, label: string, value: string, colors: typeof DEFAULT_COLORS) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.textLight);
  doc.text(`${label}:`, margin, doc.y, { continued: true, width: contentW });
  doc.font('Helvetica').fillColor(colors.text);
  doc.text(` ${safeText(value)}`);
  doc.moveDown(0.15);
}

function drawSeparator(doc: PDFKit.PDFDocument, colors: typeof DEFAULT_COLORS) {
  doc.moveDown(0.3);
  const y = doc.y;
  doc.save();
  doc.strokeColor(colors.border).lineWidth(0.5);
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.restore();
  doc.moveDown(0.5);
}

function drawItemsTable(doc: PDFKit.PDFDocument, items: any[], colors: typeof DEFAULT_COLORS) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  const colWidths = [180, 60, 40, 70, 70];
  const headers = ['Descrição', 'Tipo', 'Qtd', 'Valor Unit.', 'Total'];

  doc.save();
  doc.rect(margin, doc.y - 2, contentW, 18).fill(colors.primaryLight);
  doc.restore();

  doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.primary);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, doc.y, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
    x += colWidths[i] + 10;
  });
  doc.moveDown(0.4);
  doc.y += 2;

  doc.save();
  doc.strokeColor(colors.primary).lineWidth(0.5);
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).stroke();
  doc.restore();
  doc.moveDown(0.3);

  doc.fontSize(8).font('Helvetica').fillColor(colors.text);
  let totalItens = 0;
  for (const item of items) {
    const tipoLabel = item.tipo === 'material' ? 'Material' : item.tipo === 'outros' ? 'Outros' : 'Serviço';
    const row = [
      item.descricao,
      tipoLabel,
      String(item.quantidade),
      item.valorUnitario ? `R$ ${item.valorUnitario.toFixed(2)}` : '-',
      item.valorTotal ? `R$ ${item.valorTotal.toFixed(2)}` : '-',
    ];
    totalItens += item.valorTotal || 0;

    let rx = margin;
    row.forEach((cell: string, i: number) => {
      doc.text(cell, rx + 2, doc.y, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
      rx += colWidths[i] + 10;
    });
    doc.moveDown(0.2);
  }

  doc.moveDown(0.2);
  doc.save();
  doc.rect(margin, doc.y - 2, contentW, 16).fill(colors.primaryLight);
  doc.restore();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.primary);
  doc.text(`Total dos Itens: R$ ${totalItens.toFixed(2)}`, margin, doc.y, { width: contentW, align: 'right' });
  doc.moveDown(0.5);
}

function drawSignatureSection(doc: PDFKit.PDFDocument, signature: any, colors: typeof DEFAULT_COLORS) {
  const margin = doc.page.margins.left;

  if (signature.assinaturaBase64 && signature.assinaturaBase64 !== 'SEM_ASSINATURA') {
    try {
      const imgBuffer = Buffer.from(
        signature.assinaturaBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
      doc.image(imgBuffer, margin + 75, doc.y, { width: 250, height: 80 });
      doc.moveDown(4);
    } catch {
      doc.fontSize(10).font('Helvetica').fillColor(colors.textLight).text('[Assinatura não disponível]');
      doc.moveDown(0.5);
    }
  }

  doc.fontSize(9).font('Helvetica').fillColor(colors.text);
  if (signature.assinanteNome) doc.text(`Nome: ${signature.assinanteNome}`);
  if (signature.assinanteCpf) doc.text(`CPF: ${signature.assinanteCpf}`);
  if (signature.assinanteCargo) doc.text(`Cargo: ${signature.assinanteCargo}`);
  if (signature.signedAt || signature.assinadoEm) {
    doc.text(`Data/Hora: ${formatDateBR(signature.signedAt || signature.assinadoEm)}`);
  }
  if (signature.timezone) doc.text(`Fuso Horário: ${signature.timezone}`);
  if (signature.signatureIdentifier) doc.text(`Identificador: ${signature.signatureIdentifier}`);
  if (signature.documentHash) {
    doc.text(`Hash de Integridade: ${signature.documentHash.substring(0, 32)}...`);
  }
  doc.font('Helvetica-Bold').fillColor(colors.primary).text('Status: Assinado eletronicamente');
  doc.moveDown(0.8);

  drawSeparator(doc, colors);

  doc.fontSize(7).font('Helvetica').fillColor(colors.textLight);
  doc.text(
    `Documento assinado eletronicamente em ${formatDateBR(signature.signedAt || signature.assinadoEm)} | IP: ${signature.ipAssinante || 'N/A'}`,
    margin, doc.y,
    { width: doc.page.width - margin * 2, align: 'center' }
  );
  if (signature.signatureIdentifier) {
    doc.text(`Identificador da Assinatura: ${signature.signatureIdentifier}`, { align: 'center' });
  }
  doc.text(`Hub Codemed - ${env.appUrl}`, { align: 'center' });
}

function drawFooter(
  doc: PDFKit.PDFDocument, org: any, pageNum: number, totalPages: number,
  colors: typeof DEFAULT_COLORS, footerCfg: any = {}, layoutConfig: any = {},
) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const contentW = pageW - margin * 2;
  const footerY = doc.page.height - 50;

  doc.save();
  doc.strokeColor(colors.border).lineWidth(0.5);
  doc.moveTo(margin, footerY).lineTo(margin + contentW, footerY).stroke();
  doc.restore();

  if (footerCfg.mostrarEmpresa !== false) {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.text);
    const footerParts: string[] = [];
    if (org?.nome) footerParts.push(org.nome);
    if (org?.cnpjCpf) footerParts.push(`CNPJ: ${org.cnpjCpf}`);
    doc.text(footerParts.join('  •  '), margin, footerY + 5, { width: contentW, align: 'center' });
  }

  if (footerCfg.mostrarContato !== false) {
    const footerContact: string[] = [];
    if (org?.telefone) footerContact.push(`Tel: ${org.telefone}`);
    if (org?.email) footerContact.push(org.email);
    if (org?.website) footerContact.push(org.website);
    if (footerContact.length > 0) {
      doc.fontSize(6).font('Helvetica').fillColor(colors.textLight);
      doc.text(footerContact.join('  •  '), margin, footerY + 15, { width: contentW, align: 'center' });
    }
  }

  if (footerCfg.mostrarPagina !== false) {
    doc.fontSize(6).font('Helvetica').fillColor(colors.textLight);
    doc.text(`Página ${pageNum} de ${totalPages}`, margin, footerY + 27, { width: contentW, align: 'center' });
  }

  if (footerCfg.textoPersonalizado) {
    doc.fontSize(6).font('Helvetica').fillColor(colors.textLight);
    doc.text(footerCfg.textoPersonalizado, margin, footerY + 37, { width: contentW, align: 'center' });
  } else if (footerCfg.mostrarDisclaimer !== false) {
    doc.fontSize(5).fillColor(colors.textLight);
    doc.text('Documento gerado pelo sistema CodeHelp CRM/Helpdesk', margin, footerY + 37, { width: contentW, align: 'center' });
  }
}
