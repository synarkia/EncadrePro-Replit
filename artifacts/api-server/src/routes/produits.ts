import { Router, type IRouter } from "express";
import { eq, sql, ilike, or } from "drizzle-orm";
import { db, produitsTable } from "@workspace/db";
import { serializeDates } from "../lib/db-utils";
import {
  ListProduitsResponse,
  CreateProduitBody,
  UpdateProduitParams,
  UpdateProduitBody,
  UpdateProduitResponse,
  DeleteProduitParams,
  DeleteProduitResponse,
  ToggleProduitActifParams,
  ToggleProduitActifResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Helper: normalize a produit row ─────────────────────────────────────────
function mapProduit(p: typeof produitsTable.$inferSelect) {
  return {
    ...serializeDates(p as unknown as Record<string, unknown>),
    type_produit: p.type_produit ?? null,
    fournisseur: p.fournisseur ?? null,
    sous_categorie: p.sous_categorie ?? null,
    unite: p.unite ?? null,
  };
}

// ─── GET /produits — list (optional ?categorie or ?type= filter) ─────────────
router.get("/produits", async (req, res): Promise<void> => {
  const categorie = typeof req.query.categorie === "string" ? req.query.categorie : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;

  let rows;
  if (categorie) {
    rows = await db.select().from(produitsTable).where(eq(produitsTable.categorie, categorie)).orderBy(produitsTable.designation);
  } else if (type) {
    rows = await db.select().from(produitsTable).where(eq(produitsTable.type_produit, type)).orderBy(produitsTable.designation);
  } else {
    rows = await db.select().from(produitsTable).orderBy(produitsTable.designation);
  }

  res.json(ListProduitsResponse.parse(rows.map(mapProduit)));
});

// ─── GET /produits/search?q=&type= — autocomplete search ────────────────────
router.get("/produits/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const fournisseur = typeof req.query.fournisseur === "string" && req.query.fournisseur ? req.query.fournisseur : undefined;

  if (q.length < 2) {
    res.json([]);
    return;
  }

  const pattern = `%${q}%`;
  const searchCond = or(
    ilike(produitsTable.designation, pattern),
    ilike(produitsTable.reference, pattern),
    ilike(produitsTable.fournisseur, pattern),
  );

  let whereClause = searchCond;
  if (type) whereClause = sql`${whereClause} AND ${produitsTable.type_produit} = ${type}`;
  if (fournisseur) whereClause = sql`${whereClause} AND ${produitsTable.fournisseur} = ${fournisseur}`;

  const rows = await db.select().from(produitsTable)
    .where(whereClause!)
    .orderBy(produitsTable.designation)
    .limit(20);

  res.json(rows.map(mapProduit));
});

// ─── GET /produits/fournisseurs — list unique suppliers ─────────────────────
router.get("/produits/fournisseurs", async (req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ fournisseur: produitsTable.fournisseur })
    .from(produitsTable)
    .where(sql`${produitsTable.fournisseur} IS NOT NULL AND ${produitsTable.fournisseur} <> ''`)
    .orderBy(produitsTable.fournisseur);

  res.json(rows.map(r => r.fournisseur).filter(Boolean));
});

// ─── POST /produits ──────────────────────────────────────────────────────────
router.post("/produits", async (req, res): Promise<void> => {
  const parsed = CreateProduitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [produit] = await db.insert(produitsTable).values(parsed.data).returning();
  res.status(201).json(UpdateProduitResponse.parse(mapProduit(produit)));
});

// ─── PUT /produits/:id ───────────────────────────────────────────────────────
router.put("/produits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProduitParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateProduitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [produit] = await db.update(produitsTable).set(parsed.data)
    .where(eq(produitsTable.id, params.data.id)).returning();

  if (!produit) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.json(UpdateProduitResponse.parse(mapProduit(produit)));
});

// ─── DELETE /produits/:id ────────────────────────────────────────────────────
router.delete("/produits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProduitParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(produitsTable).where(eq(produitsTable.id, params.data.id));
  res.json(DeleteProduitResponse.parse({ success: true }));
});

// ─── PATCH /produits/:id/image ───────────────────────────────────────────────
router.patch("/produits/:id/image", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { objectPath } = req.body as { objectPath?: string };
  if (!objectPath && objectPath !== null) { res.status(400).json({ error: "objectPath requis" }); return; }

  const [produit] = await db.update(produitsTable).set({ image_url: objectPath ?? null })
    .where(eq(produitsTable.id, id)).returning();

  if (!produit) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.json(UpdateProduitResponse.parse(mapProduit(produit)));
});

// ─── PATCH /produits/:id/toggle ─────────────────────────────────────────────
router.patch("/produits/:id/toggle", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleProduitActifParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(produitsTable).where(eq(produitsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Produit introuvable" }); return; }

  const [produit] = await db.update(produitsTable)
    .set({ actif: existing.actif === 1 ? 0 : 1 })
    .where(eq(produitsTable.id, params.data.id)).returning();

  res.json(ToggleProduitActifResponse.parse(mapProduit(produit)));
});

export default router;
