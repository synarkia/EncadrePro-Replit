import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
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

router.get("/produits", async (req, res): Promise<void> => {
  const categorie =
    typeof req.query.categorie === "string" ? req.query.categorie : undefined;

  const rows = categorie
    ? await db.select().from(produitsTable).where(eq(produitsTable.categorie, categorie)).orderBy(produitsTable.designation)
    : await db.select().from(produitsTable).orderBy(produitsTable.designation);

  res.json(ListProduitsResponse.parse(rows.map(serializeDates)));
});

router.post("/produits", async (req, res): Promise<void> => {
  const parsed = CreateProduitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [produit] = await db.insert(produitsTable).values(parsed.data).returning();
  res.status(201).json(UpdateProduitResponse.parse(serializeDates(produit)));
});

router.put("/produits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProduitParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateProduitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [produit] = await db
    .update(produitsTable)
    .set(parsed.data)
    .where(eq(produitsTable.id, params.data.id))
    .returning();

  if (!produit) {
    res.status(404).json({ error: "Produit introuvable" });
    return;
  }

  res.json(UpdateProduitResponse.parse(serializeDates(produit)));
});

router.delete("/produits/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProduitParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(produitsTable).where(eq(produitsTable.id, params.data.id));
  res.json(DeleteProduitResponse.parse({ success: true }));
});

router.patch("/produits/:id/toggle", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleProduitActifParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db.select().from(produitsTable).where(eq(produitsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Produit introuvable" });
    return;
  }

  const [produit] = await db
    .update(produitsTable)
    .set({ actif: existing.actif === 1 ? 0 : 1 })
    .where(eq(produitsTable.id, params.data.id))
    .returning();

  res.json(ToggleProduitActifResponse.parse(serializeDates(produit)));
});

export default router;
