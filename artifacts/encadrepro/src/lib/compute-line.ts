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
 * The matière total is simply `quantite × prix_unitaire_ht` for every product
 * type — what the user types in PU HT is what the customer pays per unit.
 *
 * The legacy V1 VR/Plexi rules (mini_fact_tn minimum-billing, majo_epaisseur
 * thickness markup, TA legacy formula) used to silently inflate this total.
 * They are intentionally NOT applied here so the line card, document totals,
 * persisted total_ht and the printed PDF all show `qty × PU HT`. The
 * `mini_fact_*`, `majo_epaisseur`, `coef_marge_ta`, `plus_value_ta_pct` and
 * `prix_achat_ht` columns remain on the products table and on this input
 * shape so the rule can be re-introduced later without a refactor.
 */
export function computeLigneTotalHT(p: ComputeLigneTotalHTInput): number {
  return Number((p.quantite * p.prix_unitaire_ht).toFixed(2));
}
