import { pgTable, serial, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devisTable } from "./devis";

/* WEB-TO-DESKTOP NOTE: shared schema, used by future Electron build.
 *
 * A "Projet" sits between a Devis (quote) and its LigneDevis rows. One devis
 * can carry several projects (e.g. one frame + one mirror + one glass cut),
 * each with its own type, dimensions and optional reference photo. Lignes
 * keep their `projet_id` so totals + per-line discounts stay unchanged.
 */

export const PROJET_TYPES = ["encadrement", "verre", "miroir", "vitrage", "autre"] as const;
export type ProjetType = (typeof PROJET_TYPES)[number];

export const projetsTable = pgTable("projets", {
  id: serial("id").primaryKey(),
  devis_id: integer("devis_id").notNull().references(() => devisTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("encadrement"),
  width_cm: real("width_cm"),
  height_cm: real("height_cm"),
  photo_path: text("photo_path"),
  label: text("label"),
  position: integer("position").notNull().default(0),
  cree_le: timestamp("cree_le", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  modifie_le: timestamp("modifie_le", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date().toISOString()),
}, (table) => [
  index("projets_devis_id_position_idx").on(table.devis_id, table.position),
]);

export const insertProjetSchema = createInsertSchema(projetsTable).omit({
  id: true,
  cree_le: true,
  modifie_le: true,
});
export type InsertProjet = z.infer<typeof insertProjetSchema>;
export type Projet = typeof projetsTable.$inferSelect;
