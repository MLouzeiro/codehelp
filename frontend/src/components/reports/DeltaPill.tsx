import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  valor: number;
  sufixo?: string;
  invertido?: boolean;
}

export default function DeltaPill({ valor, sufixo, invertido }: Props) {
  const ruim = invertido ? valor > 0 : valor < 0;
  const bom = invertido ? valor < 0 : valor > 0;
  const Icon = valor > 0 ? TrendingUp : valor < 0 ? TrendingDown : null;
  const cor = ruim ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
    : bom ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
  const sinal = valor > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      {Icon && <Icon size={12} />}
      {sinal}{valor}{sufixo || ''}
    </span>
  );
}