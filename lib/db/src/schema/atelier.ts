import { pgTable, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* WEB-TO-DESKTOP NOTE: shared schema, used by future Electron build. */

export const atelierTable = pgTable("atelier", {
  id: integer("id").primaryKey().default(1),
  nom: text("nom").notNull().default("Mon Atelier"),
  tagline: text("tagline"),
  subtitre: text("subtitre"),

  // ── Identity / legal ──────────────────────────────────────────────────────
  siret: text("siret"),
  tva_intracom: text("tva_intracom"),
  rcs: text("rcs"),
  forme_juridique: text("forme_juridique"),     // SARL, EURL, EI, …
  capital_social: numeric("capital_social", { precision: 12, scale: 2, mode: "number" }),
  code_ape: text("code_ape"),
  mentions_legales: text("mentions_legales"),

  // ── Contact ───────────────────────────────────────────────────────────────
  adresse: text("adresse"),
  telephone: text("telephone"),
  email: text("email"),
  logo_path: text("logo_path"),

  // ── Banking ───────────────────────────────────────────────────────────────
  iban: text("iban"),
  bic: text("bic"),

  // ── Documents ─────────────────────────────────────────────────────────────
  conditions_generales: text("conditions_generales").default("Devis valable 30 jours. Acompte de 30% à la commande."),
  prefixe_devis: text("prefixe_devis").notNull().default("DEV"),
  prefixe_facture: text("prefixe_facture").notNull().default("FAC"),
  compteur_devis: integer("compteur_devis").notNull().default(0),
  compteur_facture: integer("compteur_facture").notNull().default(0),
  tva_defaut: numeric("tva_defaut", { precision: 5, scale: 2, mode: "number" }).notNull().default(20),

  // ── Email ─────────────────────────────────────────────────────────────────
  email_template: text("email_template"),
  smtp_host: text("smtp_host"),
  smtp_port: integer("smtp_port").default(587),
  smtp_user: text("smtp_user"),
  smtp_pass: text("smtp_pass"),

  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const insertAtelierSchema = createInsertSchema(atelierTable).omit({ id: true, modifie_le: true });
export type InsertAtelier = z.infer<typeof insertAtelierSchema>;
export type Atelier = typeof atelierTable.$inferSelect;
