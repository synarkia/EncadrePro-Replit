import { useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetFactureAcompte, getGetFactureAcompteQueryKey,
  useGetAtelier,
} from "@workspace/api-client-react";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateLong } from "@/lib/format";

/* WEB-TO-DESKTOP NOTE: Same print pattern as facture page — Electron should
   swap window.print() for webContents.printToPDF(). */

const MODE_LABELS: Record<string, string> = {
  cb: "Carte bancaire",
  especes: "Espèces",
  virement: "Virement",
  lien: "Lien de paiement",
  cheque: "Chèque",
};

export default function FactureAcomptePrint() {
  const { id } = useParams<{ id: string }>();
  const faId = parseInt(id || "0", 10);

  const { data: fa, isLoading } = useGetFactureAcompte(faId, {
    query: { enabled: !!faId, queryKey: getGetFactureAcompteQueryKey(faId) },
  });
  const { data: atelier } = useGetAtelier();

  // The /api/factures-acompte/:id/pdf endpoint redirects here with ?print=1,
  // which auto-opens the browser print dialog so the user lands on PDF
  // generation in one click.
  useEffect(() => {
    if (!fa) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [fa]);

  if (isLoading || !fa) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handlePrint = () => window.print();
  const soldeRestant = fa.facture_total_ttc != null
    ? Math.max(0, fa.facture_total_ttc - fa.montant_ttc)
    : null;
  const modeLabel = MODE_LABELS[fa.mode_reglement] || fa.mode_reglement;

  return (
    <>
      {/* ── Print view (mirrors facture print template) ───────────────── */}
      <div className="print-only print-document">
        <header className="print-header">
          <div className="print-brand">
            {atelier?.logo_path && (
              <img src={atelier.logo_path} alt="Logo" className="print-logo" />
            )}
            <div className="print-brand-text">
              <h1>{atelier?.nom || "Atelier"}</h1>
              {atelier?.tagline && <p className="print-brand-tagline">{atelier.tagline}</p>}
              {atelier?.adresse && (
                <p className="print-brand-meta">{atelier.adresse.split("\n").join(" · ")}</p>
              )}
              <p className="print-brand-meta">
                {atelier?.telephone && <>Tél. {atelier.telephone}</>}
                {atelier?.email && <> · {atelier.email}</>}
              </p>
            </div>
          </div>
        </header>

        <div className="print-meta">
          <div>
            <div className="print-meta-label">Document</div>
            <h2 className="print-meta-title">Facture d'acompte</h2>
            <p className="print-meta-number">N° {fa.numero}</p>
            <dl className="print-meta-list">
              <dt>Émise le</dt><dd>{formatDateLong(fa.date_paiement)}</dd>
              {fa.facture_numero && (
                <><dt>Facture finale</dt><dd>{fa.facture_numero}</dd></>
              )}
              {fa.devis_numero && (
                <><dt>Devis</dt><dd>{fa.devis_numero}</dd></>
              )}
              <dt>Mode de règlement</dt><dd>{modeLabel}</dd>
              {fa.reference_paiement && (
                <><dt>Référence</dt><dd>{fa.reference_paiement}</dd></>
              )}
            </dl>
          </div>
          <div className="print-client-block">
            <div className="print-meta-label">Adressée à</div>
            <p className="print-client-name">
              {fa.client_entreprise || [fa.client_prenom, fa.client_nom].filter(Boolean).join(" ") || "—"}
            </p>
            {(() => {
              const addrLines: string[] = [];
              if (fa.client_adresse) addrLines.push(...fa.client_adresse.split("\n"));
              const cityLine = [fa.client_code_postal, fa.client_ville].filter(Boolean).join(" ");
              if (cityLine) addrLines.push(cityLine);
              const meta: string[] = [];
              if (fa.client_email) meta.push(fa.client_email);
              if (fa.client_telephone) meta.push(fa.client_telephone);
              return (
                <>
                  {addrLines.length > 0 && (
                    <div className="print-client-lines">
                      {addrLines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  )}
                  {meta.length > 0 && (
                    <>
                      <hr />
                      <div className="print-client-meta">
                        {meta.map((m, i) => <div key={i}>{m}</div>)}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div className="print-section-title">
          <h2>Détail de l'acompte</h2>
          <span className="print-currency-note">Montants en euros</span>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "60%" }}>Désignation</th>
              <th className="text-right" style={{ width: "20%" }}>Montant HT</th>
              <th className="text-right" style={{ width: "20%" }}>Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="print-designation">
                  Acompte sur {fa.facture_numero || fa.devis_numero || "commande"}
                </div>
                <div className="print-description">
                  Acompte versé le {formatDate(fa.date_paiement)} — {modeLabel}
                  {fa.reference_paiement ? ` (réf. ${fa.reference_paiement})` : ""}.
                </div>
              </td>
              <td className="text-right">{formatCurrency(fa.montant_ht)}</td>
              <td className="text-right">{formatCurrency(fa.montant_ttc)}</td>
            </tr>
          </tbody>
        </table>

        <div className="print-summary">
          <div className="print-conditions">
            <div className="print-meta-label">Imputation</div>
            <p>
              Cet acompte sera déduit du montant de la facture définitive
              {fa.facture_numero ? ` n° ${fa.facture_numero}` : ""}. Document
              fiscal autonome conforme à l'article 289 du CGI.
            </p>
          </div>
          <div className="print-totals">
            <div className="print-totals-row is-sub">
              <span className="print-totals-label">Montant HT</span>
              <span className="print-totals-value">{formatCurrency(fa.montant_ht)}</span>
            </div>
            {/* Per-rate VAT breakdown when applicable; falls back to a single
                aggregated row when only one rate was used on the source devis. */}
            {(fa.montant_tva_20 > 0 || fa.montant_tva_10 > 0) ? (
              <>
                {fa.montant_tva_20 > 0 && (
                  <div className="print-totals-row is-vat">
                    <span className="print-totals-label">TVA <small>20 %</small></span>
                    <span className="print-totals-value">{formatCurrency(fa.montant_tva_20)}</span>
                  </div>
                )}
                {fa.montant_tva_10 > 0 && (
                  <div className="print-totals-row is-vat">
                    <span className="print-totals-label">TVA <small>10 %</small></span>
                    <span className="print-totals-value">{formatCurrency(fa.montant_tva_10)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="print-totals-row is-vat">
                <span className="print-totals-label">TVA</span>
                <span className="print-totals-value">{formatCurrency(fa.montant_tva)}</span>
              </div>
            )}
            <div className="print-totals-row is-grand">
              <span className="print-totals-label">Total TTC encaissé</span>
              <span className="print-totals-value">{formatCurrency(fa.montant_ttc)}</span>
            </div>
            {soldeRestant != null && (
              <div className="print-totals-row is-net">
                <span className="print-totals-label">Solde restant à facturer</span>
                <span className="print-totals-value">{formatCurrency(soldeRestant)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="print-mode-strip">
          <dl className="print-mode-list">
            <dt>Mode</dt>
            <dd>{modeLabel}</dd>
            <dt>Référence</dt>
            <dd>À rappeler : {fa.numero}</dd>
          </dl>
        </div>

        <div className="print-pagefooter">
          <span>Facture d'acompte {fa.numero}</span>
          <span className="print-pagefooter-mid">
            {atelier?.nom || ""}
            {atelier?.adresse ? ` — ${atelier.adresse.split("\n").pop()}` : ""}
          </span>
          <span>Page 1 / 1</span>
        </div>
      </div>

      {/* ── Screen view ───────────────────────────────────────────────── */}
      <div className="space-y-6 pb-20 animate-in fade-in duration-300 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href={fa.facture_id ? `/factures/${fa.facture_id}` : "/factures"}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Facture d'acompte {fa.numero}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {fa.client_entreprise || `${fa.client_prenom ?? ""} ${fa.client_nom ?? ""}`.trim() || "—"}
                {fa.facture_numero && (
                  <> • Rattachée à <span className="text-primary">{fa.facture_numero}</span></>
                )}
                {" • "}{formatDateLong(fa.date_paiement)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="glass-panel" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimer / PDF
            </Button>
            {fa.facture_id && (
              <Link href={`/factures/${fa.facture_id}`}>
                <Button variant="outline" size="sm" className="glass-panel">
                  <FileText className="h-4 w-4 mr-1" /> Voir la facture
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-lg border border-border/50 p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-semibold">Détail de l'acompte</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Numéro</dt>
            <dd className="font-mono">{fa.numero}</dd>
            <dt className="text-muted-foreground">Date d'encaissement</dt>
            <dd>{formatDate(fa.date_paiement)}</dd>
            <dt className="text-muted-foreground">Mode de règlement</dt>
            <dd>{modeLabel}</dd>
            {fa.reference_paiement && (
              <>
                <dt className="text-muted-foreground">Référence</dt>
                <dd className="font-mono text-xs">{fa.reference_paiement}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Montant HT</dt>
            <dd>{formatCurrency(fa.montant_ht)}</dd>
            <dt className="text-muted-foreground">TVA</dt>
            <dd>
              {formatCurrency(fa.montant_tva)}
              {(fa.montant_tva_20 > 0 || fa.montant_tva_10 > 0) && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({[
                    fa.montant_tva_20 > 0 ? `20 % : ${formatCurrency(fa.montant_tva_20)}` : null,
                    fa.montant_tva_10 > 0 ? `10 % : ${formatCurrency(fa.montant_tva_10)}` : null,
                  ].filter(Boolean).join(" • ")})
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground font-semibold">Total TTC</dt>
            <dd className="font-bold text-primary">{formatCurrency(fa.montant_ttc)}</dd>
            {soldeRestant != null && (
              <>
                <dt className="text-muted-foreground">Solde restant à facturer</dt>
                <dd>{formatCurrency(soldeRestant)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </>
  );
}
