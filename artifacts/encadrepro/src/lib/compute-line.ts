/* WEB-TO-DESKTOP NOTE: pure helper, no DOM/Node deps. Reusable in Electron build. */

import type { ProductTypeCode } from "./product-types";

/**
 * TN/TA regime (used only for VR — Verre/Plexi):
 *  TN = Tarif Net    → use prix_ht as-is (already net for the customer).
 *  TA = Tarif Achat  → apply legacy V1 formula based on prix_achat_ht and per-product
 *                      coefficients (majo_epaisseur, coef_marge_ta, plus_value_ta_pct).
 * For non-VR types the regime is ignored and prix_ht is used directly.
 */
export type RegimePricing = "TN" | "TA";

export interface ComputeLignePvuhtInput {
  type_code: string | null | undefined;
  prix_ht: number;
  prix_achat_ht?: number | null;
  coefficient_marge?: number | null;
  regime?: RegimePricing | null;
}

/**
 * Returns the prix-unitaire-HT to apply on a devis line, given a product
 * and an optional TN/TA regime (only meaningful for VR).
 *
 * NOTE: For surface-priced VR-TA the true line total uses the legacy
 * `computeLigneTotalHT` helper below (which depends on the actual surface).
 * This function still returns a sensible per-m² estimate so the UI can
 * preview a unit price before width/height are entered.
 */
export function computeLignePvuht(p: ComputeLignePvuhtInput): number {
  const isVerre = p.type_code === ("VR" as ProductTypeCode);
  if (!isVerre) return p.prix_ht;
  if (p.regime === "TA" && p.prix_achat_ht != null && p.coefficient_marge != null) {
    return Number((p.prix_achat_ht * p.coefficient_marge).toFixed(2));
  }
  return p.prix_ht;
}

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
 * Computes the line total HT for a devis line.
 *
 * Legacy V1 formula for VR + TA + surface pricing (m²):
 *   total = max(surface, mini_fact_ta) × pauht × majo_epaisseur × coef_marge_ta × (1 + plus_value_ta_pct/100)
 *
 * For VR + TN + surface pricing the V1 minimum-billing rule still applies:
 *   total = max(surface, mini_fact_tn) × prix_unitaire_ht
 *
 * Otherwise falls back to the standard quantite × prix_unitaire_ht.
 */
export function computeLigneTotalHT(p: ComputeLigneTotalHTInput): number {
  const isVerre = p.type_code === ("VR" as ProductTypeCode);
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
    return Number((billable * p.prix_unitaire_ht).toFixed(2));
  }

  return Number((p.quantite * p.prix_unitaire_ht).toFixed(2));
}
