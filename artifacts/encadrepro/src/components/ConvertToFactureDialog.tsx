import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ConvertPayload = {
  acompte_montant: number | null;
  mode_paiement: "cb" | "especes" | "virement" | "lien" | null;
  reference_virement: string | null;
  date_echeance: string;
  note_interne: string | null;
};

type Preset = "0" | "30" | "50" | "100" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "0", label: "0 %" },
  { value: "30", label: "30 %" },
  { value: "50", label: "50 %" },
  { value: "100", label: "100 %" },
  { value: "custom", label: "Custom" },
];

const PAYMENT_MODES: { value: ConvertPayload["mode_paiement"]; label: string }[] = [
  { value: "cb", label: "CB" },
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement" },
  { value: "lien", label: "Lien de paiement" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devisNumero: string;
  totalTtc: number;
  isPending: boolean;
  onSubmit: (payload: ConvertPayload) => void;
}

export function ConvertToFactureDialog({
  open, onOpenChange, devisNumero, totalTtc, isPending, onSubmit,
}: Props) {
  const [preset, setPreset] = useState<Preset>("0");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [mode, setMode] = useState<ConvertPayload["mode_paiement"]>(null);
  const [reference, setReference] = useState("");
  const [echeance, setEcheance] = useState<string>(todayIso());
  const [note, setNote] = useState("");

  // Reset whenever the dialog re-opens so a stale value never leaks across
  // two consecutive conversions.
  useEffect(() => {
    if (open) {
      setPreset("0");
      setCustomAmount("");
      setMode(null);
      setReference("");
      setEcheance(todayIso());
      setNote("");
    }
  }, [open]);

  const acompteMontant = useMemo(() => {
    if (preset === "custom") {
      const n = parseFloat(customAmount.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return 0;
      return round2(n);
    }
    const pct = parseInt(preset, 10);
    return round2((totalTtc * pct) / 100);
  }, [preset, customAmount, totalTtc]);

  const acomptePct = totalTtc > 0 ? round2((acompteMontant / totalTtc) * 100) : 0;
  const resteAPayer = round2(Math.max(0, totalTtc - acompteMontant));
  const overTotal = acompteMontant > totalTtc + 0.01;
  const needsMode = acompteMontant > 0;
  // Spec range is [0, total TTC]: empty input is invalid, but explicit "0" is allowed
  // (equivalent to picking the 0% chip while keeping the user in custom mode).
  const customInvalid = preset === "custom" && (customAmount.trim() === "" || acompteMontant < 0);
  const submitDisabled =
    isPending ||
    overTotal ||
    customInvalid ||
    (needsMode && !mode) ||
    !echeance;

  const handleSubmit = () => {
    if (submitDisabled) return;
    onSubmit({
      acompte_montant: acompteMontant > 0 ? acompteMontant : null,
      mode_paiement: needsMode ? mode : null,
      reference_virement:
        needsMode && mode === "virement" && reference.trim().length > 0
          ? reference.trim()
          : null,
      date_echeance: echeance,
      note_interne: note.trim().length > 0 ? note.trim() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-panel max-w-lg"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            const target = e.target as HTMLElement;
            // Allow Enter inside textarea to insert newlines.
            if (target.tagName !== "TEXTAREA") {
              e.preventDefault();
              handleSubmit();
            }
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Convertir le devis {devisNumero} en facture</DialogTitle>
          <DialogDescription>
            Renseignez l'acompte versé, le mode de règlement et l'échéance du
            solde. La facture sera créée et le devis passera en « Converti ».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Acompte preset chips ───────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Acompte versé</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  data-active={preset === p.value}
                  className={cn(
                    "px-3 py-1.5 rounded-md border text-sm transition-colors",
                    preset === p.value
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "border-border hover:bg-muted",
                  )}
                  data-testid={`preset-acompte-${p.value}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="Montant en €"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="max-w-[180px]"
                  data-testid="input-acompte-custom"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">
                  ≈ {acomptePct.toFixed(1)} % du total TTC
                </span>
              </div>
            )}

            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">
                Total TTC : {formatCurrency(totalTtc)}
              </span>
              <span data-testid="reste-a-payer">
                <span className="text-muted-foreground">Reste à payer : </span>
                <span className="font-semibold">{formatCurrency(resteAPayer)}</span>
              </span>
            </div>
            {overTotal && (
              <p className="text-xs text-destructive" role="alert">
                L'acompte ne peut pas dépasser le total TTC.
              </p>
            )}
          </div>

          {/* ── Payment mode (only when acompte > 0) ───────────────────── */}
          {needsMode && (
            <div className="space-y-2" data-testid="mode-paiement-block">
              <Label>Mode de règlement</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-sm transition-colors",
                      mode === m.value
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border hover:bg-muted",
                    )}
                    data-testid={`mode-${m.value}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {mode === "virement" && (
                <Input
                  type="text"
                  placeholder="Référence virement (optionnel)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  data-testid="input-reference-virement"
                />
              )}
            </div>
          )}

          {/* ── Échéance solde ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="convert-echeance">Échéance du solde</Label>
            <Input
              id="convert-echeance"
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              data-testid="input-echeance"
            />
            <p className="text-xs text-muted-foreground">
              Par défaut : aujourd'hui (paiement comptant). Pour un client B2B,
              choisissez par exemple J+30.
            </p>
          </div>

          {/* ── Note interne ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="convert-note">Note interne (optionnel)</Label>
            <Textarea
              id="convert-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Visible sur la facture en remplacement des notes du devis."
              data-testid="input-note-interne"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="bg-violet-600 hover:bg-violet-500 text-white"
            data-testid="button-confirm-convert"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
