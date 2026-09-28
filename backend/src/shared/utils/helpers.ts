export function generateOsNumber(year: number, sequence: number): string {
  return `OS-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Gera numeroOs de forma atômica usando a tabela OrderSequence.
 * Atomicidade garantida por upsert + UPDATE … RETURNING dentro de $transaction.
 */
export async function getAtomicOsNumber(prisma: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`INSERT INTO "OrderSequence" ("year", "lastNum") VALUES (${year}, 0) ON CONFLICT ("year") DO NOTHING`;
    const rows = await tx.$queryRaw`UPDATE "OrderSequence" SET "lastNum" = "lastNum" + 1 WHERE "year" = ${year} RETURNING "lastNum"`;
    return rows[0] as { lastNum: number };
  });
  return generateOsNumber(year, seq.lastNum);
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
