import { pgTable, serial, text, real, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { devisTable } from "./devis";

export const facturesTable = pgTable("factures", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  devis_id: integer("devis_id").references(() => devisTable.id),
  client_id: integer("client_id").notNull().references(() => clientsTable.id),
  date_creation: date("date_creation").notNull().defaultNow(),
  date_echeance: date("date_echeance"),
  statut: text("statut").notNull().default("brouillon"),
  sous_total_ht: real("sous_total_ht").notNull().default(0),
  total_tva_10: real("total_tva_10").notNull().default(0),
  total_tva_20: real("total_tva_20").notNull().default(0),
  total_ttc: real("total_ttc").notNull().default(0),
  total_paye: real("total_paye").notNull().default(0),
  solde_restant: real("solde_restant").notNull().default(0),
  notes: text("notes"),
  conditions: text("conditions"),
  cree_le: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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
  prix_unitaire_ht: real("prix_unitaire_ht").notNull(),
  taux_tva: real("taux_tva").notNull(),
  total_ht: real("total_ht").notNull(),
  total_ttc: real("total_ttc").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export const acomptesTable = pgTable("acomptes", {
  id: serial("id").primaryKey(),
  facture_id: integer("facture_id").notNull().references(() => facturesTable.id),
  montant: real("montant").notNull(),
  date_paiement: date("date_paiement").notNull(),
  mode_paiement: text("mode_paiement"),
  notes: text("notes"),
  cree_le: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
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
