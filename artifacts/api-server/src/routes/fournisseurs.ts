import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, fournisseursTable } from "@workspace/db";
import { serializeDates } from "../lib/db-utils";
import {
  ListFournisseursResponse,
  CreateFournisseurBody,
  GetFournisseurParams,
  GetFournisseurResponse,
  UpdateFournisseurParams,
  UpdateFournisseurBody,
  UpdateFournisseurResponse,
  DeleteFournisseurParams,
  DeleteFournisseurResponse,
} from "@workspace/api-zod";

/* WEB-TO-DESKTOP NOTE: route handlers are HTTP-only; reusable via IPC in Electron build. */

const router: IRouter = Router();

function mapFournisseur(f: typeof fournisseursTable.$inferSelect) {
  return serializeDates(f as unknown as Record<string, unknown>);
}

router.get("/fournisseurs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(fournisseursTable).orderBy(fournisseursTable.nom);
  res.json(ListFournisseursResponse.parse(rows.map(mapFournisseur)));
});

router.post("/fournisseurs", async (req, res): Promise<void> => {
  const parsed = CreateFournisseurBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(fournisseursTable).values(parsed.data).returning();
  res.status(201).json(GetFournisseurResponse.parse(mapFournisseur(row)));
});

router.get("/fournisseurs/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFournisseurParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(fournisseursTable).where(eq(fournisseursTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Fournisseur introuvable" }); return; }
  res.json(GetFournisseurResponse.parse(mapFournisseur(row)));
});

router.put("/fournisseurs/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateFournisseurParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateFournisseurBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(fournisseursTable).set({ ...parsed.data, modifie_le: new Date().toISOString() })
    .where(eq(fournisseursTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Fournisseur introuvable" }); return; }
  res.json(UpdateFournisseurResponse.parse(mapFournisseur(row)));
});

router.delete("/fournisseurs/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFournisseurParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(fournisseursTable).where(eq(fournisseursTable.id, params.data.id));
  res.json(DeleteFournisseurResponse.parse({ success: true }));
});

export default router;
