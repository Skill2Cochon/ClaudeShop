---
title: ADR-002 — Multi-tenant DB Strategy (Shared DB + RLS)
aliases:
  - ADR-002
tags:
  - type/adr
  - adr/accepted
  - decision/architecture
  - decision/security
  - project/claudeshop
  - phase/1
  - phase/2
adr_id: "002"
status: accepted
date: 2026-04-18
decision_makers:
  - ClaudeShop Maintainers
supersedes: null
superseded_by: null
---

# ADR-002 — Multi-tenant DB : Shared DB + Row-Level Security

> [!success] Status
> **Accepted** · 2026-04-18 · effect immédiat (Phase 1 Prisma schema, enforced Phase 2+)

## Context

ClaudeShop est multi-tenant dès le premier jour : plusieurs merchants hébergés sur la même instance, isolés les uns des autres, tout en partageant l'infra (Postgres sur un hôte unique, typiquement 8 GB RAM, objectif budget modeste).

Choix possibles (du plus isolé au plus partagé) :

1. **DB par tenant** — un PostgreSQL cluster par merchant
2. **Schema par tenant** — une DB, un schema Postgres par merchant
3. **Shared DB + `tenantId` column** — une DB, un schema, colonne discriminante sur chaque table

Chaque option a des trade-offs sur : isolation, coût, complexité migrations, DX Prisma, escape hatch enterprise.

## Decision

**Option 3 : Shared DB + `tenantId` column + PostgreSQL Row-Level Security (RLS)** comme défense en profondeur.

```sql
-- Toutes les tables tenantisées ont cette policy
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
```

Le backend (Fastify) entre dans une transaction au début de chaque requête et exécute `SET LOCAL app.tenant_id = '<cuid>'`. Toute query Prisma hors-scope retourne zero rows (policy deny-by-default).

## Options considérées

| Option | Isolation | Coût | Migration UX | Prisma UX | Escape hatch |
|---|---|---|---|---|---|
| DB par tenant | Strongest | EUR/tenant × N | 1 commande par cluster = nightmare à 100+ | Prisma multi-DB clunky | N/A (déjà isolé) |
| Schema par tenant | Strong | DB commune mais N schemas = connection pool explode | Prisma v6 multi-schema UX encore fragile | Ok avec `previewFeatures = multiSchema` mais peut casser | Promote to dedicated DB |
| **Shared + RLS** (choisi) | Good (RLS = filet de sécurité) | EUR 0 marginal | Une migration = N tenants | Simple, un seul client Prisma | Read-replica cutover + router |

## Rationale

> [!quote] Constraint binding : budget
> Plafond budget indicatif ~EUR 200/mois. Schema-per-tenant multiplie les connexions × N → PgBouncer pool saturé à 50 tenants. DB-per-tenant irréaliste sur une seule VM de taille modeste.

> [!quote] Constraint binding : DX Prisma
> Prisma 6 multi-schema reste labeled *preview*. Shared DB = un seul `PrismaClient`, un seul flux de migration, code 3× plus simple dans `packages/db`.

> [!quote] Constraint binding : security
> Une erreur applicative qui oublie `WHERE tenantId = ?` ne fuite RIEN grâce à la RLS — safety net important pour un CMS open-source où n'importe qui peut submit un PR.

## Consequences

### Positive

- ✅ Coût infra marginal zéro jusqu'à ~100 tenants actifs
- ✅ Migration en 1 commande, sans coordination par-tenant
- ✅ RLS = defense-in-depth : bugs applicatifs ne fuitent pas
- ✅ Prisma middleware `$extends` global = un seul point à auditer (cf. [[../../packages/db/src/client.ts|withTenant helper]])
- ✅ Audit log inter-tenant facile (une seule table `AuditLog`)

### Negative

- ⚠️ **Noisy neighbor** : un merchant qui fait un bulk import de 100k produits peut saturer les connexions
  - **Mitigation** : PgBouncer quotas per-tenant (prévu Phase 2), BullMQ concurrency cap, statement timeout per-role
- ⚠️ **Any missed `setPgTenant`** = app voit tout sans filtre (middleware oublié)
  - **Mitigation** : deny-by-default RLS (pas de policy `USING (true)`), panic-log si `app.tenant_id` non-set, OTel attribute `tenant.id` required sur tous les spans
- ⚠️ **pgvector + RLS** : les queries SQL brutes pour vector sim skippent Prisma middleware
  - **Mitigation** : `VectorRepository` wrapper qui force le tenant filter explicit en plus de RLS (cf. [[../../.claude/plan/claudeshop-v1-0#15 Risks Mitigations|Risk #5]])
- ⚠️ **Enterprise customer** demande sa propre DB pour compliance
  - **Escape hatch** : promotion via read-replica cutover + connection router côté API (planifié Phase 5)

### Neutral

- Backups Postgres = un seul dump pour tous les tenants — simplifie ops, complique "give me just my data"
  - **Résolu par** : per-tenant GDPR export API (scoped query via `withTenant`) + par-tenant logical dump via `pg_dump --data-only --where="tenantId='...'"`

## Implementation

1. Toutes les tables tenantisées ont `tenantId String` en colonne FK vers `Tenant`
2. `packages/db/prisma/migrations/20260419000000_rls/migration.sql` applique les policies
3. App se connecte avec role `claudeshop_app` (UPDATE/DELETE bloqués sur `AuditLog` — INSERT-only)
4. `withTenant(prisma, tenantId, fn)` dans `packages/db/src/client.ts` ouvre la transaction et set le setting
5. Tests d'intégration Phase 2 : deux tenants créent des produits, vérifient 100 % isolation (pas de leak)

## Follow-ups

- [ ] Phase 2 : integration tests RLS multi-tenant (2 tenants, cross-tenant = 0 rows)
- [ ] Phase 2 : panic-log si `current_setting('app.tenant_id', true)` est NULL sur query
- [ ] Phase 4 : planifier escape hatch "dedicated DB" pour tenants enterprise
- [ ] Phase 5 : documenter GDPR export API

## Related ADRs

- [[ADR-001-monorepo-tooling|ADR-001 — Monorepo Tooling]] (package `db` placement)
- [[ADR-003-plugin-isolation-tiers|ADR-003 — Plugin Isolation]] *(Phase 3, draft)*

## References

- [[../../.claude/plan/claudeshop-v1-0#Multi-tenant strategy|Plan § Multi-tenant strategy]]
- [[../../packages/db/prisma/schema.prisma|schema.prisma]]
- [[../../packages/db/prisma/migrations/20260419000000_rls/migration.sql|RLS migration SQL]]
- PostgreSQL RLS docs : https://www.postgresql.org/docs/16/ddl-rowsecurity.html
