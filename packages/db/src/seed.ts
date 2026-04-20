/**
 * ClaudeShop seed script — creates a demo tenant with sample catalog,
 * customers, and an admin AuthUser (email: demo@claudeshop.local,
 * password: demo-admin-1234).
 *
 * Invoked via `pnpm db:seed`.
 */
import bcrypt from 'bcryptjs';
import { createPrismaClient, withTenant } from './client.js';

const DEMO_ADMIN_EMAIL = 'demo@claudeshop.local';
const DEMO_ADMIN_PASSWORD = 'demo-admin-1234';

async function main() {
  const prisma = createPrismaClient();

  try {
    const demoTenant = await prisma.tenant.upsert({
      where: { slug: 'demo' },
      create: {
        slug: 'demo',
        name: 'Demo Store',
        plan: 'PRO',
        settings: {
          currency: 'EUR',
          defaultLocale: 'en',
          locales: ['en', 'fr', 'de', 'es'],
        },
      },
      update: {},
    });

    // eslint-disable-next-line no-console
    console.info(`Demo tenant ready: ${demoTenant.id} (${demoTenant.slug})`);

    await withTenant(prisma, demoTenant.id, async (tx) => {
      const product = await tx.product.upsert({
        where: { tenantId_slug: { tenantId: demoTenant.id, slug: 'hello-claudeshop-tee' } },
        create: {
          tenantId: demoTenant.id,
          slug: 'hello-claudeshop-tee',
          status: 'ACTIVE',
          type: 'VARIABLE',
          name: {
            en: 'Hello ClaudeShop T-Shirt',
            fr: 'T-Shirt Hello ClaudeShop',
            de: 'Hello ClaudeShop T-Shirt',
            es: 'Camiseta Hello ClaudeShop',
          },
          description: {
            en: 'A 100% organic cotton tee — proof that ClaudeShop can sell things.',
            fr: 'T-shirt coton bio 100% — preuve que ClaudeShop sait vendre.',
          },
          seo: {
            title: { en: 'Hello ClaudeShop Tee', fr: 'T-shirt Hello ClaudeShop' },
            description: { en: 'The iconic demo tee.', fr: 'Le t-shirt démo iconique.' },
          },
          variants: {
            create: [
              { sku: 'HCS-TEE-S', options: { size: 'S', color: 'black' }, weight: '0.2' },
              { sku: 'HCS-TEE-M', options: { size: 'M', color: 'black' }, weight: '0.22' },
              { sku: 'HCS-TEE-L', options: { size: 'L', color: 'black' }, weight: '0.24' },
            ],
          },
        },
        update: {},
      });
      // eslint-disable-next-line no-console
      console.info(`Seeded product: ${product.slug}`);

      // Phase 15 — seed PriceSets so the storefront PDP shows real prices.
      const variants = await tx.variant.findMany({
        where: { productId: product.id },
        select: { id: true, sku: true },
      });
      for (const v of variants) {
        for (const { currency, amount } of [
          { currency: 'EUR', amount: '29.90' },
          { currency: 'USD', amount: '32.00' },
        ]) {
          await tx.priceSet.upsert({
            where: {
              variantId_currency_channel: {
                variantId: v.id,
                currency,
                channel: 'default',
              },
            },
            create: {
              variantId: v.id,
              currency,
              channel: 'default',
              amount,
              taxIncluded: false,
            },
            update: {},
          });
        }
      }
      // eslint-disable-next-line no-console
      console.info(`Seeded ${variants.length * 2} PriceSets (EUR + USD per variant)`);

      const apparel = await tx.category.upsert({
        where: { tenantId_slug: { tenantId: demoTenant.id, slug: 'apparel' } },
        create: {
          tenantId: demoTenant.id,
          slug: 'apparel',
          name: { en: 'Apparel', fr: 'Vêtements' },
          position: 1,
        },
        update: {},
      });
      await tx.category.upsert({
        where: { tenantId_slug: { tenantId: demoTenant.id, slug: 'accessories' } },
        create: {
          tenantId: demoTenant.id,
          slug: 'accessories',
          name: { en: 'Accessories', fr: 'Accessoires' },
          position: 2,
        },
        update: {},
      });
      await tx.categoryOnProduct.upsert({
        where: {
          productId_categoryId: { productId: product.id, categoryId: apparel.id },
        },
        create: { productId: product.id, categoryId: apparel.id },
        update: {},
      });
      // eslint-disable-next-line no-console
      console.info('Seeded categories: apparel + accessories');

      await tx.customer.upsert({
        where: { tenantId_email: { tenantId: demoTenant.id, email: 'demo@claudeshop.local' } },
        create: {
          tenantId: demoTenant.id,
          email: 'demo@claudeshop.local',
          firstName: 'Demo',
          lastName: 'Shopper',
          group: 'B2C',
        },
        update: {},
      });
      // eslint-disable-next-line no-console
      console.info('Seeded customer: demo@claudeshop.local');

      const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
      await tx.authUser.upsert({
        where: { tenantId_email: { tenantId: demoTenant.id, email: DEMO_ADMIN_EMAIL } },
        create: {
          tenantId: demoTenant.id,
          email: DEMO_ADMIN_EMAIL,
          passwordHash,
          role: 'OWNER',
          displayName: 'Demo Owner',
          emailVerified: true,
        },
        update: {},
      });
      // eslint-disable-next-line no-console
      console.info(
        `Seeded admin user: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD} (OWNER)`,
      );

      await tx.page.upsert({
        where: { tenantId_slug: { tenantId: demoTenant.id, slug: 'about' } },
        create: {
          tenantId: demoTenant.id,
          slug: 'about',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          title: {
            en: 'About ClaudeShop',
            fr: 'À propos de ClaudeShop',
          },
          body: {
            en:
              '# About ClaudeShop\n\n' +
              'ClaudeShop is a Claude-native business OS — catalog, orders, payments,\n' +
              'and a merchant copilot all under one repo.\n\n' +
              '- Open source (Apache-2.0)\n' +
              '- Multi-tenant with Postgres RLS\n' +
              '- Semantic search via pgvector\n',
            fr:
              '# À propos de ClaudeShop\n\n' +
              'ClaudeShop est un OS de commerce natif Claude — catalogue, commandes,\n' +
              'paiements et copilote marchand dans un seul repo.\n\n' +
              '- Open source (Apache-2.0)\n' +
              '- Multi-tenant avec RLS Postgres\n' +
              '- Recherche sémantique via pgvector\n',
          },
        },
        update: {},
      });
      // eslint-disable-next-line no-console
      console.info('Seeded CMS page: /about');
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
