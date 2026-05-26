import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });

  const espacos: { nome: string; tipo: 'DIARIO' | 'POR_HORA' }[] = [
    { nome: 'Quadra', tipo: 'POR_HORA' },
    { nome: 'Churrasqueira', tipo: 'DIARIO' },
    { nome: 'Salão de Festas', tipo: 'DIARIO' },
  ];

  for (const espaco of espacos) {
    await prisma.espacoReserva.upsert({
      where: { nome: espaco.nome },
      update: {},
      create: espaco,
    });
  }

  await prisma.configuracao.upsert({
    where: { chave: 'APP_NOME' },
    update: {},
    create: { chave: 'APP_NOME', valor: 'Condomínio' },
  });

  console.log('Seed concluído.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
