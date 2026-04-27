import { Router, type IRouter } from "express";
import { eq, sql, asc } from "drizzle-orm";
import { db, projetsTable, devisTable } from "@workspace/db";
import {
  CreateProjetParams,
  CreateProjetBody,
  UpdateProjetParams,
  UpdateProjetBody,
  DeleteProjetParams,
  ReorderProjetsParams,
  ReorderProjetsBody,
} from "@workspace/api-zod";

/**
 * WEB-TO-DESKTOP NOTE: pure HTTP CRUD on the shared schema, fully reusable
 * from a future Electron build via the same router mount point.
 */

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function devisExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: devisTable.id }).from(devisTable).where(eq(devisTable.id, id));
  return !!row;
}

async function nextPosition(devisId: number): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${projetsTable.position})` })
    .from(projetsTable)
    .where(eq(projetsTable.devis_id, devisId));
  return (row?.max ?? -1) + 1;
}

// ─── POST /devis/:id/projets — create one projet under a devis ───────────────
router.post("/devis/:id/projets", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateProjetParams.safeParse({ id: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid devis id" }); return; }

  const body = CreateProjetBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (!(await devisExists(params.data.id))) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  const position = await nextPosition(params.data.id);
  const [projet] = await db.insert(projetsTable).values({
    devis_id: params.data.id,
    type: body.data.type,
    width_cm: body.data.width_cm ?? null,
    height_cm: body.data.height_cm ?? null,
    photo_path: body.data.photo_path ?? null,
    label: body.data.label ?? null,
    position,
  }).returning();

  res.status(201).json(projet);
});

// ─── PATCH /projets/:id — partial update (type, dims, photo, label) ──────────
router.patch("/projets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProjetParams.safeParse({ id: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateProjetBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  // Build a partial update that only touches keys the caller actually sent —
  // a missing key keeps the column unchanged, an explicit null clears it.
  const patch: Record<string, unknown> = {};
  if ("type" in req.body) patch.type = body.data.type;
  if ("width_cm" in req.body) patch.width_cm = body.data.width_cm ?? null;
  if ("height_cm" in req.body) patch.height_cm = body.data.height_cm ?? null;
  if ("photo_path" in req.body) patch.photo_path = body.data.photo_path ?? null;
  if ("label" in req.body) patch.label = body.data.label ?? null;

  if (Object.keys(patch).length === 0) {
    const [existing] = await db.select().from(projetsTable).where(eq(projetsTable.id, params.data.id));
    if (!existing) { res.status(404).json({ error: "Projet introuvable" }); return; }
    res.json(existing);
    return;
  }

  const [updated] = await db.update(projetsTable)
    .set(patch)
    .where(eq(projetsTable.id, params.data.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Projet introuvable" }); return; }
  res.json(updated);
});

// ─── DELETE /projets/:id — remove projet, lignes go back to "free" ───────────
router.delete("/projets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProjetParams.safeParse({ id: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  // FK ON DELETE SET NULL on lignes_devis.projet_id keeps existing lignes —
  // their devis totals stay intact, they just become free-form again.
  const result = await db.delete(projetsTable).where(eq(projetsTable.id, params.data.id)).returning();
  if (result.length === 0) { res.status(404).json({ error: "Projet introuvable" }); return; }
  res.json({ success: true });
});

// ─── PUT /devis/:id/projets/reorder — atomic reorder ────────────────────────
router.put("/devis/:id/projets/reorder", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ReorderProjetsParams.safeParse({ id: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid devis id" }); return; }

  const body = ReorderProjetsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  // Verify the body lists the devis's projets exactly once each — refuse
  // partial reorders so positions never go inconsistent.
  const current = await db.select({ id: projetsTable.id })
    .from(projetsTable)
    .where(eq(projetsTable.devis_id, params.data.id));
  const currentIds = new Set(current.map(p => p.id));
  const bodyIds = new Set(body.data.ids);
  if (
    bodyIds.size !== body.data.ids.length ||
    currentIds.size !== bodyIds.size ||
    [...currentIds].some(id => !bodyIds.has(id))
  ) {
    res.status(400).json({ error: "ids must list every projet of the devis exactly once" });
    return;
  }

  // Two-phase update so the (devis_id, position) pair never collides during
  // the rewrite — first push every position into a high range, then settle.
  await db.transaction(async (tx) => {
    for (let i = 0; i < body.data.ids.length; i++) {
      await tx.update(projetsTable)
        .set({ position: 1_000_000 + i })
        .where(eq(projetsTable.id, body.data.ids[i]));
    }
    for (let i = 0; i < body.data.ids.length; i++) {
      await tx.update(projetsTable)
        .set({ position: i })
        .where(eq(projetsTable.id, body.data.ids[i]));
    }
  });

  const reordered = await db.select().from(projetsTable)
    .where(eq(projetsTable.devis_id, params.data.id))
    .orderBy(asc(projetsTable.position));
  res.json(reordered);
});

export default router;
