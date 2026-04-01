import { useState } from "react";
import { 
  useListProduits, getListProduitsQueryKey,
  useCreateProduit, useToggleProduitActif 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { id: "tous", label: "Tous" },
  { id: "baguettes", label: "Baguettes" },
  { id: "verres", label: "Verres" },
  { id: "passe_partout", label: "Passe-partout" },
  { id: "quincaillerie", label: "Quincaillerie" },
  { id: "main_oeuvre", label: "Main d'œuvre" }
];

export default function Catalogue() {
  const [categorie, setCategorie] = useState("tous");
  const [search, setSearch] = useState("");
  
  const { data: produits, isLoading } = useListProduits(categorie !== "tous" ? { categorie } : {});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const toggleActif = useToggleProduitActif();
  // Form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    reference: "", designation: "", categorie: "baguettes", unite_calcul: "metre_lineaire", prix_ht: "", taux_tva: "20"
  });
  const createProduit = useCreateProduit();

  const filteredProduits = produits?.filter(p => 
    p.designation.toLowerCase().includes(search.toLowerCase()) || 
    (p.reference && p.reference.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggle = (id: number) => {
    toggleActif.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });
        toast({ title: "Statut mis à jour" });
      }
    });
  };

  const handleCreate = () => {
    const prix = parseFloat(formData.prix_ht);
    if (!formData.designation || isNaN(prix)) return;

    createProduit.mutate({
      data: {
        ...formData,
        prix_ht: prix,
        taux_tva: parseFloat(formData.taux_tva)
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProduitsQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Produit créé avec succès" });
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
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>Ajouter au catalogue</DialogTitle>
            </DialogHeader>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={createProduit.isPending || !formData.designation || !formData.prix_ht}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : filteredProduits?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card/30">
            Aucun produit dans cette catégorie.
          </div>
        ) : (
          filteredProduits?.map(produit => (
            <Card key={produit.id} className={`glass-panel border-border/50 transition-opacity ${!produit.actif ? "opacity-50 grayscale hover:grayscale-0" : ""}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Box className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      {produit.reference && <Badge variant="secondary" className="mb-1 text-[10px]">{produit.reference}</Badge>}
                      <h3 className="font-semibold text-foreground leading-tight line-clamp-2">{produit.designation}</h3>
                    </div>
                  </div>
                  <Switch checked={produit.actif === 1} onCheckedChange={() => handleToggle(produit.id)} />
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
