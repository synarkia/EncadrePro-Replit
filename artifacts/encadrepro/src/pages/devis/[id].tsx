import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetDevis, getGetDevisQueryKey,
  useSaveDevisLignes, useUpdateDevisStatut,
  useListProduits,
  useConvertDevisToFacture
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Save, ArrowRightLeft, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { statutColors } from "./index";

export default function DevisDetail() {
  const { id } = useParams<{ id: string }>();
  const devisId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: devis, isLoading } = useGetDevis(devisId, {
    query: { enabled: !!devisId, queryKey: getGetDevisQueryKey(devisId) }
  });
  const { data: produits } = useListProduits();

  const saveLignes = useSaveDevisLignes();
  const updateStatut = useUpdateDevisStatut();
  const convertFacture = useConvertDevisToFacture();

  // Local state for lines to allow fast editing before save
  const [lignes, setLignes] = useState<any[]>([]);
  const initRef = useRef<number | null>(null);

  useEffect(() => {
    if (devis && initRef.current !== devisId) {
      initRef.current = devisId;
      setLignes(devis.lignes || []);
    }
  }, [devis, devisId]);

  const addLine = () => {
    setLignes([...lignes, {
      id: `temp-${Date.now()}`,
      produit_id: null,
      designation: "",
      unite_calcul: "unitaire",
      largeur_m: null,
      hauteur_m: null,
      quantite: 1,
      prix_unitaire_ht: 0,
      taux_tva: devis?.total_tva_20 ? 20 : 20, // default 20
      ordre: lignes.length
    }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLignes = [...lignes];
    newLignes[index] = { ...newLignes[index], [field]: value };
    
    // Auto fill from product if selected
    if (field === 'produit_id' && value) {
      const prod = produits?.find(p => p.id.toString() === value);
      if (prod) {
        newLignes[index].designation = prod.designation;
        newLignes[index].unite_calcul = prod.unite_calcul;
        newLignes[index].prix_unitaire_ht = prod.prix_ht;
        newLignes[index].taux_tva = prod.taux_tva;
      }
    }
    setLignes(newLignes);
  };

  const removeLine = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Format payload
    const payload = lignes.map((l, i) => ({
      produit_id: l.produit_id ? parseInt(l.produit_id) : null,
      designation: l.designation,
      unite_calcul: l.unite_calcul,
      largeur_m: l.largeur_m ? parseFloat(l.largeur_m) : null,
      hauteur_m: l.hauteur_m ? parseFloat(l.hauteur_m) : null,
      quantite: parseFloat(l.quantite),
      prix_unitaire_ht: parseFloat(l.prix_unitaire_ht),
      taux_tva: parseFloat(l.taux_tva),
      ordre: i
    }));

    saveLignes.mutate({ id: devisId, data: { lignes: payload } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDevisQueryKey(devisId) });
        toast({ title: "Lignes enregistrées", description: "Le devis a été mis à jour." });
      }
    });
  };

  const handleChangeStatut = (newStatut: string) => {
    updateStatut.mutate({ id: devisId, data: { statut: newStatut } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDevisQueryKey(devisId) });
        toast({ title: "Statut mis à jour" });
      }
    });
  };

  const handleConvert = () => {
    convertFacture.mutate({ id: devisId }, {
      onSuccess: (facture) => {
        toast({ title: "Devis converti", description: "Facture créée avec succès." });
        setLocation(`/factures/${facture.id}`);
      }
    });
  };

  // Preview calculations
  const previewTotals = useMemo(() => {
    let ht = 0, tva10 = 0, tva20 = 0;
    lignes.forEach(l => {
      let q = Number(l.quantite) || 0;
      if (l.unite_calcul === 'metre_lineaire') {
        const w = Number(l.largeur_m) || 0;
        const h = Number(l.hauteur_m) || 0;
        q = (w + h) * 2 * q;
      } else if (l.unite_calcul === 'metre_carre') {
        const w = Number(l.largeur_m) || 0;
        const h = Number(l.hauteur_m) || 0;
        q = w * h * q;
      }
      
      const lineHt = q * (Number(l.prix_unitaire_ht) || 0);
      ht += lineHt;
      if (Number(l.taux_tva) === 10) tva10 += lineHt * 0.1;
      else if (Number(l.taux_tva) === 20) tva20 += lineHt * 0.2;
    });
    return { ht, tva10, tva20, ttc: ht + tva10 + tva20 };
  }, [lignes]);

  if (isLoading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-8" /><Skeleton className="h-[500px] w-full" /></div>;
  if (!devis) return <div className="p-8">Devis introuvable</div>;

  const isEditable = ['brouillon', 'envoye'].includes(devis.statut);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/devis">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Devis {devis.numero}</h1>
              <Badge className={statutColors[devis.statut] || ""}>
                {devis.statut.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              <Link href={`/clients/${devis.client_id}`} className="hover:text-primary hover:underline transition-colors font-medium">
                {devis.client_prenom} {devis.client_nom}
              </Link>
              {" • "}Créé le {formatDate(devis.date_creation)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {devis.statut === 'brouillon' && (
            <Button variant="outline" className="glass-panel" onClick={() => handleChangeStatut('envoye')}>
              Marquer envoyé
            </Button>
          )}
          {devis.statut === 'envoye' && (
            <>
              <Button variant="outline" className="glass-panel text-green-500 hover:text-green-400" onClick={() => handleChangeStatut('accepte')}>
                Marquer accepté
              </Button>
              <Button variant="outline" className="glass-panel text-red-500 hover:text-red-400" onClick={() => handleChangeStatut('refuse')}>
                Marquer refusé
              </Button>
            </>
          )}
          {devis.statut === 'accepte' && (
            <Button className="shadow-lg shadow-violet-500/20 bg-violet-600 hover:bg-violet-500 text-white" onClick={handleConvert} disabled={convertFacture.isPending}>
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Convertir en facture
            </Button>
          )}
          {devis.facture_id && (
             <Link href={`/factures/${devis.facture_id}`}>
               <Button variant="outline" className="glass-panel border-primary/50 text-primary">
                 <FileCheck className="mr-2 h-4 w-4" /> Voir la facture
               </Button>
             </Link>
          )}
        </div>
      </div>

      <Card className="glass-panel border-border/50">
        <CardHeader className="border-b border-border/50 bg-card/30 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Lignes du devis</CardTitle>
          {isEditable && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={addLine} className="bg-secondary/20 text-secondary hover:bg-secondary/30">
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveLignes.isPending}>
                <Save className="h-4 w-4 mr-1" /> {saveLignes.isPending ? "..." : "Sauvegarder"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-medium w-1/4">Désignation</th>
                  <th className="p-3 text-left font-medium">Unité</th>
                  <th className="p-3 text-center font-medium">Dim (L x H)</th>
                  <th className="p-3 text-center font-medium">Qté</th>
                  <th className="p-3 text-right font-medium">PU HT</th>
                  <th className="p-3 text-right font-medium">TVA</th>
                  <th className="p-3 text-right font-medium">Total HT</th>
                  {isEditable && <th className="p-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {lignes.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune ligne.</td></tr>
                ) : (
                  lignes.map((ligne, index) => {
                    // Calc display qte
                    let dispQ = Number(ligne.quantite) || 0;
                    if (ligne.unite_calcul === 'metre_lineaire') {
                      dispQ = ((Number(ligne.largeur_m)||0) + (Number(ligne.hauteur_m)||0)) * 2 * dispQ;
                    } else if (ligne.unite_calcul === 'metre_carre') {
                      dispQ = (Number(ligne.largeur_m)||0) * (Number(ligne.hauteur_m)||0) * dispQ;
                    }
                    const totalHt = dispQ * (Number(ligne.prix_unitaire_ht)||0);

                    return (
                      <tr key={ligne.id || index} className="hover:bg-white/5 transition-colors">
                        <td className="p-2">
                          {isEditable ? (
                            <div className="space-y-2">
                              <Select value={ligne.produit_id?.toString() || ""} onValueChange={(v) => updateLine(index, 'produit_id', v)}>
                                <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50"><SelectValue placeholder="Produit..." /></SelectTrigger>
                                <SelectContent>
                                  {produits?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.reference ? `[${p.reference}] ` : ''}{p.designation}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input 
                                value={ligne.designation} 
                                onChange={e => updateLine(index, 'designation', e.target.value)}
                                className="h-8 text-xs bg-background/50 border-border/50" placeholder="Description libre..."
                              />
                            </div>
                          ) : (
                            <span className="font-medium">{ligne.designation}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {isEditable ? (
                            <Select value={ligne.unite_calcul} onValueChange={(v) => updateLine(index, 'unite_calcul', v)}>
                              <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50"><SelectValue/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unitaire">Unité</SelectItem>
                                <SelectItem value="metre_lineaire">Mètre linéaire</SelectItem>
                                <SelectItem value="metre_carre">Mètre carré</SelectItem>
                                <SelectItem value="heure">Heure</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{ligne.unite_calcul.replace('_', ' ')}</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {isEditable && (ligne.unite_calcul === 'metre_lineaire' || ligne.unite_calcul === 'metre_carre') ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Input type="number" step="0.01" value={ligne.largeur_m || ''} onChange={e => updateLine(index, 'largeur_m', e.target.value)} className="h-8 w-16 text-xs text-center p-1 bg-background/50 border-border/50" placeholder="L" />
                              <span className="text-muted-foreground text-xs">x</span>
                              <Input type="number" step="0.01" value={ligne.hauteur_m || ''} onChange={e => updateLine(index, 'hauteur_m', e.target.value)} className="h-8 w-16 text-xs text-center p-1 bg-background/50 border-border/50" placeholder="H" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {ligne.largeur_m || ligne.hauteur_m ? `${ligne.largeur_m || 0}m x ${ligne.hauteur_m || 0}m` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {isEditable ? (
                            <Input type="number" min="1" value={ligne.quantite} onChange={e => updateLine(index, 'quantite', e.target.value)} className="h-8 w-16 mx-auto text-center bg-background/50 border-border/50" />
                          ) : (
                            <span>{ligne.quantite}</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {isEditable ? (
                            <Input type="number" step="0.01" value={ligne.prix_unitaire_ht} onChange={e => updateLine(index, 'prix_unitaire_ht', e.target.value)} className="h-8 w-20 ml-auto text-right bg-background/50 border-border/50" />
                          ) : (
                            <span>{formatCurrency(ligne.prix_unitaire_ht)}</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {isEditable ? (
                            <Select value={ligne.taux_tva.toString()} onValueChange={(v) => updateLine(index, 'taux_tva', v)}>
                              <SelectTrigger className="h-8 w-16 ml-auto text-xs bg-background/50 border-border/50"><SelectValue/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="20">20%</SelectItem>
                                <SelectItem value="10">10%</SelectItem>
                                <SelectItem value="5.5">5.5%</SelectItem>
                                <SelectItem value="0">0%</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{ligne.taux_tva}%</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-medium text-accent">
                          {formatCurrency(totalHt)}
                        </td>
                        {isEditable && (
                          <td className="p-2 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeLine(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 border-t border-border/50">
          <div className="ml-auto w-full max-w-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="font-medium">{formatCurrency(previewTotals.ht)}</span>
            </div>
            {previewTotals.tva10 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA 10%</span>
                <span>{formatCurrency(previewTotals.tva10)}</span>
              </div>
            )}
            {previewTotals.tva20 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA 20%</span>
                <span>{formatCurrency(previewTotals.tva20)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-border/50 flex justify-between items-center">
              <span className="font-bold text-lg">Total TTC</span>
              <span className="font-bold text-2xl text-primary">{formatCurrency(previewTotals.ttc)}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
