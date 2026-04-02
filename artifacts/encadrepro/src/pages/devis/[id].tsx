import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetDevis, getGetDevisQueryKey,
  useSaveDevisLignes, useUpdateDevisStatut,
  useListProduits,
  useConvertDevisToFacture,
  useGetAtelier,
  useDeleteDevis,
  getListDevisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Save, ArrowRightLeft, FileCheck, Printer, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { statutColors } from "./index";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/* WEB-TO-DESKTOP NOTE: For print in Electron, use BrowserWindow.webContents.print() or
   generate a PDF via webContents.printToPDF() and save to disk. */

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
  const { data: atelier } = useGetAtelier();

  const saveLignes = useSaveDevisLignes();
  const updateStatut = useUpdateDevisStatut();
  const convertFacture = useConvertDevisToFacture();
  const deleteDevis = useDeleteDevis();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      taux_tva: 20,
      ordre: lignes.length
    }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLignes = [...lignes];
    newLignes[index] = { ...newLignes[index], [field]: value };
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

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const openEdit = () => {
    setEditNotes(devis?.notes ?? "");
    setEditDate(devis?.date_validite ? devis.date_validite.slice(0, 10) : "");
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    setIsSavingEdit(true);
    try {
      await fetch(`${BASE_URL}/api/devis/${devisId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editNotes, date_validite: editDate || null }),
      });
      await queryClient.invalidateQueries({ queryKey: getGetDevisQueryKey(devisId) });
      setIsEditOpen(false);
      toast({ title: "Devis mis à jour" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = () => {
    deleteDevis.mutate({ id: devisId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
        toast({ title: "Devis supprimé" });
        setLocation("/devis");
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" }),
    });
  };

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
    <>
      {/* ── Print-only document ───────────────────────────────── */}
      <div className="print-document hidden print:block">
        <div className="print-header">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{atelier?.nom || "Atelier"}</h2>
            {atelier?.adresse && <p className="text-sm text-gray-600">{atelier.adresse}</p>}
            {atelier?.code_postal && <p className="text-sm text-gray-600">{atelier.code_postal} {atelier.ville}</p>}
            {atelier?.telephone && <p className="text-sm text-gray-600">Tél. {atelier.telephone}</p>}
            {atelier?.email && <p className="text-sm text-gray-600">{atelier.email}</p>}
            {atelier?.siret && <p className="text-xs text-gray-500 mt-1">SIRET : {atelier.siret}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold text-gray-900">DEVIS</h1>
            <p className="text-lg font-semibold text-gray-700 mt-1">{devis.numero}</p>
            <p className="text-sm text-gray-500 mt-1">Émis le {formatDate(devis.date_creation)}</p>
            {devis.date_validite && <p className="text-sm text-gray-500">Valable jusqu'au {formatDate(devis.date_validite)}</p>}
          </div>
        </div>

        <div className="print-client-box">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client</p>
          <p className="font-bold text-gray-900 text-base">{devis.client_prenom} {devis.client_nom}</p>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Désignation</th>
              <th>Unité</th>
              <th>Dimensions</th>
              <th className="text-right">Qté</th>
              <th className="text-right">PU HT</th>
              <th className="text-right">TVA</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(devis.lignes || []).map((l: any, i: number) => {
              let q = Number(l.quantite) || 0;
              if (l.unite_calcul === 'metre_lineaire') q = ((Number(l.largeur_m)||0) + (Number(l.hauteur_m)||0)) * 2 * q;
              else if (l.unite_calcul === 'metre_carre') q = (Number(l.largeur_m)||0) * (Number(l.hauteur_m)||0) * q;
              const totalHt = q * (Number(l.prix_unitaire_ht)||0);
              return (
                <tr key={i}>
                  <td>{l.designation}</td>
                  <td>{l.unite_calcul?.replace('_', ' ')}</td>
                  <td>{l.largeur_m || l.hauteur_m ? `${l.largeur_m||0}m × ${l.hauteur_m||0}m` : '-'}</td>
                  <td className="text-right">{q.toFixed(2)}</td>
                  <td className="text-right">{formatCurrency(l.prix_unitaire_ht)}</td>
                  <td className="text-right">{l.taux_tva}%</td>
                  <td className="text-right font-semibold">{formatCurrency(totalHt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="print-totals">
          <table>
            <tbody>
              <tr><td>Sous-total HT</td><td>{formatCurrency(devis.total_ht ?? previewTotals.ht)}</td></tr>
              {(devis.total_tva_10 ?? 0) > 0 && <tr><td>TVA 10%</td><td>{formatCurrency(devis.total_tva_10)}</td></tr>}
              {(devis.total_tva_20 ?? 0) > 0 && <tr><td>TVA 20%</td><td>{formatCurrency(devis.total_tva_20)}</td></tr>}
              <tr className="print-total-row"><td>Total TTC</td><td>{formatCurrency(devis.total_ttc ?? previewTotals.ttc)}</td></tr>
            </tbody>
          </table>
        </div>

        {atelier?.conditions_devis && (
          <div className="print-conditions">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conditions</p>
            <p className="text-xs text-gray-600">{atelier.conditions_devis}</p>
          </div>
        )}
        <div className="print-footer">
          {atelier?.siret && <span>SIRET : {atelier.siret}</span>}
          {atelier?.tva_intracommunautaire && <span>TVA Intracomm. : {atelier.tva_intracommunautaire}</span>}
        </div>
      </div>

      {/* ── Screen view ───────────────────────────────────────── */}
      <div className="space-y-6 pb-20 animate-in fade-in duration-300 print:hidden">
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
            <Button variant="outline" size="sm" className="glass-panel" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimer
            </Button>
            <Button variant="outline" size="sm" className="glass-panel" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Modifier
            </Button>
            <Button variant="outline" size="sm" className="glass-panel text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
            {devis.statut === 'brouillon' && (
              <Button variant="outline" className="glass-panel" onClick={() => handleChangeStatut('envoye')}>
                Marquer envoyé
              </Button>
            )}
            {devis.statut === 'envoye' && (
              <>
                <Button variant="outline" className="glass-panel text-green-600 dark:text-green-400 hover:text-green-500" onClick={() => handleChangeStatut('accepte')}>
                  Marquer accepté
                </Button>
                <Button variant="outline" className="glass-panel text-red-600 dark:text-red-400 hover:text-red-500" onClick={() => handleChangeStatut('refuse')}>
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
                    <th className="p-3 text-center font-medium">Dim (L × H)</th>
                    <th className="p-3 text-center font-medium">Qté</th>
                    <th className="p-3 text-right font-medium">PU HT</th>
                    <th className="p-3 text-right font-medium">TVA</th>
                    <th className="p-3 text-right font-medium">Total HT</th>
                    {isEditable && <th className="p-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {lignes.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune ligne. Cliquez sur "Ajouter" pour commencer.</td></tr>
                  ) : (
                    lignes.map((ligne, index) => {
                      let dispQ = Number(ligne.quantite) || 0;
                      if (ligne.unite_calcul === 'metre_lineaire') {
                        dispQ = ((Number(ligne.largeur_m)||0) + (Number(ligne.hauteur_m)||0)) * 2 * dispQ;
                      } else if (ligne.unite_calcul === 'metre_carre') {
                        dispQ = (Number(ligne.largeur_m)||0) * (Number(ligne.hauteur_m)||0) * dispQ;
                      }
                      const totalHt = dispQ * (Number(ligne.prix_unitaire_ht)||0);

                      return (
                        <tr key={ligne.id || index} className="hover:bg-muted/10 transition-colors">
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
                                <span className="text-muted-foreground text-xs">×</span>
                                <Input type="number" step="0.01" value={ligne.hauteur_m || ''} onChange={e => updateLine(index, 'hauteur_m', e.target.value)} className="h-8 w-16 text-xs text-center p-1 bg-background/50 border-border/50" placeholder="H" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {ligne.largeur_m || ligne.hauteur_m ? `${ligne.largeur_m || 0}m × ${ligne.hauteur_m || 0}m` : '-'}
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

      {/* ── Edit header dialog ──────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>Modifier le devis</DialogTitle>
            <DialogDescription>Modifiez la date de validité et les notes internes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de validité</label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes internes</label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Observations, conditions particulières..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit}>
              {isSavingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis <strong>{devis.numero}</strong> et toutes ses lignes seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDevis.isPending}
            >
              {deleteDevis.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
