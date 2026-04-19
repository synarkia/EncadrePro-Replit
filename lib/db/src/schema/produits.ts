import { pgTable, serial, text, integer, numeric, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { fournisseursTable } from "./fournisseurs";

/* WEB-TO-DESKTOP NOTE: schema is shared between the web app and a future Electron build. */

/**
 * Five-code product type system:
 *  VR  = Verre / Plexi
 *  FA  = Façonnage
 *  AU  = Autres composants
 *  SD  = Service direct (livraison, déplacement, manutention…)
 *  EN  = Encadrement (métier de base : moulures, baguettes…)
 */
export const PRODUCT_TYPES = ["VR", "FA", "AU", "SD", "EN"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/**
 * Per-product pricing formula:
 *  unit          → quantité simple
 *  linear_meter  → mètre linéaire = (largeur+hauteur)*2 * quantité
 *  square_meter  → mètre carré = largeur*hauteur * quantité
 */
export const PRICING_MODES = ["unit", "linear_meter", "square_meter"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const produitsTable = pgTable("produits", {
  id: serial("id").primaryKey(),

  // ── Core identity ─────────────────────────────────────────────────────────
  reference: text("reference"),
  designation: text("designation").notNull(),

  // ── New 5-code typology + pricing formula ─────────────────────────────────
  type_code: text("type_code").notNull().default("EN"),         // VR | FA | AU | SD | EN
  pricing_mode: text("pricing_mode").notNull().default("unit"), // unit | linear_meter | square_meter

  // ── Modular metadata (kept for filtering) ─────────────────────────────────
  // TODO: drop after FileMaker import migration is complete and verified
  type_produit: text("type_produit"),    // legacy free-form: matière | façonnage | service
  // TODO: drop after FileMaker import migration is complete and verified — superseded by fournisseur_id
  fournisseur: text("fournisseur"),
  fournisseur_id: integer("fournisseur_id").references(() => fournisseursTable.id, { onDelete: "set null" }), // FK → fournisseurs.id
  sous_categorie: text("sous_categorie"),
  unite: text("unite"),                  // m² | ml | pièce | heure | forfait
  // TODO: drop after FileMaker import migration is complete and verified — superseded by pricing_mode
  unite_calcul: text("unite_calcul").notNull().default("unitaire"),

  // ── Pricing (numeric for precision) ───────────────────────────────────────
  prix_achat_ht: numeric("prix_achat_ht", { precision: 12, scale: 2, mode: "number" }),
  coefficient_marge: numeric("coefficient_marge", { precision: 6, scale: 3, mode: "number" }),
  prix_ht: numeric("prix_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  taux_tva: numeric("taux_tva", { precision: 5, scale: 2, mode: "number" }).notNull().default(20),

  // ── Specialised measurements (façonnage / encadrement) ────────────────────
  largeur_mm: real("largeur_mm"),       // moulding profile width
  epaisseur_mm: real("epaisseur_mm"),   // moulding profile depth (VR thickness)
  longueur_barre_m: real("longueur_barre_m"), // standard bar length

  // ── VR-specific TN/TA pricing parameters ──────────────────────────────────
  majo_epaisseur: numeric("majo_epaisseur", { precision: 4, scale: 2, mode: "number" }),       // thickness markup multiplier
  mini_fact_tn: numeric("mini_fact_tn", { precision: 6, scale: 3, mode: "number" }),           // min billable surface m² – Tarif Normal
  mini_fact_ta: numeric("mini_fact_ta", { precision: 6, scale: 3, mode: "number" }),           // min billable surface m² – Tarif Atelier
  coef_marge_ta: numeric("coef_marge_ta", { precision: 6, scale: 3, mode: "number" }),         // separate margin coef for TA
  plus_value_ta_pct: numeric("plus_value_ta_pct", { precision: 6, scale: 2, mode: "number" }), // TA plus-value % uplift

  // ── FA-specific ───────────────────────────────────────────────────────────
  fac_mm: integer("fac_mm"),                                    // façonnage profile mm

  // ── EN-specific ───────────────────────────────────────────────────────────
  cadre_or_accessoire: text("cadre_or_accessoire"),             // 'cadre' | 'accessoire'
  vendu: boolean("vendu").notNull().default(false),             // brocante: pièce unique vendue

  // ── Inventory & legacy refs ───────────────────────────────────────────────
  stock_alerte: integer("stock_alerte"),
  ref_legacy: text("ref_legacy"),       // V1 Electron desktop reference
  notes: text("notes"),
  image_url: text("image_url"),
  actif: integer("actif").notNull().default(1),

  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const insertProduitSchema = createInsertSchema(produitsTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertProduit = z.infer<typeof insertProduitSchema>;
export type Produit = typeof produitsTable.$inferSelect;
