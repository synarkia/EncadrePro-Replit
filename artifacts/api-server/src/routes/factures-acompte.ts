import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { execRows, serializeDates } from "../lib/db-utils";

const router: IRouter = Router();

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

// ─── Row shape returned by the joined SELECT ─────────────────────────────────
type FactureAcompteRow = {
  id: number; numero: string;
  facture_id: number; facture_numero: string | null;
  facture_total_ttc: string | null;
  devis_id: number | null; devis_numero: string | null;
  client_id: number | null;
  client_nom: string | null; client_prenom: string | null; client_entreprise: string | null;
  client_adresse: string | null; client_code_postal: string | null;
  client_ville: string | null; client_email: string | null; client_telephone: string | null;
  montant_ht: string; montant_tva: string;
  montant_tva_10: string; montant_tva_20: string;
  montant_ttc: string;
  mode_reglement: string; reference_paiement: string | null;
  date_paiement: string;
  cree_le: string; modifie_le: string;
};

// Single FROM clause reused by every read endpoint here so the response shape
// stays in lock-step (especially the joined client / facture / devis fields).
function selectClause() {
  return sql`SELECT fa.*,
                    f.numero  AS facture_numero,
                    f.total_ttc AS facture_total_ttc,
                    f.client_id AS client_id,
                    d.numero  AS devis_numero,
                    c.nom AS client_nom, c.prenom AS client_prenom, c.entreprise AS client_entreprise,
                    c.adresse AS client_adresse, c.code_postal AS client_code_postal,
                    c.ville AS client_ville, c.email AS client_email,
                    c.telephone AS client_telephone
             FROM factures_acompte fa
             LEFT JOIN factures f ON f.id = fa.facture_id
             LEFT JOIN devis    d ON d.id = fa.devis_id
             LEFT JOIN clients  c ON c.id = f.client_id`;
}

function mapRow(r: FactureAcompteRow) {
  const s = serializeDates(r as unknown as Record<string, unknown>);
  return {
    id: r.id,
    numero: r.numero,
    facture_id: r.facture_id,
    facture_numero: r.facture_numero ?? null,
    facture_total_ttc: r.facture_total_ttc != null ? parseNum(r.facture_total_ttc) : null,
    devis_id: r.devis_id ?? null,
    devis_numero: r.devis_numero ?? null,
    client_id: r.client_id ?? null,
    client_nom: r.client_nom ?? null,
    client_prenom: r.client_prenom ?? null,
    client_entreprise: r.client_entreprise ?? null,
    client_adresse: r.client_adresse ?? null,
    client_code_postal: r.client_code_postal ?? null,
    client_ville: r.client_ville ?? null,
    client_email: r.client_email ?? null,
    client_telephone: r.client_telephone ?? null,
    montant_ht: parseNum(r.montant_ht),
    montant_tva: parseNum(r.montant_tva),
    montant_tva_10: parseNum(r.montant_tva_10),
    montant_tva_20: parseNum(r.montant_tva_20),
    montant_ttc: parseNum(r.montant_ttc),
    mode_reglement: r.mode_reglement,
    reference_paiement: r.reference_paiement ?? null,
    date_paiement: r.date_paiement,
    cree_le: s.cree_le as string,
    modifie_le: s.modifie_le as string,
  };
}

// ─── List FA(s) attached to a facture ─────────────────────────────────────────
router.get("/factures/:id/factures-acompte", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await execRows<FactureAcompteRow>(
    sql`${selectClause()} WHERE fa.facture_id = ${id} ORDER BY fa.cree_le ASC`,
  );
  res.json(rows.map(mapRow));
});

// ─── Single FA detail ─────────────────────────────────────────────────────────
router.get("/factures-acompte/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await execRows<FactureAcompteRow>(
    sql`${selectClause()} WHERE fa.id = ${id} LIMIT 1`,
  );
  if (rows.length === 0) { res.status(404).json({ error: "Facture d'acompte introuvable" }); return; }
  res.json(mapRow(rows[0]));
});

// ─── PDF "endpoint" — redirect to printable HTML ──────────────────────────────
// We don't ship a server-side PDF engine: the frontend page mounts a
// print-only template and the browser's print dialog produces the PDF. The
// API path is kept for parity with the spec and so external integrations
// have a stable URL.
router.get("/factures-acompte/:id/pdf", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await execRows<{ id: number }>(
    sql`SELECT id FROM factures_acompte WHERE id = ${id} LIMIT 1`,
  );
  if (rows.length === 0) { res.status(404).json({ error: "Facture d'acompte introuvable" }); return; }

  // Frontend artifact is mounted at "/" — the printable page sets ?print=1 to
  // auto-open the browser print dialog on mount.
  res.redirect(302, `/factures-acompte/${id}?print=1`);
});

export default router;
