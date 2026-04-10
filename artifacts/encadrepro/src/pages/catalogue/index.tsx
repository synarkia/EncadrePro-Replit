import { useRef, useState } from "react";
import { 
  useListProduits, getListProduitsQueryKey,
  useCreateProduit, useUpdateProduit, useDeleteProduit, useToggleProduitActif 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Camera, Loader2, Pencil, Trash2, Building2, Tag } from "lucide-react";
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

// ── Type definitions ─────────────────────────────────────────────────────────
const TYPE_TABS = [
  { id: "tous", label: "Tous" },
  { id: "matière", label: "Matière" },
  { id: "façonnage", label: "Façonnage" },
  { id: "service", label: "Service" },
];

const UNITE_OPTIONS = [
  { value: "ml", label: "Mètre linéaire (ml)" },
  { value: "m²", label: "Mètre carré (m²)" },
  { value: "pièce", label: "Pièce" },
  { value: "heure", label: "Heure" },
  { value: "forfait", label: "Forfait" },
];

// Map new unit to old unite_calcul for backward compat
function uniteToUniteCalcul(unite: string): string {
  const map: Record<string, string> = {
    "ml": "metre_lineaire",
    "m²": "metre_carre",
    "pièce": "unitaire",
    "heure": "heure",
    "forfait": "unitaire",
  };
  return map[unite] ?? "unitaire";
}

// Map old unite_calcul to new unite for display
function uniteCalcToUnite(uniteCalcul: string, unite?: string | null): string {
  if (unite) return unite;
  const map: Record<string, string> = {
    "metre_lineaire": "ml",
    "metre_carre": "m²",
    "unitaire": "pièce",
    "heure": "heure",
  };
  return map[uniteCalcul] ?? "pièce";
}

function typeBadgeVariant(type: string | null | undefined) {
  if (type === "façonnage") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (type === "service") return "bg-green-500/15 text-green-400 border-green-500/30";
  return "bg-primary/15 text-primary border-primary/30"; // matière or unknown
}

function typeLabel(type: string | null | undefined) {
  if (type === "façonnage") return "Façonnage";
  if (type === "service") return "Service";
  return "Matière";
}

// ── Form state ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  type_produit: "matière" as string,
  fournisseur: "",
  sous_categorie: "",
  unite: "ml",
  reference: "",
  designation: "",
  prix_ht: "",
  taux_tva: "20",
  notes: "",
};

function ProduitForm({ formData, setFormData }: {
  formData: typeof EMPTY_FORM;
  setFormData: (d: typeof EMPTY_FORM) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Type selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Type de produit *</label>
        <div className="flex gap-2">
          {["matière", "façonnage", "service"].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFormData({ ...formData, type_produit: t })}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all capitalize ${
                formData.type_produit === t
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Reference + Designation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Référence</label>
          <Input
            value={formData.reference}
            onChange={e => setFormData({ ...formData, reference: e.target.value })}
            placeholder="Ex: BAG-001"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Désignation *</label>
          <Input
            value={formData.designation}
            onChange={e => setFormData({ ...formData, designation: e.target.value })}
            placeholder="Moulure chêne massif..."
          />
        </div>
      </div>

      {/* Supplier + SubCategory */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fournisseur</label>
          <Input
            value={formData.fournisseur}
            onChange={e => setFormData({ ...formData, fournisseur: e.target.value })}
            placeholder="Larson-Juhl, Artclair..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Sous-catégorie</label>
          <Input
            value={formData.sous_categorie}
            onChange={e => setFormData({ ...formData, sous_categorie: e.target.value })}
            placeholder={formData.type_produit === "façonnage" ? "Polissage, Soudure..." : formData.type_produit === "service" ? "Livraison, Pose..." : "Baguette, Verre..."}
          />
        </div>
      </div>

      {/* Unit + Price + TVA */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Unité</label>
          <Select value={formData.unite} onValueChange={v => setFormData({ ...formData, unite: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITE_OPTIONS.map(u => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Prix HT *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.prix_ht}
            onChange={e => setFormData({ ...formData, prix_ht: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">TVA</label>
          <Select value={formData.taux_tva} onValueChange={v => setFormData({ ...formData, taux_tva: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="5.5">5.5%</SelectItem>
              <SelectItem value="0">0%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Input
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Remarques optionnelles..."
        />
      </div>
    </div>
  );
}

/* WEB-TO-DESKTOP NOTE: Image upload uses presigned GCS URLs via REST.
   In Electron, replace this with IPC + fs.writeFile to a local images/ folder. */
function useImageUpload(produitId: number, onSuccess: () => void) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const patchRes = await fetch(`/api/produits/${produitId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath }),
      });
      if (!patchRes.ok) throw new Error("Impossible de lier l'image au produit");

      onSuccess();
      toast({ title: "Image mise à jour" });
    } catch (err) {
      toast({ title: "Erreur", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}

function ProductImageArea({ produit, onRefresh }: {
  produit: { id: number; image_url?: string | null };
  onRefresh: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload(produit.id, onRefresh);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };
  const imageUrl = produit.image_url ? `/api/storage/objects/${produit.image_url.replace(/^\/objects\//, "")}` : null;

  return (
    <div
      className="relative w-full h-24 rounded-lg mb-3 overflow-hidden cursor-pointer group shrink-0"
      onClick={() => !uploading && inputRef.current?.click()}
      title="Cliquer pour changer l'image"
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {imageUrl ? (
        <>
          <img src={imageUrl} alt="photo produit" className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-border/40 rounded-lg bg-muted/10 group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
          {uploading ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" /> : (
            <>
              <Camera className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mb-1" />
              <span className="text-[10px] text-muted-foreground/40 group-hover:text-primary/60">Photo</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Catalogue() {
  const [typeFilter, setTypeFilter] = useState("tous");
  const [search, setSearch] = useState("");
  const { data: produits, isLoading } = useListProduits(typeFilter !== "tous" ? { type: typeFilter } : {});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleActif = useToggleProduitActif();
  const createProduit = useCreateProduit();
  const updateProduit = useUpdateProduit();
  const deleteProduit = useDeleteProduit();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });

  const filteredProduits = produits?.filter(p =>
    p.designation.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
    (p.fournisseur && p.fournisseur.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggle = (id: number) => {
    toggleActif.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Statut mis à jour" }); } });
  };

  const buildPayload = (form: typeof EMPTY_FORM) => ({
    type_produit: form.type_produit || "matière",
    fournisseur: form.fournisseur || null,
    sous_categorie: form.sous_categorie || null,
    unite: form.unite,
    reference: form.reference || null,
    designation: form.designation,
    categorie: "baguettes",
    unite_calcul: uniteToUniteCalcul(form.unite),
    prix_ht: parseFloat(form.prix_ht),
    taux_tva: parseFloat(form.taux_tva),
    notes: form.notes || null,
  });

  const handleCreate = () => {
    const prix = parseFloat(createForm.prix_ht);
    if (!createForm.designation || isNaN(prix)) return;
    createProduit.mutate({ data: buildPayload(createForm) }, {
      onSuccess: () => {
        invalidate();
        setIsCreateOpen(false);
        setCreateForm({ ...EMPTY_FORM });
        toast({ title: "Produit créé" });
      },
    });
  };

  const openEdit = (p: NonNullable<typeof produits>[number]) => {
    setEditForm({
      type_produit: p.type_produit ?? "matière",
      fournisseur: p.fournisseur ?? "",
      sous_categorie: p.sous_categorie ?? "",
      unite: uniteCalcToUnite(p.unite_calcul, p.unite),
      reference: p.reference ?? "",
      designation: p.designation,
      prix_ht: String(p.prix_ht),
      taux_tva: String(p.taux_tva),
      notes: p.notes ?? "",
    });
    setEditingId(p.id);
  };

  const handleEdit = () => {
    if (!editingId) return;
    const prix = parseFloat(editForm.prix_ht);
    if (!editForm.designation || isNaN(prix)) return;
    updateProduit.mutate({ id: editingId, data: buildPayload(editForm) }, {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        toast({ title: "Produit modifié" });
      },
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteProduit.mutate({ id: deletingId }, {
      onSuccess: () => {
        invalidate();
        setDeletingId(null);
        toast({ title: "Produit supprimé" });
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogue</h1>
          <p className="text-muted-foreground mt-1">Matières, façonnages et services.</p>
        </div>
        <Button
          className="shadow-lg shadow-primary/20"
          onClick={() => { setCreateForm({ ...EMPTY_FORM, type_produit: typeFilter !== "tous" ? typeFilter : "matière" }); setIsCreateOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nouveau produit
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full sm:w-auto">
          <TabsList className="glass-panel h-auto">
            {TYPE_TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 bg-card/50 p-1 rounded-lg border w-full max-w-sm shrink-0">
          <Search className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
          <Input
            placeholder="Réf, nom, fournisseur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none bg-transparent h-8"
          />
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(8)].map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)
        ) : filteredProduits?.length === 0 ? (
          <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-card/20">
            Aucun produit dans cette catégorie.
          </div>
        ) : (
          filteredProduits?.map(produit => {
            const unite = uniteCalcToUnite(produit.unite_calcul, produit.unite);
            return (
              <Card
                key={produit.id}
                className={`glass-panel border-border/50 transition-all ${!produit.actif ? "opacity-50" : "hover:border-primary/30"}`}
              >
                <CardContent className="p-4">
                  <ProductImageArea produit={produit} onRefresh={invalidate} />

                  {/* Type + toggle */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeVariant(produit.type_produit)}`}>
                      {typeLabel(produit.type_produit)}
                    </span>
                    <Switch checked={produit.actif === 1} onCheckedChange={() => handleToggle(produit.id)} className="scale-90" />
                  </div>

                  {/* Reference + name */}
                  <div className="mb-2">
                    {produit.reference && (
                      <p className="text-[10px] text-muted-foreground/70 font-mono mb-0.5">{produit.reference}</p>
                    )}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{produit.designation}</h3>
                    {(produit.sous_categorie) && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/70">{produit.sous_categorie}</span>
                      </div>
                    )}
                  </div>

                  {/* Supplier pill */}
                  {produit.fournisseur && (
                    <div className="flex items-center gap-1 mb-3">
                      <Building2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                      <span className="text-[10px] text-muted-foreground/70 truncate">{produit.fournisseur}</span>
                    </div>
                  )}

                  {/* Price row */}
                  <div className="flex justify-between items-end pt-2 border-t border-border/30">
                    <div>
                      <span className="text-[10px] text-muted-foreground/60">{unite} · TVA {produit.taux_tva}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-accent">{formatCurrency(produit.prix_ht)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">HT</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/20">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs glass-panel" onClick={() => openEdit(produit)}>
                      <Pencil className="h-3 w-3 mr-1" /> Modifier
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30" onClick={() => { setDeletingId(produit.id); setDeletingName(produit.designation); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Create dialog ─────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="glass-panel max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter au catalogue</DialogTitle>
            <DialogDescription>Renseignez les informations du produit.</DialogDescription>
          </DialogHeader>
          <ProduitForm formData={createForm} setFormData={setCreateForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createProduit.isPending || !createForm.designation || !createForm.prix_ht}>
              {createProduit.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ───────────────────────────────────────── */}
      <Dialog open={editingId !== null} onOpenChange={open => !open && setEditingId(null)}>
        <DialogContent className="glass-panel max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
            <DialogDescription>Mettez à jour les informations.</DialogDescription>
          </DialogHeader>
          <ProduitForm formData={editForm} setFormData={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={updateProduit.isPending || !editForm.designation || !editForm.prix_ht}>
              {updateProduit.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────── */}
      <AlertDialog open={deletingId !== null} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingName}</strong> sera définitivement supprimé. Cette action est irréversible.
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
