import { useState } from "react";
import { Layers, Wrench, Briefcase, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import { QuickAddProductModal } from "./QuickAddProductModal";
import { formatCurrency } from "@/lib/format";
import type { ProduitSearchResult } from "./ProductSearchCombobox";
import { pricingModeToUniteCalcul, type ProductTypeCode } from "@/lib/product-types";
import { computeLignePvuht, computeLigneTotalHT, type RegimePricing } from "@/lib/compute-line";

/* WEB-TO-DESKTOP NOTE: visually keeps the 3 buckets (Matière / Façonnage / Service)
   but the matière bucket now accepts EN, VR or AU products. Façonnage is FA-only and
   Service is SD-only. When a product is picked the line's calculation method is
   inherited from the product's pricing_mode so the dimensions form (Quantité only,
   Longueur only, or Largeur×Hauteur) appears correctly. */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FaconnageItem = {
  id?: number | string;
  produit_id: number | null;
  designation: string;
  quantite: number;
  longueur_m: number | null;
  prix_unitaire_ht: number;
  taux_tva: number;
  total_ht: number;
  parametres_json: string | null;
  ordre: number;
};

export type ServiceItem = {
  id?: number | string;
  produit_id: number | null;
  designation: string;
  quantite: number;
  heures: number | null;
  prix_unitaire_ht: number;
  taux_tva: number;
  total_ht: number;
  ordre: number;
};

export type QuoteLine = {
  id: number | string;
  produit_id: number | null;
  designation: string;
  description_longue: string | null;
  remise_pct: number;
  unite_calcul: string;
  width_cm: number | null;
  height_cm: number | null;
  largeur_m: number | null;
  hauteur_m: number | null;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  faconnage: FaconnageItem[];
  service: ServiceItem[];
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

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, color, count, onAdd, addLabel, isEditable }: {
  icon: React.ElementType;
  label: string;
  color: string;
  count: number;
  onAdd?: () => void;
  addLabel?: string;
  isEditable: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded-md ${color}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 opacity-80" />
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{label}</span>
        {count > 0 && <span className="text-[10px] opacity-60">({count})</span>}
      </div>
      {isEditable && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-0.5 text-[11px] opacity-70 hover:opacity-100 transition-opacity font-medium"
        >
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      )}
    </div>
  );
}

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
}

export function QuoteLineCard({ line, index, isEditable, onChange, onRemove }: QuoteLineCardProps) {
  const [showFaconnage, setShowFaconnage] = useState(true);
  const [showService, setShowService] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<ProductTypeCode>("EN");

  const wCm = line.width_cm ?? 0;
  const hCm = line.height_cm ?? 0;
  const qCalc = calcQuantite(line.unite_calcul, wCm, hCm, line.quantite);
  const remisePct = Math.max(0, Math.min(100, line.remise_pct ?? 0));
  const grossLineHT = computeLigneTotalHT({
    type_code: line.type_code,
    unite_calcul: line.unite_calcul,
    quantite: qCalc,
    surface_m2: (line.unite_calcul === "m²" || line.unite_calcul === "metre_carre" || line.unite_calcul === "m2") ? qCalc : null,
    prix_unitaire_ht: line.prix_unitaire_ht,
    regime: line.regime_pricing,
    prix_achat_ht: line.prix_achat_ht,
    majo_epaisseur: line.majo_epaisseur,
    mini_fact_tn: line.mini_fact_tn,
    mini_fact_ta: line.mini_fact_ta,
    coef_marge_ta: line.coef_marge_ta,
    plus_value_ta_pct: line.plus_value_ta_pct,
  });
  // Apply per-line discount on the matière subtotal only (sub-items keep their price).
  const lineHT = grossLineHT * (1 - remisePct / 100);

  const totalFaconnageHT = (line.faconnage ?? []).reduce((s, f) => {
    const eff = f.longueur_m != null && f.longueur_m > 0 ? f.longueur_m : 1;
    return s + f.quantite * eff * f.prix_unitaire_ht;
  }, 0);
  const totalServiceHT = (line.service ?? []).reduce((s, s2) => s + s2.quantite * s2.prix_unitaire_ht, 0);
  const totalHT = lineHT + totalFaconnageHT + totalServiceHT;

  const faconnageCount = line.faconnage?.length ?? 0;
  const serviceCount = line.service?.length ?? 0;

  const update = (patch: Partial<QuoteLine>) => onChange({ ...line, ...patch });

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
      // Inherit calculation method from the product's pricing_mode.
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

  const handleRegimeChange = (regime: RegimePricing) => {
    const pvuht = computeLignePvuht({
      type_code: line.type_code,
      prix_ht: line.prix_unitaire_ht, // fallback for TN if no other source
      prix_achat_ht: line.prix_achat_ht,
      coefficient_marge: line.coefficient_marge,
      regime,
    });
    // For TN we can't easily recover the catalogue prix_ht once the user has
    // overridden prix_unitaire_ht, so we only auto-update the line when going
    // from TN→TA (we can compute from prix_achat_ht * coefficient_marge).
    if (regime === "TA" && line.prix_achat_ht != null && line.coefficient_marge != null) {
      update({ regime_pricing: regime, prix_unitaire_ht: pvuht });
    } else {
      update({ regime_pricing: regime });
    }
  };

  // Façonnage handlers
  const addFaconnage = () => {
    update({ faconnage: [...(line.faconnage ?? []), {
      id: `f-${Date.now()}`, produit_id: null, designation: "",
      quantite: 1, longueur_m: null, prix_unitaire_ht: 0, taux_tva: 20, total_ht: 0,
      parametres_json: null, ordre: (line.faconnage ?? []).length,
    }] });
    setShowFaconnage(true);
  };

  const updateFaconnage = (fi: number, patch: Partial<FaconnageItem>) => {
    const items = [...(line.faconnage ?? [])];
    items[fi] = { ...items[fi], ...patch };
    update({ faconnage: items });
  };

  const selectFaconnageProduit = (fi: number, p: ProduitSearchResult) => {
    updateFaconnage(fi, { produit_id: p.id, designation: p.designation, prix_unitaire_ht: p.prix_ht, taux_tva: p.taux_tva });
  };

  const removeFaconnage = (fi: number) => {
    update({ faconnage: (line.faconnage ?? []).filter((_, i) => i !== fi) });
  };

  // Service handlers
  const addService = () => {
    update({ service: [...(line.service ?? []), {
      id: `s-${Date.now()}`, produit_id: null, designation: "",
      quantite: 1, heures: null, prix_unitaire_ht: 0, taux_tva: 20, total_ht: 0,
      ordre: (line.service ?? []).length,
    }] });
    setShowService(true);
  };

  const updateService = (si: number, patch: Partial<ServiceItem>) => {
    const items = [...(line.service ?? [])];
    items[si] = { ...items[si], ...patch };
    update({ service: items });
  };

  const selectServiceProduit = (si: number, p: ProduitSearchResult) => {
    updateService(si, { produit_id: p.id, designation: p.designation, prix_unitaire_ht: p.prix_ht, taux_tva: p.taux_tva });
  };

  const removeService = (si: number) => {
    update({ service: (line.service ?? []).filter((_, i) => i !== si) });
  };

  const isVerre = line.type_code === "VR";

  return (
    <>
      <div className={`rounded-xl border transition-all overflow-hidden ${isEditable ? "border-border/50 bg-card/60" : "border-border/30 bg-card/30"}`}>

        {/* ── Card title bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-card/40 border-b border-border/30">
          <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded">#{index + 1}</span>
          {!isEditable && (<span className="text-sm font-medium flex-1 truncate">{line.designation}</span>)}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-bold text-accent tabular-nums">{formatCurrency(totalHT)}</span>
            <span className="text-[10px] text-muted-foreground">HT</span>
            {isEditable && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/40 hover:text-destructive ml-1" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ══════════════════════════════════════════════════════
              SECTION: MATIÈRE  (host item — accepts EN, VR, AU)
          ══════════════════════════════════════════════════════ */}
          <div className="space-y-2">
            <SectionHeader
              icon={Layers}
              label="Matière (Encadrement / Volume / Accessoire)"
              color="bg-violet-500/10 text-violet-300"
              count={0}
              isEditable={false}
            />
            <div className="space-y-2 pl-1">
              {/* Product search */}
              {isEditable && (
                <ProductSearchCombobox
                  typeCodes={["EN", "VR", "AU"]}
                  placeholder="Chercher encadrement, verre, accessoire... (2+ car.)"
                  onSelect={handleMatiereSelect}
                  onCreateNew={() => { setQuickAddType("EN"); setQuickAddOpen(true); }}
                  showSupplierPills
                />
              )}

              {/* TN/TA regime selector — VR only */}
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

              {/* Free-text designation */}
              {isEditable ? (
                <Input
                  value={line.designation}
                  onChange={e => update({ designation: e.target.value })}
                  placeholder="Description de la matière..."
                  className="h-8 text-sm bg-background/50 border-border/50"
                />
              ) : (
                <p className="text-sm text-muted-foreground pl-2">{line.designation || "—"}</p>
              )}

              {/* Optional long-form description (multi-line, shown under the
                  désignation on printed devis & factures). */}
              {isEditable ? (
                <textarea
                  value={line.description_longue ?? ""}
                  onChange={e => update({ description_longue: e.target.value || null })}
                  placeholder="Description détaillée (facultatif, affichée sur le document imprimé)..."
                  rows={2}
                  className="w-full text-xs bg-background/30 border border-border/40 rounded-md px-2 py-1.5 text-foreground/80 placeholder:text-muted-foreground/50 resize-y min-h-[2rem]"
                />
              ) : (
                line.description_longue && (
                  <p className="text-xs text-muted-foreground/80 pl-2 whitespace-pre-line italic">{line.description_longue}</p>
                )
              )}

              {/* Dimensions + Qty + Price + TVA row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Unit */}
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

                {/* Dimensions */}
                {needsDimensions(line.unite_calcul) && (
                  isEditable ? (
                    <>
                      <Input type="number" step="0.5" min="0"
                        value={line.width_cm ?? ""}
                        onChange={e => update({ width_cm: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="L (cm)"
                        className="h-8 w-20 text-center text-xs bg-background/50 border-border/50 shrink-0"
                      />
                      <span className="text-muted-foreground text-xs">×</span>
                      <Input type="number" step="0.5" min="0"
                        value={line.height_cm ?? ""}
                        onChange={e => update({ height_cm: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="H (cm)"
                        className="h-8 w-20 text-center text-xs bg-background/50 border-border/50 shrink-0"
                      />
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        = {qCalc.toFixed(3)} {uniteLabel(line.unite_calcul)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {wCm > 0 || hCm > 0 ? `${wCm} × ${hCm} cm → ${qCalc.toFixed(3)} ${uniteLabel(line.unite_calcul)}` : "—"}
                    </span>
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
                    />
                  </div>
                ) : (<span className="text-xs text-muted-foreground">Qté {line.quantite}</span>)}

                {/* Price */}
                {isEditable ? (
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <span className="text-[10px] text-muted-foreground">PU HT</span>
                    <Input type="number" step="0.01" min="0"
                      value={line.prix_unitaire_ht}
                      onChange={e => update({ prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-24 text-right text-sm font-semibold bg-background/50 border-border/50"
                    />
                    <span className="text-[10px] text-muted-foreground">€</span>
                    {/* Per-line discount (percentage). 0 = no discount. */}
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
                    <span className="text-sm font-semibold text-accent">{formatCurrency(lineHT)}</span>
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

          {/* ══════════════════════════════════════════════════════
              SECTION: FAÇONNAGE  (FA only)
          ══════════════════════════════════════════════════════ */}
          {(isEditable || faconnageCount > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <SectionHeader
                  icon={Wrench}
                  label="Façonnage"
                  color="bg-blue-500/10 text-blue-300"
                  count={faconnageCount}
                  onAdd={addFaconnage}
                  addLabel="Ajouter"
                  isEditable={isEditable}
                />
                {faconnageCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFaconnage(v => !v)}
                    className="ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showFaconnage ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {showFaconnage && faconnageCount > 0 && (
                <div className="space-y-1.5 pl-1">
                  {(line.faconnage ?? []).map((f, fi) => (
                    <div key={f.id ?? fi} className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                      <Wrench className="h-3 w-3 text-blue-400 shrink-0" />
                      {isEditable ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <ProductSearchCombobox
                              typeCodes={["FA"]}
                              placeholder="Chercher façonnage..."
                              onSelect={p => selectFaconnageProduit(fi, p)}
                              onCreateNew={() => { setQuickAddType("FA"); setQuickAddOpen(true); }}
                            />
                          </div>
                          <Input
                            value={f.designation}
                            onChange={e => updateFaconnage(fi, { designation: e.target.value })}
                            placeholder="Désignation..."
                            className="h-7 w-32 text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">Qté</span>
                            <Input type="number" min="1"
                              value={f.quantite}
                              onChange={e => updateFaconnage(fi, { quantite: parseFloat(e.target.value) || 1 })}
                              className="h-7 w-14 text-center text-xs bg-background/50 border-border/50"
                            />
                          </div>
                          {/* Optional length in metres for per-meter façonnage products */}
                          <div className="flex items-center gap-1 shrink-0" title="Longueur en mètres (laisser vide si non applicable)">
                            <span className="text-[10px] text-muted-foreground">L (m)</span>
                            <Input type="number" step="0.01" min="0"
                              value={f.longueur_m ?? ""}
                              placeholder="—"
                              onChange={e => updateFaconnage(fi, { longueur_m: e.target.value ? parseFloat(e.target.value) : null })}
                              className="h-7 w-16 text-center text-xs bg-background/50 border-border/50"
                            />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input type="number" step="0.01"
                              value={f.prix_unitaire_ht}
                              onChange={e => updateFaconnage(fi, { prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                              className="h-7 w-20 text-right text-xs bg-background/50 border-border/50"
                            />
                            <span className="text-[10px] text-blue-400/70">€</span>
                          </div>
                          <TvaPills value={f.taux_tva} onChange={v => updateFaconnage(fi, { taux_tva: v })} />
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0" onClick={() => removeFaconnage(fi)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{f.designation}</span>
                          <span className="text-[10px] text-muted-foreground">×{f.quantite}{f.longueur_m != null && f.longueur_m > 0 ? ` × ${f.longueur_m.toFixed(2)}m` : ""}</span>
                          <span className="text-[10px] text-muted-foreground">TVA {f.taux_tva}%</span>
                          <span className="text-xs font-semibold text-blue-400">{formatCurrency(f.quantite * (f.longueur_m != null && f.longueur_m > 0 ? f.longueur_m : 1) * f.prix_unitaire_ht)}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isEditable && faconnageCount === 0 && (
                <div
                  onClick={addFaconnage}
                  className="flex items-center gap-2 border border-dashed border-blue-500/20 rounded-lg px-3 py-1.5 text-[11px] text-blue-400/50 hover:text-blue-400/80 hover:border-blue-500/40 cursor-pointer transition-colors pl-3"
                >
                  <Plus className="h-3 w-3" /> Ajouter un façonnage
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SECTION: SERVICES  (SD only)
          ══════════════════════════════════════════════════════ */}
          {(isEditable || serviceCount > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <SectionHeader
                  icon={Briefcase}
                  label="Services"
                  color="bg-green-500/10 text-green-300"
                  count={serviceCount}
                  onAdd={addService}
                  addLabel="Ajouter"
                  isEditable={isEditable}
                />
                {serviceCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowService(v => !v)}
                    className="ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showService ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {showService && serviceCount > 0 && (
                <div className="space-y-1.5 pl-1">
                  {(line.service ?? []).map((s, si) => (
                    <div key={s.id ?? si} className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                      <Briefcase className="h-3 w-3 text-green-400 shrink-0" />
                      {isEditable ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <ProductSearchCombobox
                              typeCodes={["SD"]}
                              placeholder="Chercher service..."
                              onSelect={p => selectServiceProduit(si, p)}
                              onCreateNew={() => { setQuickAddType("SD"); setQuickAddOpen(true); }}
                            />
                          </div>
                          <Input
                            value={s.designation}
                            onChange={e => updateService(si, { designation: e.target.value })}
                            placeholder="Désignation..."
                            className="h-7 w-32 text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">Qté</span>
                            <Input type="number" min="1"
                              value={s.quantite}
                              onChange={e => updateService(si, { quantite: parseFloat(e.target.value) || 1 })}
                              className="h-7 w-14 text-center text-xs bg-background/50 border-border/50"
                            />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input type="number" step="0.01"
                              value={s.prix_unitaire_ht}
                              onChange={e => updateService(si, { prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                              className="h-7 w-20 text-right text-xs bg-background/50 border-border/50"
                            />
                            <span className="text-[10px] text-green-400/70">€</span>
                          </div>
                          <TvaPills value={s.taux_tva} onChange={v => updateService(si, { taux_tva: v })} />
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0" onClick={() => removeService(si)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{s.designation}</span>
                          <span className="text-[10px] text-muted-foreground">×{s.quantite}</span>
                          <span className="text-[10px] text-muted-foreground">TVA {s.taux_tva}%</span>
                          <span className="text-xs font-semibold text-green-400">{formatCurrency(s.quantite * s.prix_unitaire_ht)}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isEditable && serviceCount === 0 && (
                <div
                  onClick={addService}
                  className="flex items-center gap-2 border border-dashed border-green-500/20 rounded-lg px-3 py-1.5 text-[11px] text-green-400/50 hover:text-green-400/80 hover:border-green-500/40 cursor-pointer transition-colors pl-3"
                >
                  <Plus className="h-3 w-3" /> Ajouter un service
                </div>
              )}
            </div>
          )}
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
