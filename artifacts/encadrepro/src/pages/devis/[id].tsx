import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetDevis, getGetDevisQueryKey,
  useSaveDevisLignes, useUpdateDevisStatut,
  useConvertDevisToFacture,
  useGetAtelier,
  useDeleteDevis,
  getListDevisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, ArrowRightLeft, FileCheck, Printer, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { statutColors } from "./index";
import { QuoteLineCard, type QuoteLine } from "@/components/QuoteLineCard";
import { QuickAddProductModal } from "@/components/QuickAddProductModal";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcQ(unite: string, widthCm: number, heightCm: number, qte: number): number {
  const wM = widthCm / 100;
  const hM = heightCm / 100;
  if (unite === "ml" || unite === "metre_lineaire") return (wM + hM) * 2 * qte;
  if (unite === "m²" || unite === "metre_carre") return wM * hM * qte;
  return qte;
}

function newEmptyLine(ordre: number): QuoteLine {
  return {
    id: `temp-${Date.now()}`,
    produit_id: null,
    designation: "",
    unite_calcul: "pièce",
    width_cm: null,
    height_cm: null,
    largeur_m: null,
    hauteur_m: null,
    quantite: 1,
    prix_unitaire_ht: 0,
    taux_tva: 20,
    faconnage: [],
    service: [],
  };
  void ordre;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DevisDetail() {
  const { id } = useParams<{ id: string }>();
  const devisId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: devis, isLoading } = useGetDevis(devisId, {
    query: { enabled: !!devisId, queryKey: getGetDevisQueryKey(devisId) }
  });
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [lignes, setLignes] = useState<QuoteLine[]>([]);
  const initRef = useRef<number | null>(null);

  useEffect(() => {
    if (devis && initRef.current !== devisId) {
      initRef.current = devisId;
      setLignes((devis.lignes ?? []).map(l => ({
        id: l.id,
        produit_id: l.produit_id ?? null,
        designation: l.designation,
        unite_calcul: l.unite_calcul,
        width_cm: l.width_cm ?? (l.largeur_m != null ? l.largeur_m * 100 : null),
        height_cm: l.height_cm ?? (l.hauteur_m != null ? l.hauteur_m * 100 : null),
        largeur_m: l.largeur_m ?? null,
        hauteur_m: l.hauteur_m ?? null,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        taux_tva: l.taux_tva,
        faconnage: (l.faconnage ?? []).map(f => ({
          id: f.id,
          produit_id: f.produit_id ?? null,
          designation: f.designation,
          quantite: f.quantite,
          prix_unitaire_ht: f.prix_unitaire_ht,
          taux_tva: f.taux_tva,
          total_ht: f.total_ht,
          parametres_json: f.parametres_json ?? null,
          ordre: f.ordre,
        })),
        service: (l.service ?? []).map(s => ({
          id: s.id,
          produit_id: s.produit_id ?? null,
          designation: s.designation,
          quantite: s.quantite,
          heures: s.heures ?? null,
          prix_unitaire_ht: s.prix_unitaire_ht,
          taux_tva: s.taux_tva,
          total_ht: s.total_ht,
          ordre: s.ordre,
        })),
      })));
    }
  }, [devis, devisId]);

  const addLine = () => setLignes(prev => [...prev, newEmptyLine(prev.length)]);

  const updateLine = (index: number, line: QuoteLine) => {
    setLignes(prev => prev.map((l, i) => i === index ? line : l));
  };

  const removeLine = (index: number) => {
    setLignes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const payload = lignes.map((l, i) => ({
      produit_id: l.produit_id ?? null,
      designation: l.designation || "—",
      unite_calcul: l.unite_calcul,
      largeur_m: l.width_cm != null ? l.width_cm / 100 : (l.largeur_m ?? null),
      hauteur_m: l.height_cm != null ? l.height_cm / 100 : (l.hauteur_m ?? null),
      width_cm: l.width_cm ?? null,
      height_cm: l.height_cm ?? null,
      quantite: l.quantite || 1,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      ordre: i,
      faconnage: (l.faconnage ?? []).map((f, fi) => ({
        produit_id: f.produit_id ?? null,
        designation: f.designation || "—",
        quantite: f.quantite,
        prix_unitaire_ht: f.prix_unitaire_ht,
        taux_tva: f.taux_tva,
        parametres_json: f.parametres_json ?? null,
        ordre: fi,
      })),
      service: (l.service ?? []).map((s, si) => ({
        produit_id: s.produit_id ?? null,
        designation: s.designation || "—",
        quantite: s.quantite,
        heures: s.heures ?? null,
        prix_unitaire_ht: s.prix_unitaire_ht,
        taux_tva: s.taux_tva,
        ordre: si,
      })),
    }));

    saveLignes.mutate({ id: devisId, data: { lignes: payload } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDevisQueryKey(devisId) });
        toast({ title: "Devis enregistré", description: "Les lignes ont été sauvegardées." });
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

  const handlePrint = useCallback(() => window.print(), []);

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

  // ── Preview totals (live calculation from UI state) ───────────────────────
  const previewTotals = useMemo(() => {
    let ht = 0, tva10 = 0, tva20 = 0;
    lignes.forEach(l => {
      const wCm = l.width_cm ?? 0;
      const hCm = l.height_cm ?? 0;
      const qCalc = calcQ(l.unite_calcul, wCm, hCm, l.quantite);
      const lineHT = qCalc * l.prix_unitaire_ht;
      const faconnageHT = (l.faconnage ?? []).reduce((s, f) => s + f.quantite * f.prix_unitaire_ht, 0);
      const serviceHT = (l.service ?? []).reduce((s, sv) => s + sv.quantite * sv.prix_unitaire_ht, 0);
      const totalLineHT = lineHT + faconnageHT + serviceHT;

      ht += totalLineHT;
      if (l.taux_tva === 10) tva10 += lineHT * 0.1;
      else if (l.taux_tva === 20) tva20 += lineHT * 0.2;

      // Also add TVA for sub-items
      [...(l.faconnage ?? []), ...(l.service ?? [])].forEach(sub => {
        const subHT = sub.quantite * sub.prix_unitaire_ht;
        if (sub.taux_tva === 10) tva10 += subHT * 0.1;
        else if (sub.taux_tva === 20) tva20 += subHT * 0.2;
      });
    });
    return { ht, tva10, tva20, ttc: ht + tva10 + tva20 };
  }, [lignes]);

  if (isLoading) return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
  if (!devis) return <div className="p-8 text-muted-foreground">Devis introuvable</div>;

  const isEditable = ["brouillon", "envoye"].includes(devis.statut);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          PRINT LAYOUT (hidden on screen)
      ════════════════════════════════════════════════════════════════════ */}
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
              <th className="text-right">Qté calc.</th>
              <th className="text-right">PU HT</th>
              <th className="text-right">TVA</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(devis.lignes ?? []).map((l, i) => {
              const wCm = l.width_cm ?? (l.largeur_m != null ? l.largeur_m * 100 : 0);
              const hCm = l.height_cm ?? (l.hauteur_m != null ? l.hauteur_m * 100 : 0);
              const q = calcQ(l.unite_calcul, wCm, hCm, l.quantite);
              const totalHt = q * l.prix_unitaire_ht;
              return (
                <React.Fragment key={i}>
                  <tr>
                    <td>{l.designation}</td>
                    <td>{l.unite_calcul}</td>
                    <td>{wCm > 0 || hCm > 0 ? `${wCm}×${hCm} cm` : "-"}</td>
                    <td className="text-right">{q.toFixed(3)}</td>
                    <td className="text-right">{formatCurrency(l.prix_unitaire_ht)}</td>
                    <td className="text-right">{l.taux_tva}%</td>
                    <td className="text-right font-semibold">{formatCurrency(totalHt)}</td>
                  </tr>
                  {(l.faconnage ?? []).map((f, fi) => (
                    <tr key={`f-${fi}`} className="text-gray-500 text-xs">
                      <td className="pl-4 italic">↳ {f.designation}</td>
                      <td>unité</td>
                      <td>-</td>
                      <td className="text-right">{f.quantite}</td>
                      <td className="text-right">{formatCurrency(f.prix_unitaire_ht)}</td>
                      <td className="text-right">{f.taux_tva}%</td>
                      <td className="text-right">{formatCurrency(f.quantite * f.prix_unitaire_ht)}</td>
                    </tr>
                  ))}
                  {(l.service ?? []).map((s, si) => (
                    <tr key={`s-${si}`} className="text-gray-500 text-xs">
                      <td className="pl-4 italic">↳ {s.designation}</td>
                      <td>{s.heures ? "heure" : "unité"}</td>
                      <td>-</td>
                      <td className="text-right">{s.quantite}</td>
                      <td className="text-right">{formatCurrency(s.prix_unitaire_ht)}</td>
                      <td className="text-right">{s.taux_tva}%</td>
                      <td className="text-right">{formatCurrency(s.quantite * s.prix_unitaire_ht)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="print-totals">
          <table>
            <tbody>
              <tr><td>Sous-total HT</td><td>{formatCurrency(devis.sous_total_ht)}</td></tr>
              {(devis.total_tva_10 ?? 0) > 0 && <tr><td>TVA 10%</td><td>{formatCurrency(devis.total_tva_10)}</td></tr>}
              {(devis.total_tva_20 ?? 0) > 0 && <tr><td>TVA 20%</td><td>{formatCurrency(devis.total_tva_20)}</td></tr>}
              <tr className="print-total-row"><td>Total TTC</td><td>{formatCurrency(devis.total_ttc)}</td></tr>
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

      {/* ═══════════════════════════════════════════════════════════════════
          SCREEN LAYOUT
      ════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 pb-24 animate-in fade-in duration-300 print:hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
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
              <p className="text-muted-foreground mt-0.5 text-sm">
                <Link href={`/clients/${devis.client_id}`} className="hover:text-primary hover:underline transition-colors font-medium">
                  {devis.client_prenom} {devis.client_nom}
                </Link>
                {" · "}Créé le {formatDate(devis.date_creation)}
                {devis.date_validite && ` · Valide jusqu'au ${formatDate(devis.date_validite)}`}
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
            {devis.statut === "brouillon" && (
              <Button variant="outline" className="glass-panel" onClick={() => handleChangeStatut("envoye")}>
                Marquer envoyé
              </Button>
            )}
            {devis.statut === "envoye" && (
              <>
                <Button variant="outline" className="glass-panel text-green-600 dark:text-green-400 hover:text-green-500" onClick={() => handleChangeStatut("accepte")}>
                  Marquer accepté
                </Button>
                <Button variant="outline" className="glass-panel text-red-600 dark:text-red-400 hover:text-red-500" onClick={() => handleChangeStatut("refuse")}>
                  Marquer refusé
                </Button>
              </>
            )}
            {devis.statut === "accepte" && (
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

        {/* ── Lines section ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Lignes du devis
              {lignes.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({lignes.length})</span>}
            </h2>
            {isEditable && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-panel text-primary border-primary/30 hover:bg-primary/10"
                  onClick={addLine}
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saveLignes.isPending}>
                  {saveLignes.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enregistrement...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" />Enregistrer</>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Empty state */}
          {lignes.length === 0 && (
            <div
              className="text-center py-16 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-card/20 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => isEditable && addLine()}
            >
              {isEditable ? (
                <>
                  <Plus className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium">Aucune ligne</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Cliquez pour ajouter la première ligne</p>
                </>
              ) : (
                <p>Aucune ligne dans ce devis.</p>
              )}
            </div>
          )}

          {/* Line cards */}
          <div className="space-y-3">
            {lignes.map((line, index) => (
              <QuoteLineCard
                key={line.id}
                line={line}
                index={index}
                isEditable={isEditable}
                onChange={updated => updateLine(index, updated)}
                onRemove={() => removeLine(index)}
              />
            ))}
          </div>

          {/* Save bar (sticky when editing + lines exist) */}
          {isEditable && lignes.length > 0 && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="glass-panel text-primary border-primary/30 hover:bg-primary/10"
                onClick={addLine}
              >
                <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
              </Button>
              <Button onClick={handleSave} disabled={saveLignes.isPending}>
                {saveLignes.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enregistrement...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" />Enregistrer</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* ── Totals card ──────────────────────────────────────────────── */}
        <div className="glass-panel rounded-xl border border-border/50 p-6 ml-auto max-w-sm">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="font-semibold tabular-nums">{formatCurrency(previewTotals.ht)}</span>
            </div>
            {previewTotals.tva10 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA 10%</span>
                <span className="tabular-nums">{formatCurrency(previewTotals.tva10)}</span>
              </div>
            )}
            {previewTotals.tva20 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA 20%</span>
                <span className="tabular-nums">{formatCurrency(previewTotals.tva20)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-border/50 flex justify-between items-baseline">
              <span className="font-bold text-lg">Total TTC</span>
              <span className="font-bold text-2xl text-primary tabular-nums">{formatCurrency(previewTotals.ttc)}</span>
            </div>
          </div>
        </div>

        {/* Notes display */}
        {devis.notes && (
          <div className="glass-panel rounded-xl border border-border/40 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{devis.notes}</p>
          </div>
        )}
      </div>

      {/* ── Edit header dialog ───────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>Modifier le devis</DialogTitle>
            <DialogDescription>Date de validité et notes internes.</DialogDescription>
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

      {/* ── Delete confirmation ──────────────────────────────────────── */}
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

      {/* Global quick-add modal (from header) */}
      <QuickAddProductModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => setQuickAddOpen(false)}
      />
    </>
  );
}
