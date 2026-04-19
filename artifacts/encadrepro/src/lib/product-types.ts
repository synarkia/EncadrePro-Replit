/* WEB-TO-DESKTOP NOTE: shared front-end metadata for the 5-code product typology.
   Used by Catalogue, QuickAddProductModal, ProductSearchCombobox and QuoteLineCard. */

export const PRODUCT_TYPES = [
  {
    code: "VR",
    label: "Volume",
    plural: "Volumes",
    color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    chipColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
    description: "Verres, plexis et autres volumes transparents.",
  },
  {
    code: "FA",
    label: "Façonnage",
    plural: "Façonnages",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    chipColor: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    description: "Polissage, biseautage, perçage, soudure…",
  },
  {
    code: "AU",
    label: "Accessoire",
    plural: "Accessoires",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    chipColor: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    description: "Quincaillerie, attaches, fonds…",
  },
  {
    code: "SD",
    label: "Service",
    plural: "Services",
    color: "bg-green-500/15 text-green-400 border-green-500/30",
    chipColor: "bg-green-500/20 text-green-400 border-green-500/50",
    description: "Livraison, pose, déplacement, main d'œuvre.",
  },
  {
    code: "EN",
    label: "Encadrement",
    plural: "Encadrements",
    color: "bg-primary/15 text-primary border-primary/30",
    chipColor: "bg-primary/20 text-primary border-primary/50",
    description: "Moulures et baguettes : le métier de base.",
  },
] as const;

export type ProductTypeCode = (typeof PRODUCT_TYPES)[number]["code"];
export type ProductTypeMeta = (typeof PRODUCT_TYPES)[number];

const BY_CODE: Record<string, ProductTypeMeta> = Object.fromEntries(
  PRODUCT_TYPES.map(t => [t.code, t]),
);

export function getProductType(code: string | null | undefined): ProductTypeMeta {
  return (code && BY_CODE[code]) || PRODUCT_TYPES[4]; // default → Encadrement
}

export const PRICING_MODES = [
  { value: "unit", label: "Pièce / forfait", uniteCalcul: "unitaire" },
  { value: "linear_meter", label: "Mètre linéaire (ml)", uniteCalcul: "metre_lineaire" },
  { value: "square_meter", label: "Mètre carré (m²)", uniteCalcul: "metre_carre" },
] as const;

export type PricingMode = (typeof PRICING_MODES)[number]["value"];

/** Map a pricing_mode to the legacy unite_calcul string used by devis lines. */
export function pricingModeToUniteCalcul(mode: string | null | undefined): string {
  return PRICING_MODES.find(m => m.value === mode)?.uniteCalcul ?? "unitaire";
}

/** Inverse: derive a pricing_mode from a free-form unite/unite_calcul value. */
export function deducePricingMode(unite: string | null | undefined): PricingMode {
  if (!unite) return "unit";
  if (unite === "ml" || unite === "metre_lineaire") return "linear_meter";
  if (unite === "m²" || unite === "metre_carre") return "square_meter";
  return "unit";
}
