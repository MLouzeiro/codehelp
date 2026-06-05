export type CategoriaSuporte =
  | 'suporte_tecnico'
  | 'duvida_faturamento'
  | 'solicitacao_mudanca'
  | 'treinamento'
  | 'reclamacao'
  | 'orcamento'
  | 'agendamento'
  | 'outro';

export const CATEGORIAS: CategoriaSuporte[] = [
  'suporte_tecnico',
  'duvida_faturamento',
  'solicitacao_mudanca',
  'treinamento',
  'reclamacao',
  'orcamento',
  'agendamento',
  'outro',
];

export function classifyLocal(texto: string, categorias: string[] = CATEGORIAS): string {
  const lower = (texto || '').toLowerCase();
  if (/(erro|bug|não funciona|quebrou|falha|problema|travou|parou)/.test(lower)) return 'suporte_tecnico';
  if (/(boleto|fatura|nota|pagamento|cobrança|preço|valor|contrato|dinheiro|pix)/.test(lower)) return 'duvida_faturamento';
  if (/(quero|preciso|mudar|adicionar|novo|implementar|sugestão|melhoria|gostaria)/.test(lower)) return 'solicitacao_mudanca';
  if (/(como|ajuda|ensinar|aprender|dúvida|funciona|tutorial|manual|orientação)/.test(lower)) return 'treinamento';
  if (/(insatisfeito|péssimo|horrível|reclamação|chateado|decepção|ruim)/.test(lower)) return 'reclamacao';
  if (/(orçamento|quanto custa|preço|valor|quero contratar)/.test(lower)) return 'orcamento';
  if (/(agendar|visita|horário|quando|pode ir|vir aqui)/.test(lower)) return 'agendamento';
  return 'outro';
}
