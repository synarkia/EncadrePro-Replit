import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { execRows } from "../lib/db-utils";
import {
  GetDashboardStatsResponse,
  GetDashboardCaMensuelResponse,
  GetDashboardRecentDevisResponse,
  GetDashboardRecentFacturesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const caRows = await execRows<{ total: string }>(
    sql`SELECT COALESCE(SUM(total_ttc), 0) as total FROM factures
        WHERE statut IN ('envoyee', 'partiellement_payee', 'soldee')
        AND date_creation >= ${firstOfMonth} AND date_creation < ${firstOfNextMonth}`
  );

  const devisRows = await execRows<{ n: string; montant: string }>(
    sql`SELECT COUNT(*) as n, COALESCE(SUM(total_ttc), 0) as montant FROM devis
        WHERE statut IN ('brouillon', 'envoye')`
  );

  const facturesRows = await execRows<{ n: string; montant: string }>(
    sql`SELECT COUNT(*) as n, COALESCE(SUM(solde_restant), 0) as montant FROM factures
        WHERE statut IN ('envoyee', 'partiellement_payee')`
  );

  const clientsRows = await execRows<{ n: string }>(
    sql`SELECT COUNT(*) as n FROM clients WHERE cree_le::date >= ${thirtyDaysAgo}`
  );

  const data = {
    caMois: parseFloat(caRows[0]?.total ?? "0"),
    devisEnAttente: {
      n: parseInt(devisRows[0]?.n ?? "0", 10),
      montant: parseFloat(devisRows[0]?.montant ?? "0"),
    },
    facturesImpayees: {
      n: parseInt(facturesRows[0]?.n ?? "0", 10),
      montant: parseFloat(facturesRows[0]?.montant ?? "0"),
    },
    nouveauxClients: parseInt(clientsRows[0]?.n ?? "0", 10),
  };

  res.json(GetDashboardStatsResponse.parse(data));
});

router.get("/dashboard/ca-mensuel", async (_req, res): Promise<void> => {
  const rows = await execRows<{ mois: string; total: string }>(
    sql`SELECT TO_CHAR(date_trunc('month', cree_le), 'YYYY-MM') as mois,
               COALESCE(SUM(total_ttc), 0) as total
        FROM factures
        WHERE statut IN ('envoyee', 'partiellement_payee', 'soldee')
        AND cree_le >= NOW() - INTERVAL '12 months'
        GROUP BY mois ORDER BY mois ASC`
  );

  const data = rows.map((r) => ({ mois: r.mois, total: parseFloat(r.total) }));
  res.json(GetDashboardCaMensuelResponse.parse(data));
});

router.get("/dashboard/recent-devis", async (_req, res): Promise<void> => {
  const rows = await execRows<{
    id: number; numero: string; client_nom: string; client_prenom: string;
    total_ttc: string; statut: string; cree_le: string;
  }>(
    sql`SELECT d.id, d.numero, c.nom as client_nom, c.prenom as client_prenom,
               d.total_ttc, d.statut, d.cree_le
        FROM devis d LEFT JOIN clients c ON c.id = d.client_id
        ORDER BY d.cree_le DESC LIMIT 5`
  );

  const data = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    client_nom: r.client_nom ?? "",
    client_prenom: r.client_prenom ?? null,
    total_ttc: parseFloat(r.total_ttc ?? "0"),
    statut: r.statut,
    cree_le: r.cree_le,
  }));

  res.json(GetDashboardRecentDevisResponse.parse(data));
});

router.get("/dashboard/recent-factures", async (_req, res): Promise<void> => {
  const rows = await execRows<{
    id: number; numero: string; client_nom: string; client_prenom: string;
    total_ttc: string; statut: string; cree_le: string;
  }>(
    sql`SELECT f.id, f.numero, c.nom as client_nom, c.prenom as client_prenom,
               f.total_ttc, f.statut, f.cree_le
        FROM factures f LEFT JOIN clients c ON c.id = f.client_id
        ORDER BY f.cree_le DESC LIMIT 5`
  );

  const data = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    client_nom: r.client_nom ?? "",
    client_prenom: r.client_prenom ?? null,
    total_ttc: parseFloat(r.total_ttc ?? "0"),
    statut: r.statut,
    cree_le: r.cree_le,
  }));

  res.json(GetDashboardRecentFacturesResponse.parse(data));
});

export default router;
