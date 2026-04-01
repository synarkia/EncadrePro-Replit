import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetFacture, getGetFactureQueryKey,
  useUpdateFactureStatut, useAddPaiement,
  useListProduits,
  useGetAtelier
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, CreditCard, Clock, FileText, Plus, Trash2, Save, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { factureStatutColors } from "./index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* WEB-TO-DESKTOP NOTE: For print in Electron, use BrowserWindow.webContents.print() or
   generate a PDF via webContents.printToPDF() and save to disk. */

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function saveFactureLignes(factureId: number, lignes: any[]) {
  const res = await fetch(`${BASE_URL}/api/factures/${factureId}/lignes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lignes }),
  });
  if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
  return res.json();
}

export default function FactureDetail() {
  const { id } = useParams<{ id: string }>();
  const factureId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: facture, isLoading } = useGetFacture(factureId, {
    query: { enabled: !!factureId, queryKey: getGetFactureQueryKey(factureId) }
  });
  const { data: produits } = useListProduits();
  const { data: atelier } = useGetAtelier();

  const updateStatut = useUpdateFactureStatut();
  const addPaiement = useAddPaiement();

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [montant, setMontant] = useState<string>("");
  const [mode, setMode] = useState<string>("virement");
  const [notes, setNotes] = useState<string>("");
  const [isSavingLignes, setIsSavingLignes] = useState(false);

  // Local editable lines for brouillon factures
  const [lignes, setLignes] = useState<any[]>([]);
  const initRef = useRef<number | null>(null);

  useEffect(() => {
    if (facture && initRef.current !== factureId) {
      initRef.current = factureId;
      setLignes(facture.lignes || []);
    }
  }, [facture, factureId]);

  const isEditable = facture?.statut === "brouillon";

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

  const handleSaveLignes = async () => {
    setIsSavingLignes(true);
    try {
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
      await saveFactureLignes(factureId, payload);
      queryClient.invalidateQueries({ queryKey: getGetFactureQueryKey(factureId) });
      initRef.current = null; // allow re-init from fresh data
      toast({ title: "Lignes enregistrées", description: "La facture a été mise à jour." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les lignes.", variant: "destructive" });
    } finally {
      setIsSavingLignes(false);
    }
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

  const handleChangeStatut = (newStatut: string) => {
    updateStatut.mutate({ id: factureId, data: { statut: newStatut } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFactureQueryKey(factureId) });
        toast({ title: "Statut mis à jour" });
      }
    });
  };

  const handleAddPayment = () => {
    const val = parseFloat(montant);
    if (isNaN(val) || val <= 0) return;

    addPaiement.mutate({
      id: factureId,
      data: {
        montant: val,
        date_paiement: new Date().toISOString(),
        mode_paiement: mode,
        notes: notes
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFactureQueryKey(factureId) });
        setIsPaymentOpen(false);
        setMontant("");
        setNotes("");
        toast({ title: "Paiement ajouté", description: `${formatCurrency(val)} ajouté avec succès.` });
      }
    });
  };

  const handlePrint = useCallback(() => { window.print(); }, []);

  if (isLoading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-8" /><Skeleton className="h-[500px] w-full" /></div>;
  if (!facture) return <div className="p-8">Facture introuvable</div>;

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
            <h1 className="text-3xl font-bold text-gray-900">FACTURE</h1>
            <p className="text-lg font-semibold text-gray-700 mt-1">{facture.numero}</p>
            <p className="text-sm text-gray-500 mt-1">Émise le {formatDate(facture.date_creation)}</p>
            {facture.date_echeance && <p className="text-sm text-gray-500">Échéance le {formatDate(facture.date_echeance)}</p>}
          </div>
        </div>

        <div className="print-client-box">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client</p>
          <p className="font-bold text-gray-900 text-base">{facture.client_prenom} {facture.client_nom}</p>
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
            {facture.lignes.map((l: any, i: number) => (
              <tr key={i}>
                <td>{l.designation}</td>
                <td>{l.unite_calcul?.replace('_', ' ')}</td>
                <td>{l.largeur_m || l.hauteur_m ? `${l.largeur_m||0}m × ${l.hauteur_m||0}m` : '-'}</td>
                <td className="text-right">{Number(l.quantite_calculee ?? l.quantite).toFixed(2)}</td>
                <td className="text-right">{formatCurrency(l.prix_unitaire_ht)}</td>
                <td className="text-right">{l.taux_tva}%</td>
                <td className="text-right font-semibold">{formatCurrency(l.total_ht)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-totals">
          <table>
            <tbody>
              <tr><td>Sous-total HT</td><td>{formatCurrency(facture.sous_total_ht)}</td></tr>
              {facture.total_tva_10 > 0 && <tr><td>TVA 10%</td><td>{formatCurrency(facture.total_tva_10)}</td></tr>}
              {facture.total_tva_20 > 0 && <tr><td>TVA 20%</td><td>{formatCurrency(facture.total_tva_20)}</td></tr>}
              <tr className="print-total-row"><td>Total TTC</td><td>{formatCurrency(facture.total_ttc)}</td></tr>
              {facture.total_paye > 0 && <tr><td className="text-green-700">Déjà réglé</td><td className="text-green-700">- {formatCurrency(facture.total_paye)}</td></tr>}
              {facture.solde_restant > 0.01 && <tr className="print-total-row"><td>Solde restant dû</td><td>{formatCurrency(facture.solde_restant)}</td></tr>}
            </tbody>
          </table>
        </div>

        {atelier?.conditions_facture && (
          <div className="print-conditions">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conditions de règlement</p>
            <p className="text-xs text-gray-600">{atelier.conditions_facture}</p>
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
            <Link href="/factures">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Facture {facture.numero}</h1>
                <Badge className={factureStatutColors[facture.statut] || ""}>
                  {facture.statut.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                <Link href={`/clients/${facture.client_id}`} className="hover:text-primary hover:underline transition-colors font-medium">
                  {facture.client_prenom} {facture.client_nom}
                </Link>
                {facture.date_echeance && <span> • Échéance {formatDate(facture.date_echeance)}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="glass-panel" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimer
            </Button>
            {facture.statut === 'brouillon' && (
              <Button variant="outline" className="glass-panel" onClick={() => handleChangeStatut('envoyee')}>
                Marquer envoyée
              </Button>
            )}
            {facture.devis_id && (
              <Link href={`/devis/${facture.devis_id}`}>
                <Button variant="outline" className="glass-panel border-muted-foreground/30 text-muted-foreground hover:text-foreground">
                  <FileText className="mr-2 h-4 w-4" /> Voir le devis source
                </Button>
              </Link>
            )}
            {(facture.statut === 'envoyee' || facture.statut === 'partiellement_payee') && (
              <Dialog open={isPaymentOpen} onOpenChange={(open) => {
                setIsPaymentOpen(open);
                if (open) setMontant(facture.solde_restant.toString());
              }}>
                <DialogTrigger asChild>
                  <Button className="shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-500 text-white">
                    <CreditCard className="mr-2 h-4 w-4" /> Ajouter un paiement
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel">
                  <DialogHeader>
                    <DialogTitle>Enregistrer un paiement</DialogTitle>
                    <DialogDescription>Saisissez le montant et le mode de règlement.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-muted/20 rounded-lg flex justify-between items-center border border-border/50">
                      <span className="text-sm font-medium">Reste à payer</span>
                      <span className="text-xl font-bold text-accent">{formatCurrency(facture.solde_restant)}</span>
                    </div>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Montant (€)</label>
                        <Input type="number" step="0.01" max={facture.solde_restant} value={montant} onChange={e => setMontant(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Mode de paiement</label>
                        <Select value={mode} onValueChange={setMode}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="virement">Virement</SelectItem>
                            <SelectItem value="carte">Carte bancaire</SelectItem>
                            <SelectItem value="cheque">Chèque</SelectItem>
                            <SelectItem value="especes">Espèces</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Notes (optionnel)</label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Réf. virement..." />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Annuler</Button>
                    <Button onClick={handleAddPayment} disabled={addPaiement.isPending}>
                      {addPaiement.isPending ? "Enregistrement..." : "Valider le paiement"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass-panel border-border/50">
              <CardHeader className="border-b border-border/50 bg-card/30 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  {isEditable ? "Éditer les lignes" : "Détail de la facturation"}
                </CardTitle>
                {isEditable && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={addLine} className="bg-secondary/20 text-secondary hover:bg-secondary/30">
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                    <Button size="sm" onClick={handleSaveLignes} disabled={isSavingLignes}>
                      <Save className="h-4 w-4 mr-1" /> {isSavingLignes ? "..." : "Sauvegarder"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left font-medium">Désignation</th>
                        {isEditable && <th className="p-3 text-left font-medium">Unité</th>}
                        {isEditable && <th className="p-3 text-center font-medium">Dim (L × H)</th>}
                        <th className="p-3 text-center font-medium">Qté calc.</th>
                        <th className="p-3 text-right font-medium">PU HT</th>
                        <th className="p-3 text-right font-medium">TVA</th>
                        <th className="p-3 text-right font-medium">Total HT</th>
                        {isEditable && <th className="p-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {lignes.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                          {isEditable ? 'Aucune ligne. Cliquez sur "Ajouter" pour commencer.' : 'Aucune ligne de facturation.'}
                        </td></tr>
                      ) : (
                        lignes.map((ligne, index) => {
                          let dispQ = Number(ligne.quantite) || 0;
                          if (ligne.unite_calcul === 'metre_lineaire') {
                            dispQ = ((Number(ligne.largeur_m)||0) + (Number(ligne.hauteur_m)||0)) * 2 * dispQ;
                          } else if (ligne.unite_calcul === 'metre_carre') {
                            dispQ = (Number(ligne.largeur_m)||0) * (Number(ligne.hauteur_m)||0) * dispQ;
                          }
                          const totalHt = isEditable
                            ? dispQ * (Number(ligne.prix_unitaire_ht)||0)
                            : (ligne.total_ht ?? dispQ * (Number(ligne.prix_unitaire_ht)||0));

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
                                    <Input value={ligne.designation} onChange={e => updateLine(index, 'designation', e.target.value)} className="h-8 text-xs bg-background/50 border-border/50" placeholder="Description libre..." />
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-medium">{ligne.designation}</span>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {ligne.unite_calcul?.replace('_', ' ')}
                                      {(ligne.largeur_m || ligne.hauteur_m) && ` (${ligne.largeur_m||0}m × ${ligne.hauteur_m||0}m)`}
                                    </div>
                                  </div>
                                )}
                              </td>
                              {isEditable && (
                                <td className="p-2">
                                  <Select value={ligne.unite_calcul} onValueChange={(v) => updateLine(index, 'unite_calcul', v)}>
                                    <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unitaire">Unité</SelectItem>
                                      <SelectItem value="metre_lineaire">Mètre linéaire</SelectItem>
                                      <SelectItem value="metre_carre">Mètre carré</SelectItem>
                                      <SelectItem value="heure">Heure</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              )}
                              {isEditable && (
                                <td className="p-2 text-center">
                                  {(ligne.unite_calcul === 'metre_lineaire' || ligne.unite_calcul === 'metre_carre') ? (
                                    <div className="flex items-center gap-1 justify-center">
                                      <Input type="number" step="0.01" value={ligne.largeur_m || ''} onChange={e => updateLine(index, 'largeur_m', e.target.value)} className="h-8 w-14 text-xs text-center p-1 bg-background/50 border-border/50" placeholder="L" />
                                      <span className="text-muted-foreground text-xs">×</span>
                                      <Input type="number" step="0.01" value={ligne.hauteur_m || ''} onChange={e => updateLine(index, 'hauteur_m', e.target.value)} className="h-8 w-14 text-xs text-center p-1 bg-background/50 border-border/50" placeholder="H" />
                                    </div>
                                  ) : <span className="text-xs text-muted-foreground">-</span>}
                                </td>
                              )}
                              <td className="p-2 text-center">
                                {isEditable ? (
                                  <Input type="number" min="1" value={ligne.quantite} onChange={e => updateLine(index, 'quantite', e.target.value)} className="h-8 w-16 mx-auto text-center bg-background/50 border-border/50" />
                                ) : (
                                  <span>{ligne.quantite_calculee ?? ligne.quantite}</span>
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
                  {isEditable ? (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total HT</span><span className="font-medium">{formatCurrency(previewTotals.ht)}</span></div>
                      {previewTotals.tva10 > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA 10%</span><span>{formatCurrency(previewTotals.tva10)}</span></div>}
                      {previewTotals.tva20 > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA 20%</span><span>{formatCurrency(previewTotals.tva20)}</span></div>}
                      <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                        <span className="font-bold text-lg">Total TTC</span>
                        <span className="font-bold text-2xl text-primary">{formatCurrency(previewTotals.ttc)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total HT</span><span className="font-medium">{formatCurrency(facture.sous_total_ht)}</span></div>
                      {facture.total_tva_10 > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA 10%</span><span>{formatCurrency(facture.total_tva_10)}</span></div>}
                      {facture.total_tva_20 > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA 20%</span><span>{formatCurrency(facture.total_tva_20)}</span></div>}
                      <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                        <span className="font-bold text-lg">Total TTC</span>
                        <span className="font-bold text-2xl text-primary">{formatCurrency(facture.total_ttc)}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="glass-panel">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> État des paiements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Total payé</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(facture.total_paye)}</p>
                  </div>
                  <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Reste à payer</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(facture.solde_restant)}</p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-3">Historique des paiements</h4>
                  {facture.paiements.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>
                  ) : (
                    <div className="space-y-3">
                      {facture.paiements.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 rounded bg-muted/10 border border-border/30">
                          <div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">+{formatCurrency(p.montant)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDateTime(p.date_paiement)} • {p.mode_paiement}</p>
                            {p.notes && <p className="text-[10px] text-muted-foreground">{p.notes}</p>}
                          </div>
                          <CheckCircle className="h-4 w-4 text-green-500/70" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
