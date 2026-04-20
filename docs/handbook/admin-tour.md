---
title: Admin Tour
aliases:
  - Admin Walkthrough
  - Management UI
tags:
  - type/handbook
  - handbook/admin-tour
  - project/claudeshop
status: stable
updated: 2026-04-20
---

# Admin Tour — The 22 Surfaces

> [!abstract] Everything a merchant can do without talking to Claude.
> The admin (`apps/admin`) ships with 22 top-level surfaces covering Commerce, Marketing, ERP, Configuration, Dev/Ops, and AI. Claude is a **companion** via **Ctrl-K** / `/copilot` but every action is also clickable.

**See also** :: [[getting-started|Getting Started]] · [[configuration|Configuration]] · [[deployment|Deployment]] · [[../../CLAUDE|CLAUDE.md]]

## Sidebar at a Glance

| Group | Surfaces |
|---|---|
| **Commerce** | [[#Dashboard\|Dashboard]] · [[#Products\|Products]] · [[#Orders\|Orders]] · [[#Customers\|Customers]] · [[#Inventory\|Inventory]] · [[#Reviews\|Reviews]] · [[#Pages\|Pages]] |
| **Marketing** | [[#Promotions\|Promotions]] · [[#Segments\|Segments]] · [[#Campaigns\|Campaigns]] |
| **ERP** | [[#Suppliers\|Suppliers]] · [[#Purchase Orders\|Purchase Orders]] |
| **Configuration** | [[#Settings\|Settings]] (Site, Email Templates, API Keys) · [[#Payments\|Payments]] · [[#Shipping Rates\|Shipping Rates]] · [[#Tax Rates\|Tax Rates]] |
| **Dev / Ops** | [[#Webhooks\|Webhooks]] · [[#Modules\|Modules]] · [[#Audit\|Audit]] |
| **AI** | [[#Copilot\|Copilot]] · [[#Command Palette\|Command Palette]] |

## Commerce

### Dashboard
`/dashboard` · Windowed KPIs (7d / 30d / 90d / YTD) with **prior-period deltas**, AOV sparkline, top 5 products, low-stock digest, pending orders queue. Everything clickable deep-links into the matching surface.

### Products
`/products` · List + filter + CSV import/export. Click a product → **Overview** (name, description, media, SEO) · **Variants** (SKU, options, stock, barcode) · **Pricing** (per-variant price sets with `validFrom/validTo` windows for sales) · **Inventory** · **Related products** · **Audit trail**. Claude copy generation available from the "**AI ✨**" button in the name field.

### Orders
`/orders` · Filter bar (status · date range · customer email · channel · total range) with filter-persisted CSV export. Click an order → **Header** (customer, totals, taxes) · **Line items** (fulfilment bar per line) · **Shipping** (address + label) · **Payments** (auth / capture / refund) · **Notes** (internal timeline) · **Audit trail**.

### Customers
`/customers` · Directory with LTV computed server-side + last-order date + segment chips. Click a customer → **Overview** (contact, addresses) · **Orders history** · **Segments + marketing consent** · **CRM Notes** · **Audit trail**. CSV export respects current filters.

### Inventory
`/inventory` · SKU-level stock across warehouses (Phase 4+). Adjust button with reason code + audit. **Low-stock digest** — manual trigger or cron (`POST /v1/admin/inventory/digest`). CSV export with filter forwarding.

### Reviews
`/reviews` · Moderation queue (`pending` / `approved` / `rejected` / `flagged`). Per-review reply + publish. Claude can draft a reply via the copilot (diff preview mandatory).

### Pages
`/pages` · CMS pages (home blocks, about, legal, custom). Markdown + MJML-style blocks. Draft / publish / schedule. Per-locale versions.

## Marketing

### Promotions
`/promotions` · Code + rule engine (min-basket, product/category targeting, stacking, usage caps, per-customer caps, validity window). Preview on sample carts. Usage report with CSV export.

### Segments
`/segments` · Dynamic customer cohorts — composable filters (country, LTV range, tag, last-purchase window, product purchased). Used by promotions + campaigns.

### Campaigns
`/campaigns` · Email + push blasts targeted at segments. Template picker + A/B subject + send-time preview. Delivery log with open/click metrics.

## ERP

### Suppliers
`/suppliers` · Supplier directory with contact, payment terms, currency, average lead time. Link to products they supply.

### Purchase Orders
`/purchase-orders` · Draft / submit / receive workflow. Auto-generate from a low-stock digest. Partial receipt supported — updates inventory on confirm.

## Configuration

### Settings
`/settings` — sub-sections in a left tabs column :

| Tab | What it edits |
|---|---|
| **Site** | Store name, logo, footer copy, default locale/currency, contact email |
| **Email Templates** | Transactional emails with Markdown body + MJML preview (sandboxed iframe) |
| **API Keys** | Merchant-generated keys — shown **once** on creation, hashed at rest |
| **Security** | Change password, active sessions, 2FA (Phase 5) |
| **Tenant** | Plan, locales, timezone, feature flags (see [[configuration#6 · Feature Flags per-tenant\|Configuration § Feature Flags]]) |

### Payments
`/payments` · Activate PSPs per tenant. Stripe / Mollie / Manual built-in. Per-method : display name, icon, min/max basket, country restrictions. Test-mode toggle.

### Shipping Rates
`/shipping-rates` · Carrier + method rows, weight brackets, free-shipping thresholds, per-country overrides. Required for checkout to complete.

### Tax Rates
`/tax-rates` · VAT / sales tax definitions per region + product tax class. Inclusive vs exclusive pricing toggle per tenant.

## Dev / Ops

### Webhooks
`/webhooks` · Outbound subscriptions (`order.created`, `order.fulfilled`, `customer.created`, …). Per-subscription : URL, HMAC secret, filter expression, retry policy. **Deliveries log** with status, response code, response body, duration, HMAC signature. **Manual redeliver** button on any failed delivery.

### Modules
`/modules` · Installed plugins registry. Install / enable / disable / configure. Each module declares a typed manifest (Zod-validated) with capability scopes. 3-tier isolation (in-process / worker / sandbox) visible per module.

### Audit
`/audit` · Immutable log of every mutation (who, when, what, diff, IP, user-agent). Filter by actor type / action / resource / date range. CSV export. Links to the resource in question.

## AI

### Copilot
`/copilot` · Full-screen chat with Claude scoped to the current tenant. Tools available :
- **Read-only** (run immediately) : search products/orders/customers, summarise audit entries, explain webhook failures, draft copy
- **Mutating** (diff preview + click-to-confirm) : create/update product, update order status, append customer note, moderate a review

Tool calls appear as expandable cards with inputs / diff preview / apply button.

### Command Palette
`/_palette` · Opens with **Ctrl-K** / **⌘-K** from anywhere. Two modes :
- **Nav** : jump to any admin surface (fuzzy search on titles)
- **AI** : natural-language queries → Claude routes to the right tool → presents result inline

> [!tip] Keyboard-first
> Try `Ctrl-K → "last week failed webhooks"` or `Ctrl-K → "add product organic tee EUR 39"`. Power users never leave the keyboard.

## Permissions Matrix

> [!info] Role-based per `AuthUser.role`
> Phase 5 expands this to fine-grained ACL. v1.0 ships with four roles.

| Role | Dashboard | Commerce write | Marketing | ERP | Settings | Webhooks | Copilot writes |
|---|---|---|---|---|---|---|---|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ⚠️ (not API keys) | ✅ | ✅ |
| **STAFF** | ✅ | ✅ | ⚠️ (draft only) | ✅ | ❌ | ❌ | ⚠️ (opt-in) |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (read-only copilot) |

## Related

- [[getting-started|Getting Started]]
- [[configuration|Configuration]]
- [[deployment|Deployment]]
- [[../adrs/ADR-004-ai-admin-safety|ADR-004 AI Admin Safety]]
- [[../../CLAUDE|CLAUDE.md § Active Skill Stack]]
