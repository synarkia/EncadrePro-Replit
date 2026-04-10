import { useState } from "react";
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

export function QuickAddProductModal({ open, defaultType = "matière", onClose, onCreated }: QuickAddProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduit = useCreateProduit();

  const [form, setForm] = useState({
    type_produit: defaultType,
    reference: "",
    designation: "",
    fournisseur: "",
    sous_categorie: "",
    unite: "pièce",
    prix_ht: "",
    taux_tva: "20",
  });

  const reset = () => setForm({
    type_produit: defaultType,
    reference: "", designation: "", fournisseur: "", sous_categorie: "",
    unite: "pièce", prix_ht: "", taux_tva: "20",
  });

  const handleSubmit = () => {
    const prix = parseFloat(form.prix_ht);
    if (!form.designation || isNaN(prix)) return;

    createProduit.mutate({
      data: {
        type_produit: form.type_produit,
        fournisseur: form.fournisseur || null,
        sous_categorie: form.sous_categorie || null,
        unite: form.unite,
        reference: form.reference || null,
        designation: form.designation,
        categorie: "baguettes",
        unite_calcul: uniteToUniteCalcul(form.unite),
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
        reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="glass-panel max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un produit</DialogTitle>
          <DialogDescription>Ce produit sera ajouté au catalogue.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {["matière", "façonnage", "service"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type_produit: t })}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Référence</label>
              <Input className="h-8 text-sm" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="REF-001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Désignation *</label>
              <Input className="h-8 text-sm" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="Nom du produit..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fournisseur</label>
              <Input className="h-8 text-sm" value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} placeholder="Nom fournisseur..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sous-catégorie</label>
              <Input className="h-8 text-sm" value={form.sous_categorie} onChange={e => setForm({ ...form, sous_categorie: e.target.value })} placeholder="Ex: Verre, Polissage..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unité</label>
              <Select value={form.unite} onValueChange={v => setForm({ ...form, unite: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITE_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prix HT *</label>
              <Input className="h-8 text-sm" type="number" step="0.01" min="0" value={form.prix_ht} onChange={e => setForm({ ...form, prix_ht: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">TVA</label>
              <Select value={form.taux_tva} onValueChange={v => setForm({ ...form, taux_tva: v })}>
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
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createProduit.isPending || !form.designation || !form.prix_ht}>
            {createProduit.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Création...</> : "Créer et ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
