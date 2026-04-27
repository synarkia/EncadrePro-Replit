import { useMemo, useState } from "react";
import {
  DndContext, type DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateProjet, useUpdateProjet, useDeleteProjet, useReorderProjets,
  getGetDevisQueryKey, type Projet,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ProjetCard } from "./ProjetCard";
import { ProjetSheet, type ProjetFormValues, type ProjetType } from "./ProjetSheet";

type LigneRef = { id: number | string; designation: string; projet_id?: number | null };

type Props = {
  devisId: number;
  projets: Projet[];
  lignes: LigneRef[];
  isEditable: boolean;
};

export function ProjetSection({ devisId, projets, lignes, isEditable }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetDevisQueryKey(devisId) });

  const createProjet = useCreateProjet();
  const updateProjet = useUpdateProjet();
  const deleteProjet = useDeleteProjet();
  const reorderProjets = useReorderProjets();

  // Local order so drag-and-drop feels instant; server is the source of truth on next refetch.
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const ordered = useMemo(() => {
    const byId = new Map(projets.map(p => [p.id, p]));
    const idsFromServer = [...projets].sort((a, b) => a.position - b.position).map(p => p.id);
    const ids = orderedIds && orderedIds.every(id => byId.has(id)) && orderedIds.length === projets.length
      ? orderedIds
      : idsFromServer;
    return ids.map(id => byId.get(id)!).filter(Boolean);
  }, [projets, orderedIds]);

  const lignesByProjet = useMemo(() => {
    const map = new Map<number, LigneRef[]>();
    for (const l of lignes) {
      const pid = l.projet_id ?? null;
      if (pid == null) continue;
      const arr = map.get(pid) ?? [];
      arr.push(l);
      map.set(pid, arr);
    }
    return map;
  }, [lignes]);

  // ── Sheet state ────────────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Projet | null>(null);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (p: Projet) => { setEditing(p); setSheetOpen(true); };

  const handleSubmit = async (values: ProjetFormValues) => {
    try {
      if (editing) {
        await updateProjet.mutateAsync({
          id: editing.id,
          data: {
            type: values.type,
            width_cm: values.width_cm,
            height_cm: values.height_cm,
            label: values.label,
          },
        });
        toast({ title: "Projet mis à jour" });
      } else {
        await createProjet.mutateAsync({
          id: devisId,
          data: {
            type: values.type,
            width_cm: values.width_cm,
            height_cm: values.height_cm,
            label: values.label,
          },
        });
        toast({ title: "Projet créé" });
      }
      setSheetOpen(false);
      setEditing(null);
      invalidate();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer le projet.",
        variant: "destructive",
      });
    }
  };

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const handleDuplicate = async (p: Projet) => {
    try {
      const baseLabel = p.label?.trim() || "Projet";
      await createProjet.mutateAsync({
        id: devisId,
        data: {
          type: p.type as ProjetType,
          width_cm: p.width_cm ?? null,
          height_cm: p.height_cm ?? null,
          label: `${baseLabel} (copie)`,
        },
      });
      toast({ title: "Projet dupliqué" });
      invalidate();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de dupliquer le projet.",
        variant: "destructive",
      });
    }
  };

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProjet.mutateAsync({ id: deleteTarget.id });
      toast({ title: "Projet supprimé" });
      setDeleteTarget(null);
      invalidate();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de supprimer le projet.",
        variant: "destructive",
      });
    }
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex(p => p.id === active.id);
    const newIndex = ordered.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex).map(p => p.id);
    setOrderedIds(next);
    reorderProjets.mutate(
      { id: devisId, data: { ids: next } },
      {
        onSuccess: () => invalidate(),
        onError: (err) => {
          setOrderedIds(null); // revert
          toast({
            title: "Erreur",
            description: err instanceof Error ? err.message : "Réordonnancement impossible.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3" data-testid="projet-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Projets
          {ordered.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({ordered.length})</span>
          )}
        </h2>
        {isEditable && (
          <Button
            size="sm"
            onClick={openCreate}
            data-testid="projet-add-button"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Ajouter un projet
          </Button>
        )}
      </div>

      {ordered.length === 0 ? (
        <div
          className={[
            "text-center py-12 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-card/20 transition-colors",
            isEditable ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5" : "",
          ].join(" ")}
          onClick={() => isEditable && openCreate()}
        >
          {isEditable ? (
            <>
              <Plus className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium">Aucun projet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Crée un projet pour regrouper les lignes (cadre, verre, miroir…).
              </p>
            </>
          ) : (
            <p>Aucun projet sur ce devis.</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ordered.map(p => (
                <ProjetCard
                  key={p.id}
                  projet={p}
                  lignes={lignesByProjet.get(p.id) ?? []}
                  isEditable={isEditable}
                  onEdit={() => openEdit(p)}
                  onDuplicate={() => handleDuplicate(p)}
                  onDelete={() => setDeleteTarget(p)}
                  // onAddLine intentionally unset — wired in the next prompt.
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ProjetSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditing(null); }}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onSubmit={handleSubmit}
        isSubmitting={createProjet.isPending || updateProjet.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (lignesByProjet.get(deleteTarget.id)?.length ?? 0) > 0
                ? "Les lignes attachées resteront dans le devis comme lignes libres."
                : "Cette action est irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="projet-delete-confirm"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
