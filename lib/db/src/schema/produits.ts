import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const produitsTable = pgTable("produits", {
  id: serial("id").primaryKey(),
  reference: text("reference"),
  designation: text("designation").notNull(),
  categorie: text("categorie").notNull(),
  unite_calcul: text("unite_calcul").notNull(),
  prix_ht: real("prix_ht").notNull(),
  taux_tva: real("taux_tva").notNull().default(20.0),
  actif: integer("actif").notNull().default(1),
  notes: text("notes"),
  image_url: text("image_url"),
  cree_le: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProduitSchema = createInsertSchema(produitsTable).omit({ id: true, cree_le: true });
export type InsertProduit = z.infer<typeof insertProduitSchema>;
export type Produit = typeof produitsTable.$inferSelect;
