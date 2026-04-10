import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const produitsTable = pgTable("produits", {
  id: serial("id").primaryKey(),
  // ── new modular fields ───────────────────────────────────────────────────
  type_produit: text("type_produit"),           // matière | façonnage | service
  fournisseur: text("fournisseur"),             // supplier name
  sous_categorie: text("sous_categorie"),        // e.g. Verre / Polissage / Livraison
  unite: text("unite"),                          // m² | ml | pièce | heure | forfait
  // ── legacy fields (kept for backward compat) ───────────────────────────
  reference: text("reference"),
  designation: text("designation").notNull(),
  categorie: text("categorie").notNull().default("baguettes"),
  unite_calcul: text("unite_calcul").notNull().default("unitaire"),
  prix_ht: real("prix_ht").notNull().default(0),
  taux_tva: real("taux_tva").notNull().default(20.0),
  actif: integer("actif").notNull().default(1),
  notes: text("notes"),
  image_url: text("image_url"),
  cree_le: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProduitSchema = createInsertSchema(produitsTable).omit({ id: true, cree_le: true });
export type InsertProduit = z.infer<typeof insertProduitSchema>;
export type Produit = typeof produitsTable.$inferSelect;
