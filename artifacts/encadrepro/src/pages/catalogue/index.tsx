import { useState } from "react";
import { 
  useListProduits, getListProduitsQueryKey,
  useCreateProduit, useUpdateProduit, useDeleteProduit, useToggleProduitActif 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Box, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { id: "tous", label: "Tous" },
  { id: "baguettes", label: "Baguettes" },
  { id: "verres", label: "Verres" },
  { id: "passe_partout", label: "Passe-partout" },
  { id: "quincaillerie", label: "Quincaillerie" },
  { id: "main_oeuvre", label: "Main d'œuvre" }
];

const EMPTY_FORM = {
  reference: "", designation: "", categorie: "baguettes", unite_calcul: "metre_lineaire", prix_ht: "", taux_tva: "20"
};

function ProduitForm({ formData, setFormData }: {
  formData: typeof EMPTY_FORM;
  setFormData: (d: typeof EMPTY_FORM) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Référence</label>
          <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} placeholder="Ex: BAG-001" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Désignation *</label>
          <Input value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} placeholder="Moulure chêne massif..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Catégorie</label>
          <Select value={formData.categorie} onValueChange={v => setFormData({...formData, categorie: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              {CATEGORIES.slice(1).map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Unité de calcul</label>
          <Select value={formData.unite_calcul} onValueChange={v => setFormData({...formData, unite_calcul: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="metre_lineaire">Mètre linéaire</SelectItem>
              <SelectItem value="metre_carre">Mètre carré</SelectItem>
              <SelectItem value="unitaire">Unitaire</SelectItem>
              <SelectItem value="heure">Heure</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Prix unitaire HT *</label>
          <Input type="number" step="0.01" value={formData.prix_ht} onChange={e => setFormData({...formData, prix_ht: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">TVA</label>
          <Select value={formData.taux_tva} onValueChange={v => setFormData({...formData, taux_tva: v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="5.5">5.5%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function Catalogue() {
  const [categorie, setCategorie] = useState("tous");
  const [search, setSearch] = useState("");
  const { data: produits, isLoading } = useListProduits(categorie !== "tous" ? { categorie } : {});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleActif = useToggleProduitActif();
  const createProduit = useCreateProduit();
  const updateProduit = useUpdateProduit();
  const deleteProduit = useDeleteProduit();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });

  const filteredProduits = produits?.filter(p =>
    p.designation.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference && p.reference.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggle = (id: number) => {
    toggleActif.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Statut mis à jour" }); }
    });
  };

  const handleCreate = () => {
    const prix = parseFloat(createForm.prix_ht);
    if (!createForm.designation || isNaN(prix)) return;
    createProduit.mutate({
      data: { ...createForm, prix_ht: prix, taux_tva: parseFloat(createForm.taux_tva) }
    }, {
      onSuccess: () => {
        invalidate();
        setIsCreateOpen(false);
        setCreateForm(EMPTY_FORM);
        toast({ title: "Produit créé avec succès" });
      }
    });
  };

  const openEdit = (p: NonNullable<typeof produits>[number]) => {
    setEditForm({
      reference: p.reference ?? "",
      designation: p.designation,
      categorie: p.categorie,
      unite_calcul: p.unite_calcul,
      prix_ht: String(p.prix_ht),
      taux_tva: String(p.taux_tva),
    });
    setEditingId(p.id);
  };

  const handleEdit = () => {
    if (!editingId) return;
    const prix = parseFloat(editForm.prix_ht);
    if (!editForm.designation || isNaN(prix)) return;
    updateProduit.mutate({
      id: editingId,
      data: { ...editForm, prix_ht: prix, taux_tva: parseFloat(editForm.taux_tva) }
    }, {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        toast({ title: "Produit modifié" });
      }
    });
  };

  const openDelete = (id: number, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteProduit.mutate({ id: deletingId }, {
      onSuccess: () => {
        invalidate();
        setDeletingId(null);
        toast({ title: "Produit supprimé" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogue</h1>
          <p className="text-muted-foreground mt-1">Gérez vos références et prix.</p>
        </div>
        <Button className="shadow-lg shadow-primary/20" onClick={() => { setCreateForm(EMPTY_FORM); setIsCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau produit
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Tabs value={categorie} onValueChange={setCategorie} className="w-full sm:w-auto">
          <TabsList className="glass-panel h-auto flex-wrap justify-start">
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center space-x-2 bg-card/50 p-1 rounded-lg border w-full max-w-sm shrink-0">
          <Search className="h-4 w-4 ml-2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (réf, nom)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none bg-transparent h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
        ) : filteredProduits?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card/30">
            Aucun produit dans cette catégorie.
          </div>
        ) : (
          filteredProduits?.map(produit => (
            <Card key={produit.id} className={`glass-panel border-border/50 transition-opacity ${!produit.actif ? "opacity-50 grayscale hover:grayscale-0" : ""}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Box className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      {produit.reference && <Badge variant="secondary" className="mb-1 text-[10px]">{produit.reference}</Badge>}
                      <h3 className="font-semibold text-foreground leading-tight line-clamp-2">{produit.designation}</h3>
                    </div>
                  </div>
                  <Switch checked={produit.actif === 1} onCheckedChange={() => handleToggle(produit.id)} className="ml-2 shrink-0" />
                </div>

                <div className="flex justify-between items-end mt-4 pt-4 border-t border-border/30">
                  <div>
                    <span className="text-xs text-muted-foreground block">{produit.unite_calcul.replace('_', ' ')}</span>
                    <span className="text-[10px] text-muted-foreground">TVA {produit.taux_tva}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-accent">{formatCurrency(produit.prix_ht)}</span>
                    <span className="text-xs text-muted-foreground ml-1">HT</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs glass-panel" onClick={() => openEdit(produit)}>
                    <Pencil className="h-3 w-3 mr-1" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30" onClick={() => openDelete(produit.id, produit.designation)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Create dialog ────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>Ajouter au catalogue</DialogTitle>
          </DialogHeader>
          <ProduitForm formData={createForm} setFormData={setCreateForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createProduit.isPending || !createForm.designation || !createForm.prix_ht}>
              {createProduit.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ──────────────────────────────────────── */}
      <Dialog open={editingId !== null} onOpenChange={open => !open && setEditingId(null)}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
            <DialogDescription>Mettez à jour les informations de ce produit.</DialogDescription>
          </DialogHeader>
          <ProduitForm formData={editForm} setFormData={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={updateProduit.isPending || !editForm.designation || !editForm.prix_ht}>
              {updateProduit.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────── */}
      <AlertDialog open={deletingId !== null} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingName}</strong> sera définitivement supprimé du catalogue. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
