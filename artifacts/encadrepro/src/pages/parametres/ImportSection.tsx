import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type SkippedRow = { row_number: number; reason: string; raw_data: Record<string, unknown> };
type ImportReport = {
  total: number;
  imported: number;
  skipped_existing: number;
  skipped_error: number;
  skipped_rows: SkippedRow[];
  encoding?: string;
  encoding_note?: string;
  dry_run: boolean;
};

type ImportKind = "fournisseurs" | "clients" | "produits";

async function postImport(kind: ImportKind, file: File, opts: { dryRun?: boolean; type?: string } = {}): Promise<ImportReport> {
  const fd = new FormData();
  fd.append("file", file);
  const url = new URL(`${window.location.origin}${BASE_URL}/api/import/${kind}`);
  if (opts.dryRun) url.searchParams.set("dry_run", "true");
  if (opts.type) url.searchParams.set("type", opts.type);
  const res = await fetch(url.toString(), { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ImportReport;
}

function fournisseurMissingHint(report: ImportReport): boolean {
  const errs = report.skipped_rows.filter((r) => /fournisseur/i.test(r.reason));
  const totalSkippedErr = report.skipped_error;
  if (totalSkippedErr === 0) return false;
  return errs.length / totalSkippedErr > 0.5;
}

function ReportPanel({ report }: { report: ImportReport }) {
  const showFournisseurHint = fournisseurMissingHint(report);
  return (
    <div className="space-y-3">
      {showFournisseurHint && (
        <Alert variant="destructive" data-testid="alert-import-fournisseur-hint">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Importez d'abord les fournisseurs</AlertTitle>
          <AlertDescription>
            Il semble que les fournisseurs n'ont pas encore été importés. Importez d'abord le fichier Fournisseurs, puis réessayez l'import des produits.
          </AlertDescription>
        </Alert>
      )}
      {report.encoding_note && (
        <Alert>
          <FileSpreadsheet className="h-4 w-4" />
          <AlertDescription>{report.encoding_note}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-semibold tabular-nums">{report.total}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-xs text-emerald-300">{report.dry_run ? "À importer" : "Importés"}</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-300">{report.imported}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">Déjà présents</div>
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">{report.skipped_existing}</div>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="text-xs text-destructive">Erreurs</div>
          <div className="text-2xl font-semibold tabular-nums text-destructive">{report.skipped_error}</div>
        </div>
      </div>
      {report.encoding && (
        <div className="text-xs text-muted-foreground">Encodage : {report.encoding}{report.dry_run ? " · mode aperçu (aucune écriture)" : ""}</div>
      )}
      {report.skipped_rows.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Détails des lignes ignorées ({report.skipped_rows.length})</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="max-h-64 overflow-y-auto rounded border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ligne</TableHead>
                    <TableHead>Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.skipped_rows.map((r) => (
                    <TableRow key={`${r.row_number}-${r.reason}`}>
                      <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function ImportCard({
  title,
  kind,
  description,
  showTypeSelector = false,
}: {
  title: string;
  kind: ImportKind;
  description: string;
  showTypeSelector?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"idle" | "dry" | "import">("idle");
  const [typeMode, setTypeMode] = useState<"all" | "single">("all");
  const [singleType, setSingleType] = useState<string>("EN");

  const opts = useMemo(
    () => (showTypeSelector && typeMode === "single" ? { type: singleType } : {}),
    [showTypeSelector, typeMode, singleType],
  );

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(dryRun ? "dry" : "import");
    try {
      const r = await postImport(kind, file, { dryRun, ...opts });
      setReport(r);
      if (!dryRun) {
        toast({
          title: "Import terminé",
          description: `${r.imported} ligne(s) ajoutée(s), ${r.skipped_existing} déjà présente(s), ${r.skipped_error} erreur(s).`,
        });
        // Invalidate relevant query caches so the rest of the app picks up the new rows.
        queryClient.invalidateQueries({ queryKey: [`/api/${kind}`] });
        if (kind === "fournisseurs") {
          queryClient.invalidateQueries({ queryKey: ["/api/produits/fournisseurs"] });
        }
      }
    } catch (e) {
      toast({
        title: "Échec de l'import",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setBusy("idle");
    }
  }

  function onConfirmImport() {
    if (!file) return;
    const ok = window.confirm(
      `Cette action va analyser le fichier « ${file.name} » et ajouter les nouvelles lignes à la base de données. Les doublons seront ignorés. Continuer ?`,
    );
    if (ok) void run(false);
  }

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTypeSelector && (
          <div className="grid grid-cols-2 gap-3">
            <Select value={typeMode} onValueChange={(v) => setTypeMode(v as "all" | "single")}>
              <SelectTrigger data-testid={`select-${kind}-mode`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types dans un seul fichier</SelectItem>
                <SelectItem value="single">Fichier pour un seul type</SelectItem>
              </SelectContent>
            </Select>
            {typeMode === "single" && (
              <Select value={singleType} onValueChange={setSingleType}>
                <SelectTrigger data-testid={`select-${kind}-type`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VR">VR — Verre / Plexi</SelectItem>
                  <SelectItem value="FA">FA — Façonnage</SelectItem>
                  <SelectItem value="AU">AU — Autres</SelectItem>
                  <SelectItem value="SD">SD — Service direct</SelectItem>
                  <SelectItem value="EN">EN — Encadrement</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }}
            data-testid={`input-${kind}-file`}
            className="bg-background/50"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!file || busy !== "idle"}
            onClick={() => void run(true)}
            data-testid={`button-${kind}-analyze`}
          >
            {busy === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Analyser
          </Button>
          <Button
            type="button"
            disabled={!file || busy !== "idle"}
            onClick={onConfirmImport}
            data-testid={`button-${kind}-import`}
          >
            {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importer
          </Button>
        </div>
        {report && <ReportPanel report={report} />}
      </CardContent>
    </Card>
  );
}

export function ImportSection() {
  const [open, setOpen] = useState(true);
  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Upload className="h-5 w-5 text-primary" /> Importer depuis FileMaker
        </CardTitle>
        <CardDescription>
          Importez vos données existantes (Fournisseurs, Clients, Produits) depuis FileMaker Pro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between border border-border/40 bg-background/40">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Comment exporter depuis FileMaker</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="rounded-lg border border-border/40 bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground">
              Exportez chaque liste (Fournisseurs, Clients, Produits) en format <strong className="text-foreground">Excel (.xlsx)</strong> ou <strong className="text-foreground">CSV</strong> depuis FileMaker, puis chargez les fichiers ici. Les lignes en double seront automatiquement ignorées (jamais écrasées). <strong className="text-foreground">Les fournisseurs doivent être importés avant les produits</strong>, car les produits référencent les fournisseurs par leur nom.
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ImportCard
          kind="fournisseurs"
          title="Fournisseurs"
          description="Doublons détectés sur nom + version tarif."
        />
        <ImportCard
          kind="clients"
          title="Clients"
          description="Doublons détectés sur le nom du client."
        />
        <ImportCard
          kind="produits"
          title="Produits"
          description="Doublons détectés sur la référence (Réf). Importez les fournisseurs avant les produits."
          showTypeSelector
        />
      </CardContent>
    </Card>
  );
}
