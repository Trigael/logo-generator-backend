import { Currencies, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * This file creates initial data for database
 * Run: npx prisma db seed
 */

async function main() {
  // Inserting data
  await productTypesSeed();

  console.log('[DB] Seed data inserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


async function productTypesSeed() {
    console.log('[DB] Creating seed for product_types...');

    const existing = await prisma.product_types.findFirst();
  
    // Checking if there is any data
    if (existing) {
      console.log('[DB] Seed for product_types already exists, skipping.');

      return;
    }

    await prisma.product_types.create({
        data: { name: 'temp_logo' }
    })

    await prisma.prices.create({
        data: { 
          amount_cents: 100,
          currency: Currencies.EUR,
          product_type: { connect: { id_product_type: 1}}
         }
    })
}