import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* WEB-TO-DESKTOP NOTE: shared schema, used by future Electron build. */

export const fournisseursTable = pgTable("fournisseurs", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  version_tarif: text("version_tarif"),
  contact_nom: text("contact_nom"),
  contact_email: text("contact_email"),
  contact_tel: text("contact_tel"),
  // TODO: drop after FileMaker import migration is complete and verified
  contact: text("contact"),
  // TODO: drop after FileMaker import migration is complete and verified
  email: text("email"),
  // TODO: drop after FileMaker import migration is complete and verified
  telephone: text("telephone"),
  adresse: text("adresse"),
  ville: text("ville"),
  code_postal: text("code_postal"),
  pays: text("pays"),
  siret: text("siret"),
  notes: text("notes"),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" }).notNull().defaultNow().$onUpdate(() => new Date().toISOString()),
});

export const insertFournisseurSchema = createInsertSchema(fournisseursTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertFournisseur = z.infer<typeof insertFournisseurSchema>;
export type Fournisseur = typeof fournisseursTable.$inferSelect;
