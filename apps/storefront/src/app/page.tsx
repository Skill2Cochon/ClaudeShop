import Link from 'next/link';
import { Button } from '@claudeshop/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ClaudeShop · v0.1.0 · Phase 1 Bootstrap
        </p>
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          The modern commerce CMS
        </h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-muted-foreground">
          PrestaShop v150 sous stéroïdes — headless, AI-native, B2B-first, et
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"> docker compose up </code>
          prêt en 5 minutes.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/en">
          <Button size="lg">Browse storefront</Button>
        </Link>
        <a href="http://localhost:3002">
          <Button size="lg" variant="outline">Open admin</Button>
        </a>
        <a href="http://localhost:3001/docs">
          <Button size="lg" variant="ghost">API docs</Button>
        </a>
      </div>

      <footer className="mt-12 text-xs text-muted-foreground">
        <span>Powered by Next.js 16 · Fastify · Prisma 6 · PostgreSQL 16 · pgvector</span>
      </footer>
    </main>
  );
}
