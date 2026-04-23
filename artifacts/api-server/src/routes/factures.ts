import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, facturesTable, lignesFactureTable, acomptesTable, atelierTable, produitsTable } from "@workspace/db";
import { computeLigneTotalHT, type RegimePricing } from "../lib/compute-line";
import { execRows, serializeDates } from "../lib/db-utils";
import {
  ListFacturesResponse,
  CreateFactureBody,
  GetFactureParams,
  GetFactureResponse,
  DeleteFactureParams,
  DeleteFactureResponse,
  UpdateFactureStatutParams,
  UpdateFactureStatutBody,
  UpdateFactureStatutResponse,
  AddPaiementParams,
  AddPaiementBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

// ─── Type helpers ─────────────────────────────────────────────────────────────
type FactureWithClient = {
  id: number; numero: string; devis_id: number; devis_numero: string | null; client_id: number;
  client_nom: string; client_prenom: string;
  client_adresse: string | null; client_code_postal: string | null; client_ville: string | null;
  client_email: string | null; client_telephone: string | null;
  date_creation: string; date_echeance: string;
  statut: string; sous_total_ht: string; total_tva_10: string; total_tva_20: string;
  total_ttc: string; total_paye: string; solde_restant: string; notes: string;
  conditions: string; prestation_periode: string | null; bon_de_commande: string | null;
  cree_le: string; modifie_le: string;
};

async function getFactureWithClient(id: number): Promise<FactureWithClient | undefined> {
  const rows = await execRows<FactureWithClient>(
    sql`SELECT f.*,
               c.nom as client_nom, c.prenom as client_prenom,
               c.adresse as client_adresse, c.code_postal as client_code_postal,
               c.ville as client_ville, c.email as client_email, c.telephone as client_telephone,
               d.numero as devis_numero
        FROM factures f
        LEFT JOIN clients c ON c.id = f.client_id
        LEFT JOIN devis d ON d.id = f.devis_id
        WHERE f.id = ${id}`
  );
  return rows[0];
}

function mapFacture(f: FactureWithClient) {
  const s = serializeDates(f as unknown as Record<string, unknown>);
  return {
    id: f.id, numero: f.numero, devis_id: f.devis_id ?? null, devis_numero: f.devis_numero ?? null,
    client_id: f.client_id, client_nom: f.client_nom ?? null,
    client_prenom: f.client_prenom ?? null,
    client_adresse: f.client_adresse ?? null, client_code_postal: f.client_code_postal ?? null,
    client_ville: f.client_ville ?? null, client_email: f.client_email ?? null,
    client_telephone: f.client_telephone ?? null,
    date_creation: f.date_creation,
    date_echeance: f.date_echeance ?? null, statut: f.statut,
    sous_total_ht: parseNum(f.sous_total_ht), total_tva_10: parseNum(f.total_tva_10),
    total_tva_20: parseNum(f.total_tva_20), total_ttc: parseNum(f.total_ttc),
    total_paye: parseNum(f.total_paye), solde_restant: parseNum(f.solde_restant),
    notes: f.notes ?? null, conditions: f.conditions ?? null,
    prestation_periode: f.prestation_periode ?? null,
    bon_de_commande: f.bon_de_commande ?? null,
    cree_le: s.cree_le as string, modifie_le: s.modifie_le as string,
  };
}

async function recalcFacture(factureId: number): Promise<void> {
  const lignes = await db.select().from(lignesFactureTable).where(eq(lignesFactureTable.facture_id, factureId));
  const acompteRows = await execRows<{ total: string }>(
    sql`SELECT COALESCE(SUM(montant), 0) as total FROM acomptes WHERE facture_id = ${factureId}`
  );

  let ht = 0, tva10 = 0, tva20 = 0;
  for (const l of lignes) {
    ht += l.total_ht;
    if (l.taux_tva === 10) tva10 += l.total_ht * 0.1;
    else tva20 += l.total_ht * 0.2;
  }

  const totalTTC = ht + tva10 + tva20;
  const totalPaye = parseNum(acompteRows[0]?.total);
  const soldeRestant = Math.max(0, totalTTC - totalPaye);

  // Determine auto-status based on payments
  const [current] = await db.select().from(facturesTable).where(eq(facturesTable.id, factureId));
  let statut = current?.statut ?? "brouillon";
  if (totalPaye > 0 && soldeRestant > 0.01) statut = "partiellement_payee";
  else if (totalPaye >= totalTTC && totalTTC > 0) statut = "soldee";

  await db.update(facturesTable)
    .set({
      sous_total_ht: ht, total_tva_10: tva10, total_tva_20: tva20,
      total_ttc: totalTTC, total_paye: totalPaye, solde_restant: soldeRestant,
      statut,
    })
    .where(eq(facturesTable.id, factureId));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/factures", async (req, res): Promise<void> => {
  const statut = typeof req.query.statut === "string" ? req.query.statut : null;
  const clientId = typeof req.query.client_id === "string" ? parseInt(req.query.client_id, 10) : null;

  let query = sql`SELECT f.*,
        c.nom as client_nom, c.prenom as client_prenom,
        c.adresse as client_adresse, c.code_postal as client_code_postal,
        c.ville as client_ville, c.email as client_email, c.telephone as client_telephone,
        d.numero as devis_numero
      FROM factures f
      LEFT JOIN clients c ON c.id = f.client_id
      LEFT JOIN devis d ON d.id = f.devis_id
      WHERE 1=1`;

  if (statut) query = sql`${query} AND f.statut = ${statut}`;
  if (clientId) query = sql`${query} AND f.client_id = ${clientId}`;
  query = sql`${query} ORDER BY f.cree_le DESC`;

  const rows = await execRows<FactureWithClient>(query);
  res.json(ListFacturesResponse.parse(rows.map(mapFacture)));
});

router.post("/factures", async (req, res): Promise<void> => {
  const parsed = CreateFactureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Ensure atelier row exists
  const [atelier] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!atelier) {
    await db.insert(atelierTable).values({ id: 1, nom: "Mon Atelier" });
  }

  const year = new Date().getFullYear();
  const [atelierRow] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  const next = (atelierRow.compteur_facture ?? 0) + 1;
  await db.update(atelierTable).set({ compteur_facture: next }).where(eq(atelierTable.id, 1));
  const numero = `${atelierRow.prefixe_facture}-${year}-${String(next).padStart(3, "0")}`;

  const echeance = new Date();
  echeance.setDate(echeance.getDate() + 30);

  const [facture] = await db.insert(facturesTable).values({
    numero,
    client_id: parsed.data.client_id,
    notes: parsed.data.notes ?? null,
    statut: "brouillon",
    date_echeance: echeance.toISOString().slice(0, 10),
    total_paye: 0,
    solde_restant: 0,
  }).returning();

  const withClient = await getFactureWithClient(facture.id);
  res.status(201).json(mapFacture(withClient!));
});

router.get("/factures/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFactureParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const factureRow = await getFactureWithClient(params.data.id);
  if (!factureRow) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }

  const lignes = await db.select().from(lignesFactureTable)
    .where(eq(lignesFactureTable.facture_id, params.data.id))
    .orderBy(lignesFactureTable.ordre);

  const paiements = await db.select().from(acomptesTable)
    .where(eq(acomptesTable.facture_id, params.data.id))
    .orderBy(acomptesTable.cree_le);

  const data = {
    ...mapFacture(factureRow),
    lignes: lignes.map((l) => ({
      id: l.id, devis_id: l.facture_id, produit_id: l.produit_id ?? null,
      designation: l.designation,
      description_longue: l.description_longue ?? null,
      unite_calcul: l.unite_calcul,
      largeur_m: l.largeur_m ?? null, hauteur_m: l.hauteur_m ?? null,
      quantite: l.quantite, quantite_calculee: l.quantite_calculee ?? null,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise_pct: l.remise_pct ?? 0,
      taux_tva: l.taux_tva,
      total_ht: l.total_ht, total_ttc: l.total_ttc, ordre: l.ordre,
    })),
    paiements: paiements.map((p) => ({
      id: p.id, facture_id: p.facture_id, montant: p.montant,
      date_paiement: p.date_paiement, mode_paiement: p.mode_paiement ?? null,
      notes: p.notes ?? null, cree_le: p.cree_le,
    })),
  };

  res.json(GetFactureResponse.parse(data));
});

router.put("/factures/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { notes, date_echeance, prestation_periode, bon_de_commande } = req.body as {
    notes?: string; date_echeance?: string;
    prestation_periode?: string | null; bon_de_commande?: string | null;
  };
  await db.update(facturesTable)
    .set({
      ...(notes !== undefined && { notes }),
      ...(date_echeance !== undefined && { date_echeance: date_echeance ?? null }),
      ...(prestation_periode !== undefined && { prestation_periode: prestation_periode ?? null }),
      ...(bon_de_commande !== undefined && { bon_de_commande: bon_de_commande ?? null }),
    })
    .where(eq(facturesTable.id, id));

  const updated = await getFactureWithClient(id);
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  res.json(mapFacture(updated));
});

router.delete("/factures/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFactureParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(facturesTable).where(eq(facturesTable.id, params.data.id));
  res.json(DeleteFactureResponse.parse({ success: true }));
});

router.patch("/factures/:id/statut", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateFactureStatutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateFactureStatutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(facturesTable)
    .set({ statut: parsed.data.statut })
    .where(eq(facturesTable.id, params.data.id));

  const updated = await getFactureWithClient(params.data.id);
  if (!updated) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }

  res.json(UpdateFactureStatutResponse.parse(mapFacture(updated)));
});

router.put("/factures/:id/lignes", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const factureId = parseInt(raw, 10);
  if (isNaN(factureId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { lignes } = req.body as {
    lignes: Array<{
      produit_id?: number | null; designation: string;
      description_longue?: string | null;
      unite_calcul: string;
      largeur_m?: number | null; hauteur_m?: number | null;
      quantite: number; prix_unitaire_ht: number;
      remise_pct?: number | null;
      taux_tva: number; ordre: number;
    }>;
  };

  if (!Array.isArray(lignes)) {
    res.status(400).json({ error: "lignes must be an array" });
    return;
  }

  await db.delete(lignesFactureTable).where(eq(lignesFactureTable.facture_id, factureId));

  if (lignes.length > 0) {
    // Pre-fetch products so VR / mini_fact_tn / TA legacy formula stays in
    // lock-step with the QuoteLineCard preview shown in the UI.
    const produitIds = lignes
      .map(l => l.produit_id)
      .filter((id): id is number => id != null);
    const produits = produitIds.length
      ? await db.select().from(produitsTable).where(inArray(produitsTable.id, produitIds))
      : [];
    const produitsById = new Map(produits.map(p => [p.id, p]));

    const toInsert = lignes.map((l) => {
      let qCalc = l.quantite;
      const w = l.largeur_m ?? 0;
      const h = l.hauteur_m ?? 0;
      // NOTE: this route's metre_lineaire uses the legacy ×2 perimeter formula
      // (different from devis where dimensions are summed without doubling).
      // Preserved as-is to avoid a behaviour change on existing factures.
      if (l.unite_calcul === "metre_lineaire") qCalc = (w + h) * 2 * l.quantite;
      else if (l.unite_calcul === "metre_carre") qCalc = w * h * l.quantite;
      const isSurface = l.unite_calcul === "m²" || l.unite_calcul === "metre_carre" || l.unite_calcul === "m2";
      const prod = l.produit_id != null ? produitsById.get(l.produit_id) : undefined;
      const regime = ((l as { regime_pricing?: string | null }).regime_pricing ?? null) as RegimePricing | null;
      const grossHt = computeLigneTotalHT({
        type_code: prod?.type_code ?? null,
        unite_calcul: l.unite_calcul,
        quantite: qCalc,
        surface_m2: isSurface ? qCalc : null,
        prix_unitaire_ht: l.prix_unitaire_ht,
        regime,
        prix_achat_ht: prod?.prix_achat_ht ?? null,
        majo_epaisseur: prod?.majo_epaisseur ?? null,
        mini_fact_tn: prod?.mini_fact_tn ?? null,
        mini_fact_ta: prod?.mini_fact_ta ?? null,
        coef_marge_ta: prod?.coef_marge_ta ?? null,
        plus_value_ta_pct: prod?.plus_value_ta_pct ?? null,
      });
      const remisePct = Math.max(0, Math.min(100, l.remise_pct ?? 0));
      const totalHt = grossHt * (1 - remisePct / 100);
      const totalTtc = totalHt * (1 + l.taux_tva / 100);
      return {
        facture_id: factureId,
        produit_id: l.produit_id ?? null,
        designation: l.designation,
        description_longue: l.description_longue ?? null,
        unite_calcul: l.unite_calcul,
        largeur_m: l.largeur_m ?? null,
        hauteur_m: l.hauteur_m ?? null,
        quantite: l.quantite,
        quantite_calculee: qCalc,
        prix_unitaire_ht: l.prix_unitaire_ht,
        remise_pct: remisePct,
        taux_tva: l.taux_tva,
        total_ht: totalHt,
        total_ttc: totalTtc,
        ordre: l.ordre,
      };
    });
    await db.insert(lignesFactureTable).values(toInsert);
  }

  await recalcFacture(factureId);

  const factureRow = await getFactureWithClient(factureId);
  if (!factureRow) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  const newLignes = await db.select().from(lignesFactureTable)
    .where(eq(lignesFactureTable.facture_id, factureId))
    .orderBy(lignesFactureTable.ordre);
  const paiements = await db.select().from(acomptesTable)
    .where(eq(acomptesTable.facture_id, factureId))
    .orderBy(acomptesTable.cree_le);

  const data = {
    ...mapFacture(factureRow),
    lignes: newLignes.map((l) => ({
      id: l.id, devis_id: l.facture_id, produit_id: l.produit_id ?? null,
      designation: l.designation, unite_calcul: l.unite_calcul,
      largeur_m: l.largeur_m ?? null, hauteur_m: l.hauteur_m ?? null,
      quantite: l.quantite, quantite_calculee: l.quantite_calculee ?? null,
      prix_unitaire_ht: l.prix_unitaire_ht, taux_tva: l.taux_tva,
      total_ht: l.total_ht, total_ttc: l.total_ttc, ordre: l.ordre,
    })),
    paiements: paiements.map((p) => ({
      id: p.id, facture_id: p.facture_id, montant: p.montant,
      date_paiement: p.date_paiement, mode_paiement: p.mode_paiement ?? null,
      notes: p.notes ?? null, cree_le: p.cree_le,
    })),
  };

  res.json(data);
});

router.post("/factures/:id/paiements", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPaiementParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = AddPaiementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [acompte] = await db.insert(acomptesTable).values({
    facture_id: params.data.id,
    montant: parsed.data.montant,
    date_paiement: parsed.data.date_paiement,
    mode_paiement: parsed.data.mode_paiement ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  // Recalculate totals and update status
  await recalcFacture(params.data.id);

  res.status(201).json({
    id: acompte.id,
    facture_id: acompte.facture_id,
    montant: acompte.montant,
    date_paiement: acompte.date_paiement,
    mode_paiement: acompte.mode_paiement ?? null,
    notes: acompte.notes ?? null,
    cree_le: acompte.cree_le,
  });
});

export default router;
