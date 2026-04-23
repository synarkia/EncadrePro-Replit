/* WEB-TO-DESKTOP NOTE: pure helper, no DOM/Node deps. Reusable in Electron build.
   MIRROR of artifacts/encadrepro/src/lib/compute-line.ts — keep the two in sync.
   Centralises the matière line-total formula so the UI live preview, the printed
   document and the persisted total_ht all agree (mini_fact_tn / majo_epaisseur
   / TA legacy formula). */

export type RegimePricing = "TN" | "TA";

export interface ComputeLigneTotalHTInput {
  type_code: string | null | undefined;
  unite_calcul: string;
  quantite: number;
  /** Surface in m² (only used for VR-TA legacy formula). */
  surface_m2?: number | null;
  prix_unitaire_ht: number;
  regime?: RegimePricing | null;
  /** Per-product TA coefficients (legacy V1). */
  prix_achat_ht?: number | null;
  majo_epaisseur?: number | null;
  mini_fact_ta?: number | null;
  mini_fact_tn?: number | null;
  coef_marge_ta?: number | null;
  plus_value_ta_pct?: number | null;
}

/**
 * Matière line total = quantite × prix_unitaire_ht for every product type.
 * The legacy V1 VR/Plexi rules (mini_fact_tn, majo_epaisseur, TA legacy
 * formula) are intentionally NOT applied — see the matching note in
 * artifacts/encadrepro/src/lib/compute-line.ts.
 */
export function computeLigneTotalHT(p: ComputeLigneTotalHTInput): number {
  return Number((p.quantite * p.prix_unitaire_ht).toFixed(2));
}
