import { LucideIcon } from 'lucide-react';
import { AcronymText } from '../AcronymText';

interface Props {
  label: string;
  valor: string | number;
  icon: LucideIcon;
  cor: string;
  delta?: React.ReactNode;
}

export default function ReportKpiCard({ label, valor, icon: Icon, cor, delta }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cor}`}>
          <Icon size={18} />
        </div>
        {delta}
      </div>
      <div className="mt-3">
        <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{valor}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}><AcronymText text={label} /></div>
      </div>
    </div>
  );
}