import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  prenom: text("prenom"),
  email: text("email"),
  telephone: text("telephone"),
  adresse: text("adresse"),
  ville: text("ville"),
  code_postal: text("code_postal"),
  notes: text("notes"),
  cree_le: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, cree_le: true, modifie_le: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
