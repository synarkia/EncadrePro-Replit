import { pgTable, serial, text, real, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { produitsTable } from "./produits";

/* WEB-TO-DESKTOP NOTE: shared schema, used by future Electron build. */

export const devisTable = pgTable("devis", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  client_id: integer("client_id").notNull().references(() => clientsTable.id),
  date_creation: date("date_creation", { mode: "string" }).notNull().defaultNow(),
  date_validite: date("date_validite", { mode: "string" }),
  statut: text("statut").notNull().default("brouillon"),
  sous_total_ht: numeric("sous_total_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_tva_10: numeric("total_tva_10", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_tva_20: numeric("total_tva_20", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_ttc: numeric("total_ttc", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  notes: text("notes"),
  conditions: text("conditions"),
  facture_id: integer("facture_id"),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const lignesDevisTable = pgTable("lignes_devis", {
  id: serial("id").primaryKey(),
  devis_id: integer("devis_id").notNull().references(() => devisTable.id, { onDelete: "cascade" }),
  produit_id: integer("produit_id"),
  designation: text("designation").notNull(),
  unite_calcul: text("unite_calcul").notNull(),
  // ── legacy meter fields (kept for backward compat) ─────────────────────
  largeur_m: real("largeur_m"),
  hauteur_m: real("hauteur_m"),
  // ── new cm fields for user-friendly input ──────────────────────────────
  width_cm: real("width_cm"),
  height_cm: real("height_cm"),
  // ── quantities & pricing ────────────────────────────────────────────────
  quantite: real("quantite").notNull().default(1),
  quantite_calculee: real("quantite_calculee"),
  prix_unitaire_ht: numeric("prix_unitaire_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  taux_tva: numeric("taux_tva", { precision: 5, scale: 2, mode: "number" }).notNull(),
  total_ht: numeric("total_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  total_ttc: numeric("total_ttc", { precision: 12, scale: 2, mode: "number" }).notNull(),
  ordre: integer("ordre").notNull().default(0),
  // ── VR-only TN/TA regime selector (null for non-VR lines) ──────────────
  regime_pricing: text("regime_pricing"),
});

export const lignesDevisFaconnageTable = pgTable("lignes_devis_faconnage", {
  id: serial("id").primaryKey(),
  ligne_devis_id: integer("ligne_devis_id").notNull().references(() => lignesDevisTable.id, { onDelete: "cascade" }),
  produit_id: integer("produit_id").references(() => produitsTable.id),
  designation: text("designation").notNull(),
  quantite: real("quantite").notNull().default(1),
  // Optional length in metres — used for FA products priced per linear meter
  // (e.g. mat-board cut). When set, line total = quantite × longueur_m × pu_ht.
  longueur_m: real("longueur_m"),
  prix_unitaire_ht: numeric("prix_unitaire_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  taux_tva: numeric("taux_tva", { precision: 5, scale: 2, mode: "number" }).notNull().default(20),
  total_ht: numeric("total_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  parametres_json: text("parametres_json"),
  ordre: integer("ordre").notNull().default(0),
});

export const lignesDevisServiceTable = pgTable("lignes_devis_service", {
  id: serial("id").primaryKey(),
  ligne_devis_id: integer("ligne_devis_id").notNull().references(() => lignesDevisTable.id, { onDelete: "cascade" }),
  produit_id: integer("produit_id").references(() => produitsTable.id),
  designation: text("designation").notNull(),
  quantite: real("quantite").notNull().default(1),
  heures: real("heures"),
  prix_unitaire_ht: numeric("prix_unitaire_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  taux_tva: numeric("taux_tva", { precision: 5, scale: 2, mode: "number" }).notNull().default(20),
  total_ht: numeric("total_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  ordre: integer("ordre").notNull().default(0),
});

export const insertDevisSchema = createInsertSchema(devisTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertDevis = z.infer<typeof insertDevisSchema>;
export type Devis = typeof devisTable.$inferSelect;

export const insertLigneDevisSchema = createInsertSchema(lignesDevisTable).omit({ id: true });
export type InsertLigneDevis = z.infer<typeof insertLigneDevisSchema>;
export type LigneDevis = typeof lignesDevisTable.$inferSelect;

export const insertLigneDevisFaconnageSchema = createInsertSchema(lignesDevisFaconnageTable).omit({ id: true });
export type InsertLigneDevisFaconnage = z.infer<typeof insertLigneDevisFaconnageSchema>;
export type LigneDevisFaconnage = typeof lignesDevisFaconnageTable.$inferSelect;

export const insertLigneDevisServiceSchema = createInsertSchema(lignesDevisServiceTable).omit({ id: true });
export type InsertLigneDevisService = z.infer<typeof insertLigneDevisServiceSchema>;
export type LigneDevisService = typeof lignesDevisServiceTable.$inferSelect;
