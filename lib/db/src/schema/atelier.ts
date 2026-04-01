import { pgTable, integer, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const atelierTable = pgTable("atelier", {
  id: integer("id").primaryKey().default(1),
  nom: text("nom").notNull().default("Mon Atelier"),
  siret: text("siret"),
  adresse: text("adresse"),
  telephone: text("telephone"),
  email: text("email"),
  logo_path: text("logo_path"),
  conditions_generales: text("conditions_generales").default("Devis valable 30 jours. Acompte de 30% à la commande."),
  prefixe_devis: text("prefixe_devis").notNull().default("DEV"),
  prefixe_facture: text("prefixe_facture").notNull().default("FAC"),
  compteur_devis: integer("compteur_devis").notNull().default(0),
  compteur_facture: integer("compteur_facture").notNull().default(0),
  tva_defaut: real("tva_defaut").notNull().default(20.0),
  email_template: text("email_template"),
  smtp_host: text("smtp_host"),
  smtp_port: integer("smtp_port").default(587),
  smtp_user: text("smtp_user"),
  smtp_pass: text("smtp_pass"),
});

export const insertAtelierSchema = createInsertSchema(atelierTable).omit({ id: true });
export type InsertAtelier = z.infer<typeof insertAtelierSchema>;
export type Atelier = typeof atelierTable.$inferSelect;
