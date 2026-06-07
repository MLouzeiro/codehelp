import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.update({
    where: { email: 'admin@codemed.com.br' },
    data: { isMaster: true },
  });
  console.log(`[migrate-master] admin.isMaster = ${admin.isMaster}`);

  const fila = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
  if (fila && !fila.etapaInicial) {
    await prisma.helpdeskConfig.update({
      where: { id: fila.id },
      data: { etapaInicial: true },
    });
    console.log('[migrate-master] fila.etapaInicial = true');
  }

  const triagem = await prisma.helpdeskConfig.findUnique({ where: { slug: 'triagem' } });
  if (triagem && triagem.ativo) {
    await prisma.helpdeskConfig.update({
      where: { id: triagem.id },
      data: { ativo: false },
    });
    console.log('[migrate-master] triagem desativada (migrada para fila)');
  }

  const outrosComEtapaInicial = await prisma.helpdeskConfig.findMany({
    where: { etapaInicial: true, slug: { not: 'fila' } },
  });
  if (outrosComEtapaInicial.length > 0) {
    await prisma.helpdeskConfig.updateMany({
      where: { id: { in: outrosComEtapaInicial.map((o) => o.id) } },
      data: { etapaInicial: false },
    });
    console.log(`[migrate-master] removido etapaInicial de ${outrosComEtapaInicial.length} etapas (so fila pode ser inicial)`);
  }

  console.log('[migrate-master] OK');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
