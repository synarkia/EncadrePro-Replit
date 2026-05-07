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

  let ht = 0, tva10 = 0, tva20 = 0;
  for (const l of lignes) {
    ht += l.total_ht;
    if (l.taux_tva === 10) tva10 += l.total_ht * 0.1;
    else                    tva20 += l.total_ht * 0.2;
  }

  const totalTTC     = ht + tva10 + tva20;
  const totalPaye    = parseNum(acompteRows[0]?.total);
  const soldeRestant = Math.max(0, totalTTC - totalPaye);

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
