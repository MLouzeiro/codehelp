import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@codemed.com.br' } });
  if (adminExists) {
    console.log('Admin já existe. Pulando seed.');
    return;
  }

  const password = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@codemed.com.br',
      password,
      role: 'admin',
      phone: '(11) 99999-9999',
    },
  });

  const vendedor = await prisma.user.create({
    data: {
      name: 'Vendedor Teste',
      email: 'vendedor@codemed.com.br',
      password,
      role: 'vendedor',
      phone: '(11) 98888-8888',
    },
  });

  await prisma.client.createMany({
    data: [
      { name: 'Lab Saúde Total', email: 'contato@labsaude.com.br', phone: '(11) 3333-1111', company: 'Lab Saúde Total Ltda', sellerId: vendedor.id },
      { name: 'Análise Clínica ABC', email: 'admin@lababc.com.br', phone: '(11) 3333-2222', company: 'ABC Análises Clínicas', sellerId: vendedor.id },
    ],
  });

  await prisma.task.createMany({
    data: [
      { title: 'Implementar módulo de login', description: 'Criar tela de login com JWT', status: 'concluida', priority: 'alta', order: 1, assigneeId: vendedor.id },
      { title: 'Cadastro de clientes', description: 'CRUD de clientes com busca', status: 'em_andamento', priority: 'media', order: 2, assigneeId: vendedor.id },
      { title: 'Dashboard com gráficos', description: 'Criar dashboard com Recharts', status: 'aberta', priority: 'media', order: 3, assigneeId: vendedor.id },
      { title: 'Kanban drag-and-drop', description: 'Implementar drag and drop nativo', status: 'aberta', priority: 'alta', order: 4 },
    ],
  });

  console.log('Seed concluído com sucesso!');
  console.log(`Admin: admin@codemed.com.br / admin123`);
  console.log(`Vendedor: vendedor@codemed.com.br / admin123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
