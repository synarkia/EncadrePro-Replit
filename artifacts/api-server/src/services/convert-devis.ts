/**
 * Shared "convertir devis → facture" logic.
 *
 * Extracted from `POST /devis/:id/convertir` so both the HTTP route and the
 * seed script create factures (+ optional facture d'acompte) through the
 * same authoritative path: row-locking idempotency, atomic atelier counter
 * increments, per-rate VAT split on the FA, and cascading lignes copy.
 *
 * The route handler in `routes/devis.ts` thinly wraps this service to map
 * its discriminated-union result into HTTP status codes; the seed script
 * imports it directly to fabricate "converti" devis without duplicating
 * any of the conversion semantics.
 */
import { eq, sql } from "drizzle-orm";
import {
  db,
  devisTable,
  lignesDevisTable,
  facturesTable,
  lignesFactureTable,
  acomptesTable,
  facturesAcompteTable,
} from "@workspace/db";

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

export type ConvertDevisOpts = {
  id: number;
  acompte_montant?: number | null;
  mode_paiement?: string | null;
  reference_virement?: string | null;
  /** ISO yyyy-mm-dd. Defaults to today (paiement comptant). */
  date_echeance?: string | null;
  note_interne?: string | null;
};

export type Facture        = typeof facturesTable.$inferSelect;
export type FactureAcompte = typeof facturesAcompteTable.$inferSelect;

export type ConvertDevisResult =
  | { kind: "missing" }
  | { kind: "conflict" }
  | { kind: "existing"; facture: Facture; factureAcompte: FactureAcompte | null }
  | { kind: "created";  facture: Facture; factureAcompte: FactureAcompte | null };

/**
 * Throws `{ statusCode: 400, message }` when the acompte > devis total TTC.
 * Returns one of the four discriminated-union kinds otherwise.
 */
export async function convertDevisToFacture(opts: ConvertDevisOpts): Promise<ConvertDevisResult> {
  const targetId       = opts.id;
  const acompteMontant = Math.max(0, Number(opts.acompte_montant ?? 0));
  const echeanceIso    = opts.date_echeance && opts.date_echeance.length >= 10
    ? opts.date_echeance.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return db.transaction(async (tx) => {
    const lockedRows = await tx.execute(sql`
      SELECT id, statut, facture_id, total_ttc, total_tva_10, total_tva_20,
             total_tva_55, total_tva_0,
             sous_total_ht, notes, conditions, client_id
        FROM devis
       WHERE id = ${targetId}
       FOR UPDATE
    `);
    const locked = ((lockedRows as { rows?: unknown[] }).rows ?? lockedRows) as Array<{
      id: number; statut: string; facture_id: number | null;
      total_ttc: string | number; total_tva_10: string | number; total_tva_20: string | number;
      total_tva_55: string | number; total_tva_0: string | number;
      sous_total_ht: string | number; notes: string | null; conditions: string | null;
      client_id: number;
    }>;
    const devis = locked[0];
    if (!devis) return { kind: "missing" as const };

    // Idempotent short-circuit.
    const factureFk = devis.facture_id == null ? null : Number(devis.facture_id);
    if (devis.statut === "converti" || factureFk != null) {
      if (factureFk == null || !Number.isFinite(factureFk)) {
        return { kind: "conflict" as const };
      }
      const [existing] = await tx.select().from(facturesTable).where(eq(facturesTable.id, factureFk));
      if (!existing) return { kind: "conflict" as const };
      const [existingFa] = await tx.select().from(facturesAcompteTable)
        .where(eq(facturesAcompteTable.facture_id, existing.id));
      return { kind: "existing" as const, facture: existing, factureAcompte: existingFa ?? null };
    }

    const noteFinale = (opts.note_interne && opts.note_interne.trim().length > 0)
      ? opts.note_interne
      : devis.notes;

    // Authoritative totals from the LOCKED row.
    const lockedTotalTtc     = parseNum(devis.total_ttc);
    const lockedTva10        = parseNum(devis.total_tva_10);
    const lockedTva20        = parseNum(devis.total_tva_20);
    const lockedTva55        = parseNum(devis.total_tva_55);
    const lockedTva0         = parseNum(devis.total_tva_0);
    const lockedSousTotalHt  = parseNum(devis.sous_total_ht);
    if (acompteMontant > lockedTotalTtc + 0.01) {
      throw Object.assign(new Error("L'acompte ne peut pas dépasser le total TTC"), { statusCode: 400 });
    }
    const lockedSoldeRestant   = Math.max(0, lockedTotalTtc - acompteMontant);
    const lockedInitialStatut  =
      acompteMontant > 0 && lockedSoldeRestant <= 0.01 ? "soldee" : "brouillon";

    // Atomic facture counter (race-free, rolls back on tx rollback).
    const factureCounterRes = await tx.execute(sql`
      UPDATE atelier
         SET compteur_facture = compteur_facture + 1
       WHERE id = 1
      RETURNING compteur_facture AS next_num, prefixe_facture AS prefixe
    `);
    const factureCounterRows = ((factureCounterRes as { rows?: unknown[] }).rows ?? factureCounterRes) as Array<
      { next_num: number; prefixe: string }
    >;
    const factureCounter = factureCounterRows[0];
    if (!factureCounter) throw new Error("Atelier non configuré");
    const year = new Date().getFullYear();
    const numero = `${factureCounter.prefixe}-${year}-${String(Number(factureCounter.next_num)).padStart(3, "0")}`;

    const [created] = await tx.insert(facturesTable).values({
      numero,
      devis_id: devis.id,
      client_id: devis.client_id,
      sous_total_ht: lockedSousTotalHt,
      total_tva_10: lockedTva10,
      total_tva_20: lockedTva20,
      total_tva_55: lockedTva55,
      total_tva_0: lockedTva0,
      total_ttc: lockedTotalTtc,
      total_paye: acompteMontant,
      solde_restant: lockedSoldeRestant,
      notes: noteFinale,
      conditions: devis.conditions,
      statut: lockedInitialStatut,
      date_echeance: echeanceIso,
    }).returning();

    // Copy lignes_devis → lignes_facture.
    const lignes = await tx.select().from(lignesDevisTable).where(eq(lignesDevisTable.devis_id, devis.id));
    for (const l of lignes) {
      await tx.insert(lignesFactureTable).values({
        facture_id: created.id,
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

    let createdFa: FactureAcompte | null = null;
    if (acompteMontant > 0) {
      const acompteNote = opts.mode_paiement === "virement" && opts.reference_virement
        ? `Référence virement: ${opts.reference_virement}`
        : null;
      await tx.insert(acomptesTable).values({
        facture_id: created.id,
        montant: acompteMontant,
        date_paiement: new Date().toISOString().slice(0, 10),
        mode_paiement: opts.mode_paiement ?? null,
        notes: acompteNote,
      });

      // Standalone "facture d'acompte" (French tax law) with per-rate VAT split.
      // The dedicated FA template only breaks out 10 % and 20 % columns, but
      // the *total* `montant_tva` MUST include every applicable rate (incl.
      // 5.5 %), otherwise montant_ht is overstated and the deposit invoice
      // is fiscally incorrect for mixed-rate quotes.
      const ratio   = lockedTotalTtc > 0 ? acompteMontant / lockedTotalTtc : 0;
      const faTtc   = acompteMontant;
      const faTva10 = Math.round(lockedTva10 * ratio * 100) / 100;
      const faTva20 = Math.round(lockedTva20 * ratio * 100) / 100;
      const faTva55 = Math.round(lockedTva55 * ratio * 100) / 100;
      const faTva   = Math.round((faTva10 + faTva20 + faTva55) * 100) / 100;
      const faHt    = Math.round((faTtc - faTva) * 100) / 100;

      const counterRows = await tx.execute(sql`
        UPDATE atelier
           SET compteur_facture_acompte = compteur_facture_acompte + 1
         WHERE id = 1
        RETURNING compteur_facture_acompte AS next_fa, prefixe_facture_acompte AS prefixe
      `);
      const counterRow = (counterRows.rows ?? counterRows)[0] as { next_fa: number; prefixe: string } | undefined;
      const nextFa  = Number(counterRow?.next_fa ?? 1);
      const prefixe = counterRow?.prefixe || "FA";
      const faNumero = `${prefixe}-${year}-${String(nextFa).padStart(4, "0")}`;

      const referencePaiement = opts.mode_paiement === "virement" && opts.reference_virement
        ? opts.reference_virement
        : null;

      const [fa] = await tx.insert(facturesAcompteTable).values({
        numero: faNumero,
        facture_id: created.id,
        devis_id: devis.id,
        montant_ht: faHt,
        montant_tva: faTva,
        montant_tva_10: faTva10,
        montant_tva_20: faTva20,
        montant_ttc: faTtc,
        mode_reglement: opts.mode_paiement ?? "virement",
        reference_paiement: referencePaiement,
        date_paiement: new Date().toISOString().slice(0, 10),
      }).returning();
      createdFa = fa;
    }

    await tx.update(devisTable)
      .set({ statut: "converti", facture_id: created.id })
      .where(eq(devisTable.id, devis.id));

    return { kind: "created" as const, facture: created, factureAcompte: createdFa };
  });
}
