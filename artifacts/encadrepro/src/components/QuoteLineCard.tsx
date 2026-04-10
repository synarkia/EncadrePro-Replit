import { useState } from "react";
import { Wrench, Briefcase, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import { QuickAddProductModal } from "./QuickAddProductModal";
import { formatCurrency } from "@/lib/format";
import type { ProduitSearchResult } from "./ProductSearchCombobox";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FaconnageItem = {
  id?: number | string;
  produit_id: number | null;
  designation: string;
  quantite: number;
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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcQuantite(unite: string, widthCm: number, heightCm: number, qte: number): number {
  const wM = widthCm / 100;
  const hM = heightCm / 100;
  if (unite === "ml" || unite === "metre_lineaire") return (wM + hM) * 2 * qte;
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

interface QuoteLineCardProps {
  line: QuoteLine;
  index: number;
  isEditable: boolean;
  onChange: (line: QuoteLine) => void;
  onRemove: () => void;
}

export function QuoteLineCard({ line, index, isEditable, onChange, onRemove }: QuoteLineCardProps) {
  const [showSubs, setShowSubs] = useState((line.faconnage?.length ?? 0) > 0 || (line.service?.length ?? 0) > 0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<string>("façonnage");

  const wCm = line.width_cm ?? 0;
  const hCm = line.height_cm ?? 0;
  const qCalc = calcQuantite(line.unite_calcul, wCm, hCm, line.quantite);
  const lineHT = qCalc * line.prix_unitaire_ht;

  const totalFaconnageHT = (line.faconnage ?? []).reduce((s, f) => s + f.quantite * f.prix_unitaire_ht, 0);
  const totalServiceHT = (line.service ?? []).reduce((s, s2) => s + s2.quantite * s2.prix_unitaire_ht, 0);
  const totalHT = lineHT + totalFaconnageHT + totalServiceHT;

  const update = (patch: Partial<QuoteLine>) => onChange({ ...line, ...patch });

  const handleMatiereSelect = (p: ProduitSearchResult) => {
    update({
      produit_id: p.id,
      designation: p.designation,
      unite_calcul: p.unite ?? p.unite_calcul,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: p.taux_tva,
    });
  };

  // Façonnage handlers
  const addFaconnage = () => {
    update({ faconnage: [...(line.faconnage ?? []), {
      id: `f-${Date.now()}`,
      produit_id: null,
      designation: "",
      quantite: 1,
      prix_unitaire_ht: 0,
      taux_tva: 20,
      total_ht: 0,
      parametres_json: null,
      ordre: (line.faconnage ?? []).length,
    }] });
    setShowSubs(true);
  };

  const updateFaconnage = (fi: number, patch: Partial<FaconnageItem>) => {
    const items = [...(line.faconnage ?? [])];
    items[fi] = { ...items[fi], ...patch };
    update({ faconnage: items });
  };

  const selectFaconnageProduit = (fi: number, p: ProduitSearchResult) => {
    updateFaconnage(fi, {
      produit_id: p.id,
      designation: p.designation,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: p.taux_tva,
    });
  };

  const removeFaconnage = (fi: number) => {
    update({ faconnage: (line.faconnage ?? []).filter((_, i) => i !== fi) });
  };

  // Service handlers
  const addService = () => {
    update({ service: [...(line.service ?? []), {
      id: `s-${Date.now()}`,
      produit_id: null,
      designation: "",
      quantite: 1,
      heures: null,
      prix_unitaire_ht: 0,
      taux_tva: 20,
      total_ht: 0,
      ordre: (line.service ?? []).length,
    }] });
    setShowSubs(true);
  };

  const updateService = (si: number, patch: Partial<ServiceItem>) => {
    const items = [...(line.service ?? [])];
    items[si] = { ...items[si], ...patch };
    update({ service: items });
  };

  const selectServiceProduit = (si: number, p: ProduitSearchResult) => {
    updateService(si, {
      produit_id: p.id,
      designation: p.designation,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: p.taux_tva,
    });
  };

  const removeService = (si: number) => {
    update({ service: (line.service ?? []).filter((_, i) => i !== si) });
  };

  const subCount = (line.faconnage?.length ?? 0) + (line.service?.length ?? 0);

  return (
    <>
      <div className={`rounded-xl border transition-all ${isEditable ? "border-border/50 bg-card/60" : "border-border/30 bg-card/30"}`}>
        {/* ── Line number badge ───────────────────────────── */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-0">
          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded">#{index + 1}</span>
          {!isEditable && <span className="text-sm font-medium flex-1 truncate">{line.designation}</span>}
          {isEditable && (
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground/50 hover:text-destructive" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="p-4 pt-2 space-y-3">
          {/* ── Material row ─────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-primary/60 w-14 shrink-0">Matière</span>
            {isEditable ? (
              <div className="flex-1">
                <ProductSearchCombobox
                  typeFilter="matière"
                  placeholder="Chercher matière... (2+ car.)"
                  onSelect={handleMatiereSelect}
                  onCreateNew={() => { setQuickAddType("matière"); setQuickAddOpen(true); }}
                />
              </div>
            ) : null}
          </div>

          {/* ── Designation (editable free-text) ─────── */}
          {isEditable && (
            <Input
              value={line.designation}
              onChange={e => update({ designation: e.target.value })}
              placeholder="Description libre de la ligne..."
              className="h-8 text-sm bg-background/50 border-border/50"
            />
          )}

          {/* ── Dimensions + Qty + Price ─────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unit */}
            {isEditable ? (
              <Select value={line.unite_calcul} onValueChange={v => update({ unite_calcul: v })}>
                <SelectTrigger className="h-8 w-24 text-xs bg-background/50 border-border/50 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pièce">Pièce</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="m²">m²</SelectItem>
                  <SelectItem value="heure">Heure</SelectItem>
                  <SelectItem value="forfait">Forfait</SelectItem>
                  <SelectItem value="metre_lineaire">ml (legacy)</SelectItem>
                  <SelectItem value="metre_carre">m² (legacy)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs font-medium bg-muted/40 px-2 py-1 rounded-md">{uniteLabel(line.unite_calcul)}</span>
            )}

            {/* Dimensions (cm) */}
            {needsDimensions(line.unite_calcul) && (
              <>
                {isEditable ? (
                  <>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={line.width_cm ?? ""}
                      onChange={e => update({ width_cm: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="L (cm)"
                      className="h-8 w-20 text-center text-xs bg-background/50 border-border/50 shrink-0"
                    />
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
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
                    {wCm > 0 || hCm > 0 ? `${wCm} × ${hCm} cm → ${qCalc.toFixed(3)} ${uniteLabel(line.unite_calcul)}` : "-"}
                  </span>
                )}
              </>
            )}

            {/* Quantity */}
            {isEditable ? (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">Qté</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantite}
                  onChange={e => update({ quantite: parseFloat(e.target.value) || 1 })}
                  className="h-8 w-16 text-center text-xs bg-background/50 border-border/50"
                />
              </div>
            ) : null}

            {/* Price */}
            {isEditable ? (
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <span className="text-[10px] text-muted-foreground">PU HT</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.prix_unitaire_ht}
                  onChange={e => update({ prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-24 text-right text-sm font-semibold bg-background/50 border-border/50"
                />
                <span className="text-[10px] text-muted-foreground">€ HT</span>
              </div>
            ) : (
              <div className="ml-auto text-right shrink-0">
                <span className="text-sm font-semibold text-accent">{formatCurrency(lineHT)}</span>
                <span className="text-[10px] text-muted-foreground ml-1">HT</span>
              </div>
            )}

            {/* TVA */}
            {isEditable && (
              <Select value={String(line.taux_tva)} onValueChange={v => update({ taux_tva: parseFloat(v) })}>
                <SelectTrigger className="h-8 w-20 text-xs bg-background/50 border-border/50 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">TVA 20%</SelectItem>
                  <SelectItem value="10">TVA 10%</SelectItem>
                  <SelectItem value="5.5">TVA 5.5%</SelectItem>
                  <SelectItem value="0">TVA 0%</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Sub-items section ─────────────────────── */}
          {(isEditable || subCount > 0) && (
            <div className="border-t border-border/30 pt-3">
              {/* Toggle + Add buttons */}
              <div className="flex items-center gap-2 mb-2">
                {subCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSubs(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSubs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {subCount} opération{subCount > 1 ? "s" : ""}
                  </button>
                )}
                {isEditable && (
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
                      onClick={addFaconnage}
                    >
                      <Wrench className="h-3 w-3 mr-1" /> + Façonnage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] text-green-400 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
                      onClick={addService}
                    >
                      <Briefcase className="h-3 w-3 mr-1" /> + Service
                    </Button>
                  </div>
                )}
              </div>

              {/* Sub-items list */}
              {showSubs && (
                <div className="space-y-2">
                  {/* Façonnage items */}
                  {(line.faconnage ?? []).map((f, fi) => (
                    <div key={f.id ?? fi} className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                      <Wrench className="h-3 w-3 text-blue-400 shrink-0" />
                      {isEditable ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <ProductSearchCombobox
                              typeFilter="façonnage"
                              placeholder="Chercher façonnage..."
                              onSelect={p => selectFaconnageProduit(fi, p)}
                              onCreateNew={() => { setQuickAddType("façonnage"); setQuickAddOpen(true); }}
                            />
                          </div>
                          <Input
                            value={f.designation}
                            onChange={e => updateFaconnage(fi, { designation: e.target.value })}
                            placeholder="Désignation..."
                            className="h-7 w-32 text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={f.quantite}
                            onChange={e => updateFaconnage(fi, { quantite: parseFloat(e.target.value) || 1 })}
                            className="h-7 w-14 text-center text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={f.prix_unitaire_ht}
                            onChange={e => updateFaconnage(fi, { prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                            className="h-7 w-20 text-right text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <span className="text-[10px] text-blue-400/70 shrink-0">€ HT</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0" onClick={() => removeFaconnage(fi)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{f.designation}</span>
                          <span className="text-xs text-muted-foreground">×{f.quantite}</span>
                          <span className="text-xs font-medium text-blue-400">{formatCurrency(f.quantite * f.prix_unitaire_ht)}</span>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Service items */}
                  {(line.service ?? []).map((s, si) => (
                    <div key={s.id ?? si} className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                      <Briefcase className="h-3 w-3 text-green-400 shrink-0" />
                      {isEditable ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <ProductSearchCombobox
                              typeFilter="service"
                              placeholder="Chercher service..."
                              onSelect={p => selectServiceProduit(si, p)}
                              onCreateNew={() => { setQuickAddType("service"); setQuickAddOpen(true); }}
                            />
                          </div>
                          <Input
                            value={s.designation}
                            onChange={e => updateService(si, { designation: e.target.value })}
                            placeholder="Désignation..."
                            className="h-7 w-32 text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={s.quantite}
                            onChange={e => updateService(si, { quantite: parseFloat(e.target.value) || 1 })}
                            className="h-7 w-14 text-center text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={s.prix_unitaire_ht}
                            onChange={e => updateService(si, { prix_unitaire_ht: parseFloat(e.target.value) || 0 })}
                            className="h-7 w-20 text-right text-xs bg-background/50 border-border/50 shrink-0"
                          />
                          <span className="text-[10px] text-green-400/70 shrink-0">€ HT</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0" onClick={() => removeService(si)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs flex-1">{s.designation}</span>
                          <span className="text-xs text-muted-foreground">×{s.quantite}</span>
                          <span className="text-xs font-medium text-green-400">{formatCurrency(s.quantite * s.prix_unitaire_ht)}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Line total footer ─────────────────────── */}
          <div className="flex justify-between items-center pt-2 border-t border-border/20">
            <div className="flex gap-3 text-[10px] text-muted-foreground/60">
              {!isEditable && line.quantite > 0 && <span>Qté {line.quantite}</span>}
              <span>TVA {line.taux_tva}%</span>
              {subCount > 0 && <span className="text-xs">({subCount} opération{subCount > 1 ? "s" : ""})</span>}
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-accent">{formatCurrency(totalHT)}</span>
              <span className="text-[10px] text-muted-foreground ml-1">HT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick add modal shared across all sub-item search combos */}
      <QuickAddProductModal
        open={quickAddOpen}
        defaultType={quickAddType}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => { setQuickAddOpen(false); }}
      />
    </>
  );
}
