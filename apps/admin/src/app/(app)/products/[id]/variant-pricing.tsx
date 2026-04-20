import type { PriceSet, Variant } from '@claudeshop/contracts/product';
import {
  deleteVariantPriceAction,
  listVariantPrices,
  upsertVariantPriceAction,
} from './variant-pricing-actions';

interface VariantPricingProps {
  productId: string;
  variants: Variant[];
}

export async function VariantPricing({
  productId,
  variants,
}: VariantPricingProps) {
  // Fetch prices for every variant in parallel. Variants typically come
  // in small groups (<12) so a per-variant call is fine; Phase 30.1
  // adds a bulk /v1/admin/products/:id/prices when it matters.
  const pricingByVariant = await Promise.all(
    variants.map(async (variant) => ({
      variant,
      prices: await listVariantPrices(variant.id),
    })),
  );

  return (
    <div className="space-y-4">
      {pricingByVariant.map(({ variant, prices }) => (
        <VariantCard
          key={variant.id}
          productId={productId}
          variant={variant}
          prices={prices}
        />
      ))}
    </div>
  );
}

function VariantCard({
  productId,
  variant,
  prices,
}: {
  productId: string;
  variant: Variant;
  prices: PriceSet[];
}) {
  const upsert = upsertVariantPriceAction.bind(null, variant.id, productId);

  return (
    <div className="rounded-md border bg-background p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold">{variant.sku}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {Object.entries(variant.options)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ') || 'no options'}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {prices.length} price{prices.length === 1 ? '' : 's'}
        </span>
      </header>

      {prices.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No prices yet — add one below to make this variant purchasable.
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-xs">
          {prices.map((price) => (
            <PriceRow
              key={`${price.currency}-${price.channel}`}
              productId={productId}
              variantId={variant.id}
              price={price}
            />
          ))}
        </ul>
      )}

      <form action={upsert} className="mt-3 space-y-2 rounded border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <LabeledInput
            name="currency"
            label="Currency"
            placeholder="EUR"
            uppercase
            required
          />
          <LabeledInput name="amount" label="Amount" placeholder="29.00" required />
          <LabeledInput name="channel" label="Channel" placeholder="default" />
          <label className="flex items-end gap-1.5 pb-1 text-[11px] text-muted-foreground">
            <input type="checkbox" name="taxIncluded" className="mb-0.5" /> Tax included
          </label>
          <button
            type="submit"
            className="self-end rounded-md border bg-foreground px-2 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Save price
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <LabeledInput
            name="validFrom"
            label="Valid from (optional)"
            type="date"
            hint="Empty = always valid"
          />
          <LabeledInput
            name="validTo"
            label="Valid until (optional)"
            type="date"
            hint="Great for seasonal pricing"
          />
        </div>
      </form>
    </div>
  );
}

function PriceRow({
  productId,
  variantId,
  price,
}: {
  productId: string;
  variantId: string;
  price: PriceSet;
}) {
  const del = deleteVariantPriceAction.bind(
    null,
    variantId,
    productId,
    price.currency,
    price.channel,
  );

  return (
    <li className="flex items-center justify-between gap-3 rounded border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono">
          <span className="font-semibold">
            {price.amount} {price.currency}
          </span>
          <span className="ml-2 text-muted-foreground">· {price.channel}</span>
          {price.taxIncluded ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              incl. tax
            </span>
          ) : null}
        </p>
        {price.validFrom || price.validTo ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {price.validFrom
              ? `from ${new Date(price.validFrom).toLocaleDateString()}`
              : 'from ∞'}
            {' · '}
            {price.validTo
              ? `until ${new Date(price.validTo).toLocaleDateString()}`
              : 'no end'}
          </p>
        ) : null}
      </div>
      <form action={del}>
        <button
          type="submit"
          className="rounded border border-destructive/40 bg-background px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
        >
          Remove
        </button>
      </form>
    </li>
  );
}

/**
 * Phase 54 — compact label + input with an optional hint. Used for
 * both the currency/amount row and the new valid-from/until row so
 * both share the same vertical rhythm even though the fields are
 * different widths.
 */
function LabeledInput({
  name,
  label,
  type = 'text',
  placeholder,
  uppercase,
  required,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  uppercase?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={`mt-1 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs normal-case ${
          uppercase ? 'uppercase' : ''
        }`}
      />
      {hint ? (
        <span className="mt-0.5 block text-[9px] normal-case text-muted-foreground/80">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
