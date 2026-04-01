import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetFacture, getGetFactureQueryKey,
  useUpdateFactureStatut, useAddPaiement
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, CreditCard, Clock, FileText } from "lucide-react";
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
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FactureDetail() {
  const { id } = useParams<{ id: string }>();
  const factureId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: facture, isLoading } = useGetFacture(factureId, {
    query: { enabled: !!factureId, queryKey: getGetFactureQueryKey(factureId) }
  });

  const updateStatut = useUpdateFactureStatut();
  const addPaiement = useAddPaiement();

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [montant, setMontant] = useState<string>("");
  const [mode, setMode] = useState<string>("virement");
  const [notes, setNotes] = useState<string>("");

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
        toast({ title: "Paiement ajouté", description: `${formatCurrency(val)} ajouté avec succès.` });
      }
    });
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-8 w-64 mb-8" /><Skeleton className="h-[500px] w-full" /></div>;
  if (!facture) return <div className="p-8">Facture introuvable</div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
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
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
              if(open) setMontant(facture.solde_restant.toString());
            }}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-500 text-white">
                  <CreditCard className="mr-2 h-4 w-4" /> Ajouter un paiement
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel">
                <DialogHeader>
                  <DialogTitle>Enregistrer un paiement</DialogTitle>
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
                        <SelectTrigger><SelectValue/></SelectTrigger>
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
            <CardHeader className="border-b border-border/50 bg-card/30">
              <CardTitle className="text-lg">Détail de la facturation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Désignation</th>
                      <th className="p-3 text-center font-medium">Qté calc.</th>
                      <th className="p-3 text-right font-medium">PU HT</th>
                      <th className="p-3 text-right font-medium">TVA</th>
                      <th className="p-3 text-right font-medium">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {facture.lignes.map((ligne, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <span className="font-medium">{ligne.designation}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {ligne.unite_calcul.replace('_', ' ')}
                            {(ligne.largeur_m || ligne.hauteur_m) && ` (${ligne.largeur_m||0}m x ${ligne.hauteur_m||0}m)`}
                          </div>
                        </td>
                        <td className="p-3 text-center">{ligne.quantite_calculee}</td>
                        <td className="p-3 text-right">{formatCurrency(ligne.prix_unitaire_ht)}</td>
                        <td className="p-3 text-right">{ligne.taux_tva}%</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(ligne.total_ht)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-6 border-t border-border/50">
              <div className="ml-auto w-full max-w-sm space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span className="font-medium">{formatCurrency(facture.sous_total_ht)}</span>
                </div>
                {facture.total_tva_10 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA 10%</span>
                    <span>{formatCurrency(facture.total_tva_10)}</span>
                  </div>
                )}
                {facture.total_tva_20 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA 20%</span>
                    <span>{formatCurrency(facture.total_tva_20)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                  <span className="font-bold text-lg">Total TTC</span>
                  <span className="font-bold text-2xl text-primary">{formatCurrency(facture.total_ttc)}</span>
                </div>
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
                  <p className="text-lg font-bold text-green-500">{formatCurrency(facture.total_paye)}</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Reste à payer</p>
                  <p className="text-lg font-bold text-orange-500">{formatCurrency(facture.solde_restant)}</p>
                </div>
              </div>
              
              <div className="pt-4">
                <h4 className="text-sm font-medium mb-3">Historique des paiements</h4>
                {facture.paiements.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>
                ) : (
                  <div className="space-y-3">
                    {facture.paiements.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-green-400">+{formatCurrency(p.montant)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateTime(p.date_paiement)} • {p.mode_paiement}</p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500/50" />
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
  );
}
