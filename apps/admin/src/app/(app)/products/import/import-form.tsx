'use client';

import { useActionState } from 'react';
import { Button } from '@claudeshop/ui';
import type { ImportProductsBatchResult, RowResult } from '@claudeshop/core';
import { importProductsAction, type ImportState } from './actions';

const INITIAL: ImportState = { status: 'idle' };

const CSV_EXAMPLE = `slug,name_en,name_fr,status,type,sku,size,color,weight
hello-tee,Hello ClaudeShop Tee,T-shirt Hello ClaudeShop,ACTIVE,VARIABLE,HCS-TEE-S,S,black,0.20
hello-tee,Hello ClaudeShop Tee,T-shirt Hello ClaudeShop,ACTIVE,VARIABLE,HCS-TEE-M,M,black,0.22
summer-cap,Summer Cap,Casquette d'été,DRAFT,SIMPLE,CAP-SUM-NAT,,,,0.12`;

const JSON_EXAMPLE = JSON.stringify(
  [
    {
      slug: 'hello-tee',
      status: 'ACTIVE',
      type: 'VARIABLE',
      name: { en: 'Hello Tee', fr: 'T-shirt Hello' },
      variants: [
        { sku: 'HCS-TEE-S', barcode: null, options: { size: 'S' }, weight: '0.2' },
        { sku: 'HCS-TEE-M', barcode: null, options: { size: 'M' }, weight: '0.22' },
      ],
    },
  ],
  null,
  2,
);

export function ImportForm() {
  const [state, formAction, isPending] = useActionState<ImportState, FormData>(
    importProductsAction,
    INITIAL,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Format
            </label>
            <select
              name="format"
              defaultValue="csv"
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            >
              <option value="csv">CSV (multi-row per product)</option>
              <option value="json">JSON (array of CreateProductInput)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Collision mode
            </label>
            <select
              name="mode"
              defaultValue="skip"
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            >
              <option value="skip">Skip existing slugs (default)</option>
              <option value="fail">Fail on first error</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payload
          </label>
          <textarea
            name="payload"
            rows={14}
            required
            spellCheck={false}
            placeholder="Paste your CSV or JSON here"
            className="mt-1 w-full rounded-md border bg-background p-3 font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <ExampleButton label="CSV example" payload={CSV_EXAMPLE} format="csv" />
            <ExampleButton label="JSON example" payload={JSON_EXAMPLE} format="json" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Recognised CSV columns: slug, name_en, name_fr, name_de, name_es, status, type,
            description_en, description_fr, sku, barcode, size, color, material, weight.
            Other columns are ignored.
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </form>

      {state.status === 'error' ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {state.message}
        </div>
      ) : null}

      {state.status === 'ok' ? <ResultPanel result={state.result} /> : null}
    </div>
  );
}

function ExampleButton({
  label,
  payload,
  format,
}: {
  label: string;
  payload: string;
  format: 'csv' | 'json';
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        const form = (event.currentTarget as HTMLElement).closest('form');
        if (!form) return;
        const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="payload"]');
        const select = form.querySelector<HTMLSelectElement>('select[name="format"]');
        if (textarea) textarea.value = payload;
        if (select) select.value = format;
      }}
      className="rounded border px-2 py-1 hover:bg-muted"
    >
      Load {label}
    </button>
  );
}

function ResultPanel({ result }: { result: ImportProductsBatchResult }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total" value={result.total} />
        <Kpi label="Created" value={result.created} tone="emerald" />
        <Kpi label="Skipped" value={result.skipped} tone="amber" />
        <Kpi label="Errored" value={result.errored} tone={result.errored > 0 ? 'red' : undefined} />
      </div>
      <ul className="space-y-1 rounded-lg border bg-card p-3 text-xs">
        {result.rows.map((row: RowResult, idx: number) => (
          <li key={idx} className="flex items-start gap-2">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-semibold uppercase ${
                row.status === 'created'
                  ? 'bg-emerald-100 text-emerald-900'
                  : row.status === 'skipped'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-red-100 text-red-900'
              }`}
            >
              {row.status}
            </span>
            {row.status === 'created' ? (
              <span>
                <code className="font-mono">{row.slug}</code> → {row.productId}
              </span>
            ) : row.status === 'skipped' ? (
              <span>
                <code className="font-mono">{row.slug}</code> — {row.reason}
              </span>
            ) : (
              <span>
                row #{row.rowIndex}
                {row.slug ? (
                  <>
                    {' '}
                    (<code className="font-mono">{row.slug}</code>)
                  </>
                ) : null}
                : {row.message}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
