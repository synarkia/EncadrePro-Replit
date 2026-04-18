import { pgTable, serial, text, real, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { devisTable } from "./devis";

/* WEB-TO-DESKTOP NOTE: shared schema, used by future Electron build. */

export const facturesTable = pgTable("factures", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  devis_id: integer("devis_id").references(() => devisTable.id),
  client_id: integer("client_id").notNull().references(() => clientsTable.id),
  date_creation: date("date_creation", { mode: "string" }).notNull().defaultNow(),
  date_echeance: date("date_echeance", { mode: "string" }),
  statut: text("statut").notNull().default("brouillon"),
  sous_total_ht: numeric("sous_total_ht", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_tva_10: numeric("total_tva_10", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_tva_20: numeric("total_tva_20", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_ttc: numeric("total_ttc", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_paye: numeric("total_paye", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  solde_restant: numeric("solde_restant", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  notes: text("notes"),
  conditions: text("conditions"),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const lignesFactureTable = pgTable("lignes_facture", {
  id: serial("id").primaryKey(),
  facture_id: integer("facture_id").notNull().references(() => facturesTable.id, { onDelete: "cascade" }),
  produit_id: integer("produit_id"),
  designation: text("designation").notNull(),
  unite_calcul: text("unite_calcul").notNull(),
  largeur_m: real("largeur_m"),
  hauteur_m: real("hauteur_m"),
  quantite: real("quantite").notNull().default(1),
  quantite_calculee: real("quantite_calculee"),
  prix_unitaire_ht: numeric("prix_unitaire_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  taux_tva: numeric("taux_tva", { precision: 5, scale: 2, mode: "number" }).notNull(),
  total_ht: numeric("total_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  total_ttc: numeric("total_ttc", { precision: 12, scale: 2, mode: "number" }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export const acomptesTable = pgTable("acomptes", {
  id: serial("id").primaryKey(),
  facture_id: integer("facture_id").notNull().references(() => facturesTable.id),
  montant: numeric("montant", { precision: 12, scale: 2, mode: "number" }).notNull(),
  date_paiement: date("date_paiement", { mode: "string" }).notNull(),
  mode_paiement: text("mode_paiement"),
  notes: text("notes"),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertFactureSchema = createInsertSchema(facturesTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertFacture = z.infer<typeof insertFactureSchema>;
export type Facture = typeof facturesTable.$inferSelect;

export const insertLigneFactureSchema = createInsertSchema(lignesFactureTable).omit({ id: true });
export type InsertLigneFacture = z.infer<typeof insertLigneFactureSchema>;
export type LigneFacture = typeof lignesFactureTable.$inferSelect;

export const insertAcompteSchema = createInsertSchema(acomptesTable).omit({ id: true, cree_le: true });
export type InsertAcompte = z.infer<typeof insertAcompteSchema>;
export type Acompte = typeof acomptesTable.$inferSelect;
