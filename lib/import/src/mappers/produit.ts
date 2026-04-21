import type { Result, ProductTypeCode } from "../types.js";
import {
  pickColumn,
  strOrNull,
  parseFrenchNumber,
  parseFrenchBool,
  normCadreOrAccessoire,
  normTypeCode,
  inferPricingMode,
  uniteCalculFor,
} from "../normalize.js";

export const PRODUIT_COLUMNS = {
  ref: ["Ref", "Réf", "Référence", "Reference"],
  designation: ["Désignation", "Designation", "Libellé", "Libelle", "Nom"],
  fournisseur: ["Fournisseur", "Founisseur"],
  fournisseur_version: ["Version tarif", "VersionTarif", "Version"],
  ref_fournisseur: ["Réf Fournisseur", "Ref Fournisseur", "RefF"],
  sous_categorie: ["Catégorie", "Categorie", "Sous-catégorie", "SousCategorie"],
  type_code: ["Type", "Type code", "TypeCode"],
  pauht: ["PAUHT", "Prix achat", "PrixAchat", "Prix achat HT"],
  coef_marge: ["Coef marge", "CoefMarge", "Marge"],
  notes: ["Notes", "Remarques"],
  image: ["Image", "Photo", "URL image"],
  pricing_mode: ["Pricing mode", "PricingMode", "Unité", "Unite"],

  // VR
  epaisseur_mm: ["Épais", "Epais", "Épaisseur", "Epaisseur", "Épais (mm)"],
  majo_epaisseur: ["Majo épais", "Majo epais", "MajoEpais"],
  mini_fact_tn: ["Mini fact TN", "MiniFactTN"],
  mini_fact_ta: ["Mini fact TA", "MiniFactTA"],
  coef_marge_ta: ["Coef marge TA", "CoefMargeTA"],
  plus_value_ta_pct: ["PlusValue TA", "PlusValueTA", "PlusValue TA %"],

  // FA
  fac_mm: ["mm", "fac mm", "FacMm", "Fac mm"],

  // EN
  cadre_or_accessoire: ["Cadre ou accessoire", "CadreOuAccessoire", "Cadre/Accessoire"],
  vendu: ["Vendu", "VENDU"],
} as const;

export type ProduitInsert = {
  ref_legacy: string | null;
  reference: string | null;
  designation: string;
  type_code: ProductTypeCode;
  pricing_mode: "unit" | "linear_meter" | "square_meter";
  unite_calcul: string;
  fournisseur_id: number | null;
  fournisseur: string | null;
  sous_categorie: string | null;
  prix_achat_ht: number | null;
  coefficient_marge: number | null;
  prix_ht: number;
  taux_tva: number;
  epaisseur_mm: number | null;
  majo_epaisseur: number | null;
  mini_fact_tn: number | null;
  mini_fact_ta: number | null;
  coef_marge_ta: number | null;
  plus_value_ta_pct: number | null;
  fac_mm: number | null;
  cadre_or_accessoire: string | null;
  vendu: boolean;
  notes: string | null;
  image_url: string | null;
};

/**
 * Lookup a fournisseur_id from a name (and optional version).
 * Returns null if no match. Implements the 3-tier match strategy:
 *   exact name+version → exact name (version-tolerant) → case-insensitive name.
 */
export function findFournisseurId(
  name: string,
  version: string | null,
  index: { byName: Map<string, { id: number; version: string | null }[]>; byNameLower: Map<string, number> },
): { id: number; strategy: "name+version" | "name" | "name-ci" } | null {
  if (!name) return null;
  const candidates = index.byName.get(name) ?? [];
  if (version) {
    const exact = candidates.find((c) => (c.version ?? "") === version);
    if (exact) return { id: exact.id, strategy: "name+version" };
  }
  if (candidates.length > 0) return { id: candidates[0].id, strategy: "name" };
  const ci = index.byNameLower.get(name.toLowerCase());
  if (ci != null) return { id: ci, strategy: "name-ci" };
  return null;
}

export type FournisseurIndex = {
  byName: Map<string, { id: number; version: string | null }[]>;
  byNameLower: Map<string, number>;
};

export function buildFournisseurIndex(
  rows: { id: number; nom: string; version_tarif: string | null }[],
): FournisseurIndex {
  const byName = new Map<string, { id: number; version: string | null }[]>();
  const byNameLower = new Map<string, number>();
  for (const r of rows) {
    const arr = byName.get(r.nom) ?? [];
    arr.push({ id: r.id, version: r.version_tarif });
    byName.set(r.nom, arr);
    if (!byNameLower.has(r.nom.toLowerCase())) byNameLower.set(r.nom.toLowerCase(), r.id);
  }
  return { byName, byNameLower };
}

export function mapProduitRow(
  row: Record<string, string>,
  _lineNumber: number,
  fournisseurIndex: FournisseurIndex,
  forcedTypeCode?: ProductTypeCode,
): Result<ProduitInsert, string> {
  const designation = pickColumn(row, PRODUIT_COLUMNS.designation);
  if (!designation) return { ok: false, error: "Champ 'désignation' manquant" };

  const typeCodeRaw = forcedTypeCode ?? normTypeCode(pickColumn(row, PRODUIT_COLUMNS.type_code));
  if (!typeCodeRaw) return { ok: false, error: "Type de produit non reconnu (attendu : VR/FA/AU/SD/EN)" };
  const type_code = typeCodeRaw;

  // Pricing mode: explicit column override → infer from type_code
  const pmRaw = pickColumn(row, PRODUIT_COLUMNS.pricing_mode).toLowerCase();
  let pricing_mode: "unit" | "linear_meter" | "square_meter";
  if (pmRaw.includes("ml") || pmRaw.includes("linéaire") || pmRaw.includes("lineaire") || pmRaw === "linear_meter") {
    pricing_mode = "linear_meter";
  } else if (pmRaw.includes("m²") || pmRaw.includes("m2") || pmRaw.includes("carré") || pmRaw.includes("carre") || pmRaw === "square_meter") {
    pricing_mode = "square_meter";
  } else if (pmRaw === "p.u" || pmRaw === "pu" || pmRaw === "unit" || pmRaw === "pièce" || pmRaw === "piece" || pmRaw === "unitaire") {
    pricing_mode = "unit";
  } else {
    pricing_mode = inferPricingMode(type_code);
  }

  const fournisseurName = pickColumn(row, PRODUIT_COLUMNS.fournisseur);
  const fournisseurVersion = strOrNull(pickColumn(row, PRODUIT_COLUMNS.fournisseur_version));
  let fournisseur_id: number | null = null;
  if (fournisseurName) {
    const match = findFournisseurId(fournisseurName, fournisseurVersion, fournisseurIndex);
    if (!match) {
      return {
        ok: false,
        error: `Fournisseur '${fournisseurName}' non trouvé — importez d'abord les fournisseurs`,
      };
    }
    fournisseur_id = match.id;
  }

  const pauht = parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.pauht));
  const coef_marge = parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.coef_marge)) ?? 1;
  const prix_ht = pauht != null ? Number((pauht * coef_marge).toFixed(2)) : 0;

  return {
    ok: true,
    value: {
      ref_legacy: strOrNull(pickColumn(row, PRODUIT_COLUMNS.ref)),
      reference: strOrNull(pickColumn(row, PRODUIT_COLUMNS.ref)),
      designation,
      type_code,
      pricing_mode,
      unite_calcul: uniteCalculFor(pricing_mode),
      fournisseur_id,
      fournisseur: strOrNull(fournisseurName),
      sous_categorie: strOrNull(pickColumn(row, PRODUIT_COLUMNS.sous_categorie)),
      prix_achat_ht: pauht,
      coefficient_marge: coef_marge,
      prix_ht,
      taux_tva: 20,
      epaisseur_mm: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.epaisseur_mm)) : null,
      majo_epaisseur: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.majo_epaisseur)) : null,
      mini_fact_tn: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.mini_fact_tn)) : null,
      mini_fact_ta: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.mini_fact_ta)) : null,
      coef_marge_ta: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.coef_marge_ta)) : null,
      plus_value_ta_pct: type_code === "VR" ? parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.plus_value_ta_pct)) : null,
      fac_mm: type_code === "FA" ? (parseFrenchNumber(pickColumn(row, PRODUIT_COLUMNS.fac_mm)) ?? null) : null,
      cadre_or_accessoire: type_code === "EN" ? normCadreOrAccessoire(pickColumn(row, PRODUIT_COLUMNS.cadre_or_accessoire)) : null,
      vendu: type_code === "EN" ? parseFrenchBool(pickColumn(row, PRODUIT_COLUMNS.vendu)) : false,
      notes: strOrNull(pickColumn(row, PRODUIT_COLUMNS.notes)),
      image_url: strOrNull(pickColumn(row, PRODUIT_COLUMNS.image)),
    },
  };
}
