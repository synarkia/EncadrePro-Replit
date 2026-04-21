/* WEB-TO-DESKTOP NOTE: Pure helpers, identical in Node + Electron. */

/** Returns the first column whose key (case-insensitive, trimmed) matches one of `keys`. */
export function pickColumn(row: Record<string, string>, keys: readonly string[]): string {
  const lowerMap = new Map(Object.keys(row).map((k) => [k.trim().toLowerCase(), k]));
  for (const k of keys) {
    const found = lowerMap.get(k.trim().toLowerCase());
    if (found !== undefined) {
      const v = row[found];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

/** Empty string → null. Otherwise trimmed string. */
export function strOrNull(value: string): string | null {
  const t = value?.trim() ?? "";
  return t === "" ? null : t;
}

/**
 * Parse a French-style number: comma decimal, optional currency suffix.
 * "1 234,56 €" → 1234.56  •  "" → null  •  invalid → null
 */
export function parseFrenchNumber(value: string): number | null {
  if (value == null) return null;
  let s = String(value).trim();
  if (s === "") return null;
  // Strip currency markers and non-breaking spaces.
  s = s.replace(/[€$£]/g, "").replace(/\u00A0/g, " ").trim();
  // Remove thin/regular space thousand separators.
  s = s.replace(/\s+/g, "");
  // French decimal: convert last comma to dot if no dot already present.
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Truthy-ish boolean: "oui", "x", "v", "true", "1", "yes" → true. Empty/null/no → false. */
export function parseFrenchBool(value: string): boolean {
  const t = (value ?? "").trim().toLowerCase();
  if (t === "") return false;
  return ["oui", "o", "x", "v", "✓", "true", "1", "yes", "y", "vrai"].includes(t);
}

/** Normalise to "cadre" or "accessoire" or null. */
export function normCadreOrAccessoire(value: string): "cadre" | "accessoire" | null {
  const t = (value ?? "").trim().toLowerCase();
  if (t.startsWith("cad")) return "cadre";
  if (t.startsWith("acc")) return "accessoire";
  return null;
}

/** Map a free-form Type cell to one of VR/FA/AU/SD/EN. Returns null if unmappable. */
export function normTypeCode(value: string): "VR" | "FA" | "AU" | "SD" | "EN" | null {
  const t = (value ?? "").trim().toUpperCase();
  if (["VR", "FA", "AU", "SD", "EN"].includes(t)) return t as "VR" | "FA" | "AU" | "SD" | "EN";
  // Common French long-forms.
  if (t.startsWith("VER") || t.startsWith("PLEX") || t.startsWith("MIR")) return "VR";
  if (t.startsWith("FAC") || t.startsWith("FAÇ")) return "FA";
  if (t.startsWith("AUT") || t.startsWith("ACC")) return "AU";
  if (t.startsWith("SER") || t.startsWith("POSE") || t.startsWith("LIV")) return "SD";
  if (t.startsWith("ENC") || t.startsWith("CAD") || t.startsWith("MOUL") || t.startsWith("BAG")) return "EN";
  return null;
}

/** Default pricing_mode inferred from type_code. */
export function inferPricingMode(typeCode: "VR" | "FA" | "AU" | "SD" | "EN"): "unit" | "linear_meter" | "square_meter" {
  switch (typeCode) {
    case "VR": return "square_meter";
    case "FA": return "linear_meter";
    case "AU":
    case "SD": return "unit";
    case "EN": return "linear_meter";
  }
}

/** "metre_lineaire" / "metre_carre" / "unitaire" — used by older devis math. */
export function uniteCalculFor(pm: "unit" | "linear_meter" | "square_meter"): string {
  if (pm === "linear_meter") return "metre_lineaire";
  if (pm === "square_meter") return "metre_carre";
  return "unitaire";
}
