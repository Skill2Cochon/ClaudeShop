import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api';
import { CopyForm } from './copy-form';
import { ReindexButton } from './reindex-button';
import { EditForm } from './edit-form';
import { VariantPricing } from './variant-pricing';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const displayName =
    product.name.en ?? product.name.fr ?? Object.values(product.name)[0] ?? '(untitled)';

  const seedHint =
    product.description?.en ??
    product.description?.fr ??
    (product.description ? Object.values(product.description)[0] : undefined) ??
    '';

  const attributeHints = [
    ...new Set(
      product.variants.flatMap((v) =>
        Object.entries(v.options).map(([k, val]) => `${k}: ${val}`),
      ),
    ),
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/products" className="text-xs text-muted-foreground hover:underline">
            ← All products
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayName}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {product.slug} · {product.status} · {product.type}
          </p>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-4">
          <h2 className="text-base font-semibold">Edit product</h2>
          <p className="text-xs text-muted-foreground">
            Phase 29 · Update slug, status, type, localized names / descriptions / SEO.
            Variants + pricing stay read-only here — the dedicated Variants section below
            is Phase 30's home.
          </p>
        </header>
        <EditForm product={product} />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-4">
          <h2 className="text-base font-semibold">
            Variants &amp; pricing ({product.variants.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Phase 30 · add, update, or remove a PriceSet per (currency, channel). The
            active price resolver picks the row whose validity window covers now and
            whose channel matches. Attribute hints surfaced to the AI:{' '}
            {attributeHints.length > 0 ? attributeHints.join(' · ') : '—'}
          </p>
        </header>
        <VariantPricing productId={product.id} variants={product.variants} />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-4">
          <h2 className="text-base font-semibold">AI product copy</h2>
          <p className="text-xs text-muted-foreground">
            Phase 4.1 · generates localized name + tagline + description + SEO in one call.
            Falls back to deterministic stub when <code>ANTHROPIC_API_KEY</code> is not set.
          </p>
        </header>
        <CopyForm productId={product.id} defaultSeed={seedHint} />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <header className="mb-4">
          <h2 className="text-base font-semibold">Semantic search</h2>
          <p className="text-xs text-muted-foreground">
            Phase 4.2 · embeddings stored in pgvector via Voyage AI (stub when{' '}
            <code>VOYAGE_API_KEY</code> is not set). Reindex after copy changes so search
            reflects the latest content.
          </p>
        </header>
        <ReindexButton productId={product.id} />
      </section>
    </div>
  );
}
