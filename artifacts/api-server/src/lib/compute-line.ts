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

export function computeLigneTotalHT(p: ComputeLigneTotalHTInput): number {
  const isVerre = p.type_code === "VR";
  const isSurface = p.unite_calcul === "m²" || p.unite_calcul === "metre_carre" || p.unite_calcul === "m2";
  const surface = p.surface_m2 ?? p.quantite;

  if (isVerre && isSurface && p.regime === "TA"
      && p.prix_achat_ht != null && p.majo_epaisseur != null && p.coef_marge_ta != null) {
    const billable = Math.max(surface, p.mini_fact_ta ?? 0);
    const pv = (p.plus_value_ta_pct ?? 0) / 100;
    return Number((billable * p.prix_achat_ht * p.majo_epaisseur * p.coef_marge_ta * (1 + pv)).toFixed(2));
  }

  if (isVerre && isSurface && (p.regime ?? "TN") === "TN" && p.mini_fact_tn != null) {
    const billable = Math.max(surface, p.mini_fact_tn);
    const epais = p.majo_epaisseur ?? 1;
    return Number((billable * p.prix_unitaire_ht * epais).toFixed(2));
  }

  return Number((p.quantite * p.prix_unitaire_ht).toFixed(2));
}
