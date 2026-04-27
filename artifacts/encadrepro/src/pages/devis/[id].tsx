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
import { ArrowLeft, Save, ArrowRightLeft, FileCheck, Printer, Pencil, Trash2, Loader2, ChevronDown, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { statutColors } from "./index";
import { QuoteLineCard, computeQuoteLineHT, type QuoteLine, type TypeLigne } from "@/components/QuoteLineCard";
import { ProjetSection } from "@/components/ProjetSection";
import type { ProduitSearchResult } from "@/components/ProductSearchCombobox";
import { computeLignePvuht, type RegimePricing } from "@/lib/compute-line";
import { pricingModeToUniteCalcul } from "@/lib/product-types";
import { QuickAddProductModal } from "@/components/QuickAddProductModal";
import { ClientContactCard } from "@/components/ClientContactCard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUT_OPTIONS: { value: string; label: string }[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
];

/* WEB-TO-DESKTOP NOTE: For print in Electron, use BrowserWindow.webContents.print() or
   generate a PDF via webContents.printToPDF() and save to disk. */

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcQ(unite: string, widthCm: number, heightCm: number, qte: number): number {
  const wM = widthCm / 100;
  const hM = heightCm / 100;
  // Linear meters: typed dimensions are summed and used as-is (no perimeter doubling).
  // Must stay in lock-step with QuoteLineCard.calcQuantite and api-server devis.calcLigne.
  if (unite === "ml" || unite === "metre_lineaire") return (wM + hM) * qte;
  if (unite === "m²" || unite === "metre_carre") return wM * hM * qte;
  return qte;
}

let tempIdCounter = 0;
function nextTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}`;
}

function emptyLineFor(
  type: TypeLigne,
  projetId: number | null,
  projetDims?: { width_cm: number | null; height_cm: number | null } | null,
): QuoteLine {
  // Matière lines auto-inherit the parent projet's dimensions when the projet
  // has them set; for façonnage / service the flag is meaningless but stays
  // true so the round-trip matches the server default.
  const useInherit = type === "matiere" && projetDims != null &&
    (projetDims.width_cm != null || projetDims.height_cm != null);
  return {
    id: nextTempId(),
    projet_id: projetId,
    produit_id: null,
    type_ligne: type,
    designation: "",
    description_longue: null,
    remise_pct: 0,
    unite_calcul: type === "service" ? "heure" : type === "faconnage" ? "metre_lineaire" : "pièce",
    width_cm: useInherit ? (projetDims?.width_cm ?? null) : null,
    height_cm: useInherit ? (projetDims?.height_cm ?? null) : null,
    largeur_m: null,
    hauteur_m: null,
    longueur_m: null,
    parametres_json: null,
    heures: null,
    quantite: 1,
    prix_unitaire_ht: 0,
    taux_tva: 20,
    inherits_project_dimensions: true,
    type_code: null,
    prix_achat_ht: null,
    coefficient_marge: null,
    regime_pricing: null,
    majo_epaisseur: null,
    mini_fact_tn: null,
    mini_fact_ta: null,
    coef_marge_ta: null,
    plus_value_ta_pct: null,
  };
}

function lineFromProduit(
  type: TypeLigne,
  projetId: number | null,
  p: ProduitSearchResult,
  projetDims?: { width_cm: number | null; height_cm: number | null } | null,
): QuoteLine {
  const base = emptyLineFor(type, projetId, projetDims);
  if (type === "matiere") {
    const regime: RegimePricing = "TN";
    const pvuht = computeLignePvuht({
      type_code: p.type_code,
      prix_ht: p.prix_ht,
      prix_achat_ht: p.prix_achat_ht,
      coefficient_marge: p.coefficient_marge,
      regime,
    });
    return {
      ...base,
      produit_id: p.id,
      designation: p.designation,
      unite_calcul: p.pricing_mode ? pricingModeToUniteCalcul(p.pricing_mode) : (p.unite ?? p.unite_calcul ?? "pièce"),
      prix_unitaire_ht: pvuht,
      taux_tva: p.taux_tva,
      type_code: p.type_code,
      prix_achat_ht: p.prix_achat_ht,
      coefficient_marge: p.coefficient_marge,
      regime_pricing: regime,
      majo_epaisseur: p.majo_epaisseur ?? null,
      mini_fact_tn: p.mini_fact_tn ?? null,
      mini_fact_ta: p.mini_fact_ta ?? null,
      coef_marge_ta: p.coef_marge_ta ?? null,
      plus_value_ta_pct: p.plus_value_ta_pct ?? null,
    };
  }
  return {
    ...base,
    produit_id: p.id,
    designation: p.designation,
    prix_unitaire_ht: p.prix_ht,
    taux_tva: p.taux_tva,
  };
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
  const [editDateCreation, setEditDateCreation] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const handlePrint = useCallback(() => { window.print(); }, []);

  const handleDownload = useCallback(() => {
    toast({
      title: "Téléchargement PDF",
      description: "Choisissez « Enregistrer en PDF » dans la boîte de dialogue d'impression.",
    });
    setTimeout(() => window.print(), 350);
  }, [toast]);

  const openEmail = useCallback(() => {
    if (!devis) return;
    const fullName = [devis.client_prenom, devis.client_nom].filter(Boolean).join(" ").trim();
    const greeting = fullName ? `Bonjour ${fullName},` : "Bonjour,";
    const atelierNom = atelier?.nom || "l'atelier";
    setEmailTo(devis.client_email || "");
    setEmailSubject(`Devis ${devis.numero}${atelier?.nom ? ` — ${atelier.nom}` : ""}`);
    setEmailBody(
      `${greeting}\n\n` +
      `Veuillez trouver ci-joint le devis ${devis.numero}` +
      (devis.date_validite ? ` (valable jusqu'au ${formatDate(devis.date_validite)})` : "") +
      ` d'un montant de ${formatCurrency(devis.total_ttc)} TTC.\n\n` +
      `Pour acceptation, merci de nous le retourner daté et signé avec la mention « Bon pour accord ».\n\n` +
      `N'hésitez pas à nous contacter pour toute question.\n\n` +
      `Cordialement,\n${atelierNom}`
    );
    setIsEmailOpen(true);
  }, [devis, atelier]);

  const handleSendEmail = useCallback(() => {
    const params = new URLSearchParams();
    if (emailSubject) params.set("subject", emailSubject);
    if (emailBody) params.set("body", emailBody);
    const href = `mailto:${encodeURIComponent(emailTo)}?${params.toString()}`;
    window.location.href = href;
    setIsEmailOpen(false);
    toast({
      title: "Brouillon ouvert",
      description: "Pensez à joindre le PDF avant d'envoyer (utilisez « Télécharger PDF »).",
    });
  }, [emailTo, emailSubject, emailBody, toast]);

  const [lignes, setLignes] = useState<QuoteLine[]>([]);
  const initRef = useRef<number | null>(null);

  useEffect(() => {
    if (devis && initRef.current !== devisId) {
      initRef.current = devisId;
      setLignes((devis.lignes ?? []).map(l => {
        const typeLigne = ((l as { type_ligne?: string | null }).type_ligne ?? "matiere") as TypeLigne;
        return {
          id: l.id,
          projet_id: (l as { projet_id?: number | null }).projet_id ?? null,
          produit_id: l.produit_id ?? null,
          type_ligne: typeLigne,
          designation: l.designation,
          description_longue: (l as { description_longue?: string | null }).description_longue ?? null,
          remise_pct: (l as { remise_pct?: number | null }).remise_pct ?? 0,
          unite_calcul: l.unite_calcul,
          width_cm: l.width_cm ?? (l.largeur_m != null ? l.largeur_m * 100 : null),
          height_cm: l.height_cm ?? (l.hauteur_m != null ? l.hauteur_m * 100 : null),
          largeur_m: l.largeur_m ?? null,
          hauteur_m: l.hauteur_m ?? null,
          longueur_m: (l as { longueur_m?: number | null }).longueur_m ?? null,
          parametres_json: (l as { parametres_json?: string | null }).parametres_json ?? null,
          heures: (l as { heures?: number | null }).heures ?? null,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          taux_tva: l.taux_tva,
          // Default TRUE for legacy rows that pre-date the column.
          inherits_project_dimensions:
            (l as { inherits_project_dimensions?: boolean }).inherits_project_dimensions ?? true,
          regime_pricing: ((l as { regime_pricing?: string | null }).regime_pricing ?? null) as RegimePricing | null,
          type_code: null,
          prix_achat_ht: null,
          coefficient_marge: null,
          majo_epaisseur: null,
          mini_fact_tn: null,
          mini_fact_ta: null,
          coef_marge_ta: null,
          plus_value_ta_pct: null,
        };
      }));
    }
  }, [devis, devisId]);

  // ── Id-based mutations: lignes are now flat and may live inside any projet,
  //    so the canonical reference is the ligne id, not its position. ─────────
  const addLineToProjet = useCallback(
    (projetId: number, type: TypeLigne, produit: ProduitSearchResult | null) => {
      // Look up the parent projet so a new matière line auto-prefills its
      // width/height from the projet (and starts in the "linked" state).
      const projet = (devis?.projets ?? []).find(p => p.id === projetId);
      const projetDims = projet
        ? { width_cm: projet.width_cm ?? null, height_cm: projet.height_cm ?? null }
        : null;
      setLignes(prev => [
        ...prev,
        produit
          ? lineFromProduit(type, projetId, produit, projetDims)
          : emptyLineFor(type, projetId, projetDims),
      ]);
    },
    [devis?.projets],
  );

  // ── Cascade: when a projet's width/height changes, re-snap every matière
  //    line attached to that projet that's still in "linked" mode. Façonnage
  //    and service are skipped (no width/height in their pricing). The user
  //    still has to click "Save" to persist; that's intentional and matches
  //    the rest of the editor.
  const cascadeProjetDimensions = useCallback(
    (
      projetId: number,
      _oldDims: { width_cm: number | null; height_cm: number | null },
      newDims: { width_cm: number | null; height_cm: number | null },
    ) => {
      let realigned = 0;
      let kept = 0;
      setLignes(prev =>
        prev.map(l => {
          if (l.projet_id !== projetId || l.type_ligne !== "matiere") return l;
          if (l.inherits_project_dimensions) {
            realigned += 1;
            return { ...l, width_cm: newDims.width_cm, height_cm: newDims.height_cm };
          }
          kept += 1;
          return l;
        }),
      );
      if (realigned === 0 && kept === 0) return;
      const parts: string[] = [];
      if (realigned > 0) {
        parts.push(`${realigned} ligne${realigned > 1 ? "s" : ""} mise${realigned > 1 ? "s" : ""} à jour`);
      }
      if (kept > 0) {
        parts.push(`${kept} ligne${kept > 1 ? "s" : ""} conserve${kept > 1 ? "nt" : ""} leur mesure custom`);
      }
      toast({
        title: "Cascade dimensions",
        description: parts.join(", "),
      });
    },
    [toast],
  );

  const updateLineById = useCallback(
    (id: QuoteLine["id"], next: QuoteLine) => {
      setLignes(prev => prev.map(l => (l.id === id ? next : l)));
    },
    [],
  );

  const removeLineById = useCallback(
    (id: QuoteLine["id"]) => {
      setLignes(prev => prev.filter(l => l.id !== id));
    },
    [],
  );

  const handleSave = () => {
    const payload = lignes.map((l, i) => ({
      projet_id: l.projet_id ?? null,
      produit_id: l.produit_id ?? null,
      type_ligne: l.type_ligne,
      designation: l.designation || "—",
      description_longue: l.description_longue ?? null,
      remise_pct: l.remise_pct ?? 0,
      unite_calcul: l.unite_calcul,
      largeur_m: l.width_cm != null ? l.width_cm / 100 : (l.largeur_m ?? null),
      hauteur_m: l.height_cm != null ? l.height_cm / 100 : (l.hauteur_m ?? null),
      width_cm: l.width_cm ?? null,
      height_cm: l.height_cm ?? null,
      longueur_m: l.longueur_m ?? null,
      heures: l.heures ?? null,
      parametres_json: l.parametres_json ?? null,
      quantite: l.quantite || 1,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      ordre: i,
      regime_pricing: l.regime_pricing ?? null,
      inherits_project_dimensions: l.inherits_project_dimensions,
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

  const openEdit = () => {
    setEditNotes(devis?.notes ?? "");
    setEditDate(devis?.date_validite ? devis.date_validite.slice(0, 10) : "");
    setEditDateCreation(devis?.date_creation ? devis.date_creation.slice(0, 10) : "");
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    setIsSavingEdit(true);
    try {
      await fetch(`${BASE_URL}/api/devis/${devisId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes,
          date_validite: editDate || null,
          date_creation: editDateCreation || null,
        }),
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
      // Single source of truth for per-line HT — branches on l.type_ligne and
      // applies the V1 TN/TA formula for matière. Stays in lock-step with
      // QuoteLineCard's display and api-server's persisted total.
      const lineHT = computeQuoteLineHT(l);
      ht += lineHT;
      if (l.taux_tva === 10) tva10 += lineHT * 0.1;
      else if (l.taux_tva === 20) tva20 += lineHT * 0.2;
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
        {/* ── Header: wordmark left, contact + legal right ─────────────── */}
        <div className="print-header">
          <div>
            {atelier?.logo_path && (
              <img
                src={`${BASE_URL}/api/storage${atelier.logo_path}`}
                alt={atelier?.nom || "Logo"}
                className="print-logo"
              />
            )}
            <h1 className="print-wordmark">{atelier?.nom || "Atelier"}</h1>
            <hr className="print-brand-rule" />
            {atelier?.tagline && <p className="print-tagline">{atelier.tagline}</p>}
            {atelier?.subtitre && (
              <p className="print-subtags">
                {atelier.subtitre.split(/\s*[·•|]\s*|\s*\n\s*/).filter(Boolean).map((tag, i) => (
                  <span key={i}>{tag}</span>
                ))}
              </p>
            )}
          </div>
          <address className="print-contact-block not-italic">
            {atelier?.nom && <div className="print-contact-name">{atelier.nom}</div>}
            {atelier?.adresse && atelier.adresse.split("\n").map((line, i) => (
              <div key={i} className="print-muted">{line}</div>
            ))}
            {atelier?.telephone && <div className="print-muted">{atelier.telephone}</div>}
            {atelier?.email && <div className="print-muted">{atelier.email}</div>}
            {(atelier?.siret || atelier?.rcs || atelier?.tva_intracom || atelier?.forme_juridique) && (
              <div className="print-legal-block">
                {atelier?.forme_juridique && <div>{atelier.forme_juridique}{atelier?.nom ? ` — ${atelier.nom}` : ""}</div>}
                {atelier?.siret && <div>SIRET {atelier.siret}</div>}
                {atelier?.rcs && <div>RCS Paris {atelier.rcs}</div>}
                {atelier?.tva_intracom && <div>TVA {atelier.tva_intracom}</div>}
              </div>
            )}
          </address>
        </div>

        {/* ── Meta area: document/title left, client right ─────────────── */}
        <div className="print-meta">
          <div>
            <div className="print-meta-label">Document</div>
            <h2 className="print-meta-title">Devis</h2>
            <p className="print-meta-number">N° {devis.numero}</p>
            <dl className="print-meta-list">
              <dt>Émis le</dt><dd>{formatDate(devis.date_creation)}</dd>
              {devis.date_validite && (
                <>
                  <dt>Valable jusqu'au</dt><dd>{formatDate(devis.date_validite)}</dd>
                </>
              )}
            </dl>
          </div>
          <div className="print-client-block">
            <div className="print-meta-label">Adressée à</div>
            <p className="print-client-name">
              {[devis.client_prenom, devis.client_nom].filter(Boolean).join(" ") || "—"}
            </p>
            {/* Address lines + a hairline-separated reference block, populated
                from the typed client fields returned by GET /devis/:id. */}
            {(() => {
              const lines: string[] = [];
              if (devis.client_adresse) lines.push(...devis.client_adresse.split("\n"));
              const cityLine = [devis.client_code_postal, devis.client_ville].filter(Boolean).join(" ");
              if (cityLine) lines.push(cityLine);
              const meta: string[] = [];
              if (devis.client_email) meta.push(devis.client_email);
              if (devis.client_telephone) meta.push(devis.client_telephone);
              return (
                <>
                  {lines.length > 0 && (
                    <div className="print-client-lines">
                      {lines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  )}
                  {meta.length > 0 && <hr />}
                  {meta.length > 0 && (
                    <div className="print-client-meta">
                      {meta.map((m, i) => <div key={i}>{m}</div>)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Section title ─────────────────────────────────────────── */}
        <div className="print-section-title">
          <h2>Prestations &amp; fournitures</h2>
          <span className="print-currency-note">Montants en euros</span>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "48%" }}>Désignation</th>
              <th className="text-right" style={{ width: "7%" }}>Qté</th>
              <th style={{ width: "11%" }}>Unité</th>
              <th className="text-right" style={{ width: "12%" }}>P.U. HT</th>
              <th className="text-right" style={{ width: "9%" }}>Remise</th>
              <th className="text-right" style={{ width: "13%" }}>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(devis.lignes ?? []).map((l, i) => {
              const typeLigne = ((l as { type_ligne?: string | null }).type_ligne ?? "matiere") as TypeLigne;
              const wCm = l.width_cm ?? (l.largeur_m != null ? l.largeur_m * 100 : 0);
              const hCm = l.height_cm ?? (l.hauteur_m != null ? l.hauteur_m * 100 : 0);
              const longueurM = (l as { longueur_m?: number | null }).longueur_m ?? null;
              const heures = (l as { heures?: number | null }).heures ?? null;
              const lineRemisePct = (l as { remise_pct?: number | null }).remise_pct ?? 0;
              // Use the persisted backend total (already factors in mini_fact_tn /
              // majo_epaisseur / TA legacy formula and the per-line remise) so the
              // printed Total HT agrees with the on-screen QuoteLineCard total.
              const totalHt = Number(l.total_ht ?? 0);

              // Quantity displayed in the print column depends on the ligne kind.
              let displayedQte: number;
              let displayedUnite: string;
              if (typeLigne === "faconnage") {
                const eff = longueurM != null && longueurM > 0 ? longueurM : 1;
                displayedQte = l.quantite * eff;
                displayedUnite = longueurM != null && longueurM > 0 ? "ml" : l.unite_calcul;
              } else if (typeLigne === "service") {
                displayedQte = heures != null && heures > 0 ? l.quantite * heures : l.quantite;
                displayedUnite = heures != null && heures > 0 ? "h" : l.unite_calcul;
              } else {
                displayedQte = calcQ(l.unite_calcul, wCm, hCm, l.quantite);
                displayedUnite = l.unite_calcul;
              }

              const descParts: string[] = [];
              const longDesc = (l as { description_longue?: string | null }).description_longue ?? null;
              if (longDesc) descParts.push(longDesc);
              if (typeLigne === "matiere" && (wCm > 0 || hCm > 0)) {
                descParts.push(`Format ${wCm}×${hCm} cm`);
              }
              if (typeLigne === "faconnage" && longueurM != null && longueurM > 0) {
                descParts.push(`Longueur : ${longueurM.toFixed(2)} m`);
              }
              if (typeLigne === "service" && heures != null && heures > 0) {
                descParts.push(`Durée : ${heures.toFixed(2)} h`);
              }

              return (
                <tr key={i}>
                  <td>
                    <div className="print-designation">{l.designation}</div>
                    {descParts.length > 0 && (
                      <div className="print-description">{descParts.join("\n")}</div>
                    )}
                  </td>
                  <td className="text-right">{displayedQte.toFixed(displayedQte % 1 === 0 ? 0 : 2)}</td>
                  <td>{displayedUnite}</td>
                  <td className="text-right">{formatCurrency(l.prix_unitaire_ht)}</td>
                  <td className="text-right">{lineRemisePct > 0 ? `\u2212${lineRemisePct.toFixed(lineRemisePct % 1 === 0 ? 0 : 2)}\u00a0%` : "—"}</td>
                  <td className="text-right">{formatCurrency(totalHt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="print-summary">
          <div className="print-conditions">
            <div className="print-meta-label">Conditions</div>
            {devis.date_validite && (
              <div className="print-due">
                Valable jusqu'au <strong>{formatDate(devis.date_validite)}</strong>
              </div>
            )}
            {atelier?.conditions_generales && <p>{atelier.conditions_generales}</p>}
          </div>

          <div className="print-totals">
            <div className="print-totals-row is-sub">
              <span className="print-totals-label">Sous-total HT</span>
              <span className="print-totals-value">{formatCurrency(devis.sous_total_ht)}</span>
            </div>
            {(devis.total_tva_20 ?? 0) > 0 && (
              <div className="print-totals-row is-vat">
                <span className="print-totals-label">TVA <small>20%</small></span>
                <span className="print-totals-value">{formatCurrency(devis.total_tva_20)}</span>
              </div>
            )}
            {(devis.total_tva_10 ?? 0) > 0 && (
              <div className="print-totals-row is-vat">
                <span className="print-totals-label">TVA <small>10%</small></span>
                <span className="print-totals-value">{formatCurrency(devis.total_tva_10)}</span>
              </div>
            )}
            <div className="print-totals-row is-grand">
              <span className="print-totals-label">Total TTC</span>
              <span className="print-totals-value">{formatCurrency(devis.total_ttc)}</span>
            </div>
          </div>
        </div>

        {/* ── Bon pour accord — acceptance signature ─────────────────── */}
        <div className="print-payment-row is-signature-only">
          <div className="print-signature">
            <div className="print-block-title">Bon pour accord</div>
            <div className="print-signature-box" />
            <p className="print-signature-hint">
              Devis à retourner daté et signé avec la mention « Bon pour accord » pour acceptation
              {devis.date_validite && <> — valable jusqu'au {formatDate(devis.date_validite)}</>}.
            </p>
          </div>
        </div>

        <div className="print-footer">
          {atelier?.nom && <span>{atelier.nom}</span>}
          {atelier?.siret && <span>SIRET {atelier.siret}</span>}
          {atelier?.tva_intracom && <span>TVA {atelier.tva_intracom}</span>}
          {!atelier?.tva_intracom && (devis.total_tva_10 ?? 0) === 0 && (devis.total_tva_20 ?? 0) === 0 && (
            <span>TVA non applicable, art. 293 B du CGI</span>
          )}
          {atelier?.mentions_legales && <span>{atelier.mentions_legales}</span>}
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
                {devis.statut === "converti" ? (
                  <Badge className={statutColors[devis.statut] || ""}>CONVERTI</Badge>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 focus:outline-none ${statutColors[devis.statut] || ""}`}>
                        {STATUT_OPTIONS.find(o => o.value === devis.statut)?.label?.toUpperCase() ?? devis.statut.toUpperCase()}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="glass-panel">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le statut</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {STATUT_OPTIONS.filter(o => o.value !== devis.statut).map(opt => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={() => handleChangeStatut(opt.value)}
                          className="cursor-pointer"
                        >
                          <span className={`mr-2 h-2 w-2 rounded-full inline-block ${
                            opt.value === "brouillon" ? "bg-gray-400" :
                            opt.value === "envoye" ? "bg-blue-400" :
                            opt.value === "accepte" ? "bg-green-400" :
                            opt.value === "refuse" ? "bg-red-400" : "bg-violet-400"
                          }`} />
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
            <Button variant="outline" size="sm" className="glass-panel" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Télécharger PDF
            </Button>
            <Button variant="outline" size="sm" className="glass-panel" onClick={openEmail}>
              <Mail className="h-4 w-4 mr-1" /> Envoyer par email
            </Button>
            <Button variant="outline" size="sm" className="glass-panel" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Modifier
            </Button>
            <Button variant="outline" size="sm" className="glass-panel text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
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

        <ClientContactCard
          adresse={devis.client_adresse}
          code_postal={devis.client_code_postal}
          ville={devis.client_ville}
          email={devis.client_email}
          telephone={devis.client_telephone}
        />

        {/* ── Projets section (lignes are edited inside their projet card) ── */}
        <ProjetSection
          devisId={devisId}
          projets={devis.projets ?? []}
          lignes={lignes}
          isEditable={isEditable}
          onAddLine={addLineToProjet}
          onChangeLine={updateLineById}
          onRemoveLine={removeLineById}
          onProjetDimensionsChanged={cascadeProjetDimensions}
        />

        {/* ── Lignes libres (orphan lignes with no projet — legacy data) ─── */}
        {(() => {
          const orphans = lignes.filter(l => l.projet_id == null);
          if (orphans.length === 0) return null;
          return (
            <div className="space-y-3" data-testid="lignes-libres-section">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Lignes libres
                <span className="text-xs font-normal text-muted-foreground rounded-full border border-border/40 px-2 py-0.5">
                  hors projet
                </span>
                <span className="text-sm font-normal text-muted-foreground">({orphans.length})</span>
              </h2>
              <div className="space-y-2">
                {orphans.map((ligne, idx) => (
                  <QuoteLineCard
                    key={ligne.id}
                    line={ligne}
                    index={idx}
                    isEditable={isEditable}
                    onChange={next => updateLineById(ligne.id, next)}
                    onRemove={() => removeLineById(ligne.id)}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Save bar ────────────────────────────────────────────────── */}
        {isEditable && (
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={handleSave} disabled={saveLignes.isPending} data-testid="devis-save-button">
              {saveLignes.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enregistrement...</>
              ) : (
                <><Save className="h-4 w-4 mr-1" />Enregistrer le devis</>
              )}
            </Button>
          </div>
        )}

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
            <DialogDescription>Dates, statut et notes du devis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de création</label>
                <Input type="date" value={editDateCreation} onChange={e => setEditDateCreation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de validité</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
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

      {/* ── Email dialog ─────────────────────────────────────────────── */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="glass-panel max-w-2xl">
          <DialogHeader>
            <DialogTitle>Envoyer le devis par email</DialogTitle>
            <DialogDescription>
              Le brouillon s'ouvrira dans votre logiciel de messagerie. Téléchargez d'abord le PDF si vous souhaitez le joindre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destinataire</label>
              <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="client@exemple.fr" />
              {!devis.client_email && (
                <p className="text-xs text-muted-foreground">Aucun email enregistré pour ce client — saisissez-en un.</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Objet</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailOpen(false)}>Annuler</Button>
            <Button onClick={handleSendEmail} disabled={!emailTo}>
              <Mail className="h-4 w-4 mr-1" /> Ouvrir dans la messagerie
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
