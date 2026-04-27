import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import type { Projet } from "@workspace/api-client-react";

export type ProjetType = "encadrement" | "verre" | "miroir" | "vitrage" | "autre";

export const PROJET_TYPE_OPTIONS: ReadonlyArray<{
  value: ProjetType;
  label: string;
  emoji: string;
}> = [
  { value: "encadrement", label: "Encadrement",      emoji: "🖼️" },
  { value: "verre",       label: "Verre",            emoji: "🪧" },
  { value: "miroir",      label: "Miroir",           emoji: "🪞" },
  { value: "vitrage",     label: "Vitrage/Chantier", emoji: "🏗️" },
  { value: "autre",       label: "Autre",            emoji: "✨" },
];

export type ProjetFormValues = {
  type: ProjetType;
  width_cm: number | null;
  height_cm: number | null;
  label: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Projet | null;
  onSubmit: (values: ProjetFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
};

export function ProjetSheet({ open, onOpenChange, mode, initial, onSubmit, isSubmitting }: Props) {
  const [type, setType] = useState<ProjetType>("encadrement");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    if (open) {
      setType(((initial?.type ?? "encadrement") as ProjetType));
      setWidth(initial?.width_cm != null ? String(initial.width_cm) : "");
      setHeight(initial?.height_cm != null ? String(initial.height_cm) : "");
      setLabel(initial?.label ?? "");
    }
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = width.trim() === "" ? null : Number(width);
    const h = height.trim() === "" ? null : Number(height);
    onSubmit({
      type,
      width_cm: w != null && Number.isFinite(w) ? w : null,
      height_cm: h != null && Number.isFinite(h) ? h : null,
      label: label.trim() === "" ? null : label.trim(),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-panel w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border/40">
          <SheetTitle>{mode === "create" ? "Nouveau projet" : "Éditer le projet"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Ajoute un projet à ce devis pour regrouper ses lignes."
              : "Modifie le type, les dimensions ou le libellé du projet."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <Label>Type de projet</Label>
            <div className="grid grid-cols-2 gap-2">
              {PROJET_TYPE_OPTIONS.map(opt => {
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={[
                      "flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-all",
                      selected
                        ? "border-primary bg-primary/15 text-foreground shadow-sm"
                        : "border-border/50 bg-card/40 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground",
                    ].join(" ")}
                    data-testid={`projet-type-${opt.value}`}
                    aria-pressed={selected}
                  >
                    <span className="text-xl leading-none" aria-hidden>{opt.emoji}</span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="projet-width">Largeur (cm)</Label>
              <Input
                id="projet-width"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={width}
                onChange={e => setWidth(e.target.value)}
                placeholder="80"
                data-testid="projet-width"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projet-height">Hauteur (cm)</Label>
              <Input
                id="projet-height"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="60"
                data-testid="projet-height"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projet-label">Libellé (optionnel)</Label>
            <Input
              id="projet-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Photo Dupont salon"
              data-testid="projet-label"
            />
          </div>
        </form>

        <SheetFooter className="p-6 pt-4 border-t border-border/40 flex-row gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={isSubmitting} data-testid="projet-submit">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement…</>
            ) : (
              mode === "create" ? "Créer le projet" : "Enregistrer"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
