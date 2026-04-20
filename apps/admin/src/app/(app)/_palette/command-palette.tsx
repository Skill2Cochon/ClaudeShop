'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { paletteSearchAction, type PaletteResult, type PaletteResultType } from './actions';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa-dashboard',
    title: 'Go to dashboard',
    subtitle: 'KPIs and activity',
    href: '/dashboard',
    keywords: 'home overview kpi dashboard',
  },
  {
    id: 'qa-products',
    title: 'Go to products',
    subtitle: 'Catalog list',
    href: '/products',
    keywords: 'products catalog items',
  },
  {
    id: 'qa-orders',
    title: 'Go to orders',
    subtitle: 'Recent orders',
    href: '/orders',
    keywords: 'orders sales',
  },
  {
    id: 'qa-customers',
    title: 'Go to customers',
    subtitle: 'CRM list',
    href: '/customers',
    keywords: 'customers crm contacts',
  },
  {
    id: 'qa-segments',
    title: 'Customer segments',
    subtitle: 'Targeting rules',
    href: '/segments',
    keywords: 'segments crm marketing',
  },
  {
    id: 'qa-campaigns',
    title: 'Email campaigns',
    subtitle: 'Marketing emails',
    href: '/campaigns',
    keywords: 'campaigns email marketing',
  },
  {
    id: 'qa-pages',
    title: 'CMS pages',
    subtitle: 'Edit content pages',
    href: '/pages',
    keywords: 'cms pages content',
  },
  {
    id: 'qa-promotions',
    title: 'Promotions',
    subtitle: 'Discount codes',
    href: '/promotions',
    keywords: 'promotions discounts codes',
  },
  {
    id: 'qa-suppliers',
    title: 'Suppliers & purchase orders',
    subtitle: 'ERP',
    href: '/suppliers',
    keywords: 'suppliers erp purchase orders vendors',
  },
  {
    id: 'qa-modules',
    title: 'Modules',
    subtitle: 'Install / configure',
    href: '/modules',
    keywords: 'modules extensions plugins stripe',
  },
  {
    id: 'qa-copilot',
    title: 'Open Copilot',
    subtitle: 'Claude-native merchant brain',
    href: '/copilot',
    keywords: 'copilot ai claude chat assistant',
  },
  {
    id: 'qa-inventory',
    title: 'Inventory dashboard',
    subtitle: 'Low-stock + safety-stock triage',
    href: '/inventory',
    keywords: 'inventory stock low-stock warehouse',
  },
  {
    id: 'qa-import',
    title: 'Bulk import products',
    subtitle: 'CSV or JSON wizard',
    href: '/products/import',
    keywords: 'import bulk csv json products',
  },
  {
    id: 'qa-audit',
    title: 'Audit log',
    subtitle: 'Mutations trail with filters',
    href: '/audit',
    keywords: 'audit log history security',
  },
  {
    id: 'qa-settings',
    title: 'Site settings',
    subtitle: 'Currency, locales, brand',
    href: '/settings',
    keywords: 'settings currency locales brand configuration',
  },
  {
    id: 'qa-webhook-deliveries',
    title: 'Webhook deliveries',
    subtitle: 'Delivery log + manual redeliver',
    href: '/webhooks/deliveries',
    keywords: 'webhook deliveries retry redeliver log',
  },
  {
    id: 'qa-api-keys',
    title: 'API keys',
    subtitle: 'Mint + revoke tenant API keys',
    href: '/settings/api-keys',
    keywords: 'api keys tokens bearer automation n8n zapier',
  },
  {
    id: 'qa-email-templates',
    title: 'Email templates',
    subtitle: 'Preview transactional emails',
    href: '/settings/email-templates',
    keywords: 'email templates transactional preview order shipped refund',
  },
];

const TYPE_LABEL: Record<PaletteResultType, string> = {
  product: 'Product',
  order: 'Order',
  customer: 'Customer',
  segment: 'Segment',
  campaign: 'Campaign',
  supplier: 'Supplier',
  page: 'Page',
  promotion: 'Promotion',
  module: 'Module',
};

const TYPE_CLASS: Record<PaletteResultType, string> = {
  product: 'bg-emerald-100 text-emerald-900',
  order: 'bg-sky-100 text-sky-900',
  customer: 'bg-fuchsia-100 text-fuchsia-900',
  segment: 'bg-amber-100 text-amber-900',
  campaign: 'bg-orange-100 text-orange-900',
  supplier: 'bg-teal-100 text-teal-900',
  page: 'bg-indigo-100 text-indigo-900',
  promotion: 'bg-pink-100 text-pink-900',
  module: 'bg-slate-200 text-slate-900',
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard trigger (⌘K / Ctrl+K) + Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isPalette =
        (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isPalette) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the input whenever we open.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery('');
      setResults([]);
      setCursor(0);
      setError(null);
    }
  }, [open]);

  // Debounced remote search. No server call for queries under 2 chars — we
  // still show the quick actions which satisfies the "empty palette" UX.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await paletteSearchAction(q);
      if (res.error) setError(res.error);
      else setError(null);
      setResults(res.results);
      setSearching(false);
      setCursor(0);
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);

  // Filter quick actions by the current query (local, instant).
  const visibleQuickActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.keywords.includes(q),
    );
  }, [query]);

  const combined = useMemo(
    () => [
      ...results.map((r) => ({ kind: 'result' as const, item: r })),
      ...visibleQuickActions.map((a) => ({ kind: 'action' as const, item: a })),
    ],
    [results, visibleQuickActions],
  );

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(combined.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = combined[cursor];
      if (target) go(target.item.href);
    }
  };

  if (!open) return <PaletteHint onOpen={() => setOpen(true)} />;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="text-muted-foreground">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search products, orders, customers, modules… or pick an action"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {searching ? (
            <span className="text-[10px] text-muted-foreground">…</span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 text-sm">
          {error ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {results.length > 0 ? (
            <Section label="Search results">
              {results.map((r, i) => (
                <ResultRow
                  key={`r-${r.type}-${r.id}`}
                  active={cursor === i}
                  onSelect={() => go(r.href)}
                  onHover={() => setCursor(i)}
                  badge={
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_CLASS[r.type]}`}
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                  }
                  title={r.title}
                  subtitle={r.subtitle}
                />
              ))}
            </Section>
          ) : null}

          {visibleQuickActions.length > 0 ? (
            <Section label={results.length > 0 ? 'Actions' : 'Quick actions'}>
              {visibleQuickActions.map((a, i) => {
                const idx = results.length + i;
                return (
                  <ResultRow
                    key={`a-${a.id}`}
                    active={cursor === idx}
                    onSelect={() => go(a.href)}
                    onHover={() => setCursor(idx)}
                    badge={
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Action
                      </span>
                    }
                    title={a.title}
                    subtitle={a.subtitle}
                  />
                );
              })}
            </Section>
          ) : null}

          {combined.length === 0 && !searching ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No results. Try another query or press Esc to close.
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            ↑↓ navigate · Enter open · Esc close
          </span>
          <span>ClaudeShop Palette</span>
        </div>
      </div>
    </div>
  );
}

function PaletteHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg hover:bg-muted"
      title="Open command palette"
    >
      <span aria-hidden>⌘</span>
      <span>K</span>
      <span className="hidden md:inline">— search anything</span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  active,
  onSelect,
  onHover,
  badge,
  title,
  subtitle,
}: {
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  badge: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
          active ? 'bg-muted' : 'hover:bg-muted/60'
        }`}
      >
        <span className="shrink-0">{badge}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{title}</span>
          {subtitle ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
