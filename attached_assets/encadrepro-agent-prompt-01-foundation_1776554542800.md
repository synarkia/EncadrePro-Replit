# EncadrePro — Agent Task 01: Foundation Schema Migration & Critical Fixes

## Context

You are working on **EncadrePro**, a French picture-framing + glaziery workshop management web app being built for an artisan client named Thomas (Atelier AGV in Lyon). It is a pnpm monorepo with the structure documented in `replit.md`.

The app is replacing a legacy FileMaker Pro database that Thomas has used for years. We will be importing approximately **5,000 existing product records** from FileMaker into PostgreSQL. The current schema cannot accommodate the legacy data structure — this task fixes that, plus a small set of related foundational issues.

**This is a foundation pass, not a feature pass.** Your job is to make the schema correct so future feature work can proceed safely. Do not build new UI screens. Do not refactor unrelated code. Do not "improve" anything that isn't on the explicit list below.

---

## Before you do ANYTHING else

1. Read `replit.md` in full.
2. Read every file in `lib/db/src/schema/`.
3. Read `lib/api-spec/openapi.yaml` (or scan its product-related sections).
4. Read `artifacts/api-server/src/routes/produits.ts` and `artifacts/api-server/src/lib/db-utils.ts`.
5. Read `artifacts/encadrepro/src/pages/catalogue/index.tsx` if it exists.

After reading, **post a short summary** in the chat of what you found before starting work. Specifically tell me:
- Current `produits` schema columns and types
- Whether money columns use `numeric` or `real`/`float`
- Whether `serializeDates()` is widely used and where it lives
- The current shape of the legacy categories enum
- Anything unexpected you notice

**Wait for me to confirm before proceeding** if anything seems off.

---

## What you must do (in this order)

### TASK 1 — Expand the product type model from 3 to 5 types

The legacy app distinguishes 5 product types with different pricing models. Current EncadrePro collapses these into 3. The mapping is:

| Legacy code | Legacy name | Current EncadrePro home | What needs to happen |
|---|---|---|---|
| VR | Volumes (glass, mirror, plexi by m²) | folded into "Matière" | Promote to its own type |
| FA | Façonnages (edge treatments by ml) | "Façonnage" | Keep as-is, but add `mm` attribute |
| AU | Accessoires (hardware by unit) | folded into "Matière" | Promote to its own type |
| SD | Services (labor by unit/hour) | "Service" | Keep |
| EN | Encadrements (frames by ml or unit) | folded into "Matière" | Promote to its own type |

#### Schema changes to `produits` table (or whatever the table is called — verify in Step 1 above)

1. Add or replace the type enum to include exactly these 5 values: `VR`, `FA`, `AU`, `SD`, `EN`. Use uppercase 2-letter codes — these are Thomas's mental model and will appear in lists.
2. Add the following columns. Make all of them nullable since they only apply to specific product types:
   - `ref_legacy` (integer, nullable, **unique**) — preserves Thomas's FileMaker Réf number (e.g. 420 for Cadre Trafalia). This is his primary mental index. Even after import, new products should get auto-assigned sequential refs continuing from the legacy max.
   - `ref_fournisseur` (text, nullable) — supplier's own SKU
   - `epaisseur_mm` (integer, nullable) — VR only: glass thickness
   - `majo_epaisseur` (numeric(4,2), nullable) — VR only: thickness multiplier
   - `mini_facturable_tn` (numeric(6,3), nullable) — VR only: minimum billable surface in m² for Tarif Normal
   - `mini_facturable_ta` (numeric(6,3), nullable) — VR only: minimum billable surface in m² for Tarif Atelier
   - `coef_marge_ta` (numeric(6,3), nullable) — VR only: separate margin coefficient for Tarif Atelier regime
   - `plus_value_ta_pct` (numeric(6,2), nullable) — VR only: plus-value percentage in TA regime
   - `fac_mm` (integer, nullable) — FA only: physical mm spec embedded in pricing (e.g. "Bords polis 6mm")
   - `cadre_or_accessoire` (text enum: `cadre` | `accessoire`, nullable) — EN only: subdivides Encadrements
   - `vendu` (boolean, default false) — EN only: marks unique brocante frames as sold
   - `image_url` (text, nullable) — product photo
   - `notes` (text, nullable) — multi-line notes (verify if already exists; if so, leave alone)
   - `pricing_mode` (enum: `unit` | `linear_meter` | `square_meter`, NOT NULL) — this is the per-product pricing formula. EN can be either `unit` (P.U) or `linear_meter` (Px.ml) depending on the moulding.

3. Verify and fix money columns (across ALL tables, not just produits): every monetary value must be `numeric(10, 2)` minimum. Margin coefficients should be `numeric(6, 3)`. If you find any `real` or `float` columns storing money, convert them. **List any conversions you do in your final report.**

4. **Delete the "legacy product categories" enum** (`baguettes`, `verres`, `passe_partout`, `quincaillerie`, `main_oeuvre`). It's described in `replit.md` as "backward compat" — there is no production data, so there is nothing to be backward compatible with. Remove the field, remove the enum definition, remove any code referencing it.

#### Migration strategy

Since there is no production data yet, generate a clean migration with `drizzle-kit generate`. **Do not use `drizzle-kit push --force` against a database that already contains test data without confirming with me first.** If the DB has test data, ask before destroying it.

After the migration, regenerate the API client: `pnpm --filter @workspace/api-spec run codegen`.

---

### TASK 2 — Add audit columns to all tables

Every table in `lib/db/src/schema/` should have:
- `created_at timestamp NOT NULL DEFAULT now()`
- `updated_at timestamp NOT NULL DEFAULT now()` with `$onUpdate(() => new Date())`

If they already exist on a table, leave that table alone. If they're missing on some, add them consistently across all tables.

---

### TASK 3 — Fix the Drizzle date-handling fragility

`replit.md` documents a known footgun: Drizzle returns `Date` objects but Zod schemas expect ISO strings, requiring a manual `serializeDates()` call before every Zod parse.

This is fragile — anyone (human or AI) will eventually forget to call it. Fix it at the source.

The cleanest fix is to configure timestamp columns with `mode: 'string'` so Drizzle returns ISO strings natively. For example:
```ts
created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
```

Apply this consistently across all timestamp columns in all schema files.

After applying, search the codebase for usages of `serializeDates()`. They should now be unnecessary. Remove them and remove the helper function itself if nothing else references it. **If something breaks, tell me — do not silently work around it.**

---

### TASK 4 — Add a `fournisseurs` table (proper relational model)

Currently suppliers appear to be stored as a string field on each product. The legacy app treats them as first-class entities with versioned price lists ("NIELSEN 02/2025", "MACOCCO 01/2023"). Restructure:

```ts
fournisseurs: {
  id: serial primary key,
  nom: text NOT NULL,                  // "NIELSEN"
  version_tarif: text NULL,            // "02/2025" (price list version date)
  contact_nom: text NULL,
  contact_email: text NULL,
  contact_tel: text NULL,
  notes: text NULL,
  created_at, updated_at
}
```

Add `fournisseur_id integer NULL REFERENCES fournisseurs(id)` to `produits`. Keep the existing string `fournisseur` field as `fournisseur_legacy text NULL` temporarily — we'll need it during the FileMaker import to map old values to new IDs, then drop it later. Add a `// TODO: drop after FileMaker migration complete` comment next to it.

Update the `GET /produits/fournisseurs` route to query the new table. Update any frontend that reads supplier data.

---

### TASK 5 — Verify and document, do NOT fix yet

For each of the following, **check whether it exists** and **report back in your summary**, but do not modify:

1. Is invoice numbering (`factures.numero`) sequential and gapless? French law requires this. If implementation looks suspect, flag it.
2. Are factures hard-deletable? They legally shouldn't be (10-year retention). Look at the DELETE handler in `factures.ts` route.
3. Does the `atelier` table store SIRET, TVA intracom, RCS, mentions légales? List what fields exist vs what's missing.
4. Is there any auth on the API? Check for middleware. If routes are unauthenticated, flag this loudly.
5. Does anything generate PDFs? Search for `react-pdf`, `pdfkit`, `puppeteer`, `playwright`. Report what you find.

These will become follow-up tasks. Do not start them now — they each need their own focused pass.

---

## Hard constraints (do not violate)

1. **Do not touch any UI components beyond what's necessary to keep types compiling.** No design changes. No "while I'm here, let me improve this card layout."
2. **Do not delete any field without explicit approval.** Adding fields = safe. Renaming = ask first. Deleting = ask first.
3. **Do not invent file paths.** If a file doesn't exist where I said it would, tell me — don't guess and create one in the wrong place.
4. **Do not introduce new dependencies** without listing them in your report and getting confirmation. The current stack is sufficient for this task.
5. **All UI text remains in French.** Any new enum values that appear in UI (like product type labels) should have French display labels — `VR` → "Volumes", `FA` → "Façonnages", etc. Store the codes, display the labels.
6. **If you discover the schema is materially different from what I described above** (e.g. the table is called `products` not `produits`, or there are columns I didn't anticipate), **stop and ask** before adapting the plan.

---

## Final report you must produce

When done, post a single message in the chat with:

1. **What changed** — list of files modified with one-line descriptions
2. **Migration generated** — name of the migration file, summary of SQL
3. **Money column audit** — any `real`/`float` columns found and converted
4. **Date handling** — confirmation that `serializeDates()` is removed, or list of places where it still must remain and why
5. **Verification findings (Task 5)** — your report on invoice numbering, deletion policies, atelier fields, auth, PDF generation
6. **What you did NOT do** — anything from the brief you skipped, with reason
7. **Suggested next agent task** — based on what you found, what's the most important follow-up

Do not push to main without my approval. Open the changes for review first.

---

## Why this prompt is structured this way (for your own future reference — not for the agent)

- **Read-first phase** prevents the agent from inventing field names that don't exist
- **Numbered tasks with explicit non-goals** prevents scope creep
- **Hard constraints section** is what saves you from "the agent helpfully refactored 40 unrelated files"
- **Verification-only Task 5** gathers intel for the next prompt without acting on it prematurely
- **Final report requirement** gives you a written audit trail and a starting point for prompt #2
