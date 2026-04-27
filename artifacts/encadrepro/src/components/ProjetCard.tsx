import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, GripVertical, MoreVertical, Pencil, Copy, Trash2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Projet } from "@workspace/api-client-react";
import { PROJET_TYPE_OPTIONS, type ProjetType } from "./ProjetSheet";

const TYPE_BY_VALUE = Object.fromEntries(PROJET_TYPE_OPTIONS.map(o => [o.value, o]));

function formatDimensions(w: number | null | undefined, h: number | null | undefined) {
  if (w == null && h == null) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
  if (w != null && h != null) return `${fmt(w)} × ${fmt(h)} cm`;
  if (w != null) return `${fmt(w)} cm (largeur)`;
  return `${fmt(h!)} cm (hauteur)`;
}

type LigneSummary = { id: number | string; designation: string };

type Props = {
  projet: Projet;
  lignes: LigneSummary[];
  isEditable: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddLine?: () => void;
};

export function ProjetCard({ projet, lignes, isEditable, onEdit, onDuplicate, onDelete, onAddLine }: Props) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: projet.id, disabled: !isEditable });

  const [open, setOpen] = useState(true);

  const opt = TYPE_BY_VALUE[projet.type as ProjetType] ?? TYPE_BY_VALUE.encadrement;
  const dims = formatDimensions(projet.width_cm, projet.height_cm);
  const title = projet.label?.trim() || opt.label;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-panel rounded-xl border border-border/50 bg-card/60 overflow-hidden"
      data-testid={`projet-card-${projet.id}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {isEditable && (
            <button
              type="button"
              className="p-1.5 -ml-1 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5 cursor-grab active:cursor-grabbing touch-none"
              aria-label="Réordonner"
              {...attributes}
              {...listeners}
              data-testid={`projet-drag-${projet.id}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-3 text-left rounded-md px-1 py-1 hover:bg-white/5 transition-colors"
            >
              <span className="text-2xl leading-none" aria-hidden>{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{title}</span>
                  {projet.label && (
                    <span className="text-xs text-muted-foreground rounded-full border border-border/50 px-2 py-0.5">
                      {opt.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {dims ? <span>{dims}</span> : <span className="italic">Dimensions non précisées</span>}
                  <span aria-hidden>·</span>
                  <span>{lignes.length} {lignes.length > 1 ? "lignes" : "ligne"}</span>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>

          {isEditable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  data-testid={`projet-menu-${projet.id}`}
                  aria-label="Options du projet"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-panel">
                <DropdownMenuItem onClick={onEdit} data-testid={`projet-edit-${projet.id}`}>
                  <Pencil className="h-4 w-4 mr-2" /> Éditer le projet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} data-testid={`projet-duplicate-${projet.id}`}>
                  <Copy className="h-4 w-4 mr-2" /> Dupliquer le projet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                  data-testid={`projet-delete-${projet.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer le projet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t border-border/40 px-3 py-3 space-y-2">
            {lignes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground/70 italic">
                Aucune ligne dans ce projet.
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {lignes.map(l => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="truncate text-muted-foreground">{l.designation || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="glass-panel text-primary border-primary/30 hover:bg-primary/10 w-full"
                disabled={!isEditable || !onAddLine}
                onClick={onAddLine}
                data-testid={`projet-add-line-${projet.id}`}
                title={onAddLine ? undefined : "Bientôt disponible"}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ajouter une ligne
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
