import { Router, type IRouter } from "express";
import { eq, or, ilike, sql } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { execRows, serializeDates } from "../lib/db-utils";
import {
  ListClientsResponse,
  CreateClientBody,
  GetClientParams,
  GetClientResponse,
  UpdateClientParams,
  UpdateClientBody,
  UpdateClientResponse,
  DeleteClientParams,
  DeleteClientResponse,
  GetClientStatsParams,
  GetClientStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

router.get("/clients", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const rows = search
    ? await db
        .select()
        .from(clientsTable)
        .where(
          or(
            ilike(clientsTable.nom, `%${search}%`),
            ilike(clientsTable.prenom, `%${search}%`),
            ilike(clientsTable.email, `%${search}%`),
            ilike(clientsTable.telephone, `%${search}%`)
          )
        )
        .orderBy(clientsTable.nom)
    : await db.select().from(clientsTable).orderBy(clientsTable.nom);

  res.json(ListClientsResponse.parse(rows.map(serializeDates)));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(GetClientResponse.parse(serializeDates(client)));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }

  res.json(GetClientResponse.parse(serializeDates(client)));
});

router.put("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set({ ...parsed.data, modifie_le: new Date() })
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }

  res.json(UpdateClientResponse.parse(serializeDates(client)));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id));
  res.json(DeleteClientResponse.parse({ success: true }));
});

router.get("/clients/:id/stats", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetClientStatsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const clientId = params.data.id;

  const devisCountRows = await execRows<{ n: string }>(
    sql`SELECT COUNT(*) as n FROM devis WHERE client_id = ${clientId}`
  );
  const facturesCountRows = await execRows<{ n: string }>(
    sql`SELECT COUNT(*) as n FROM factures WHERE client_id = ${clientId}`
  );
  const caTotalRows = await execRows<{ total: string }>(
    sql`SELECT COALESCE(SUM(total_ttc), 0) as total FROM factures
        WHERE client_id = ${clientId} AND statut IN ('envoyee', 'partiellement_payee', 'soldee')`
  );

  const devisRows = await execRows<{
    id: number; numero: string; client_id: number; date_creation: string;
    date_validite: string; statut: string; sous_total_ht: string; total_tva_10: string;
    total_tva_20: string; total_ttc: string; notes: string; conditions: string;
    facture_id: number; cree_le: string; modifie_le: string;
  }>(sql`SELECT * FROM devis WHERE client_id = ${clientId} ORDER BY cree_le DESC`);

  const facturesRows = await execRows<{
    id: number; numero: string; devis_id: number; client_id: number; date_creation: string;
    date_echeance: string; statut: string; sous_total_ht: string; total_tva_10: string;
    total_tva_20: string; total_ttc: string; total_paye: string; solde_restant: string;
    notes: string; conditions: string; cree_le: string; modifie_le: string;
  }>(sql`SELECT * FROM factures WHERE client_id = ${clientId} ORDER BY cree_le DESC`);

  const data = {
    devisCount: parseInt(devisCountRows[0]?.n ?? "0", 10),
    facturesCount: parseInt(facturesCountRows[0]?.n ?? "0", 10),
    caTotal: parseNum(caTotalRows[0]?.total),
    devis: devisRows.map((r) => ({
      id: r.id, numero: r.numero, client_id: r.client_id, client_nom: null, client_prenom: null,
      date_creation: r.date_creation, date_validite: r.date_validite ?? null,
      statut: r.statut, sous_total_ht: parseNum(r.sous_total_ht), total_tva_10: parseNum(r.total_tva_10),
      total_tva_20: parseNum(r.total_tva_20), total_ttc: parseNum(r.total_ttc),
      notes: r.notes ?? null, conditions: r.conditions ?? null, facture_id: r.facture_id ?? null,
      cree_le: r.cree_le, modifie_le: r.modifie_le,
    })),
    factures: facturesRows.map((r) => ({
      id: r.id, numero: r.numero, devis_id: r.devis_id ?? null, client_id: r.client_id,
      client_nom: null, client_prenom: null, date_creation: r.date_creation,
      date_echeance: r.date_echeance ?? null, statut: r.statut,
      sous_total_ht: parseNum(r.sous_total_ht), total_tva_10: parseNum(r.total_tva_10),
      total_tva_20: parseNum(r.total_tva_20), total_ttc: parseNum(r.total_ttc),
      total_paye: parseNum(r.total_paye), solde_restant: parseNum(r.solde_restant),
      notes: r.notes ?? null, conditions: r.conditions ?? null,
      cree_le: r.cree_le, modifie_le: r.modifie_le,
    })),
  };

  res.json(GetClientStatsResponse.parse(data));
});

export default router;
