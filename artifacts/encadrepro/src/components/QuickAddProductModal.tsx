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

const UNITE_OPTIONS = [
  { value: "ml", label: "Mètre linéaire (ml)" },
  { value: "m²", label: "Mètre carré (m²)" },
  { value: "pièce", label: "Pièce" },
  { value: "heure", label: "Heure" },
  { value: "forfait", label: "Forfait" },
];

const SOUS_CATEGORIES: Record<string, string[]> = {
  matière: ["Verre", "Encadrement", "Bois", "Plexi", "Métal", "Passe-partout", "Autre"],
  façonnage: ["Polissage", "Biseautage", "Perçage", "Découpe", "Collage", "Soudure", "Autre"],
  service: ["Montage", "Livraison", "Main d'œuvre", "Nettoyage", "Conseil", "Autre"],
};

const DEFAULT_UNITE: Record<string, string> = {
  matière: "ml",
  façonnage: "pièce",
  service: "heure",
};

function uniteToUniteCalcul(unite: string): string {
  const map: Record<string, string> = { "ml": "metre_lineaire", "m²": "metre_carre", "pièce": "unitaire", "heure": "heure", "forfait": "unitaire" };
  return map[unite] ?? "unitaire";
}

interface QuickAddProductModalProps {
  open: boolean;
  defaultType?: string;
  onClose: () => void;
  onCreated: (produit: ProduitSearchResult) => void;
}

type FormState = {
  type_produit: string;
  reference: string;
  designation: string;
  fournisseur: string;
  sous_categorie: string;
  unite: string;
  prix_ht: string;
  taux_tva: string;
  tarif_type: "forfait" | "heure";
};

export function QuickAddProductModal({ open, defaultType = "matière", onClose, onCreated }: QuickAddProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduit = useCreateProduit();

  const makeDefault = (type: string): FormState => ({
    type_produit: type,
    reference: "",
    designation: "",
    fournisseur: "",
    sous_categorie: "",
    unite: DEFAULT_UNITE[type] ?? "pièce",
    prix_ht: "",
    taux_tva: "20",
    tarif_type: type === "service" ? "heure" : "forfait",
  });

  const [form, setForm] = useState<FormState>(makeDefault(defaultType));

  useEffect(() => {
    if (open) setForm(makeDefault(defaultType));
  }, [open, defaultType]);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleTypeChange = (type: string) => {
    set({ type_produit: type, sous_categorie: "", unite: DEFAULT_UNITE[type] ?? "pièce", tarif_type: type === "service" ? "heure" : "forfait" });
  };

  const handleSubmit = () => {
    const prix = parseFloat(form.prix_ht);
    if (!form.designation || isNaN(prix)) return;

    const unite = form.type_produit === "service" ? (form.tarif_type === "heure" ? "heure" : "forfait") : form.unite;

    /* WEB-TO-DESKTOP NOTE: map legacy 3-type UI to the new 5-code typology. */
    const typeCodeMap: Record<string, "VR" | "FA" | "AU" | "SD" | "EN"> = {
      "matière": "EN", "façonnage": "FA", "service": "SD",
    };
    const pricingModeMap: Record<string, "unit" | "linear_meter" | "square_meter"> = {
      "ml": "linear_meter", "m²": "square_meter",
    };
    createProduit.mutate({
      data: {
        type_code: typeCodeMap[form.type_produit] ?? "EN",
        pricing_mode: pricingModeMap[unite] ?? "unit",
        type_produit: form.type_produit,
        fournisseur: form.fournisseur || null,
        sous_categorie: form.sous_categorie || null,
        unite,
        reference: form.reference || null,
        designation: form.designation,
        unite_calcul: uniteToUniteCalcul(unite),
        prix_ht: prix,
        taux_tva: parseFloat(form.taux_tva),
        notes: null,
      },
    }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });
        toast({ title: "Produit créé", description: form.designation });
        onCreated({
          id: created.id,
          type_produit: created.type_produit ?? null,
          designation: created.designation,
          reference: created.reference ?? null,
          fournisseur: created.fournisseur ?? null,
          sous_categorie: created.sous_categorie ?? null,
          unite: created.unite ?? null,
          unite_calcul: created.unite_calcul,
          prix_ht: created.prix_ht,
          taux_tva: created.taux_tva,
        });
        onClose();
      },
    });
  };

  const subCats = SOUS_CATEGORIES[form.type_produit] ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="glass-panel max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un produit</DialogTitle>
          <DialogDescription>Ce produit sera ajouté au catalogue.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Type selector ───────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {["matière", "façonnage", "service"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all capitalize ${
                    form.type_produit === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border/50 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sub-category pills ──────────────────────────── */}
          {subCats.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sous-catégorie</label>
              <div className="flex flex-wrap gap-1.5">
                {subCats.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set({ sous_categorie: form.sous_categorie === cat ? "" : cat })}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                      form.sous_categorie === cat
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "bg-card border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Ref + Designation ───────────────────────────── */}
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

          {/* ── Supplier (Matière only) ─────────────────────── */}
          {form.type_produit === "matière" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fournisseur</label>
              <Input className="h-8 text-sm" value={form.fournisseur} onChange={e => set({ fournisseur: e.target.value })} placeholder="Nom du fournisseur..." />
            </div>
          )}

          {/* ── Service: rate type toggle ───────────────────── */}
          {form.type_produit === "service" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type de tarif</label>
              <div className="flex gap-2">
                {([["heure", "Taux horaire"], ["forfait", "Forfait"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set({ tarif_type: val })}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                      form.tarif_type === val
                        ? "bg-green-500/20 text-green-400 border-green-500/50"
                        : "bg-card border-border/50 text-muted-foreground hover:border-green-500/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Pricing row ─────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Unit: hidden for service (derived from tarif_type) */}
            {form.type_produit !== "service" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Unité</label>
                <Select value={form.unite} onValueChange={v => set({ unite: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITE_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={`space-y-1.5 ${form.type_produit === "service" ? "col-span-2" : ""}`}>
              <label className="text-xs font-medium text-muted-foreground">
                {form.type_produit === "service" && form.tarif_type === "heure" ? "Taux / heure HT *" : "Prix HT *"}
              </label>
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
