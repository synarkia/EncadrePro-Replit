import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useCreateProduit, getListProduitsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProduitSearchResult } from "./ProductSearchCombobox";
import {
  PRODUCT_TYPES, PRICING_MODES, pricingModeToUniteCalcul,
  type ProductTypeCode,
} from "@/lib/product-types";
import { SupplierCombobox } from "./SupplierCombobox";

/* WEB-TO-DESKTOP NOTE: writes ONLY new fields (type_code, pricing_mode, fournisseur_id).
   Legacy fields (type_produit / unite_calcul / fournisseur free-text) are no longer
   populated from the UI. Backend keeps deriving them at read-time as needed. */

interface QuickAddProductModalProps {
  open: boolean;
  /** Optional default 5-code type (VR/FA/AU/SD/EN). */
  defaultTypeCode?: ProductTypeCode;
  onClose: () => void;
  onCreated: (produit: ProduitSearchResult) => void;
}

type FormState = {
  type_code: ProductTypeCode;
  pricing_mode: "unit" | "linear_meter" | "square_meter";
  reference: string;
  designation: string;
  fournisseur_id: number | null;
  sous_categorie: string;
  prix_ht: string;
  prix_achat_ht: string;
  coefficient_marge: string;
  taux_tva: string;
  largeur_mm: string;
  epaisseur_mm: string;
  longueur_barre_m: string;
  stock_alerte: string;
  // Legacy V1 VR-specific coefficients (TN/TA pricing).
  majo_epaisseur: string;
  mini_fact_tn: string;
  mini_fact_ta: string;
  coef_marge_ta: string;
  plus_value_ta_pct: string;
  // EN-specific (encadrement) hint.
  cadre_or_accessoire: string;
  // FA-specific dimension.
  fac_mm: string;
  vendu: boolean;
};

const DEFAULT_PRICING: Record<ProductTypeCode, "unit" | "linear_meter" | "square_meter"> = {
  EN: "linear_meter",
  FA: "unit",
  VR: "square_meter",
  AU: "unit",
  SD: "unit",
};

function makeDefault(type: ProductTypeCode): FormState {
  return {
    type_code: type,
    pricing_mode: DEFAULT_PRICING[type],
    reference: "",
    designation: "",
    fournisseur_id: null,
    sous_categorie: "",
    prix_ht: "",
    prix_achat_ht: "",
    coefficient_marge: "",
    taux_tva: "20",
    largeur_mm: "",
    epaisseur_mm: "",
    longueur_barre_m: "",
    stock_alerte: "",
    majo_epaisseur: "",
    mini_fact_tn: "",
    mini_fact_ta: "",
    coef_marge_ta: "",
    plus_value_ta_pct: "",
    cadre_or_accessoire: type === "EN" ? "cadre" : "",
    fac_mm: "",
    vendu: true,
  };
}

const SHOWS_PROFILE = (t: ProductTypeCode) => t === "EN" || t === "FA";
const SHOWS_PURCHASE = (t: ProductTypeCode) => t !== "SD";
const SHOWS_STOCK = (t: ProductTypeCode) => t !== "SD" && t !== "FA";
const SHOWS_SUPPLIER = (t: ProductTypeCode) => t !== "SD";

export function QuickAddProductModal({ open, defaultTypeCode = "EN", onClose, onCreated }: QuickAddProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduit = useCreateProduit();

  const [form, setForm] = useState<FormState>(makeDefault(defaultTypeCode));

  useEffect(() => {
    if (open) setForm(makeDefault(defaultTypeCode));
  }, [open, defaultTypeCode]);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleTypeChange = (type: ProductTypeCode) => {
    set({ type_code: type, pricing_mode: DEFAULT_PRICING[type], sous_categorie: "" });
  };

  const handleSubmit = () => {
    const prix = parseFloat(form.prix_ht);
    if (!form.designation || isNaN(prix)) return;

    const payload = {
      type_code: form.type_code,
      pricing_mode: form.pricing_mode,
      fournisseur_id: form.fournisseur_id,
      sous_categorie: form.sous_categorie || null,
      reference: form.reference || null,
      designation: form.designation,
      // unite_calcul kept in payload because the backend column is NOT NULL;
      // value is derived from pricing_mode — UI never lets the user type it.
      unite_calcul: pricingModeToUniteCalcul(form.pricing_mode),
      prix_ht: prix,
      prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
      coefficient_marge: form.coefficient_marge ? parseFloat(form.coefficient_marge) : null,
      taux_tva: parseFloat(form.taux_tva),
      largeur_mm: form.largeur_mm ? parseFloat(form.largeur_mm) : null,
      epaisseur_mm: form.epaisseur_mm ? parseFloat(form.epaisseur_mm) : null,
      longueur_barre_m: form.longueur_barre_m ? parseFloat(form.longueur_barre_m) : null,
      stock_alerte: form.stock_alerte ? parseInt(form.stock_alerte, 10) : null,
      majo_epaisseur: form.majo_epaisseur ? parseFloat(form.majo_epaisseur) : null,
      mini_fact_tn: form.mini_fact_tn ? parseFloat(form.mini_fact_tn) : null,
      mini_fact_ta: form.mini_fact_ta ? parseFloat(form.mini_fact_ta) : null,
      coef_marge_ta: form.coef_marge_ta ? parseFloat(form.coef_marge_ta) : null,
      plus_value_ta_pct: form.plus_value_ta_pct ? parseFloat(form.plus_value_ta_pct) : null,
      cadre_or_accessoire: form.cadre_or_accessoire || null,
      fac_mm: form.fac_mm ? parseInt(form.fac_mm, 10) : null,
      vendu: form.vendu,
      notes: null,
    };

    createProduit.mutate({ data: payload }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });
        toast({ title: "Produit créé", description: form.designation });
        onCreated({
          id: created.id,
          type_code: created.type_code as ProductTypeCode,
          pricing_mode: created.pricing_mode,
          type_produit: created.type_produit ?? null,
          designation: created.designation,
          reference: created.reference ?? null,
          fournisseur: created.fournisseur ?? null,
          fournisseur_id: created.fournisseur_id ?? null,
          sous_categorie: created.sous_categorie ?? null,
          unite: created.unite ?? null,
          unite_calcul: created.unite_calcul,
          prix_ht: created.prix_ht,
          prix_achat_ht: created.prix_achat_ht ?? null,
          coefficient_marge: created.coefficient_marge ?? null,
          taux_tva: created.taux_tva,
          majo_epaisseur: created.majo_epaisseur ?? null,
          mini_fact_tn: created.mini_fact_tn ?? null,
          mini_fact_ta: created.mini_fact_ta ?? null,
          coef_marge_ta: created.coef_marge_ta ?? null,
          plus_value_ta_pct: created.plus_value_ta_pct ?? null,
        });
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="glass-panel max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un produit</DialogTitle>
          <DialogDescription>Ce produit sera ajouté au catalogue.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Type selector (5 codes) ──────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PRODUCT_TYPES.map(t => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => handleTypeChange(t.code)}
                  title={t.description}
                  className={`py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition-all ${
                    form.type_code === t.code
                      ? t.chipColor
                      : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="font-mono">{t.code}</div>
                  <div className="text-[9px] opacity-70 truncate">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Ref + Designation ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Référence</label>
              <Input className="h-8 text-sm" value={form.reference} onChange={e => set({ reference: e.target.value })} placeholder="REF-001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Désignation *</label>
              <Input className="h-8 text-sm" value={form.designation} onChange={e => set({ designation: e.target.value })} placeholder="Nom du produit..." />
            </div>
          </div>

          {/* ── Sub-category (free-form) ─────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sous-catégorie</label>
            <Input className="h-8 text-sm" value={form.sous_categorie} onChange={e => set({ sous_categorie: e.target.value })} placeholder="Ex: Baguette, Verre minéral, Polissage..." />
          </div>

          {/* ── Supplier picker (all but pure services) ──────────── */}
          {SHOWS_SUPPLIER(form.type_code) && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fournisseur</label>
              <SupplierCombobox
                value={form.fournisseur_id}
                onChange={(id) => set({ fournisseur_id: id })}
              />
            </div>
          )}

          {/* ── Profile measurements (Encadrement & Façonnage) ──── */}
          {SHOWS_PROFILE(form.type_code) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Largeur (mm)</label>
                <Input className="h-8 text-sm" type="number" step="0.1" value={form.largeur_mm} onChange={e => set({ largeur_mm: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Épaisseur (mm)</label>
                <Input className="h-8 text-sm" type="number" step="0.1" value={form.epaisseur_mm} onChange={e => set({ epaisseur_mm: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Barre (m)</label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={form.longueur_barre_m} onChange={e => set({ longueur_barre_m: e.target.value })} />
              </div>
            </div>
          )}

          {/* ── Pricing mode ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mode de calcul</label>
            <Select value={form.pricing_mode} onValueChange={v => set({ pricing_mode: v as FormState["pricing_mode"] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICING_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* ── Pricing row ──────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prix HT *</label>
              <Input className="h-8 text-sm" type="number" step="0.01" min="0" value={form.prix_ht} onChange={e => set({ prix_ht: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">TVA</label>
              <Select value={form.taux_tva} onValueChange={v => set({ taux_tva: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="5.5">5.5%</SelectItem>
                  <SelectItem value="0">0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {SHOWS_STOCK(form.type_code) && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Alerte stock</label>
                <Input className="h-8 text-sm" type="number" min="0" value={form.stock_alerte} onChange={e => set({ stock_alerte: e.target.value })} placeholder="—" />
              </div>
            )}
          </div>

          {/* ── Purchase price + margin (cost-tracked types) ─────── */}
          {SHOWS_PURCHASE(form.type_code) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prix d'achat HT</label>
                <Input className="h-8 text-sm" type="number" step="0.01" min="0" value={form.prix_achat_ht} onChange={e => set({ prix_achat_ht: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Coefficient marge</label>
                <Input className="h-8 text-sm" type="number" step="0.01" min="0" value={form.coefficient_marge} onChange={e => set({ coefficient_marge: e.target.value })} placeholder="2.5" />
              </div>
            </div>
          )}

          {/* ── EN-specific: cadre vs accessoire ─────────────────── */}
          {form.type_code === "EN" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type d'encadrement</label>
              <Select value={form.cadre_or_accessoire || "cadre"} onValueChange={v => set({ cadre_or_accessoire: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cadre">Cadre (baguette)</SelectItem>
                  <SelectItem value="accessoire">Accessoire (passe-partout, fond, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── FA-specific: fac_mm ─────────────────────────────── */}
          {form.type_code === "FA" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Façonnage (mm)</label>
              <Input className="h-8 text-sm" type="number" step="1" min="0" value={form.fac_mm} onChange={e => set({ fac_mm: e.target.value })} placeholder="Largeur de façonnage" />
            </div>
          )}

          {/* ── VR-specific: legacy TN/TA coefficients ───────────── */}
          {form.type_code === "VR" && (
            <div className="space-y-2 rounded-lg border border-border/40 p-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coefficients TN / TA (verre)</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Mini fact. TN (m²)</label>
                  <Input className="h-7 text-xs" type="number" step="0.001" min="0" value={form.mini_fact_tn} onChange={e => set({ mini_fact_tn: e.target.value })} placeholder="0.10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Mini fact. TA (m²)</label>
                  <Input className="h-7 text-xs" type="number" step="0.001" min="0" value={form.mini_fact_ta} onChange={e => set({ mini_fact_ta: e.target.value })} placeholder="0.10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Majo. épaisseur</label>
                  <Input className="h-7 text-xs" type="number" step="0.01" min="0" value={form.majo_epaisseur} onChange={e => set({ majo_epaisseur: e.target.value })} placeholder="1.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Coef marge TA</label>
                  <Input className="h-7 text-xs" type="number" step="0.001" min="0" value={form.coef_marge_ta} onChange={e => set({ coef_marge_ta: e.target.value })} placeholder="2.500" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] text-muted-foreground">Plus-value TA (%)</label>
                  <Input className="h-7 text-xs" type="number" step="0.1" value={form.plus_value_ta_pct} onChange={e => set({ plus_value_ta_pct: e.target.value })} placeholder="0.0" />
                </div>
              </div>
            </div>
          )}

          {/* ── Vendu toggle ─────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <input
              id="vendu"
              type="checkbox"
              checked={form.vendu}
              onChange={e => set({ vendu: e.target.checked })}
              className="h-4 w-4 rounded border-border/40"
            />
            <label htmlFor="vendu" className="text-xs font-medium text-muted-foreground cursor-pointer">
              Produit vendu (apparaît dans les recherches devis)
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createProduit.isPending || !form.designation || !form.prix_ht}>
            {createProduit.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Création...</> : "Créer et ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
