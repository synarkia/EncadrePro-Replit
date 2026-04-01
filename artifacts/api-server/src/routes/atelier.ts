import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, atelierTable } from "@workspace/db";
import {
  GetAtelierResponse,
  SaveAtelierBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Ensure atelier row exists
async function ensureAtelier() {
  const [row] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!row) {
    const [created] = await db.insert(atelierTable).values({ id: 1, nom: "Mon Atelier" }).returning();
    return created;
  }
  return row;
}

router.get("/atelier", async (_req, res): Promise<void> => {
  const atelier = await ensureAtelier();
  res.json(GetAtelierResponse.parse(atelier));
});

router.put("/atelier", async (req, res): Promise<void> => {
  const parsed = SaveAtelierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureAtelier();

  const [atelier] = await db
    .update(atelierTable)
    .set(parsed.data)
    .where(eq(atelierTable.id, 1))
    .returning();

  res.json(GetAtelierResponse.parse(atelier));
});

export default router;
