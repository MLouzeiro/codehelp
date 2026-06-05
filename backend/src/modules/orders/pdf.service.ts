import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/database';
import { formatDateBR } from '../../shared/utils/helpers';

export async function generatePdf(orderId: string): Promise<string> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      tecnicoResponsavel: { select: { name: true } },
      signature: true,
      criadoPor: { select: { name: true } },
    },
  });
  if (!order || !order.signature) throw new Error('OS ou assinatura não encontrada');

  const dir = path.resolve(__dirname, '../../../storage/pdfs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${order.numeroOs.replace(/\//g, '-')}.pdf`;
  const filepath = path.join(dir, filename);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  const logoPath = path.resolve(__dirname, '../../../storage/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 45, { width: 120 });
  }

  doc.fontSize(20).font('Helvetica-Bold').text('ORDEM DE SERVIÇO', { align: 'center' });
  doc.fontSize(16).font('Helvetica').text(`nº ${order.numeroOs}`, { align: 'center' });
  doc.fontSize(10).text(`Emissão: ${formatDateBR(order.dataEmissao)}`, { align: 'right' });
  doc.moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').text('1. DADOS DO CLIENTE');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Razão Social: ${order.client.razaoSocial}`);
  if (order.client.nomeFantasia) doc.text(`Nome Fantasia: ${order.client.nomeFantasia}`);
  if (order.client.cnpjCpf) doc.text(`CNPJ/CPF: ${order.client.cnpjCpf}`);
  if (order.client.telefone) doc.text(`Telefone: ${order.client.telefone}`);
  if (order.client.email) doc.text(`Email: ${order.client.email}`);
  if (order.client.cidade && order.client.estado) doc.text(`Cidade/UF: ${order.client.cidade}/${order.client.estado}`);
  doc.moveDown(0.5);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').text('2. DADOS DO SERVIÇO');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  const tipoLabels: Record<string, string> = {
    implantacao: 'Implantação', suporte: 'Suporte', treinamento: 'Treinamento',
    desenvolvimento: 'Desenvolvimento', manutencao: 'Manutenção',
  };
  doc.text(`Tipo de Serviço: ${tipoLabels[order.tipoServico] || order.tipoServico}`);
  if (order.descricaoServico) doc.text(`Descrição: ${order.descricaoServico}`);
  const sistemas = JSON.parse(order.sistemasEnvolvidos || '[]');
  if (sistemas?.length) {
    doc.text(`Sistemas Envolvidos: ${sistemas.join(', ')}`);
  }
  if (order.equipamentos) doc.text(`Equipamentos: ${order.equipamentos}`);
  if (order.dataPrevistaEntrega) doc.text(`Previsão de Entrega: ${formatDateBR(order.dataPrevistaEntrega)}`);
  doc.moveDown(0.5);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').text('3. TÉCNICO RESPONSÁVEL E VALOR');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Técnico: ${order.tecnicoResponsavel.name}`);
  if (order.valorServico) doc.text(`Valor do Serviço: R$ ${order.valorServico.toFixed(2)}`);
  doc.moveDown(0.5);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').text('4. ASSINATURA DO CLIENTE');
  doc.moveDown(0.5);

  if (order.signature.assinaturaBase64) {
    const imgBuffer = Buffer.from(order.signature.assinaturaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    doc.image(imgBuffer, 150, doc.y, { width: 250, height: 80 });
    doc.moveDown(4);
  }

  doc.fontSize(10).font('Helvetica');
  doc.text(`Nome: ${order.signature.assinanteNome}`);
  doc.text(`CPF: ${order.signature.assinanteCpf}`);
  doc.text(`Cargo: ${order.signature.assinanteCargo}`);
  doc.text(`Data/Hora da Assinatura: ${formatDateBR(order.signature.assinadoEm)}`);
  doc.moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(8).font('Helvetica').text(
    `Documento assinado eletronicamente em ${formatDateBR(order.signature.assinadoEm)} | IP: ${order.signature.ipAssinante || 'N/A'} | Codemed LTDA`,
    { align: 'center' }
  );
  doc.text(`Hub Codemed - ${process.env.APP_URL || 'http://localhost:3000'}`, { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}
