/**
 * Seed script for EncadrePro — full demo dataset.
 *
 * Wipes all transactional rows then inserts a deterministic dataset that
 * exercises every screen and every status. The atelier singleton (id=1) is
 * upserted, never wiped.
 *
 * Run: pnpm --filter @workspace/api-server exec tsx src/seed.ts
 *
 * Refuses to run when NODE_ENV === "production".
 *
 * WEB-TO-DESKTOP NOTE: shared schema; reusable from the future Electron build.
 */
import {
  db,
  atelierTable,
  produitsTable,
  fournisseursTable,
  clientsTable,
  devisTable,
  lignesDevisTable,
  projetsTable,
  facturesTable,
  lignesFactureTable,
  acomptesTable,
  facturesAcompteTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

if (process.env.NODE_ENV === "production") {
  console.error("❌ Refus de lancer le seed en production (NODE_ENV=production).");
  process.exit(1);
}

// ── Date helpers ────────────────────────────────────────────────────────
const today = new Date();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return isoDate(d);
};
const year = today.getFullYear();
const pad3 = (n: number) => String(n).padStart(3, "0");
const pad4 = (n: number) => String(n).padStart(4, "0");
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Wipe all transactional tables ───────────────────────────────────────
async function wipe() {
  // Order matters logically but TRUNCATE … CASCADE handles FKs in one shot.
  // RESTART IDENTITY resets every SERIAL sequence so IDs start at 1 again.
  await db.execute(sql`
    TRUNCATE TABLE
      factures_acompte, acomptes, lignes_facture, factures,
      lignes_devis, projets, devis,
      produits, clients, fournisseurs
    RESTART IDENTITY CASCADE
  `);
}

// ── Atelier (singleton, upsert) ─────────────────────────────────────────
async function seedAtelier(counters: { devis: number; facture: number; faAcompte: number }) {
  const data = {
    nom: "Atelier AGV",
    adresse: "152 rue de Tolbiac, 75013 Paris",
    telephone: "06 23 80 15 27",
    email: "contact@atelier-agv.fr",
    siret: "12345678900010",
    tva_intracom: "FR12345678900",
    rcs: "Paris B 123 456 789",
    forme_juridique: "SARL",
    capital_social: 10000,
    code_ape: "1623Z",
    mentions_legales: "TVA applicable, art. 293 B du CGI non retenu",
    tva_defaut: 20,
    iban: "FR76 1234 5678 9012 3456 7890 123",
    bic: "BNPAFRPP",
    prefixe_devis: "DEV",
    prefixe_facture: "FAC",
    prefixe_facture_acompte: "FA",
    compteur_devis: counters.devis,
    compteur_facture: counters.facture,
    compteur_facture_acompte: counters.faAcompte,
  };
  const [existing] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!existing) {
    await db.insert(atelierTable).values({ id: 1, ...data });
  } else {
    await db.update(atelierTable).set(data).where(eq(atelierTable.id, 1));
  }
}

// ── Fournisseurs ────────────────────────────────────────────────────────
const FOURNISSEURS = [
  { nom: "NIELSEN",       version_tarif: "02/2025", contact_email: "contact@nielsen.fr",      ville: "Paris" },
  { nom: "GLASSOLUTIONS", version_tarif: "04/2024", contact_email: "vente@glassolutions.fr",  ville: "Lyon" },
  { nom: "MACOCCO",       version_tarif: "01/2025", contact_email: null,                       ville: "Lyon" },
  { nom: "RM DIFFUSION",  version_tarif: "2024",    contact_email: "contact@rmdiff.fr",       ville: "Bordeaux" },
  { nom: "CINDAR",        version_tarif: "2024",    contact_email: null,                       ville: "Toulouse" },
  { nom: "REVERCHON",     version_tarif: "2024",    contact_email: null,                       ville: "Saint-Étienne" },
  { nom: "SOGIMEX",       version_tarif: "2023",    contact_email: "ventes@sogimex.fr",       ville: "Lille" },
];

async function seedFournisseurs(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const f of FOURNISSEURS) {
    const [row] = await db.insert(fournisseursTable).values(f).returning();
    out.set(f.nom, row.id);
  }
  return out;
}

// ── Clients (mix: particuliers / entreprises only / mixed) ──────────────
const CLIENTS: Array<{
  nom: string | null; prenom: string | null; entreprise: string | null;
  email: string | null; telephone: string | null;
  adresse: string; code_postal: string; ville: string; notes: string | null;
}> = [
  // 0–2 : Particuliers (nom + prénom)
  { nom: "DURAND",            prenom: "Sophie",      entreprise: null, email: "sophie.durand@example.fr", telephone: "06 11 22 33 44", adresse: "12 rue Victor Hugo",       code_postal: "75011", ville: "Paris",     notes: null },
  { nom: "MARTIN",            prenom: "Jean-Pierre", entreprise: null, email: "jp.martin@example.fr",     telephone: null,             adresse: "8 place Bellecour",         code_postal: "69002", ville: "Lyon",      notes: "Préfère un contact par e-mail" },
  { nom: "O'CALLAGHAN-LOCKE", prenom: "Ryan",        entreprise: null, email: null,                       telephone: "06 23 80 15 27", adresse: "45 rue Saint-Michel",       code_postal: "33000", ville: "Bordeaux",  notes: null },
  // 3–5 : Entreprises uniquement (pas de nom de contact)
  { nom: null, prenom: null, entreprise: "Galerie des Arts Modernes", email: "contact@galerie-arts.fr",   telephone: "01 42 33 44 55", adresse: "23 rue Mercière",           code_postal: "75003", ville: "Paris",     notes: null },
  { nom: null, prenom: null, entreprise: "Musée de Lyon",             email: "regie@musee-lyon.fr",       telephone: "04 78 22 33 44", adresse: "1 place de la Confluence",  code_postal: "69002", ville: "Lyon",      notes: "Régie des œuvres" },
  { nom: null, prenom: null, entreprise: "FNAC Bellecour",            email: "achats.bellecour@fnac.fr",  telephone: "04 72 40 49 49", adresse: "85 rue de la République",   code_postal: "69002", ville: "Lyon",      notes: null },
  // 6–8 : Mixtes (entreprise + contact)
  { nom: "LEGRAND", prenom: "Camille", entreprise: "Atelier Lumière",          email: "camille@atelier-lumiere.fr", telephone: "06 88 77 66 55", adresse: "3 rue des Capucins",  code_postal: "69001", ville: "Lyon",      notes: null },
  { nom: "PETIT",   prenom: "Thomas",  entreprise: "Cabinet Petit & Associés", email: "t.petit@cabinet-petit.fr",   telephone: "01 53 00 00 00", adresse: "27 avenue Foch",      code_postal: "75116", ville: "Paris",     notes: null },
  { nom: "BERNARD", prenom: null,      entreprise: "Bernard Décoration",       email: null,                          telephone: "04 91 12 34 56", adresse: "14 cours Julien",     code_postal: "13006", ville: "Marseille", notes: "Décoration intérieure" },
];

async function seedClients(): Promise<number[]> {
  const ids: number[] = [];
  for (const c of CLIENTS) {
    const [row] = await db.insert(clientsTable).values(c).returning();
    ids.push(row.id);
  }
  return ids;
}

// ── Produits (5–10 par type_code) ───────────────────────────────────────
type Prod = {
  ref: string; designation: string; fournisseur: string; pauht: number; coef: number;
  type_code: "VR" | "FA" | "AU" | "SD" | "EN";
  pricing_mode: "unit" | "linear_meter" | "square_meter";
  taux_tva?: number;
  epaisseur_mm?: number; cadre_or_accessoire?: string; vendu?: boolean; fac_mm?: number;
};

const PRODUITS: Prod[] = [
  // VR — Verres / Plexi (m²)
  { ref: "VR-001", designation: "Verre clair 2mm",                       fournisseur: "MACOCCO",       pauht: 25.00,  coef: 2.6, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 2 },
  { ref: "VR-002", designation: "Verre clair 3mm",                       fournisseur: "GLASSOLUTIONS", pauht: 32.00,  coef: 2.5, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 3 },
  { ref: "VR-003", designation: "Miroir argenté 4mm",                    fournisseur: "MACOCCO",       pauht: 38.00,  coef: 2.5, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 4 },
  { ref: "VR-004", designation: "Verre antireflet 2mm",                  fournisseur: "GLASSOLUTIONS", pauht: 65.00,  coef: 2.2, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 2 },
  { ref: "VR-005", designation: "Verre musée Tru Vue UV 2mm",            fournisseur: "GLASSOLUTIONS", pauht: 120.00, coef: 2.0, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 2 },
  { ref: "VR-006", designation: "Plexiglas extrudé 3mm",                 fournisseur: "CINDAR",        pauht: 55.00,  coef: 2.0, type_code: "VR", pricing_mode: "square_meter", epaisseur_mm: 3 },
  // FA — Façonnages
  { ref: "FA-001", designation: "Bords polis (ml)",                      fournisseur: "REVERCHON",     pauht: 13.50,  coef: 1.5, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 4 },
  { ref: "FA-002", designation: "Biseau talon poli (ml)",                fournisseur: "REVERCHON",     pauht: 18.00,  coef: 1.5, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 6 },
  { ref: "FA-003", designation: "Chanfrein 6mm (ml)",                    fournisseur: "REVERCHON",     pauht: 12.00,  coef: 1.5, type_code: "FA", pricing_mode: "linear_meter", fac_mm: 6 },
  { ref: "FA-004", designation: "Coupe simple",                          fournisseur: "REVERCHON",     pauht: 6.00,   coef: 1.5, type_code: "FA", pricing_mode: "unit" },
  { ref: "FA-005", designation: "Pose passe-partout",                    fournisseur: "NIELSEN",       pauht: 10.00,  coef: 1.5, type_code: "FA", pricing_mode: "unit" },
  { ref: "FA-006", designation: "Montage cadre standard",                fournisseur: "NIELSEN",       pauht: 18.00,  coef: 1.5, type_code: "FA", pricing_mode: "unit" },
  // AU — Autres composants
  { ref: "AU-001", designation: "Passe-partout blanc 1.4mm 80×120",      fournisseur: "NIELSEN",       pauht: 14.00,  coef: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref: "AU-002", designation: "Carton plume 5mm 100×140",              fournisseur: "NIELSEN",       pauht: 22.00,  coef: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref: "AU-003", designation: "Fond bois MDF 3mm 50×70",               fournisseur: "RM DIFFUSION",  pauht: 6.50,   coef: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref: "AU-004", designation: "Attaches D-rings (paire)",              fournisseur: "SOGIMEX",       pauht: 1.20,   coef: 2.5, type_code: "AU", pricing_mode: "unit" },
  { ref: "AU-005", designation: "Cordon laiton 2m",                      fournisseur: "SOGIMEX",       pauht: 3.50,   coef: 2.0, type_code: "AU", pricing_mode: "unit" },
  { ref: "AU-006", designation: "Crochet X (sachet de 10)",              fournisseur: "SOGIMEX",       pauht: 2.80,   coef: 2.5, type_code: "AU", pricing_mode: "unit" },
  // SD — Services directs
  { ref: "SD-001", designation: "Livraison Lyon intra-muros",            fournisseur: "NIELSEN",       pauht: 35.00,  coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref: "SD-002", designation: "Livraison région Auvergne-Rhône-Alpes", fournisseur: "NIELSEN",       pauht: 80.00,  coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref: "SD-003", designation: "Déplacement studio (forfait)",          fournisseur: "NIELSEN",       pauht: 60.00,  coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref: "SD-004", designation: "Manutention 1h",                        fournisseur: "NIELSEN",       pauht: 45.00,  coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref: "SD-005", designation: "Pose murale sur site",                  fournisseur: "NIELSEN",       pauht: 120.00, coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  { ref: "SD-006", designation: "Conseil esthétique 1h",                 fournisseur: "NIELSEN",       pauht: 75.00,  coef: 1.0, type_code: "SD", pricing_mode: "unit" },
  // EN — Encadrements
  { ref: "EN-001", designation: "Cadre Trafalia 334-03 Argent ancien",   fournisseur: "NIELSEN",       pauht: 21.41,  coef: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "EN-002", designation: "Cadre alu 04-021 Noir mat",             fournisseur: "NIELSEN",       pauht: 18.00,  coef: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "EN-003", designation: "Cadre chêne naturel 25mm",              fournisseur: "RM DIFFUSION",  pauht: 24.00,  coef: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "EN-004", designation: "Cadre noyer 35mm verni",                fournisseur: "RM DIFFUSION",  pauht: 32.00,  coef: 2.4, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "EN-005", designation: "Cadre doré baroque 50mm",               fournisseur: "RM DIFFUSION",  pauht: 48.00,  coef: 2.5, type_code: "EN", pricing_mode: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "EN-006", designation: "Cadre 448 Orofina Art déco 20×30",      fournisseur: "RM DIFFUSION",  pauht: 45.00,  coef: 2.0, type_code: "EN", pricing_mode: "unit",          cadre_or_accessoire: "cadre" },
  { ref: "EN-007", designation: "Cadre Lodge brocante 51,2×33,2",        fournisseur: "RM DIFFUSION",  pauht: 0.00,   coef: 1.0, type_code: "EN", pricing_mode: "unit",          cadre_or_accessoire: "cadre", vendu: true },
];

const uniteFor = (m: string) =>
  m === "linear_meter" ? "metre_lineaire" : m === "square_meter" ? "metre_carre" : "unitaire";

type ProdInfo = {
  id: number; designation: string; pu: number; pricing: string; type: string; tva: number;
};

async function seedProduits(supplierIds: Map<string, number>): Promise<Map<string, ProdInfo>> {
  const out = new Map<string, ProdInfo>();
  for (const p of PRODUITS) {
    const prix_ht = round2(p.pauht * p.coef);
    const taux = p.taux_tva ?? 20;
    const [row] = await db.insert(produitsTable).values({
      reference: p.ref,
      ref_legacy: p.ref,
      designation: p.designation,
      type_code: p.type_code,
      pricing_mode: p.pricing_mode,
      unite_calcul: uniteFor(p.pricing_mode),
      fournisseur_id: supplierIds.get(p.fournisseur) ?? null,
      prix_achat_ht: p.pauht,
      coefficient_marge: p.coef,
      prix_ht,
      taux_tva: taux,
      epaisseur_mm: p.epaisseur_mm ?? null,
      cadre_or_accessoire: p.cadre_or_accessoire ?? null,
      vendu: p.vendu ?? false,
      fac_mm: p.fac_mm ?? null,
    }).returning();
    out.set(p.ref, { id: row.id, designation: p.designation, pu: prix_ht, pricing: p.pricing_mode, type: p.type_code, tva: taux });
  }
  return out;
}

// ── Devis seed model ────────────────────────────────────────────────────
type SeedLine = {
  type_ligne: "matiere" | "faconnage" | "service";
  prod_ref: string;
  width_cm?: number;
  height_cm?: number;
  longueur_m?: number;
  heures?: number;
  quantite: number;
  remise_pct?: number;
};

type SeedProjet = {
  type: "encadrement" | "verre" | "miroir" | "vitrage" | "autre";
  width_cm: number; height_cm: number; label?: string;
  lignes: SeedLine[];
};

type FactureStatut = "brouillon" | "envoyee" | "partiellement_payee" | "soldee" | "annulee";

type SeedDevis = {
  client_idx: number;
  statut: "brouillon" | "envoye" | "accepte" | "refuse" | "converti";
  date_creation: string;
  date_validite: string;
  notes?: string;
  conditions?: string;
  projets: SeedProjet[];
  // For "converti" only:
  factureStatut?: FactureStatut;
  acompteRatio?: number; // 0..1 of total TTC
  acompteDate?: string;
  factureEcheance?: string;
  withFA?: boolean;      // emit factures_acompte (deposit invoice)
};

// Mirrors the line-total formula used by PUT /devis/:id/lignes (compute-line.ts).
function computeLineTotals(l: SeedLine, prod: ProdInfo): {
  qCalc: number; pu: number; tva: number; total_ht: number; total_ttc: number; unite: string;
} {
  const pu = prod.pu;
  const tva = prod.tva;
  const remise = l.remise_pct ?? 0;
  const unite = uniteFor(prod.pricing);
  let qCalc = l.quantite;
  if (l.type_ligne === "matiere") {
    if (unite === "metre_lineaire") {
      qCalc = ((l.width_cm ?? 0) / 100 + (l.height_cm ?? 0) / 100) * l.quantite;
    } else if (unite === "metre_carre") {
      qCalc = ((l.width_cm ?? 0) / 100) * ((l.height_cm ?? 0) / 100) * l.quantite;
    } else {
      qCalc = l.quantite;
    }
  } else if (l.type_ligne === "faconnage") {
    const eff = l.longueur_m != null && l.longueur_m > 0 ? l.longueur_m : 1;
    qCalc = l.quantite * eff;
  } else {
    qCalc = l.quantite;
  }
  const gross = qCalc * pu;
  const total_ht = round2(gross * (1 - remise / 100));
  const total_ttc = round2(total_ht * (1 + tva / 100));
  return { qCalc: round2(qCalc), pu, tva, total_ht, total_ttc, unite };
}

// ── 9 devis covering all 5 statuts ──────────────────────────────────────
const DEVIS: SeedDevis[] = [
  // 1 — brouillon
  {
    client_idx: 0, statut: "brouillon",
    date_creation: daysAgo(2), date_validite: daysAgo(-28),
    notes: "Cadre pour photo de mariage",
    projets: [{
      type: "encadrement", width_cm: 30, height_cm: 40, label: "Photo mariage",
      lignes: [
        { type_ligne: "matiere", prod_ref: "EN-001", quantite: 1, width_cm: 30, height_cm: 40 },
        { type_ligne: "matiere", prod_ref: "VR-002", quantite: 1, width_cm: 30, height_cm: 40 },
        { type_ligne: "service", prod_ref: "FA-006", quantite: 1 },
      ],
    }],
  },
  // 2 — brouillon (entreprise, 2 projets)
  {
    client_idx: 3, statut: "brouillon",
    date_creation: daysAgo(1), date_validite: daysAgo(-29),
    projets: [
      { type: "encadrement", width_cm: 50, height_cm: 70, label: "Lithographie A",
        lignes: [
          { type_ligne: "matiere", prod_ref: "EN-003", quantite: 1, width_cm: 50, height_cm: 70 },
          { type_ligne: "matiere", prod_ref: "VR-005", quantite: 1, width_cm: 50, height_cm: 70 },
          { type_ligne: "service", prod_ref: "FA-005", quantite: 1 },
        ],
      },
      { type: "miroir", width_cm: 60, height_cm: 90, label: "Miroir entrée",
        lignes: [
          { type_ligne: "matiere", prod_ref: "VR-003", quantite: 1, width_cm: 60, height_cm: 90 },
        ],
      },
    ],
  },
  // 3 — envoye
  {
    client_idx: 1, statut: "envoye",
    date_creation: daysAgo(7), date_validite: daysAgo(-23),
    notes: "Aquarelle - encadrement musée",
    projets: [{
      type: "encadrement", width_cm: 40, height_cm: 60, label: "Aquarelle",
      lignes: [
        { type_ligne: "matiere", prod_ref: "EN-004", quantite: 1, width_cm: 40, height_cm: 60 },
        { type_ligne: "matiere", prod_ref: "VR-005", quantite: 1, width_cm: 40, height_cm: 60 },
        { type_ligne: "matiere", prod_ref: "AU-001", quantite: 1 },
        { type_ligne: "service", prod_ref: "SD-001", quantite: 1 },
      ],
    }],
  },
  // 4 — envoye (mixte, 2 projets, 1 façonnage)
  {
    client_idx: 6, statut: "envoye",
    date_creation: daysAgo(5), date_validite: daysAgo(-25),
    projets: [
      { type: "encadrement", width_cm: 70, height_cm: 100, label: "Affiche 70×100",
        lignes: [
          { type_ligne: "matiere", prod_ref: "EN-002", quantite: 1, width_cm: 70, height_cm: 100 },
          { type_ligne: "matiere", prod_ref: "VR-001", quantite: 1, width_cm: 70, height_cm: 100 },
          { type_ligne: "service", prod_ref: "FA-006", quantite: 1 },
        ],
      },
      { type: "vitrage", width_cm: 80, height_cm: 120, label: "Vitrage atelier",
        lignes: [
          { type_ligne: "matiere", prod_ref: "VR-002", quantite: 1, width_cm: 80, height_cm: 120 },
          { type_ligne: "faconnage", prod_ref: "FA-001", quantite: 1, longueur_m: 4.0 },
        ],
      },
    ],
  },
  // 5 — accepte (musée, gros projet)
  {
    client_idx: 4, statut: "accepte",
    date_creation: daysAgo(15), date_validite: daysAgo(-15),
    notes: "Bon de commande BC-2026-042",
    projets: [{
      type: "encadrement", width_cm: 80, height_cm: 120, label: "Œuvre conservation",
      lignes: [
        { type_ligne: "matiere", prod_ref: "EN-005", quantite: 1, width_cm: 80, height_cm: 120 },
        { type_ligne: "matiere", prod_ref: "VR-005", quantite: 1, width_cm: 80, height_cm: 120 },
        { type_ligne: "matiere", prod_ref: "AU-002", quantite: 1 },
        { type_ligne: "service", prod_ref: "SD-005", quantite: 1 },
      ],
    }],
  },
  // 6 — accepte (triptyque, remise sur services)
  {
    client_idx: 0, statut: "accepte",
    date_creation: daysAgo(20), date_validite: daysAgo(-10),
    projets: [
      { type: "encadrement", width_cm: 24, height_cm: 30, label: "Triptyque cadre 1",
        lignes: [
          { type_ligne: "matiere", prod_ref: "EN-001", quantite: 1, width_cm: 24, height_cm: 30 },
          { type_ligne: "matiere", prod_ref: "VR-002", quantite: 1, width_cm: 24, height_cm: 30 },
        ],
      },
      { type: "encadrement", width_cm: 24, height_cm: 30, label: "Triptyque cadres 2 & 3",
        lignes: [
          { type_ligne: "matiere", prod_ref: "EN-001", quantite: 2, width_cm: 24, height_cm: 30 },
          { type_ligne: "matiere", prod_ref: "VR-002", quantite: 2, width_cm: 24, height_cm: 30 },
          { type_ligne: "service", prod_ref: "FA-006", quantite: 3, remise_pct: 10 },
          { type_ligne: "service", prod_ref: "SD-001", quantite: 1 },
        ],
      },
    ],
  },
  // 7 — refuse
  {
    client_idx: 2, statut: "refuse",
    date_creation: daysAgo(40), date_validite: daysAgo(10),
    notes: "Devis refusé - hors budget",
    projets: [{
      type: "encadrement", width_cm: 100, height_cm: 150, label: "Grande affiche",
      lignes: [
        { type_ligne: "matiere", prod_ref: "EN-005", quantite: 1, width_cm: 100, height_cm: 150 },
        { type_ligne: "matiere", prod_ref: "VR-006", quantite: 1, width_cm: 100, height_cm: 150 },
        { type_ligne: "service", prod_ref: "SD-002", quantite: 1 },
      ],
    }],
  },
  // 8 — converti → facture partiellement_payee + facture d'acompte FA-YYYY-0001
  {
    client_idx: 5, statut: "converti",
    date_creation: daysAgo(30), date_validite: daysAgo(0),
    notes: "Lot enseigne - 5 affiches FNAC",
    projets: [{
      type: "encadrement", width_cm: 60, height_cm: 80, label: "Affiches × 5",
      lignes: [
        { type_ligne: "matiere",   prod_ref: "EN-002", quantite: 5, width_cm: 60, height_cm: 80 },
        { type_ligne: "matiere",   prod_ref: "VR-001", quantite: 5, width_cm: 60, height_cm: 80 },
        { type_ligne: "matiere",   prod_ref: "AU-001", quantite: 5 },
        { type_ligne: "service",   prod_ref: "FA-006", quantite: 5 },
        { type_ligne: "service",   prod_ref: "SD-002", quantite: 1 },
      ],
    }],
    factureStatut: "partiellement_payee",
    acompteRatio: 0.30,
    acompteDate: daysAgo(28),
    factureEcheance: daysAgo(-15),
    withFA: true,
  },
  // 9 — converti → facture soldee (acompte = 100%, pas de FA)
  {
    client_idx: 7, statut: "converti",
    date_creation: daysAgo(60), date_validite: daysAgo(-30),
    projets: [
      { type: "encadrement", width_cm: 50, height_cm: 70, label: "Diplôme cabinet",
        lignes: [
          { type_ligne: "matiere", prod_ref: "EN-004", quantite: 1, width_cm: 50, height_cm: 70 },
          { type_ligne: "matiere", prod_ref: "VR-004", quantite: 1, width_cm: 50, height_cm: 70 },
        ],
      },
      { type: "verre", width_cm: 90, height_cm: 60, label: "Verre vitrine accueil",
        lignes: [
          { type_ligne: "matiere",   prod_ref: "VR-002",  quantite: 1, width_cm: 90, height_cm: 60 },
          { type_ligne: "faconnage", prod_ref: "FA-002",  quantite: 1, longueur_m: 3.0 },
        ],
      },
    ],
    factureStatut: "soldee",
    acompteRatio: 1.0,
    acompteDate: daysAgo(50),
    factureEcheance: daysAgo(20),
    withFA: false,
  },
];

// ── Standalone factures (no source devis) ───────────────────────────────
type StandaloneLine = { prod_ref: string; quantite: number; width_cm?: number; height_cm?: number };
type StandaloneFacture = {
  client_idx: number;
  statut: "brouillon" | "envoyee" | "annulee";
  date_creation: string;
  date_echeance: string;
  notes?: string;
  lignes: StandaloneLine[];
};

const STANDALONE_FACTURES: StandaloneFacture[] = [
  { client_idx: 8, statut: "brouillon", date_creation: daysAgo(3),  date_echeance: daysAgo(-27), notes: "À compléter",
    lignes: [
      { prod_ref: "EN-001", quantite: 1, width_cm: 30, height_cm: 30 },
      { prod_ref: "VR-002", quantite: 1, width_cm: 30, height_cm: 30 },
    ],
  },
  { client_idx: 1, statut: "envoyee", date_creation: daysAgo(10), date_echeance: daysAgo(-20), notes: "Photo de famille",
    lignes: [
      { prod_ref: "EN-003", quantite: 1, width_cm: 40, height_cm: 50 },
      { prod_ref: "VR-001", quantite: 1, width_cm: 40, height_cm: 50 },
      { prod_ref: "FA-006", quantite: 1 },
    ],
  },
  { client_idx: 3, statut: "envoyee", date_creation: daysAgo(8),  date_echeance: daysAgo(-22), notes: "Encadrement gravure",
    lignes: [
      { prod_ref: "EN-004", quantite: 2, width_cm: 50, height_cm: 70 },
      { prod_ref: "VR-005", quantite: 2, width_cm: 50, height_cm: 70 },
      { prod_ref: "SD-001", quantite: 1 },
    ],
  },
  { client_idx: 2, statut: "annulee", date_creation: daysAgo(45), date_echeance: daysAgo(-15), notes: "Annulée à la demande du client",
    lignes: [
      { prod_ref: "EN-006", quantite: 1 },
    ],
  },
];

// ── Devis + facture orchestration ───────────────────────────────────────
async function seedDevisAndFactures(clientIds: number[], prodMap: Map<string, ProdInfo>): Promise<{
  devisCount: number; factureCount: number; faCount: number;
}> {
  let devisCounter = 0;
  let factureCounter = 0;
  let faCounter = 0;

  for (const d of DEVIS) {
    devisCounter++;
    const numero = `DEV-${year}-${pad3(devisCounter)}`;

    const [devis] = await db.insert(devisTable).values({
      numero,
      client_id: clientIds[d.client_idx],
      date_creation: d.date_creation,
      date_validite: d.date_validite,
      statut: d.statut,
      notes: d.notes ?? null,
      conditions: d.conditions ?? null,
    }).returning();

    let totalHt = 0, tva10Sum = 0, tva20Sum = 0;
    let ordre = 0;

    for (let pi = 0; pi < d.projets.length; pi++) {
      const p = d.projets[pi];
      const [projet] = await db.insert(projetsTable).values({
        devis_id: devis.id,
        type: p.type,
        width_cm: p.width_cm,
        height_cm: p.height_cm,
        label: p.label ?? null,
        position: pi,
      }).returning();

      for (const l of p.lignes) {
        const prod = prodMap.get(l.prod_ref);
        if (!prod) throw new Error(`Produit ${l.prod_ref} introuvable`);
        const c = computeLineTotals(l, prod);
        const widthM  = l.width_cm  != null ? l.width_cm  / 100 : null;
        const heightM = l.height_cm != null ? l.height_cm / 100 : null;

        await db.insert(lignesDevisTable).values({
          devis_id: devis.id,
          projet_id: projet.id,
          produit_id: prod.id,
          type_ligne: l.type_ligne,
          designation: prod.designation,
          unite_calcul: c.unite,
          width_cm: l.width_cm ?? null,
          height_cm: l.height_cm ?? null,
          largeur_m: widthM,
          hauteur_m: heightM,
          longueur_m: l.longueur_m ?? null,
          heures: l.heures ?? null,
          quantite: l.quantite,
          quantite_calculee: c.qCalc,
          prix_unitaire_ht: c.pu,
          remise_pct: l.remise_pct ?? 0,
          taux_tva: c.tva,
          total_ht: c.total_ht,
          total_ttc: c.total_ttc,
          ordre: ordre++,
          inherits_project_dimensions: true,
        });

        totalHt += c.total_ht;
        if (c.tva === 10) tva10Sum += c.total_ht * 0.1;
        else                tva20Sum += c.total_ht * 0.2;
      }
    }

    totalHt   = round2(totalHt);
    tva10Sum  = round2(tva10Sum);
    tva20Sum  = round2(tva20Sum);
    const totalTtc = round2(totalHt + tva10Sum + tva20Sum);

    let factureFk: number | null = null;

    if (d.statut === "converti") {
      factureCounter++;
      const fnumero = `FAC-${year}-${pad3(factureCounter)}`;
      const acompte = d.acompteRatio ? round2(totalTtc * d.acompteRatio) : 0;

      const [facture] = await db.insert(facturesTable).values({
        numero: fnumero,
        devis_id: devis.id,
        client_id: clientIds[d.client_idx],
        date_creation: d.date_creation,
        date_echeance: d.factureEcheance ?? d.date_creation,
        statut: d.factureStatut!,
        sous_total_ht: totalHt,
        total_tva_10: tva10Sum,
        total_tva_20: tva20Sum,
        total_ttc: totalTtc,
        total_paye: acompte,
        solde_restant: round2(Math.max(0, totalTtc - acompte)),
        notes: d.notes ?? null,
      }).returning();
      factureFk = facture.id;

      // Copy lignes_devis → lignes_facture (preserve totals).
      const lignes = await db.select().from(lignesDevisTable).where(eq(lignesDevisTable.devis_id, devis.id));
      let fOrdre = 0;
      for (const l of lignes) {
        await db.insert(lignesFactureTable).values({
          facture_id: facture.id,
          produit_id: l.produit_id,
          designation: l.designation,
          unite_calcul: l.unite_calcul,
          largeur_m: l.largeur_m,
          hauteur_m: l.hauteur_m,
          quantite: l.quantite,
          quantite_calculee: l.quantite_calculee,
          prix_unitaire_ht: l.prix_unitaire_ht,
          remise_pct: l.remise_pct ?? 0,
          taux_tva: l.taux_tva,
          total_ht: l.total_ht,
          total_ttc: l.total_ttc,
          ordre: fOrdre++,
        });
      }

      if (acompte > 0) {
        await db.insert(acomptesTable).values({
          facture_id: facture.id,
          montant: acompte,
          date_paiement: d.acompteDate ?? d.date_creation,
          mode_paiement: "virement",
          notes: d.factureStatut === "soldee" ? "Paiement intégral" : "Acompte 30%",
        });
      }

      // Standalone facture d'acompte (French tax law) for partial deposits.
      if (d.withFA && acompte > 0) {
        faCounter++;
        const ratio  = totalTtc > 0 ? acompte / totalTtc : 0;
        const faTva10 = round2(tva10Sum * ratio);
        const faTva20 = round2(tva20Sum * ratio);
        const faTva   = round2(faTva10 + faTva20);
        const faHt    = round2(acompte - faTva);
        await db.insert(facturesAcompteTable).values({
          numero: `FA-${year}-${pad4(faCounter)}`,
          facture_id: facture.id,
          devis_id: devis.id,
          montant_ht: faHt,
          montant_tva: faTva,
          montant_tva_10: faTva10,
          montant_tva_20: faTva20,
          montant_ttc: acompte,
          mode_reglement: "virement",
          reference_paiement: "VIR-2026-FNAC-001",
          date_paiement: d.acompteDate ?? d.date_creation,
        });
      }
    }

    await db.update(devisTable).set({
      sous_total_ht: totalHt,
      total_tva_10: tva10Sum,
      total_tva_20: tva20Sum,
      total_ttc: totalTtc,
      facture_id: factureFk,
    }).where(eq(devisTable.id, devis.id));
  }

  // ── Standalone factures (no devis source) ────────────────────────────
  for (const f of STANDALONE_FACTURES) {
    factureCounter++;
    const fnumero = `FAC-${year}-${pad3(factureCounter)}`;

    let ht = 0, tva10 = 0, tva20 = 0;
    const computed = f.lignes.map((l, i) => {
      const prod = prodMap.get(l.prod_ref);
      if (!prod) throw new Error(`Produit ${l.prod_ref} introuvable`);
      // For standalone factures we don't carry type_ligne; classify by product type
      // so the line formula matches the produit's pricing_mode.
      const tline: SeedLine["type_ligne"] =
        prod.type === "SD" || prod.type === "FA" ? "service" : "matiere";
      const c = computeLineTotals(
        { type_ligne: tline, prod_ref: l.prod_ref, quantite: l.quantite, width_cm: l.width_cm, height_cm: l.height_cm },
        prod,
      );
      ht += c.total_ht;
      if (c.tva === 10) tva10 += c.total_ht * 0.1;
      else                tva20 += c.total_ht * 0.2;
      return { c, prod, l, ordre: i };
    });
    ht    = round2(ht);
    tva10 = round2(tva10);
    tva20 = round2(tva20);
    const ttc = round2(ht + tva10 + tva20);

    const [facture] = await db.insert(facturesTable).values({
      numero: fnumero,
      client_id: clientIds[f.client_idx],
      date_creation: f.date_creation,
      date_echeance: f.date_echeance,
      statut: f.statut,
      sous_total_ht: ht, total_tva_10: tva10, total_tva_20: tva20, total_ttc: ttc,
      total_paye: 0,
      solde_restant: f.statut === "annulee" ? 0 : ttc,
      notes: f.notes ?? null,
    }).returning();

    for (const { c, prod, l, ordre } of computed) {
      await db.insert(lignesFactureTable).values({
        facture_id: facture.id,
        produit_id: prod.id,
        designation: prod.designation,
        unite_calcul: c.unite,
        largeur_m: l.width_cm  != null ? l.width_cm  / 100 : null,
        hauteur_m: l.height_cm != null ? l.height_cm / 100 : null,
        quantite: l.quantite,
        quantite_calculee: c.qCalc,
        prix_unitaire_ht: c.pu,
        taux_tva: c.tva,
        total_ht: c.total_ht,
        total_ttc: c.total_ttc,
        ordre,
      });
    }
  }

  return { devisCount: devisCounter, factureCount: factureCounter, faCount: faCounter };
}

// ── Main ────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🧹 Nettoyage des tables transactionnelles…");
  await wipe();

  console.log("🌱 Insertion du jeu de démo…");
  const supplierIds = await seedFournisseurs();
  console.log(`  Fournisseurs : ${supplierIds.size}`);

  const clientIds = await seedClients();
  console.log(`  Clients      : ${clientIds.length}`);

  const prodMap = await seedProduits(supplierIds);
  console.log(`  Produits     : ${prodMap.size} (VR/FA/AU/SD/EN)`);

  const counts = await seedDevisAndFactures(clientIds, prodMap);
  console.log(`  Devis        : ${counts.devisCount}`);
  console.log(`  Factures     : ${counts.factureCount}`);
  console.log(`  Factures d'acompte (FA) : ${counts.faCount}`);

  await seedAtelier({
    devis: counts.devisCount,
    facture: counts.factureCount,
    faAcompte: counts.faCount,
  });
  console.log(`  Atelier (singleton) : compteurs synchronisés`);

  console.log("✅ Seed terminé");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erreur pendant le seed:", err);
  process.exit(1);
});
