import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ProductStatus } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL or DIRECT_URL is required to seed the database',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const products = [
  {
    code: 'BECE',
    name: 'BECE Checker',
    scopeDisclosure:
      'Checks BECE School and BECE Private candidate results across all years.',
    displayOrder: 1,
  },
  {
    code: 'WASSCE',
    name: 'WASSCE Checker',
    scopeDisclosure:
      'Checks WASSCE School candidate results across all years. It does not check BECE or private-candidate results.',
    displayOrder: 2,
  },
  {
    code: 'NOVDEC_PRIVATE',
    name: 'NOV/DEC Private Checker',
    scopeDisclosure:
      'Checks WASSCE Private, ABCE, and GBCE candidate results across all years.',
    displayOrder: 3,
  },
] as const;

async function main(): Promise<void> {
  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        scopeDisclosure: product.scopeDisclosure,
        displayOrder: product.displayOrder,
      },
      create: {
        ...product,
        status: ProductStatus.UNAVAILABLE,
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw error;
  });
