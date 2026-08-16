import { RefreshCw, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';

const btnCls = 'flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors print:hidden';

interface Props {
  onRefresh: () => void;
  onCsv?: () => void;
  onExcel?: () => void;
  onPdf?: () => void;
  onPrint?: () => void;
}

export default function ReportActions({ onRefresh, onCsv, onExcel, onPdf, onPrint }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={onRefresh} className={btnCls} style={{ fontFamily: 'Lexend, sans-serif' }}>
        <RefreshCw size={14} /> Atualizar
      </button>
      {onCsv && (
        <button onClick={onCsv} className={btnCls} style={{ fontFamily: 'Lexend, sans-serif' }}>
          <Download size={14} /> CSV
        </button>
      )}
      {onExcel && (
        <button onClick={onExcel} className={btnCls} style={{ fontFamily: 'Lexend, sans-serif' }}>
          <FileSpreadsheet size={14} /> Excel
        </button>
      )}
      {onPdf && (
        <button onClick={onPdf} className={btnCls} style={{ fontFamily: 'Lexend, sans-serif' }}>
          <FileText size={14} /> PDF
        </button>
      )}
      {onPrint && (
        <button onClick={onPrint} className={btnCls} style={{ fontFamily: 'Lexend, sans-serif' }}>
          <Printer size={14} /> Imprimir
        </button>
      )}
    </div>
  );
}