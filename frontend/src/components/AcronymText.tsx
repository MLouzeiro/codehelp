import React from 'react';
import AcronymTooltip from './AcronymTooltip';

const ACRONYM_PATTERNS = ['CSAT', 'FCR', 'SLA', 'TMR', 'TMA', 'TME', 'PR', 'NPS', 'KPI', 'MTTR', 'CHT', 'IA'];

export function wrapAcronyms(text: string): React.ReactNode[] {
  const regex = new RegExp(`\\b(${ACRONYM_PATTERNS.join('|')})\\b`, 'g');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (ACRONYM_PATTERNS.includes(part)) {
      return <AcronymTooltip key={i} acronym={part} />;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AcronymText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{wrapAcronyms(text)}</span>;
}
