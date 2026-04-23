/**
 * Seed script for EncadrePro — Task 04 canonical dataset.
 * Idempotent: re-runs upsert atelier, and skip-insert if a row with the same
 * "natural key" already exists (fournisseur.nom, client.nom+prenom, produit.ref_legacy).
 *
 * Run: pnpm --filter @workspace/api-server tsx src/seed.ts
 *
 * WEB-TO-DESKTOP NOTE: seed runs against shared schema; usable from both web and Electron build.
 */
import { db, atelierTable, produitsTable, fournisseursTable, clientsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// ── Atelier ────────────────────────────────────────────────────────────────
async function seedAtelier() {
  const data = {
    nom: "Atelier AGV",
    adresse: "152 rue de Tolbiac, 75013 Paris",
    telephone: "06 23 80 15 27",
    email: "contact@atelier-agv.fr",
    siret: "12345678900010",
    tva_intracom: "FR12345678900",
    rcs: "Lyon B 123 456 789",
    forme_juridique: "SARL",
    capital_social: 10000,
    code_ape: "1623Z",
    mentions_legales: "TVA applicable, art. 293 B du CGI non retenu",
    tva_defaut: 20,
    iban: "FR76 1234 5678 9012 3456 7890 123",
    bic: "BNPAFRPP",
  } as const;

  const [existing] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!existing) {
    await db.insert(atelierTable).values({ id: 1, ...data });
    return { inserted: 1, updated: 0 };
  }
  await db.update(atelierTable).set(data).where(eq(atelierTable.id, 1));
  return { inserted: 0, updated: 1 };
}

// ── Fournisseurs ───────────────────────────────────────────────────────────
const FOURNISSEURS = [
  { nom: "NIELSEN",       version_tarif: "02/2025", contact_email: "contact@nielsen.fr" },
  { nom: "GLASSOLUTIONS", version_tarif: "04/2019", contact_email: null },
  { nom: "MACOCCO",       version_tarif: "01/2023", contact_email: null },
  { nom: "RM DIFFUSION",  version_tarif: "2023",    contact_email: null },
  { nom: "ATELIER",       version_tarif: "2024",    contact_email: null },
  { nom: "SOGIMEX",       version_tarif: "2022",    contact_email: null },
  // Extras referenced by produits below.
  { nom: "CINDAR",        version_tarif: "2023",    contact_email: null },
  { nom: "REVERCHON",     version_tarif: "2023",    contact_email: null },
];

async function seedFournisseurs() {
  let inserted = 0;
  for (const f of FOURNISSEURS) {
    const [existing] = await db.select().from(fournisseursTable).where(eq(fournisseursTable.nom, f.nom));
    if (!existing) {
      await db.insert(fournisseursTable).values(f);
      inserted += 1;
    }
  }
  return { inserted, total: FOURNISSEURS.length };
}

// ── Clients ────────────────────────────────────────────────────────────────
const CLIENTS = [
  { nom: "O'CALLAGHAN-LOCKE", prenom: "Ryan",        adresse: "12 rue Victor Hugo",        code_postal: "69002", ville: "Lyon", telephone: "06 23 80 15 27", email: "ryan.ocl@example.fr" },
  { nom: "DUPONT",            prenom: "Marie",       adresse: "45 avenue Jean Jaurès",     code_postal: "69007", ville: "Lyon", telephone: "04 72 00 00 00", email: null },
  { nom: "MARTIN",            prenom: "Jean-Pierre", adresse: "8 place Bellecour",          code_postal: "69002", ville: "Lyon", telephone: null,             email: "jp.martin@example.fr" },
  { nom: "Galerie des Arts",  prenom: null,          adresse: "23 rue Mercière",            code_postal: "69002", ville: "Lyon", telephone: "04 78 00 00 00", email: "contact@galeriedesarts.fr" },
  { nom: "Musée de Lyon",     prenom: null,          adresse: "1 place de la Confluence",   code_postal: "69002", ville: "Lyon", telephone: null,             email: "regie@musee-lyon.fr" },
];

async function seedClients() {
  let inserted = 0;
  for (const c of CLIENTS) {
    const [existing] = await db.select().from(clientsTable).where(
      and(
        eq(clientsTable.nom, c.nom),
        c.prenom ? eq(clientsTable.prenom, c.prenom) : sql`${clientsTable.prenom} IS NULL`,
      ),
    );
    if (!existing) {
      await db.insert(clientsTable).values(c);
      inserted += 1;
    }
  }
  return { inserted, total: CLIENTS.length };
}

// ── Produits ───────────────────────────────────────────────────────────────
type ProductSeed = {
  ref_legacy: string;
  designation: string;
  fournisseur_nom: string;
  pauht: number;
  coef_marge: number;
  type_code: "VR" | "FA" | "AU" | "SD" | "EN";
  pricing_mode: "unit" | "linear_meter" | "square_meter";
  // VR-only
  epaisseur_mm?: number;
  majo_epaisseur?: number;
  mini_fact_tn?: number;
  mini_fact_ta?: number;
  coef_marge_ta?: number;
  plus_value_ta_pct?: number;
  // FA-only
  fac_mm?: number;
  // EN-only
  cadre_or_accessoire?: string;
  vendu?: boolean;
};

const PRODUITS: ProductSeed[] = [
  // VR — Volumes
  { ref_legacy: "8",    designation: "verre clair 10mm",                     fournisseur_nom: "GLASSOLUTIONS", pauht: 48.80, coef_marge: 2.6, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 10, majo_epaisseur: 1.7, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.6, plus_value_ta_pct: 650 },
  { ref_legacy: "12",   designation: "Verre clair 2mm",                      fournisseur_nom: "MACOCCO",       pauht: 25.00, coef_marge: 2.6, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 2,  majo_epaisseur: 1.0, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.6, plus_value_ta_pct: 400 },
  { ref_legacy: "61",   designation: "Miroir Gris Joint poli 4mm",           fournisseur_nom: "MACOCCO",       pauht: 35.00, coef_marge: 2.5, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 4,  majo_epaisseur: 1.2, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.5, plus_value_ta_pct: 500 },
  { ref_legacy: "94",   designation: "Plexiglass extrudé Anti-reflet 2mm",   fournisseur_nom: "CINDAR",        pauht: 60.00, coef_marge: 2.0, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 2,  majo_epaisseur: 1.0, mini_fact_tn: 0.5,  mini_fact_ta: 0.5, coef_marge_ta: 2.0, plus_value_ta_pct: 300 },
  // FA — Façonnages
  { ref_legacy: "7",    designation: "Bords polis (mini 1ml)",               fournisseur_nom: "ATELIER",       pauht: 13.50, coef_marge: 1.0, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 6 },
  { ref_legacy: "21",   designation: "Biseau talon brut demi-rond SUR DEVIS",fournisseur_nom: "REVERCHON",     pauht: 35.00, coef_marge: 1.0, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 35 },
  { ref_legacy: "24",   designation: "Biseau talon poli",                    fournisseur_nom: "REVERCHON",     pauht: 18.00, coef_marge: 1.0, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 6 },
  { ref_legacy: "27",   designation: "Chanfrein mini 1ml",                   fournisseur_nom: "ATELIER",       pauht: 12.00, coef_marge: 1.0, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 6 },
  // AU — Accessoires
  { ref_legacy: "20",   designation: "Aérateur à hélice 160mm",              fournisseur_nom: "SOGIMEX",       pauht: 19.00, coef_marge: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref_legacy: "25",   designation: "Couteau à mastic forme Boucher",       fournisseur_nom: "SOGIMEX",       pauht: 8.50,  coef_marge: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref_legacy: "75",   designation: "Bouton double Chromé Brillant",        fournisseur_nom: "SOGIMEX",       pauht: 4.20,  coef_marge: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref_legacy: "104",  designation: "Silicone blanc neutre",                fournisseur_nom: "SOGIMEX",       pauht: 6.00,  coef_marge: 2.0, type_code: "AU", pricing_mode: "unit" },
  // SD — Services
  { ref_legacy: "826",  designation: "Pose (1conf)",                         fournisseur_nom: "ATELIER",       pauht: 120.00, coef_marge: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref_legacy: "827",  designation: "Pose en atelier 10mm",                 fournisseur_nom: "ATELIER",       pauht: 150.00, coef_marge: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref_legacy: "1086", designation: "Pénalité de retard",                   fournisseur_nom: "ATELIER",       pauht: 50.00,  coef_marge: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref_legacy: "1089", designation: "Livraison grand volume",               fournisseur_nom: "ATELIER",       pauht: 80.00,  coef_marge: 1.0, type_code: "SD", pricing_mode: "unit" },
  // EN — Encadrements
  { ref_legacy: "420",  designation: "Cadre Trafalia 334-03 Argent ancien",  fournisseur_nom: "NIELSEN",       pauht: 21.41, coef_marge: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre", vendu: false },
  { ref_legacy: "365",  designation: "Cadre alu 04-021 Noir mat",            fournisseur_nom: "NIELSEN",       pauht: 18.00, coef_marge: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre", vendu: false },
  { ref_legacy: "448",  designation: "Cadre 448 Orofina Art déco 20×30",     fournisseur_nom: "RM DIFFUSION",  pauht: 45.00, coef_marge: 2.0, type_code: "EN", pricing_mode: "unit",          cadre_or_accessoire: "cadre", vendu: false },
  { ref_legacy: "304",  designation: "Cadre Lodge 51,2×33,2",                fournisseur_nom: "ATELIER",       pauht: 0.00,  coef_marge: 1.0, type_code: "EN", pricing_mode: "unit",          cadre_or_accessoire: "cadre", vendu: true },
];

function uniteCalculFor(mode: string): string {
  if (mode === "linear_meter") return "metre_lineaire";
  if (mode === "square_meter") return "metre_carre";
  return "unitaire";
}

async function seedProduits() {
  // Build supplier name → id lookup
  const fRows = await db.select({ id: fournisseursTable.id, nom: fournisseursTable.nom }).from(fournisseursTable);
  const supplierByName = new Map(fRows.map(r => [r.nom, r.id]));

  // Wipe the lone test product if present (clean baseline)
  await db.delete(produitsTable).where(eq(produitsTable.designation, "Verre cristal 2mm test"));

  let inserted = 0;
  for (const p of PRODUITS) {
    const [existing] = await db.select().from(produitsTable).where(eq(produitsTable.ref_legacy, p.ref_legacy));
    if (existing) continue;

    const fId = supplierByName.get(p.fournisseur_nom) ?? null;
    const prix_ht = Number((p.pauht * p.coef_marge).toFixed(2));

    await db.insert(produitsTable).values({
      ref_legacy: p.ref_legacy,
      designation: p.designation,
      type_code: p.type_code,
      pricing_mode: p.pricing_mode,
      unite_calcul: uniteCalculFor(p.pricing_mode),
      fournisseur_id: fId,
      prix_achat_ht: p.pauht,
      coefficient_marge: p.coef_marge,
      prix_ht,
      taux_tva: 20,
      epaisseur_mm: p.epaisseur_mm ?? null,
      majo_epaisseur: p.majo_epaisseur ?? null,
      mini_fact_tn: p.mini_fact_tn ?? null,
      mini_fact_ta: p.mini_fact_ta ?? null,
      coef_marge_ta: p.coef_marge_ta ?? null,
      plus_value_ta_pct: p.plus_value_ta_pct ?? null,
      fac_mm: p.fac_mm ?? null,
      cadre_or_accessoire: p.cadre_or_accessoire ?? null,
      vendu: p.vendu ?? true,
    });
    inserted += 1;
  }
  return { inserted, total: PRODUITS.length };
}

async function seed() {
  console.log("🌱 Seeding EncadrePro database (Task 04 dataset)…");
  const a = await seedAtelier();    console.log(`  Atelier: inserted=${a.inserted} updated=${a.updated}`);
  const f = await seedFournisseurs(); console.log(`  Fournisseurs: inserted=${f.inserted}/${f.total} (${FOURNISSEURS.length} configured)`);
  const c = await seedClients();    console.log(`  Clients: inserted=${c.inserted}/${c.total}`);
  const p = await seedProduits();   console.log(`  Produits: inserted=${p.inserted}/${p.total}`);
  console.log("✅ Seed terminé");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erreur pendant le seed:", err);
  process.exit(1);
});
