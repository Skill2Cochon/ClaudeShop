import type { Product } from '@claudeshop/contracts/product';
import { updateProductAction, archiveProductAction } from './edit-actions';

interface EditFormProps {
  product: Product;
}

/**
 * Render a localized-field block back into the `locale: value\n…` format the
 * server action parses. Keeps the edit experience round-trippable.
 */
function localizedToBlock(value: Record<string, string> | undefined): string {
  if (!value) return '';
  return Object.entries(value)
    .map(([locale, text]) => `${locale}: ${text}`)
    .join('\n');
}

export function EditForm({ product }: EditFormProps) {
  const update = updateProductAction.bind(null, product.id);
  const archive = archiveProductAction.bind(null, product.id);

  const nameBlock = localizedToBlock(product.name);
  const descriptionBlock = product.description
    ? localizedToBlock(product.description as Record<string, string>)
    : '';
  const seoTitle = product.seo?.title
    ? localizedToBlock(product.seo.title as Record<string, string>)
    : '';
  const seoDescription = product.seo?.description
    ? localizedToBlock(product.seo.description as Record<string, string>)
    : '';

  return (
    <div className="space-y-4">
      <form action={update} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label="Slug"
            name="slug"
            defaultValue={product.slug}
            hint="Kebab-case, tenant-unique."
          />
          <Select
            label="Status"
            name="status"
            defaultValue={product.status}
            options={[
              { value: 'DRAFT', label: 'DRAFT' },
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'ARCHIVED', label: 'ARCHIVED' },
            ]}
          />
          <Select
            label="Type"
            name="type"
            defaultValue={product.type}
            options={[
              { value: 'SIMPLE', label: 'SIMPLE' },
              { value: 'VARIABLE', label: 'VARIABLE' },
              { value: 'BUNDLE', label: 'BUNDLE' },
              { value: 'DIGITAL', label: 'DIGITAL' },
              { value: 'SUBSCRIPTION', label: 'SUBSCRIPTION' },
            ]}
          />
        </div>

        <LocalizedField
          label="Name (per locale)"
          name="name"
          defaultValue={nameBlock}
          rows={4}
          hint="One line per locale in 'en: Hello Tee' format."
        />
        <LocalizedField
          label="Description (per locale)"
          name="description"
          defaultValue={descriptionBlock}
          rows={6}
          hint="Long-form. Supports the same locale prefix."
        />

        <div className="grid gap-3 md:grid-cols-2">
          <LocalizedField
            label="SEO title (per locale)"
            name="seoTitle"
            defaultValue={seoTitle}
            rows={3}
          />
          <LocalizedField
            label="SEO description (per locale)"
            name="seoDescription"
            defaultValue={seoDescription}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">
            Empty fields are ignored — the server merges only the fields you changed.
          </span>
          <button
            type="submit"
            className="rounded-md border bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Save changes
          </button>
        </div>
      </form>

      {product.status !== 'ARCHIVED' ? (
        <form
          action={archive}
          className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
        >
          <div className="text-xs text-destructive">
            Archive this product — it will be hidden from the storefront and listings.
            Reactivate by flipping the status back to ACTIVE.
          </div>
          <button
            type="submit"
            className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            Archive
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      />
      {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LocalizedField({
  label,
  name,
  defaultValue,
  rows,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        spellCheck={false}
        className="w-full rounded-md border bg-background p-2 font-mono text-xs"
      />
      {hint ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
