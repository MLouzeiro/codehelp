import { describe, it, expect } from 'vitest';
import { normalizePhone, phoneDigitsFromChat } from '../modules/integrations/whatsapp/whatsapp-utils';

describe('whatsapp-utils (FASE 9 — deduplicação)', () => {
  it('normalizePhone remove tudo que não é dígito', () => {
    expect(normalizePhone('(85) 99999-8888')).toBe('85999998888');
    expect(normalizePhone('+55 85 9999-8888')).toBe('558599998888');
    expect(normalizePhone('abc123')).toBe('123');
    expect(normalizePhone('')).toBe('');
  });

  it('normalizePhone é idêntico a replace(/[^\d]/g, \'\')', () => {
    const entradas = ['(85) 99999-8888', '5511999887766', '@c.us', 'texto sem numero'];
    for (const entrada of entradas) {
      expect(normalizePhone(entrada)).toBe(entrada.replace(/[^\d]/g, ''));
    }
  });

  it('phoneDigitsFromChat extrai dígitos ignorando sufixo', () => {
    expect(phoneDigitsFromChat('5511999887766@s.whatsapp.net')).toBe('5511999887766');
    expect(phoneDigitsFromChat('5511999887766@c.us')).toBe('5511999887766');
    expect(phoneDigitsFromChat('85999998888@broadcast')).toBe('85999998888');
  });
});