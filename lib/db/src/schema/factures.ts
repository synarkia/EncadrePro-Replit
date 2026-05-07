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
  total_tva_55: numeric("total_tva_55", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_tva_0: numeric("total_tva_0", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_ttc: numeric("total_ttc", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  total_paye: numeric("total_paye", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  solde_restant: numeric("solde_restant", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  notes: text("notes"),
  conditions: text("conditions"),
  prestation_periode: text("prestation_periode"),
  bon_de_commande: text("bon_de_commande"),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const lignesFactureTable = pgTable("lignes_facture", {
  id: serial("id").primaryKey(),
  facture_id: integer("facture_id").notNull().references(() => facturesTable.id, { onDelete: "cascade" }),
  produit_id: integer("produit_id"),
  designation: text("designation").notNull(),
  // ── Optional long-form description shown under the designation on print
  description_longue: text("description_longue"),
  unite_calcul: text("unite_calcul").notNull(),
  largeur_m: real("largeur_m"),
  hauteur_m: real("hauteur_m"),
  quantite: real("quantite").notNull().default(1),
  quantite_calculee: real("quantite_calculee"),
  prix_unitaire_ht: numeric("prix_unitaire_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  // ── Per-line discount expressed as a percentage (0–100). 0 = no discount.
  remise_pct: numeric("remise_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
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

// ─── Factures d'acompte ───────────────────────────────────────────────────────
// French tax law requires a deposit payment to generate its own standalone
// invoice document ("facture d'acompte") with its own number (FA-YYYY-NNNN),
// distinct from the final facture and from the simple `acomptes` payment row.
// One factures_acompte row corresponds to one deposit collected at conversion
// time; it's tied to BOTH the parent final facture and the original devis.
export const facturesAcompteTable = pgTable("factures_acompte", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  facture_id: integer("facture_id").notNull().references(() => facturesTable.id, { onDelete: "cascade" }),
  devis_id: integer("devis_id").references(() => devisTable.id),
  montant_ht: numeric("montant_ht", { precision: 12, scale: 2, mode: "number" }).notNull(),
  montant_tva: numeric("montant_tva", { precision: 12, scale: 2, mode: "number" }).notNull(),
  // Per-rate VAT breakdown: French tax law requires that a facture d'acompte
  // expose how much VAT was collected at each applicable rate (10 % vs 20 %)
  // when the source devis mixes them. We default both to 0 so a single-rate
  // FA still has well-defined columns.
  montant_tva_10: numeric("montant_tva_10", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  montant_tva_20: numeric("montant_tva_20", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  montant_ttc: numeric("montant_ttc", { precision: 12, scale: 2, mode: "number" }).notNull(),
  mode_reglement: text("mode_reglement").notNull(),
  reference_paiement: text("reference_paiement"),
  date_paiement: date("date_paiement", { mode: "string" }).notNull(),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const insertFactureAcompteSchema = createInsertSchema(facturesAcompteTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertFactureAcompte = z.infer<typeof insertFactureAcompteSchema>;
export type FactureAcompte = typeof facturesAcompteTable.$inferSelect;

export const insertFactureSchema = createInsertSchema(facturesTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertFacture = z.infer<typeof insertFactureSchema>;
export type Facture = typeof facturesTable.$inferSelect;

export const insertLigneFactureSchema = createInsertSchema(lignesFactureTable).omit({ id: true });
export type InsertLigneFacture = z.infer<typeof insertLigneFactureSchema>;
export type LigneFacture = typeof lignesFactureTable.$inferSelect;

export const insertAcompteSchema = createInsertSchema(acomptesTable).omit({ id: true, cree_le: true });
export type InsertAcompte = z.infer<typeof insertAcompteSchema>;
export type Acompte = typeof acomptesTable.$inferSelect;
