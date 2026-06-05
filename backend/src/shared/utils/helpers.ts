export function generateOsNumber(year: number, sequence: number): string {
  return `OS-${year}-${String(sequence).padStart(4, '0')}`;
}

export function generateToken(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
