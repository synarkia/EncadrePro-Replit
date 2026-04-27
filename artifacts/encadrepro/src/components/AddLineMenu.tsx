import { useState, useEffect } from "react";
import { Layers, Wrench, Briefcase, ArrowLeft, FilePlus2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ProductSearchCombobox, type ProduitSearchResult,
} from "./ProductSearchCombobox";
import type { ProductTypeCode } from "@/lib/product-types";

/* WEB-TO-DESKTOP NOTE: 2-stage line creator. Stage 1: pick the kind
   (Matière / Façonnage / Service). Stage 2: search the catalogue filtered
   to the matching product types, with a "ligne libre" escape hatch. */

export type TypeLigne = "matiere" | "faconnage" | "service";

const TYPE_OPTIONS: {
  value: TypeLigne;
  label: string;
  emoji: string;
  icon: React.ElementType;
  description: string;
  accent: string;
  typeCodes: ProductTypeCode[];
  searchPlaceholder: string;
}[] = [
  {
    value: "matiere",
    label: "Matière",
    emoji: "🧱",
    icon: Layers,
    description: "Encadrement, verre, accessoire — facturé à la pièce, au ml ou au m².",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/40 text-violet-200",
    typeCodes: ["EN", "VR", "AU"],
    searchPlaceholder: "Chercher dans encadrements, verres, accessoires…",
  },
  {
    value: "faconnage",
    label: "Façonnage",
    emoji: "✂️",
    icon: Wrench,
    description: "Coupe, polissage, biseautage… optionnellement facturé au mètre.",
    accent: "from-blue-500/20 to-blue-500/5 border-blue-500/40 text-blue-200",
    typeCodes: ["FA"],
    searchPlaceholder: "Chercher un façonnage…",
  },
  {
    value: "service",
    label: "Service",
    emoji: "🛠️",
    icon: Briefcase,
    description: "Pose, livraison, main d'œuvre — facturé à l'unité ou à l'heure.",
    accent: "from-green-500/20 to-green-500/5 border-green-500/40 text-green-200",
    typeCodes: ["SD"],
    searchPlaceholder: "Chercher un service…",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddLine: (type: TypeLigne, produit: ProduitSearchResult | null) => void;
  contextLabel?: string;
};

export function AddLineMenu({ open, onOpenChange, onAddLine, contextLabel }: Props) {
  const [stage, setStage] = useState<"choose" | "pick">("choose");
  const [type, setType] = useState<TypeLigne>("matiere");

  // Reset to "choose" each time the dialog opens so the user always
  // starts from the type picker.
  useEffect(() => {
    if (open) setStage("choose");
  }, [open]);

  const opt = TYPE_OPTIONS.find(o => o.value === type)!;

  const handleSelectType = (t: TypeLigne) => {
    setType(t);
    setStage("pick");
  };

  const handleSelectProduit = (p: ProduitSearchResult) => {
    onAddLine(type, p);
    onOpenChange(false);
  };

  const handleAddLibre = () => {
    onAddLine(type, null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-2xl">
        {stage === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Ajouter une ligne</DialogTitle>
              <DialogDescription>
                {contextLabel
                  ? <>Choisis le type de ligne à ajouter au projet <strong>{contextLabel}</strong>.</>
                  : "Choisis le type de ligne à créer."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
              {TYPE_OPTIONS.map(o => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => handleSelectType(o.value)}
                    data-testid={`add-line-type-${o.value}`}
                    className={`group flex flex-col items-start gap-2 rounded-xl border bg-gradient-to-br p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${o.accent}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl leading-none" aria-hidden>{o.emoji}</span>
                      <Icon className="h-4 w-4 opacity-70" />
                    </div>
                    <div>
                      <div className="font-semibold text-base">{o.label}</div>
                      <p className="text-xs opacity-80 mt-1 leading-snug">{o.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1 text-muted-foreground"
                  onClick={() => setStage("choose")}
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{opt.emoji}</span>
                  Ajouter — {opt.label}
                </DialogTitle>
              </div>
              <DialogDescription>
                Sélectionne un produit du catalogue, ou crée une ligne libre sans produit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <ProductSearchCombobox
                typeCodes={opt.typeCodes}
                placeholder={opt.searchPlaceholder}
                onSelect={handleSelectProduit}
                showSupplierPills={type === "matiere"}
              />
              <div className="flex justify-center pt-2 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleAddLibre}
                  data-testid={`add-line-libre-${type}`}
                >
                  <FilePlus2 className="h-3.5 w-3.5 mr-1.5" />
                  Créer une ligne libre (sans produit)
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
