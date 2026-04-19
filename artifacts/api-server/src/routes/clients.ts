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

// ── GET /clients — list with CA/devis stats ─────────────────────────────────

router.get("/clients", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const actifsOnly = req.query.actifs_seulement === "1";
  const sortBy = typeof req.query.sort === "string" ? req.query.sort : "nom";

  type ClientRow = {
    id: number; nom: string; prenom: string | null; email: string | null;
    telephone: string | null; adresse: string | null; ville: string | null;
    code_postal: string | null; notes: string | null; cree_le: string; modifie_le: string;
    ca_total: string; devis_count: string; derniere_activite: string | null;
  };

  const orderExpr: Record<string, string> = {
    nom: "c.nom ASC",
    ca: "ca_total DESC, c.nom ASC",
    activite: "derniere_activite DESC NULLS LAST, c.nom ASC",
    devis: "devis_count DESC, c.nom ASC",
  };
  const orderClause = orderExpr[sortBy] ?? "c.nom ASC";

  const searchConds: string[] = [];
  if (search) {
    const esc = search.replace(/'/g, "''");
    searchConds.push(`(c.nom ILIKE '%${esc}%' OR c.prenom ILIKE '%${esc}%' OR c.email ILIKE '%${esc}%' OR c.telephone ILIKE '%${esc}%')`);
  }
  if (actifsOnly) searchConds.push("COALESCE(ca.ca_total, 0) > 0");
  const whereClause = searchConds.length > 0 ? `WHERE ${searchConds.join(" AND ")}` : "";

  const rawQuery = `
    WITH client_ca AS (
      SELECT client_id, COALESCE(SUM(total_ttc), 0) AS ca_total, MAX(cree_le) AS derniere_facture
      FROM factures
      WHERE statut IN ('envoyee', 'partiellement_payee', 'soldee')
      GROUP BY client_id
    ),
    client_devis AS (
      SELECT client_id, COUNT(*) AS devis_count, MAX(cree_le) AS dernier_devis
      FROM devis
      GROUP BY client_id
    )
    SELECT
      c.id, c.nom, c.prenom, c.email, c.telephone, c.adresse, c.ville, c.code_postal,
      c.notes, c.cree_le, c.modifie_le,
      COALESCE(ca.ca_total, 0) AS ca_total,
      COALESCE(d.devis_count, 0) AS devis_count,
      GREATEST(ca.derniere_facture, d.dernier_devis) AS derniere_activite
    FROM clients c
    LEFT JOIN client_ca ca ON ca.client_id = c.id
    LEFT JOIN client_devis d ON d.client_id = c.id
    ${whereClause}
    ORDER BY ${orderClause}
  `;

  const rows = await execRows<ClientRow>(sql.raw(rawQuery));
  const mapped = rows.map(r => ({
    ...serializeDates(r),
    ca_total: parseNum(r.ca_total),
    devis_count: parseInt(r.devis_count, 10),
    derniere_activite: r.derniere_activite ?? null,
  }));

  res.json(ListClientsResponse.parse(mapped));
});

// ── GET /clients/search?q= — autocomplete ───────────────────────────────────

router.get("/clients/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) { res.json([]); return; }

  const escaped = q.replace(/'/g, "''");
  type SearchRow = { id: number; nom: string; prenom: string | null; telephone: string | null; email: string | null; ca_total: string; };
  const rows = await execRows<SearchRow>(sql.raw(`
    SELECT c.id, c.nom, c.prenom, c.telephone, c.email,
      COALESCE((SELECT SUM(total_ttc) FROM factures WHERE client_id = c.id AND statut IN ('envoyee','partiellement_payee','soldee')), 0) AS ca_total
    FROM clients c
    WHERE c.nom ILIKE '%${escaped}%' OR c.prenom ILIKE '%${escaped}%' OR c.email ILIKE '%${escaped}%' OR c.telephone ILIKE '%${escaped}%'
    ORDER BY c.nom
    LIMIT 10
  `));

  res.json(rows.map(r => ({
    id: r.id,
    nom: r.nom,
    prenom: r.prenom ?? null,
    telephone: r.telephone ?? null,
    email: r.email ?? null,
    ca_total: parseNum(r.ca_total),
  })));
});

// ── POST /clients ────────────────────────────────────────────────────────────

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(GetClientResponse.parse(serializeDates(client)));
});

// ── GET /clients/:id ─────────────────────────────────────────────────────────

router.get("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

  res.json(GetClientResponse.parse(serializeDates(client)));
});

// ── PUT /clients/:id ─────────────────────────────────────────────────────────

router.put("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db
    .update(clientsTable)
    .set({ ...parsed.data })
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

  res.json(UpdateClientResponse.parse(serializeDates(client)));
});

// ── DELETE /clients/:id ──────────────────────────────────────────────────────

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id));
    res.json(DeleteClientResponse.parse({ success: true }));
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23503") {
      res.status(409).json({ error: "Ce client a des devis ou factures associés. Supprimez-les d'abord avant de supprimer le client." });
      return;
    }
    throw err;
  }
});

// ── GET /clients/:id/stats ───────────────────────────────────────────────────

router.get("/clients/:id/stats", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetClientStatsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

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
