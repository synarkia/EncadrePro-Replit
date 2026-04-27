import { useState } from "react";
import { Layers, Wrench, Briefcase, Trash2, Link2, Link2Off, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import { QuickAddProductModal } from "./QuickAddProductModal";
import { formatCurrency } from "@/lib/format";
import type { ProduitSearchResult } from "./ProductSearchCombobox";
import { pricingModeToUniteCalcul, type ProductTypeCode } from "@/lib/product-types";
import { computeLignePvuht, computeLigneTotalHT, type RegimePricing } from "@/lib/compute-line";

/* WEB-TO-DESKTOP NOTE: One ligne is now ONE of three disjoint kinds —
   matière (dimensions + V1 TN/TA formula), façonnage (optional length
   multiplier), or service (optional hours). The card branches on
   `line.type_ligne`. The caller is responsible for never letting a ligne
   change kind after creation. */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TypeLigne = "matiere" | "faconnage" | "service";

export type QuoteLine = {
  id: number | string;
  projet_id?: number | null;
  produit_id: number | null;
  type_ligne: TypeLigne;
  designation: string;
  description_longue: string | null;
  remise_pct: number;
  unite_calcul: string;
  // ── Matière fields ────────────────────────────────────────────────────
  width_cm: number | null;
  height_cm: number | null;
  largeur_m: number | null;
  hauteur_m: number | null;
  // ── Façonnage field ───────────────────────────────────────────────────
  longueur_m: number | null;
  parametres_json: string | null;
  // ── Service field ─────────────────────────────────────────────────────
  heures: number | null;
  // ── Common ────────────────────────────────────────────────────────────
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  // ── Matière dimension inheritance ────────────────────────────────────
  // True when width_cm/height_cm should track the parent projet's dims.
  // Auto-flipped to false when the user types a custom width/height.
  // Façonnage / service ignore this flag.
  inherits_project_dimensions: boolean;
  // ── Client-only metadata used to drive the TN/TA selector for VR products. ──
  type_code?: ProductTypeCode | null;
  prix_achat_ht?: number | null;
  coefficient_marge?: number | null;
  regime_pricing?: RegimePricing | null;
  // Legacy V1 TA/TN coefficients propagated from the catalogue when a VR product
  // is picked. Used by `computeLigneTotalHT` to apply the legacy formula.
  majo_epaisseur?: number | null;
  mini_fact_tn?: number | null;
  mini_fact_ta?: number | null;
  coef_marge_ta?: number | null;
  plus_value_ta_pct?: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcQuantite(unite: string, widthCm: number, heightCm: number, qte: number): number {
  const wM = widthCm / 100;
  const hM = heightCm / 100;
  // No perimeter doubling — the typed dimension(s) are summed and used as-is.
  if (unite === "ml" || unite === "metre_lineaire") return (wM + hM) * qte;
  if (unite === "m²" || unite === "metre_carre") return wM * hM * qte;
  return qte;
}

function needsDimensions(unite: string): boolean {
  return ["ml", "metre_lineaire", "m²", "metre_carre"].includes(unite);
}

function uniteLabel(unite: string): string {
  const map: Record<string, string> = { ml: "ml", "m²": "m²", metre_lineaire: "ml", metre_carre: "m²", unitaire: "pièce", pièce: "pièce", heure: "h", forfait: "forfait" };
  return map[unite] ?? unite;
}

/** Compute the line's total HT (before TVA, after remise) for any of the 3 kinds.
 *  Kept exported so devis/[id].tsx previewTotals can stay in lock-step. */
export function computeQuoteLineHT(line: QuoteLine): number {
  const remisePct = Math.max(0, Math.min(100, line.remise_pct ?? 0));
  if (line.type_ligne === "faconnage") {
    const eff = line.longueur_m != null && line.longueur_m > 0 ? line.longueur_m : 1;
    return line.quantite * eff * line.prix_unitaire_ht * (1 - remisePct / 100);
  }
  if (line.type_ligne === "service") {
    return line.quantite * line.prix_unitaire_ht * (1 - remisePct / 100);
  }
  // matiere — uses the V1 formula
  const wCm = line.width_cm ?? 0;
  const hCm = line.height_cm ?? 0;
  const qCalc = calcQuantite(line.unite_calcul, wCm, hCm, line.quantite);
  const isSurface = line.unite_calcul === "m²" || line.unite_calcul === "metre_carre" || line.unite_calcul === "m2";
  const grossHT = computeLigneTotalHT({
    type_code: line.type_code,
    unite_calcul: line.unite_calcul,
    quantite: qCalc,
    surface_m2: isSurface ? qCalc : null,
    prix_unitaire_ht: line.prix_unitaire_ht,
    regime: line.regime_pricing,
    prix_achat_ht: line.prix_achat_ht,
    majo_epaisseur: line.majo_epaisseur,
    mini_fact_tn: line.mini_fact_tn,
    mini_fact_ta: line.mini_fact_ta,
    coef_marge_ta: line.coef_marge_ta,
    plus_value_ta_pct: line.plus_value_ta_pct,
  });
  return grossHT * (1 - remisePct / 100);
}

// ── Per-type chrome (icon + accent color) ─────────────────────────────────────

const KIND_CHROME: Record<TypeLigne, {
  icon: React.ElementType; emoji: string; label: string;
  accent: string; cardAccent: string;
}> = {
  matiere: {
    icon: Layers, emoji: "🧱", label: "Matière",
    accent: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    cardAccent: "border-l-violet-500/60",
  },
  faconnage: {
    icon: Wrench, emoji: "✂️", label: "Façonnage",
    accent: "bg-blue-500/15 text-blue-200 border-blue-500/30",
    cardAccent: "border-l-blue-500/60",
  },
  service: {
    icon: Briefcase, emoji: "🛠️", label: "Service",
    accent: "bg-green-500/15 text-green-200 border-green-500/30",
    cardAccent: "border-l-green-500/60",
  },
};

// ── TVA pill ──────────────────────────────────────────────────────────────────

function TvaPills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 shrink-0">
      {[10, 20].map(rate => (
        <button
          key={rate}
          type="button"
          onClick={() => onChange(rate)}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
            value === rate
              ? "bg-primary/20 border-primary/50 text-primary"
              : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
          }`}
        >
          {rate}%
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface QuoteLineCardProps {
  line: QuoteLine;
  index: number;
  isEditable: boolean;
  onChange: (line: QuoteLine) => void;
  onRemove: () => void;
  /** Parent projet's dimensions (if any). When provided and the line is
   *  matière + inherits_project_dimensions, the link icon is shown and the
   *  "Réaligner" button becomes available after an override. */
  projetDimensions?: { width_cm: number | null; height_cm: number | null } | null;
}

export function QuoteLineCard({
  line, index, isEditable, onChange, onRemove, projetDimensions,
}: QuoteLineCardProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<ProductTypeCode>("EN");

  const kind = KIND_CHROME[line.type_ligne];
  const KindIcon = kind.icon;

  const totalHT = computeQuoteLineHT(line);
  const update = (patch: Partial<QuoteLine>) => onChange({ ...line, ...patch });

  // ── Inheritance helpers (matière only) ────────────────────────────────────
  const projetHasDims =
    line.type_ligne === "matiere" &&
    projetDimensions != null &&
    (projetDimensions.width_cm != null || projetDimensions.height_cm != null);
  const isInherited = line.type_ligne === "matiere" && projetHasDims && line.inherits_project_dimensions;
  const isOverridden = line.type_ligne === "matiere" && projetHasDims && !line.inherits_project_dimensions;

  /** Re-snap width/height to the parent projet's dims and flip inherits back on. */
  const realignToProjet = () => {
    if (!projetDimensions) return;
    update({
      width_cm: projetDimensions.width_cm,
      height_cm: projetDimensions.height_cm,
      inherits_project_dimensions: true,
    });
  };

  // ── Product picker per kind ────────────────────────────────────────────────
  const handleMatiereSelect = (p: ProduitSearchResult) => {
    const newRegime: RegimePricing = "TN";
    const pvuht = computeLignePvuht({
      type_code: p.type_code,
      prix_ht: p.prix_ht,
      prix_achat_ht: p.prix_achat_ht,
      coefficient_marge: p.coefficient_marge,
      regime: newRegime,
    });
    update({
      produit_id: p.id,
      designation: p.designation,
      unite_calcul: p.pricing_mode ? pricingModeToUniteCalcul(p.pricing_mode) : (p.unite ?? p.unite_calcul),
      prix_unitaire_ht: pvuht,
      taux_tva: p.taux_tva,
      type_code: p.type_code,
      prix_achat_ht: p.prix_achat_ht,
      coefficient_marge: p.coefficient_marge,
      regime_pricing: newRegime,
      majo_epaisseur: p.majo_epaisseur ?? null,
      mini_fact_tn: p.mini_fact_tn ?? null,
      mini_fact_ta: p.mini_fact_ta ?? null,
      coef_marge_ta: p.coef_marge_ta ?? null,
      plus_value_ta_pct: p.plus_value_ta_pct ?? null,
    });
  };

  const handleFaconnageSelect = (p: ProduitSearchResult) => {
    update({
      produit_id: p.id,
      designation: p.designation,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: p.taux_tva,
    });
  };

  const handleServiceSelect = (p: ProduitSearchResult) => {
    update({
      produit_id: p.id,
      designation: p.designation,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: p.taux_tva,
    });
  };

  const handleRegimeChange = (regime: RegimePricing) => {
    const pvuht = computeLignePvuht({
      type_code: line.type_code,
      prix_ht: line.prix_unitaire_ht,
      prix_achat_ht: line.prix_achat_ht,
      coefficient_marge: line.coefficient_marge,
      regime,
    });
    if (regime === "TA" && line.prix_achat_ht != null && line.coefficient_marge != null) {
      update({ regime_pricing: regime, prix_unitaire_ht: pvuht });
    } else {
      update({ regime_pricing: regime });
    }
  };

  const isVerre = line.type_ligne === "matiere" && line.type_code === "VR";

  return (
    <>
      <div
        className={`rounded-xl border border-l-4 transition-all overflow-hidden ${kind.cardAccent} ${isEditable ? "border-border/50 bg-card/60" : "border-border/30 bg-card/30"}`}
        data-testid={`quote-line-${line.id}`}
      >
        {/* ── Card title bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-card/40 border-b border-border/30">
          <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded">#{index + 1}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${kind.accent}`}>
            <KindIcon className="h-3 w-3" />
            <span aria-hidden>{kind.emoji}</span>
            {kind.label}
          </span>
          {!isEditable && (<span className="text-sm font-medium flex-1 truncate">{line.designation}</span>)}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-bold text-accent tabular-nums">{formatCurrency(totalHT)}</span>
            <span className="text-[10px] text-muted-foreground">HT</span>
            {isEditable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/40 hover:text-destructive ml-1"
                onClick={onRemove}
                data-testid={`quote-line-remove-${line.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* ── Product search ────────────────────────────────────── */}
          {isEditable && (
            line.type_ligne === "matiere" ? (
              <ProductSearchCombobox
                typeCodes={["EN", "VR", "AU"]}
                placeholder="Chercher encadrement, verre, accessoire… (2+ car.)"
                onSelect={handleMatiereSelect}
                onCreateNew={() => { setQuickAddType("EN"); setQuickAddOpen(true); }}
                showSupplierPills
              />
            ) : line.type_ligne === "faconnage" ? (
              <ProductSearchCombobox
                typeCodes={["FA"]}
                placeholder="Chercher un façonnage…"
                onSelect={handleFaconnageSelect}
                onCreateNew={() => { setQuickAddType("FA"); setQuickAddOpen(true); }}
              />
            ) : (
              <ProductSearchCombobox
                typeCodes={["SD"]}
                placeholder="Chercher un service…"
                onSelect={handleServiceSelect}
                onCreateNew={() => { setQuickAddType("SD"); setQuickAddOpen(true); }}
              />
            )
          )}

          {/* ── TN/TA regime — VR matière only ────────────────────── */}
          {isEditable && isVerre && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Régime tarifaire</span>
              {(["TN", "TA"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRegimeChange(r)}
                  title={r === "TN" ? "Tarif net (prix HT catalogue)" : "Tarif achat (prix d'achat × marge)"}
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                    (line.regime_pricing ?? "TN") === r
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                      : "border-border/40 text-muted-foreground hover:border-cyan-500/30"
                  }`}
                >
                  {r}
                </button>
              ))}
              {line.regime_pricing === "TA" && (line.prix_achat_ht == null || line.coefficient_marge == null) && (
                <span className="text-[10px] text-amber-400/80">Prix d'achat ou marge manquant</span>
              )}
            </div>
          )}

          {/* ── Designation ───────────────────────────────────────── */}
          {isEditable ? (
            <Input
              value={line.designation}
              onChange={e => update({ designation: e.target.value })}
              placeholder={
                line.type_ligne === "matiere" ? "Description de la matière…"
                  : line.type_ligne === "faconnage" ? "Description du façonnage…"
                  : "Description du service…"
              }
              className="h-8 text-sm bg-background/50 border-border/50"
              data-testid={`quote-line-designation-${line.id}`}
            />
          ) : (
            <p className="text-sm text-muted-foreground pl-2">{line.designation || "—"}</p>
          )}

          {/* ── Long description ──────────────────────────────────── */}
          {isEditable ? (
            <textarea
              value={line.description_longue ?? ""}
              onChange={e => update({ description_longue: e.target.value || null })}
              placeholder="Description détaillée (facultatif, affichée sur le document imprimé)…"
              rows={2}
              className="w-full text-xs bg-background/30 border border-border/40 rounded-md px-2 py-1.5 text-foreground/80 placeholder:text-muted-foreground/50 resize-y min-h-[2rem]"
            />
          ) : (
            line.description_longue && (
              <p className="text-xs text-muted-foreground/80 pl-2 whitespace-pre-line italic">{line.description_longue}</p>
            )
          )}

          {/* ── Type-specific fields + qty/price/tva row ──────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Matière: unite + dimensions */}
            {line.type_ligne === "matiere" && (
              <>
                {isEditable ? (
                  <Select value={line.unite_calcul} onValueChange={v => update({ unite_calcul: v })}>
                    <SelectTrigger className="h-8 w-24 text-xs bg-background/50 border-border/50 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unitaire">Pièce</SelectItem>
                      <SelectItem value="metre_lineaire">ml</SelectItem>
                      <SelectItem value="metre_carre">m²</SelectItem>
                      <SelectItem value="heure">Heure</SelectItem>
                      <SelectItem value="forfait">Forfait</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-medium bg-muted/40 px-2 py-1 rounded-md">{uniteLabel(line.unite_calcul)}</span>
                )}

                {needsDimensions(line.unite_calcul) && (() => {
                  const wCm = line.width_cm ?? 0;
                  const hCm = line.height_cm ?? 0;
                  const qCalc = calcQuantite(line.unite_calcul, wCm, hCm, line.quantite);
                  return isEditable ? (
                    <>
                      {/* Inheritance indicator — left of the dimension inputs.
                          Linked: solid Link2 (matches projet). Unlinked: muted
                          Link2Off + a "Réaligner" button to snap back. */}
                      {isInherited && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center h-8 w-7 text-cyan-300/80 shrink-0"
                                aria-label="Mesure héritée du projet"
                                data-testid={`quote-line-link-${line.id}`}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Hérité du projet</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {isOverridden && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center h-8 w-7 text-muted-foreground/50 shrink-0"
                                aria-label="Mesure custom (déliée du projet)"
                                data-testid={`quote-line-unlink-${line.id}`}
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Mesure custom — déliée du projet</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Input type="number" step="0.5" min="0"
                        value={line.width_cm ?? ""}
                        onChange={e => update({
                          width_cm: e.target.value ? parseFloat(e.target.value) : null,
                          inherits_project_dimensions: false,
                        })}
                        placeholder="L (cm)"
                        className="h-8 w-20 text-center text-xs bg-background/50 border-border/50 shrink-0"
                        data-testid={`quote-line-width-${line.id}`}
                      />
                      <span className="text-muted-foreground text-xs">×</span>
                      <Input type="number" step="0.5" min="0"
                        value={line.height_cm ?? ""}
                        onChange={e => update({
                          height_cm: e.target.value ? parseFloat(e.target.value) : null,
                          inherits_project_dimensions: false,
                        })}
                        placeholder="H (cm)"
                        className="h-8 w-20 text-center text-xs bg-background/50 border-border/50 shrink-0"
                        data-testid={`quote-line-height-${line.id}`}
                      />
                      {isOverridden && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={realignToProjet}
                          className="h-8 px-2 text-[10px] text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-500/10 shrink-0"
                          data-testid={`quote-line-realign-${line.id}`}
                          title={`Réaligner sur le projet (${projetDimensions?.width_cm ?? "—"} × ${projetDimensions?.height_cm ?? "—"} cm)`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Réaligner
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        = {qCalc.toFixed(3)} {uniteLabel(line.unite_calcul)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {wCm > 0 || hCm > 0 ? `${wCm} × ${hCm} cm → ${qCalc.toFixed(3)} ${uniteLabel(line.unite_calcul)}` : "—"}
                    </span>
                  );
                })()}
              </>
            )}

            {/* Façonnage: optional length in metres */}
            {line.type_ligne === "faconnage" && (
              isEditable ? (
                <div
                  className="flex items-center gap-1 shrink-0"
                  title="Longueur en mètres (laisser vide si non applicable)"
                >
                  <span className="text-[10px] text-muted-foreground">L (m)</span>
                  <Input type="number" step="0.01" min="0"
                    value={line.longueur_m ?? ""}
                    placeholder="—"
                    onChange={e => update({ longueur_m: e.target.value ? parseFloat(e.target.value) : null })}
                    className="h-8 w-20 text-center text-xs bg-background/50 border-border/50"
                    data-testid={`quote-line-longueur-${line.id}`}
                  />
                </div>
              ) : (
                line.longueur_m != null && line.longueur_m > 0 && (
                  <span className="text-xs text-muted-foreground">L : {line.longueur_m.toFixed(2)} m</span>
                )
              )
            )}

            {/* Service: optional hours */}
            {line.type_ligne === "service" && (
              isEditable ? (
                <div
                  className="flex items-center gap-1 shrink-0"
                  title="Heures travaillées (facultatif, affiché sur le document)"
                >
                  <span className="text-[10px] text-muted-foreground">Heures</span>
                  <Input type="number" step="0.25" min="0"
                    value={line.heures ?? ""}
                    placeholder="—"
                    onChange={e => update({ heures: e.target.value ? parseFloat(e.target.value) : null })}
                    className="h-8 w-20 text-center text-xs bg-background/50 border-border/50"
                    data-testid={`quote-line-heures-${line.id}`}
                  />
                </div>
              ) : (
                line.heures != null && line.heures > 0 && (
                  <span className="text-xs text-muted-foreground">{line.heures.toFixed(2)} h</span>
                )
              )
            )}

            {/* Quantity */}
            {isEditable ? (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">Qté</span>
                <Input type="number" min="1" step="1"
                  value={line.quantite}
                  onChange={e => update({ quantite: parseFloat(e.target.value) || 1 })}
                  className="h-8 w-16 text-center text-xs bg-background/50 border-border/50"
                  data-testid={`quote-line-qty-${line.id}`}
                />
              </div>
            ) : (<span className="text-xs text-muted-foreground">Qté {line.quantite}</span>)}

            {/* Price + remise */}
            {isEditable ? (
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <span className="text-[10px] text-muted-foreground">PU HT</span>
                <Input type="number" step="0.01" min="0"
                  value={line.prix_unitaire_ht}
                  onChange={e => update({ prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-24 text-right text-sm font-semibold bg-background/50 border-border/50"
                  data-testid={`quote-line-pu-${line.id}`}
                />
                <span className="text-[10px] text-muted-foreground">€</span>
                <span className="text-[10px] text-muted-foreground ml-2" title="Remise sur cette ligne en %">Remise</span>
                <Input type="number" step="1" min="0" max="100"
                  value={line.remise_pct ?? 0}
                  onChange={e => update({ remise_pct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                  className="h-8 w-14 text-right text-xs bg-background/50 border-border/50"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="ml-auto text-right shrink-0">
                <span className="text-sm font-semibold text-accent">{formatCurrency(totalHT)}</span>
                <span className="text-[10px] text-muted-foreground ml-1">HT</span>
              </div>
            )}

            {/* TVA pills */}
            {isEditable ? (
              <TvaPills value={line.taux_tva} onChange={v => update({ taux_tva: v })} />
            ) : (
              <span className="text-[10px] text-muted-foreground shrink-0">TVA {line.taux_tva}%</span>
            )}
          </div>
        </div>
      </div>

      <QuickAddProductModal
        open={quickAddOpen}
        defaultTypeCode={quickAddType}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => setQuickAddOpen(false)}
      />
    </>
  );
}
