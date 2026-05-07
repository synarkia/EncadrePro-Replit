/**
 * Shared facture-recalculation logic.
 *
 * Sums all `lignes_facture` for a facture, derives per-rate VAT (10 / 20),
 * adds up `acomptes` to compute `total_paye` / `solde_restant`, and
 * auto-flips the facture statut:
 *   - totalPaye > 0 && solde > 0.01 → "partiellement_payee"
 *   - totalPaye >= totalTTC > 0     → "soldee"
 *   - otherwise leaves the current statut untouched (e.g. "brouillon",
 *     "envoyee", "annulee").
 *
 * This is the single source of truth for facture totals/status. Both the
 * `POST /factures/:id/paiements` route and the seed script call it.
 */
import { eq, sql } from "drizzle-orm";
import { db, facturesTable, lignesFactureTable } from "@workspace/db";
import { execRows } from "../lib/db-utils";

const parseNum = (v: unknown) => parseFloat(String(v ?? "0"));

export async function recalcFacture(factureId: number): Promise<void> {
  const lignes = await db.select().from(lignesFactureTable).where(eq(lignesFactureTable.facture_id, factureId));
  const acompteRows = await execRows<{ total: string }>(
    sql`SELECT COALESCE(SUM(montant), 0) as total FROM acomptes WHERE facture_id = ${factureId}`,
  );

  let ht = 0, tva10 = 0, tva20 = 0, tva55 = 0, tva0 = 0;
  for (const l of lignes) {
    ht += l.total_ht;
    const rate = Number(l.taux_tva);
    if (rate === 20) tva20 += l.total_ht * 0.20;
    else if (rate === 10) tva10 += l.total_ht * 0.10;
    else if (rate === 5.5) tva55 += l.total_ht * 0.055;
    // rate === 0: no TVA, tva0 stays 0 (column tracks HT base at 0%)
  }

  const totalTTC     = ht + tva10 + tva20 + tva55;
  const totalPaye    = parseNum(acompteRows[0]?.total);
  const soldeRestant = Math.max(0, totalTTC - totalPaye);

  const [current] = await db.select().from(facturesTable).where(eq(facturesTable.id, factureId));
  let statut = current?.statut ?? "brouillon";
  if (totalPaye > 0 && soldeRestant > 0.01) statut = "partiellement_payee";
  else if (totalPaye >= totalTTC && totalTTC > 0) statut = "soldee";

  await db.update(facturesTable)
    .set({
      sous_total_ht: ht, total_tva_10: tva10, total_tva_20: tva20,
      total_tva_55: tva55, total_tva_0: tva0,
      total_ttc: totalTTC, total_paye: totalPaye, solde_restant: soldeRestant,
      statut,
    })
    .where(eq(facturesTable.id, factureId));
}
