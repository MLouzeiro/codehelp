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
  // Normalizar para comparação: remove acentos e converte para minúsculas.
  // Isso permite que "não funciona", "nao funciona", "nâo funciona" etc. sejam tousmatch.
  const lower = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/(erro|bug|nao funciona|quebrou|falha|problema|travou|parou)/.test(lower)) return 'suporte_tecnico';
  if (/(boleto|fatura|nota|pagamento|cobranca|preco|valor|contrato|dinheiro|pix)/.test(lower)) return 'duvida_faturamento';
  if (/(quero|preciso|mudar|adicionar|novo|implementar|sugestao|melhoria|gostaria)/.test(lower)) return 'solicitacao_mudanca';
  if (/(como|ajuda|ensinar|aprender|duvida|funciona|tutorial|manual|orientacao)/.test(lower)) return 'treinamento';
  if (/(insatisfeito|peissimo|horriivel|reclamacao|chateado|decepcao|ruim)/.test(lower)) return 'reclamacao';
  if (/(orcamento|quanto custa|preco|valor|quero contratar)/.test(lower)) return 'orcamento';
  if (/(agendar|visita|horario|quando|pode ir|vir aqui)/.test(lower)) return 'agendamento';
  return 'outro';
}
