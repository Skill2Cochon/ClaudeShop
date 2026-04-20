import Link from 'next/link';
import { ImportForm } from './import-form';

export const dynamic = 'force-dynamic';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/products"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All products
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk product import</h1>
        <p className="text-sm text-muted-foreground">
          Phase 21 · Paste CSV or JSON, preview what will happen, and let the importer do the
          rest. Slug collisions are skipped by default (pick &ldquo;fail&rdquo; if you want
          an all-or-nothing seed). Up to 500 rows per batch.
        </p>
      </header>

      <ImportForm />
    </div>
  );
}
