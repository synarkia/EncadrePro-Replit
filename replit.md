# EncadrePro — Workspace

## Overview

EncadrePro is a French picture-framing workshop management web app, rebuilt from a V1 Electron desktop app. Built as a web app first, with Electron-portability in mind (look for `/* WEB-TO-DESKTOP NOTES */` comments).

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Frontend**: React + Vite + TanStack Query + React Hook Form
- **Design**: Dark glass-morphism, primary violet `#7C6BFF`, gold accent `#D4A853`, dark bg `hsl(240 15% 6%)`
- **Language**: All UI in French

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/          # Express API server
│   └── encadrepro/          # React + Vite frontend (serves at /)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   └── db/                  # Drizzle ORM schema + DB connection
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── replit.md
```

## Business Logic

### Product types (modular pricing — new in v2)
- **Matière** — raw material (baguette, glass, passepartout, hardware)
- **Façonnage** — finishing operation (polishing, welding, cutting)
- **Service** — service item (delivery, installation, framing time)

### Product unit types
- `ml` / `metre_lineaire` — `(L+H)*2*Q` (dimensions in cm, stored and converted to meters)
- `m²` / `metre_carre` — `L*H*Q`
- `pièce` / `unitaire` / `heure` / `forfait` — `Q`

### Legacy product categories (backward compat)
`baguettes`, `verres`, `passe_partout`, `quincaillerie`, `main_oeuvre`

### Statuses
- Devis: `brouillon`, `envoye`, `accepte`, `refuse`, `converti`
- Factures: `brouillon`, `envoyee`, `partiellement_payee`, `soldee`, `annulee`

### Atelier table
Single-row config (id=1). Always upsert, never insert a second row.

## Key Files

### Database Schema (`lib/db/src/schema/`)
- `atelier.ts` — Workshop settings singleton
- `clients.ts` — Customer records
- `produits.ts` — Product catalogue (new: `type_produit`, `fournisseur`, `sous_categorie`, `unite`)
- `devis.ts` — Quotes + `lignes_devis` (new: `width_cm`, `height_cm`) + `lignes_devis_faconnage` + `lignes_devis_service`
- `factures.ts` — Invoices + `lignes_facture` + `acomptes` tables

### API Routes (`artifacts/api-server/src/routes/`)
- `dashboard.ts` — Stats, CA mensuel, recent devis/factures
- `clients.ts` — CRUD + stats
- `produits.ts` — CRUD + `GET /produits/search?q=&type=` + `GET /produits/fournisseurs`
- `devis.ts` — CRUD + save lignes (with nested faconnage/service) + convert to facture
- `factures.ts` — CRUD + paiements (auto-recalculates statut)
- `atelier.ts` — GET/PUT settings

### Frontend Components (`artifacts/encadrepro/src/components/`)
- `ProductSearchCombobox.tsx` — Autocomplete with 2+ char trigger, type filter, supplier pill
- `QuickAddProductModal.tsx` — Quick product creation modal (type/fournisseur/unite form)
- `QuoteLineCard.tsx` — Card-based line editor with façonnage + service sub-items

### Frontend Pages (`artifacts/encadrepro/src/pages/`)
- `dashboard.tsx` — KPI cards + monthly CA chart
- `clients/index.tsx` — Client list with search
- `clients/[id].tsx` — Client details + history
- `devis/index.tsx` — Quotes list
- `devis/[id].tsx` — Quote editor with QuoteLineCard layout + totals panel
- `factures/index.tsx` — Invoices list
- `factures/[id].tsx` — Invoice details + payment tracking
- `catalogue/index.tsx` — Product catalogue with type tabs (Matière/Façonnage/Service)
- `parametres/index.tsx` — Workshop settings form

## Important Notes

### Date serialization
Drizzle with node-postgres returns `Date` objects for timestamp columns, but Zod schemas expect ISO strings. Always use `serializeDates()` from `artifacts/api-server/src/lib/db-utils.ts` before parsing with Zod.

### Raw SQL results
Use `execRows<T>()` helper (in `db-utils.ts`) for raw SQL queries — it unwraps the `QueryResult.rows` from node-postgres.

### WEB-TO-DESKTOP Notes
Look for `/* WEB-TO-DESKTOP NOTE */` comments throughout the codebase for hints on adapting to Electron/better-sqlite3.

## GitHub Repository

The workspace is mirrored to GitHub at: **https://github.com/synarkia/EncadrePro-Replit**

- Integration: Replit GitHub connector (`conn_github_01KKYKF67V2Y35YT14TFB90VN2`) is wired to this project
- All commits are pushed to the `main` branch on the remote
- A write-enabled SSH deploy key is registered on the GitHub repo for push access

## Database Commands

```bash
pnpm --filter @workspace/db run push          # Sync schema
pnpm --filter @workspace/db run push-force    # Force sync if conflicts
pnpm --filter @workspace/api-spec run codegen # Regenerate API hooks/schemas
```

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server. Routes validated with `@workspace/api-zod`.

### `artifacts/encadrepro` (`@workspace/encadrepro`)
React + Vite frontend at preview path `/`. Uses `@workspace/api-client-react` for data fetching.

### `lib/db` (`@workspace/db`)
Drizzle ORM + PostgreSQL. Exports `db` client and all table definitions.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec (`openapi.yaml`) + Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)
Generated Zod schemas for API request/response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks and fetch client.
