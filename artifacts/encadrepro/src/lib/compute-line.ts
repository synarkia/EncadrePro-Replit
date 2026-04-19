/* WEB-TO-DESKTOP NOTE: pure helper, no DOM/Node deps. Reusable in Electron build. */

import type { ProductTypeCode } from "./product-types";

/**
 * TN/TA regime (used only for VR — Verre/Plexi):
 *  TN = Tarif Net    → use prix_ht as-is (already net for the customer).
 *  TA = Tarif Achat  → apply margin: prix_achat_ht * coefficient_marge.
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
 */
export function computeLignePvuht(p: ComputeLignePvuhtInput): number {
  const isVerre = p.type_code === ("VR" as ProductTypeCode);
  if (!isVerre) return p.prix_ht;
  if (p.regime === "TA" && p.prix_achat_ht != null && p.coefficient_marge != null) {
    return Number((p.prix_achat_ht * p.coefficient_marge).toFixed(2));
  }
  return p.prix_ht;
}
