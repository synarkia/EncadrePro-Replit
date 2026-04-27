import { Router, type IRouter } from "express";
import { eq, sql, inArray, asc, and } from "drizzle-orm";
import {
  db,
  devisTable,
  lignesDevisTable,
  atelierTable,
  facturesTable,
  lignesFactureTable,
  produitsTable,
  projetsTable,
} from "@workspace/db";
import { computeLigneTotalHT, type RegimePricing } from "../lib/compute-line";
import { execRows, serializeDates } from "../lib/db-utils";
import {
  ListDevisResponse,
  CreateDevisBody,
  GetDevisParams,
  GetDevisResponse,
  DeleteDevisParams,
  DeleteDevisResponse,
  UpdateDevisStatutParams,
  UpdateDevisStatutBody,
  UpdateDevisStatutResponse,
  SaveDevisLignesParams,
  SaveDevisLignesBody,
  SaveDevisLignesResponse,
  ConvertDevisToFactureParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

// ─── Helper: calculate line quantity ──────────────────────────────────────────
function calcLigne(unite: string, widthCm: number | null, heightCm: number | null, quantite: number) {
  const wM = (widthCm ?? 0) / 100;
  const hM = (heightCm ?? 0) / 100;
  if (unite === "ml" || unite === "metre_lineaire") {
    // V1 stored a single "longueur" in widthCm — sum widthCm + heightCm so
    // callers that only fill one of the two still get the typed length.
    // No ×2 perimeter doubling: clients should pre-compute perimeter
    // themselves if they want it billed as such.
    return (wM + hM) * quantite;
  }
  if (unite === "m²" || unite === "metre_carre") {
    return wM * hM * quantite;
  }
  return quantite;
}

// ─── Helper: get next document number ─────────────────────────────────────────
async function getNextNumero(type: "devis" | "facture"): Promise<string> {
  const [atelier] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!atelier) throw new Error("Atelier non configuré");

  const year = new Date().getFullYear();

  if (type === "devis") {
    const next = (atelier.compteur_devis ?? 0) + 1;
    await db.update(atelierTable).set({ compteur_devis: next }).where(eq(atelierTable.id, 1));
    return `${atelier.prefixe_devis}-${year}-${String(next).padStart(3, "0")}`;
  } else {
    const next = (atelier.compteur_facture ?? 0) + 1;
    await db.update(atelierTable).set({ compteur_facture: next }).where(eq(atelierTable.id, 1));
    return `${atelier.prefixe_facture}-${year}-${String(next).padStart(3, "0")}`;
  }
}

// ─── Helper: recalculate devis totals (flat lignes — each contributes alone) ───
async function recalcDevis(devisId: number): Promise<void> {
  const lignes = await db.select().from(lignesDevisTable).where(eq(lignesDevisTable.devis_id, devisId));

  let ht = 0, tva10 = 0, tva20 = 0;
  for (const l of lignes) {
    ht += l.total_ht;
    if (l.taux_tva === 10) tva10 += l.total_ht * 0.1;
    else tva20 += l.total_ht * 0.2;
  }

  await db.update(devisTable)
    .set({ sous_total_ht: ht, total_tva_10: tva10, total_tva_20: tva20, total_ttc: ht + tva10 + tva20 })
    .where(eq(devisTable.id, devisId));
}

// ─── Helper: get devis with client name ───────────────────────────────────────
type DevisWithClient = {
  id: number; numero: string; client_id: number;
  client_nom: string; client_prenom: string;
  client_adresse: string | null; client_code_postal: string | null; client_ville: string | null;
  client_email: string | null; client_telephone: string | null;
  date_creation: string; date_validite: string; statut: string; sous_total_ht: string;
  total_tva_10: string; total_tva_20: string; total_ttc: string; notes: string;
  conditions: string; facture_id: number; cree_le: string; modifie_le: string;
};

async function getDevisWithClient(id: number): Promise<DevisWithClient | undefined> {
  const rows = await execRows<DevisWithClient>(
    sql`SELECT d.*,
               c.nom as client_nom, c.prenom as client_prenom,
               c.adresse as client_adresse, c.code_postal as client_code_postal,
               c.ville as client_ville, c.email as client_email, c.telephone as client_telephone
        FROM devis d LEFT JOIN clients c ON c.id = d.client_id WHERE d.id = ${id}`
  );
  return rows[0];
}

function mapDevis(r: DevisWithClient) {
  const s = serializeDates(r as unknown as Record<string, unknown>);
  return {
    id: r.id, numero: r.numero, client_id: r.client_id, client_nom: r.client_nom ?? null,
    client_prenom: r.client_prenom ?? null,
    client_adresse: r.client_adresse ?? null, client_code_postal: r.client_code_postal ?? null,
    client_ville: r.client_ville ?? null, client_email: r.client_email ?? null,
    client_telephone: r.client_telephone ?? null,
    date_creation: r.date_creation,
    date_validite: r.date_validite ?? null, statut: r.statut,
    sous_total_ht: parseNum(r.sous_total_ht), total_tva_10: parseNum(r.total_tva_10),
    total_tva_20: parseNum(r.total_tva_20), total_ttc: parseNum(r.total_ttc),
    notes: r.notes ?? null, conditions: r.conditions ?? null, facture_id: r.facture_id ?? null,
    cree_le: s.cree_le as string, modifie_le: s.modifie_le as string,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/devis", async (req, res): Promise<void> => {
  const statut = typeof req.query.statut === "string" ? req.query.statut : null;
  const clientId = typeof req.query.client_id === "string" ? parseInt(req.query.client_id, 10) : null;

  let query = sql`SELECT d.*,
        c.nom as client_nom, c.prenom as client_prenom,
        c.adresse as client_adresse, c.code_postal as client_code_postal,
        c.ville as client_ville, c.email as client_email, c.telephone as client_telephone
      FROM devis d LEFT JOIN clients c ON c.id = d.client_id WHERE 1=1`;

  if (statut) query = sql`${query} AND d.statut = ${statut}`;
  if (clientId) query = sql`${query} AND d.client_id = ${clientId}`;
  query = sql`${query} ORDER BY d.cree_le DESC`;

  const rows = await execRows<DevisWithClient>(query);
  res.json(ListDevisResponse.parse(rows.map(mapDevis)));
});

router.post("/devis", async (req, res): Promise<void> => {
  const parsed = CreateDevisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingAtelier] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!existingAtelier) {
    await db.insert(atelierTable).values({ id: 1, nom: "Mon Atelier" });
  }

  const numero = await getNextNumero("devis");
  const validite = new Date();
  validite.setDate(validite.getDate() + 30);

  const [devis] = await db.insert(devisTable).values({
    numero,
    client_id: parsed.data.client_id,
    notes: parsed.data.notes ?? null,
    statut: "brouillon",
    date_validite: validite.toISOString().slice(0, 10),
  }).returning();

  const withClient = await getDevisWithClient(devis.id);
  res.status(201).json(SaveDevisLignesResponse.parse(mapDevis(withClient!)));
});

// ─── GET /devis/:id — returns flat lignes (each ligne is one of 3 disjoint kinds)
router.get("/devis/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDevisParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const devisRow = await getDevisWithClient(params.data.id);
  if (!devisRow) { res.status(404).json({ error: "Devis introuvable" }); return; }

  const lignes = await db.select().from(lignesDevisTable)
    .where(eq(lignesDevisTable.devis_id, params.data.id))
    .orderBy(lignesDevisTable.ordre);

  // Load every projet attached to this devis, ordered by user-set position so
  // the UI can render them in the saved order without an extra sort.
  const projets = await db.select().from(projetsTable)
    .where(eq(projetsTable.devis_id, params.data.id))
    .orderBy(asc(projetsTable.position));

  const data = {
    ...mapDevis(devisRow),
    projets,
    lignes: lignes.map((l) => ({
      id: l.id,
      devis_id: l.devis_id,
      projet_id: l.projet_id ?? null,
      produit_id: l.produit_id ?? null,
      type_ligne: ((l.type_ligne ?? "matiere") as "matiere" | "faconnage" | "service"),
      designation: l.designation,
      description_longue: l.description_longue ?? null,
      unite_calcul: l.unite_calcul,
      largeur_m: l.largeur_m ?? null,
      hauteur_m: l.hauteur_m ?? null,
      width_cm: l.width_cm ?? null,
      height_cm: l.height_cm ?? null,
      longueur_m: l.longueur_m ?? null,
      heures: l.heures ?? null,
      parametres_json: l.parametres_json ?? null,
      quantite: l.quantite,
      quantite_calculee: l.quantite_calculee ?? null,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise_pct: l.remise_pct ?? 0,
      taux_tva: l.taux_tva,
      total_ht: l.total_ht,
      total_ttc: l.total_ttc,
      ordre: l.ordre,
      regime_pricing: l.regime_pricing ?? null,
    })),
  };

  res.json(GetDevisResponse.parse(data));
});

router.put("/devis/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { notes, date_validite, date_creation } = req.body as { notes?: string; date_validite?: string; date_creation?: string };
  await db.update(devisTable)
    .set({
      ...(notes !== undefined && { notes }),
      ...(date_validite !== undefined && { date_validite: date_validite ?? null }),
      ...(date_creation !== undefined && date_creation && { date_creation: date_creation }),
    })
    .where(eq(devisTable.id, id));

  const updated = await getDevisWithClient(id);
  if (!updated) { res.status(404).json({ error: "Introuvable" }); return; }
  res.json(mapDevis(updated));
});

router.delete("/devis/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDevisParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(devisTable).where(eq(devisTable.id, params.data.id));
  res.json(DeleteDevisResponse.parse({ success: true }));
});

router.patch("/devis/:id/statut", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDevisStatutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateDevisStatutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.update(devisTable)
    .set({ statut: parsed.data.statut })
    .where(eq(devisTable.id, params.data.id));

  const updated = await getDevisWithClient(params.data.id);
  if (!updated) { res.status(404).json({ error: "Devis introuvable" }); return; }
  res.json(UpdateDevisStatutResponse.parse(mapDevis(updated)));
});

// ─── PUT /devis/:id/lignes — save flat lignes (each is matière | façonnage | service)
router.put("/devis/:id/lignes", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SaveDevisLignesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SaveDevisLignesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const devisId = params.data.id;

  // Defend against cross-devis projet linkage: collect every non-null projet_id
  // the client sent and confirm each one belongs to THIS devis. Otherwise a
  // bad client could attach a ligne to a projet of a different quote.
  const submittedProjetIds = Array.from(new Set(
    parsed.data.lignes
      .map(l => (l as { projet_id?: number | null }).projet_id ?? null)
      .filter((id): id is number => id != null),
  ));
  if (submittedProjetIds.length > 0) {
    const ownedProjets = await db
      .select({ id: projetsTable.id })
      .from(projetsTable)
      .where(and(
        eq(projetsTable.devis_id, devisId),
        inArray(projetsTable.id, submittedProjetIds),
      ));
    const ownedIds = new Set(ownedProjets.map(p => p.id));
    const foreign = submittedProjetIds.filter(id => !ownedIds.has(id));
    if (foreign.length > 0) {
      res.status(400).json({
        error: `projet_id(s) [${foreign.join(", ")}] do not belong to devis ${devisId}`,
      });
      return;
    }
  }

  await db.delete(lignesDevisTable).where(eq(lignesDevisTable.devis_id, devisId));

  // Pre-fetch all referenced products in one query so we can apply the V1
  // matière formula (mini_fact_tn / majo_epaisseur / TA legacy) consistently
  // with what the UI's QuoteLineCard shows.
  const produitIds = parsed.data.lignes
    .map(l => l.produit_id)
    .filter((id): id is number => id != null);
  const produits = produitIds.length
    ? await db.select().from(produitsTable).where(inArray(produitsTable.id, produitIds))
    : [];
  const produitsById = new Map(produits.map(p => [p.id, p]));

  for (let i = 0; i < parsed.data.lignes.length; i++) {
    const l = parsed.data.lignes[i];
    const typeLigne = ((l as { type_ligne?: string }).type_ligne ?? "matiere") as "matiere" | "faconnage" | "service";

    // Per-line discount applies to all three kinds (kept simple & uniform).
    const remisePct = Math.max(0, Math.min(100, (l as { remise_pct?: number | null }).remise_pct ?? 0));

    let totalHT = 0;
    let qCalc: number | null = null;
    let widthCm: number | null = null;
    let heightCm: number | null = null;
    let largeurM: number | null = null;
    let hauteurM: number | null = null;
    let longueurM: number | null = null;
    let heures: number | null = null;
    let regimePricing: RegimePricing | null = null;
    let parametresJson: string | null = null;

    if (typeLigne === "matiere") {
      // ── Matière: dimensions + V1 legacy formula via computeLigneTotalHT ──
      widthCm = l.width_cm ?? (l.largeur_m != null ? l.largeur_m * 100 : null);
      heightCm = l.height_cm ?? (l.hauteur_m != null ? l.hauteur_m * 100 : null);
      largeurM = widthCm != null ? widthCm / 100 : (l.largeur_m ?? null);
      hauteurM = heightCm != null ? heightCm / 100 : (l.hauteur_m ?? null);
      qCalc = calcLigne(l.unite_calcul, widthCm, heightCm, l.quantite);
      const isSurface = l.unite_calcul === "m²" || l.unite_calcul === "metre_carre" || l.unite_calcul === "m2";
      const prod = l.produit_id != null ? produitsById.get(l.produit_id) : undefined;
      regimePricing = ((l as { regime_pricing?: string | null }).regime_pricing ?? null) as RegimePricing | null;
      const grossHT = computeLigneTotalHT({
        type_code: prod?.type_code ?? null,
        unite_calcul: l.unite_calcul,
        quantite: qCalc,
        surface_m2: isSurface ? qCalc : null,
        prix_unitaire_ht: l.prix_unitaire_ht,
        regime: regimePricing,
        prix_achat_ht: prod?.prix_achat_ht ?? null,
        majo_epaisseur: prod?.majo_epaisseur ?? null,
        mini_fact_tn: prod?.mini_fact_tn ?? null,
        mini_fact_ta: prod?.mini_fact_ta ?? null,
        coef_marge_ta: prod?.coef_marge_ta ?? null,
        plus_value_ta_pct: prod?.plus_value_ta_pct ?? null,
      });
      totalHT = grossHT * (1 - remisePct / 100);
    } else if (typeLigne === "faconnage") {
      // ── Façonnage: optional longueur_m used as per-unit length multiplier ──
      longueurM = (l as { longueur_m?: number | null }).longueur_m ?? null;
      parametresJson = (l as { parametres_json?: string | null }).parametres_json ?? null;
      const eff = longueurM != null && longueurM > 0 ? longueurM : 1;
      const grossHT = l.quantite * eff * l.prix_unitaire_ht;
      qCalc = l.quantite * eff;
      totalHT = grossHT * (1 - remisePct / 100);
    } else {
      // ── Service: optional heures field; total = quantite × pu_ht ──
      heures = (l as { heures?: number | null }).heures ?? null;
      const grossHT = l.quantite * l.prix_unitaire_ht;
      qCalc = l.quantite;
      totalHT = grossHT * (1 - remisePct / 100);
    }

    const totalTTC = totalHT * (1 + l.taux_tva / 100);

    await db.insert(lignesDevisTable).values({
      devis_id: devisId,
      // Preserve the projet grouping the UI sent (NULL = ligne libre hors projet).
      // The FK is ON DELETE SET NULL, so unknown ids would crash here — we
      // trust the UI to only send projet ids that belong to this devis.
      projet_id: (l as { projet_id?: number | null }).projet_id ?? null,
      produit_id: l.produit_id ?? null,
      type_ligne: typeLigne,
      designation: l.designation,
      description_longue: (l as { description_longue?: string | null }).description_longue ?? null,
      unite_calcul: l.unite_calcul,
      largeur_m: largeurM,
      hauteur_m: hauteurM,
      width_cm: widthCm,
      height_cm: heightCm,
      longueur_m: longueurM,
      heures,
      parametres_json: parametresJson,
      quantite: l.quantite,
      quantite_calculee: qCalc,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise_pct: remisePct,
      taux_tva: l.taux_tva,
      total_ht: totalHT,
      total_ttc: totalTTC,
      ordre: l.ordre ?? i,
      regime_pricing: regimePricing,
    });
  }

  await recalcDevis(devisId);

  const updated = await getDevisWithClient(devisId);
  if (!updated) { res.status(404).json({ error: "Devis introuvable" }); return; }
  res.json(SaveDevisLignesResponse.parse(mapDevis(updated)));
});

router.post("/devis/:id/convertir", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ConvertDevisToFactureParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [devis] = await db.select().from(devisTable).where(eq(devisTable.id, params.data.id));
  if (!devis) { res.status(404).json({ error: "Devis introuvable" }); return; }

  const numero = await getNextNumero("facture");
  const echeance = new Date();
  echeance.setDate(echeance.getDate() + 30);

  const [facture] = await db.insert(facturesTable).values({
    numero,
    devis_id: devis.id,
    client_id: devis.client_id,
    sous_total_ht: devis.sous_total_ht,
    total_tva_10: devis.total_tva_10,
    total_tva_20: devis.total_tva_20,
    total_ttc: devis.total_ttc,
    total_paye: 0,
    solde_restant: devis.total_ttc,
    notes: devis.notes,
    conditions: devis.conditions,
    statut: "brouillon",
    date_echeance: echeance.toISOString().slice(0, 10),
  }).returning();

  const lignes = await db.select().from(lignesDevisTable).where(eq(lignesDevisTable.devis_id, devis.id));
  for (const l of lignes) {
    await db.insert(lignesFactureTable).values({
      facture_id: facture.id,
      produit_id: l.produit_id,
      designation: l.designation,
      description_longue: l.description_longue ?? null,
      unite_calcul: l.unite_calcul,
      largeur_m: l.largeur_m,
      hauteur_m: l.hauteur_m,
      quantite: l.quantite,
      quantite_calculee: l.quantite_calculee,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise_pct: l.remise_pct ?? 0,
      taux_tva: l.taux_tva,
      total_ht: l.total_ht,
      total_ttc: l.total_ttc,
      ordre: l.ordre,
    });
  }

  await db.update(devisTable)
    .set({ statut: "converti", facture_id: facture.id })
    .where(eq(devisTable.id, devis.id));

  const factureRows = await execRows<{
    id: number; numero: string; devis_id: number; devis_numero: string | null; client_id: number;
    client_nom: string; client_prenom: string;
    client_adresse: string | null; client_code_postal: string | null; client_ville: string | null;
    client_email: string | null; client_telephone: string | null;
    date_creation: string; date_echeance: string;
    statut: string; sous_total_ht: string; total_tva_10: string; total_tva_20: string;
    total_ttc: string; total_paye: string; solde_restant: string; notes: string;
    conditions: string; prestation_periode: string | null; bon_de_commande: string | null;
    cree_le: string; modifie_le: string;
  }>(
    sql`SELECT f.*,
               c.nom as client_nom, c.prenom as client_prenom,
               c.adresse as client_adresse, c.code_postal as client_code_postal,
               c.ville as client_ville, c.email as client_email, c.telephone as client_telephone,
               d.numero as devis_numero
        FROM factures f
        LEFT JOIN clients c ON c.id = f.client_id
        LEFT JOIN devis d ON d.id = f.devis_id
        WHERE f.id = ${facture.id}`
  );

  const f = factureRows[0];
  res.status(201).json({
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
    cree_le: f.cree_le, modifie_le: f.modifie_le,
  });
});

export default router;
