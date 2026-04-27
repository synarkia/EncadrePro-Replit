import { useEffect, useState } from "react";
import { Loader2, Layers, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

/**
 * Project types that ship with a "skeleton" template (pre-created lignes
 * the user just has to fill in). Right now only "vitrage" (chantier) does:
 * a chantier almost always means one matière line (the glass) plus one
 * service line (pose hours). Add more types here as the pattern grows.
 */
export const TEMPLATE_PROJET_TYPES: ReadonlySet<ProjetType> = new Set(["vitrage"]);

export type ProjetFormValues = {
  type: ProjetType;
  width_cm: number | null;
  height_cm: number | null;
  label: string | null;
  /** Only meaningful in "create" mode for a type in TEMPLATE_PROJET_TYPES.
   *  When true, the parent will pre-create the template's lignes after
   *  the projet itself has been persisted. Ignored for edit. */
  use_template: boolean;
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
  // Default ON; only flipped by the user via the Switch. The "touched" flag
  // distinguishes auto-defaults (re-applied on sheet open + on type change)
  // from explicit user intent (which we preserve across type switches).
  const [useTemplate, setUseTemplateState] = useState<boolean>(true);
  const [templateUserTouched, setTemplateUserTouched] = useState<boolean>(false);
  const setUseTemplate = (next: boolean) => {
    setTemplateUserTouched(true);
    setUseTemplateState(next);
  };

  useEffect(() => {
    if (open) {
      const initialType = (initial?.type ?? "encadrement") as ProjetType;
      setType(initialType);
      setWidth(initial?.width_cm != null ? String(initial.width_cm) : "");
      setHeight(initial?.height_cm != null ? String(initial.height_cm) : "");
      setLabel(initial?.label ?? "");
      // Reset the toggle (and clear any prior manual override) every time
      // the sheet opens so each "Nouveau projet" starts from the default
      // for the currently-selected type.
      setUseTemplateState(TEMPLATE_PROJET_TYPES.has(initialType));
      setTemplateUserTouched(false);
    }
  }, [open, initial]);

  // When the user switches projet type inside the sheet, only auto-default
  // the toggle if they HAVEN'T explicitly toggled it yet. This way someone
  // who turned the template OFF for vitrage and briefly switched away won't
  // have it silently flipped back ON when they return to vitrage.
  useEffect(() => {
    if (!templateUserTouched) {
      setUseTemplateState(TEMPLATE_PROJET_TYPES.has(type));
    }
  }, [type, templateUserTouched]);

  const hasTemplate = TEMPLATE_PROJET_TYPES.has(type);
  const showTemplateToggle = mode === "create" && hasTemplate;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = width.trim() === "" ? null : Number(width);
    const h = height.trim() === "" ? null : Number(height);
    onSubmit({
      type,
      width_cm: w != null && Number.isFinite(w) ? w : null,
      height_cm: h != null && Number.isFinite(h) ? h : null,
      label: label.trim() === "" ? null : label.trim(),
      // Only meaningful for create + templateable types; the parent guards
      // the cascade anyway, so it's safe to always send the current toggle.
      use_template: showTemplateToggle && useTemplate,
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

          {/* ── Template toggle (only shown for templateable types in create mode) ──
              For chantier, we pre-create one matière (vitrage) + one service
              (pose). The user can keep the toggle off to start from scratch. */}
          {showTemplateToggle && (
            <div
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2"
              data-testid="projet-template-block"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="projet-template-toggle" className="text-sm font-medium text-foreground">
                    Utiliser le template chantier
                  </Label>
                  <p className="text-xs text-muted-foreground/80">
                    Crée 1 ligne matière (vitrage) + 1 ligne service (pose) à remplir.
                  </p>
                </div>
                <Switch
                  id="projet-template-toggle"
                  checked={useTemplate}
                  onCheckedChange={setUseTemplate}
                  data-testid="projet-template-toggle"
                />
              </div>
              {useTemplate && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] text-cyan-200/90 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                    <Layers className="h-3 w-3" /> Matière (vitrage)
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-cyan-200/90 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                    <Briefcase className="h-3 w-3" /> Service (pose)
                  </span>
                </div>
              )}
            </div>
          )}

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
