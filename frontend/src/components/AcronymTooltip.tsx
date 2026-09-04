import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, ExternalLink } from 'lucide-react';
import { getGlossaryEntry, type GlossaryEntry } from '../lib/metricGlossary';

const ACRONYMS: Record<string, { label: string; full: string; desc: string; meta?: string }> = {
  CSAT: { label: 'CSAT', full: 'Customer Satisfaction Score', desc: 'Indicador de satisfacao do cliente. Escala de 1 a 5.', meta: '3.5' },
  FCR: { label: 'FCR', full: 'First Contact Resolution', desc: 'Taxa de resolucao no primeiro contato. Percentual de tickets resolvidos sem reabertura.', meta: '60%' },
  SLA: { label: 'SLA', full: 'Service Level Agreement', desc: 'Acordo de nivel de servico. Percentual de tickets atendidos dentro do prazo.', meta: '95%' },
  TMR: { label: 'TMR', full: 'Tempo Medio de Resolucao', desc: 'Tempo medio entre criacao e resolucao do ticket.', meta: '360 min' },
  TMA: { label: 'TMA', full: 'Tempo Medio de Atendimento', desc: 'Tempo medio total do atendimento, incluindo todas as etapas.' },
  TME: { label: 'TME', full: 'Tempo Medio de Espera', desc: 'Tempo medio que o cliente aguarda entre envios de mensagem ate resposta do agente.', meta: '30 min' },
  PR: { label: 'PR', full: 'Primeira Resposta', desc: 'Tempo entre criacao do ticket e primeira resposta do analista.', meta: '15 min' },
  NPS: { label: 'NPS', full: 'Net Promoter Score', desc: 'Indicador de lealdade do cliente. Escala de -100 a 100.' },
  KPI: { label: 'KPI', full: 'Key Performance Indicator', desc: 'Indicador-chave de desempenho. Metrica usada para avaliar a eficacia de um processo.' },
  MTTR: { label: 'MTTR', full: 'Mean Time To Resolve', desc: 'Tempo medio entre a primeira resposta e a resolucao do problema.' },
  CHT: { label: 'CHT', full: 'First Response Time', desc: 'Alias para PR (Primeira Resposta) em alguns contextos.' },
  IA: { label: 'IA', full: 'Inteligencia Artificial', desc: 'Sistema de analise automatizada de tickets, conversas e desempenho.' },
};

interface AcronymTooltipProps {
  acronym: string;
  children?: React.ReactNode;
  className?: string;
}

export default function AcronymTooltip({ acronym, children, className = '' }: AcronymTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const key = acronym.toUpperCase();
  const info = ACRONYMS[key];
  const glossary = getGlossaryEntry(key);

  useEffect(() => {
    if (!showDetail) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDetail(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDetail]);

  if (!info) {
    return <span className={className}>{children || acronym}</span>;
  }

  return (
    <span ref={ref} className={`relative inline-flex items-center gap-0.5 ${className}`}>
      <span
        className="border-b border-dashed border-current cursor-help"
        onMouseEnter={() => { if (!showDetail) setShowTooltip(true); }}
        onMouseLeave={() => { if (!showDetail) setShowTooltip(false); }}
        onClick={() => { setShowTooltip(false); setShowDetail(!showDetail); }}
      >
        {children || acronym}
      </span>
      <HelpCircle
        size={10}
        className="text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-help"
        onClick={(e) => { e.stopPropagation(); setShowTooltip(false); setShowDetail(!showDetail); }}
      />

      {showTooltip && !showDetail && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
          <span className="font-bold text-violet-300">{info.full}</span>
          <span className="block mt-1 text-gray-300 leading-relaxed">{info.desc}</span>
          {info.meta && (
            <span className="block mt-1 text-emerald-400 text-[10px]">Meta: {info.meta}</span>
          )}
          <span className="block mt-1.5 text-[10px] text-gray-500">Clique para ver detalhes</span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
        </span>
      )}

      {showDetail && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs rounded-xl shadow-2xl z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-gray-200 dark:border-gray-700">
            <span className="font-bold text-violet-700 dark:text-violet-300">{acronym}</span>
            <button onClick={(e) => { e.stopPropagation(); setShowDetail(false); }} className="p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/30 rounded">
              <X size={12} />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <div>
              <div className="font-semibold text-[11px] text-gray-500 dark:text-gray-400 uppercase">Nome completo</div>
              <div className="text-sm font-medium">{info.full}</div>
            </div>
            <div>
              <div className="font-semibold text-[11px] text-gray-500 dark:text-gray-400 uppercase">O que mede</div>
              <div className="text-sm">{glossary?.descricao || info.desc}</div>
            </div>
            {glossary && (
              <div>
                <div className="font-semibold text-[11px] text-gray-500 dark:text-gray-400 uppercase">Como e calculado</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{glossary.comoCalculado}</div>
              </div>
            )}
            {(info.meta || glossary?.meta) && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Meta:</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{info.meta || glossary?.meta}</span>
              </div>
            )}
          </div>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-gray-800" />
        </span>
      )}
    </span>
  );
}

export function getAcronymFull(key: string): string {
  return ACRONYMS[key.toUpperCase()]?.full || key;
}

export function getAcronymDesc(key: string): string {
  return ACRONYMS[key.toUpperCase()]?.desc || '';
}
