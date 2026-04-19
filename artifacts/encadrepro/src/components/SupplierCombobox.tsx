import { useState, useEffect, useRef } from "react";
import { Search, Plus, Building2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useListFournisseurs, getListFournisseursQueryKey, useCreateFournisseur } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/* WEB-TO-DESKTOP NOTE: thin wrapper around /fournisseurs REST. In Electron, swap fetch
   for an IPC channel — but the public API of this component stays identical. */

export interface SupplierComboboxProps {
  value: number | null;
  onChange: (id: number | null, label?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SupplierCombobox({ value, onChange, placeholder = "Sélectionner un fournisseur…", disabled }: SupplierComboboxProps) {
  const { data: suppliers, isLoading } = useListFournisseurs();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createFournisseur = useCreateFournisseur();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ nom: "", version_tarif: "", contact_nom: "", contact_email: "", contact_tel: "" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = suppliers?.find(s => s.id === value) ?? null;
  const filtered = (suppliers ?? []).filter(s =>
    !query || s.nom.toLowerCase().includes(query.toLowerCase()) ||
    (s.version_tarif && s.version_tarif.toLowerCase().includes(query.toLowerCase()))
  );

  const labelOf = (s: { nom: string; version_tarif?: string | null }) =>
    s.version_tarif ? `${s.nom} — ${s.version_tarif}` : s.nom;

  const handleSelect = (id: number, label: string) => {
    onChange(id, label);
    setOpen(false);
    setShowCreate(false);
    setQuery("");
  };

  const handleCreate = () => {
    if (!newForm.nom.trim()) return;
    createFournisseur.mutate({
      data: {
        nom: newForm.nom.trim(),
        version_tarif: newForm.version_tarif.trim() || null,
        contact_nom: newForm.contact_nom.trim() || null,
        contact_email: newForm.contact_email.trim() || null,
        contact_tel: newForm.contact_tel.trim() || null,
      },
    }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListFournisseursQueryKey() });
        toast({ title: "Fournisseur créé", description: created.nom });
        handleSelect(created.id, labelOf(created));
        setNewForm({ nom: "", version_tarif: "", contact_nom: "", contact_email: "", contact_tel: "" });
      },
      onError: () => toast({ title: "Erreur", description: "Création impossible.", variant: "destructive" }),
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full h-8 px-3 text-sm rounded-md border border-border/60 bg-background/60 hover:border-primary/40 transition-colors disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? labelOf(selected) : placeholder}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border/50 bg-popover shadow-xl shadow-black/30 overflow-hidden">
          {!showCreate && (
            <>
              <div className="relative border-b border-border/30">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher un fournisseur…"
                  className="pl-9 h-9 text-sm border-0 focus-visible:ring-0 bg-transparent"
                />
              </div>

              <ul className="py-1 max-h-56 overflow-y-auto">
                {isLoading && (
                  <li className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
                  </li>
                )}
                {!isLoading && filtered.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat.</li>
                )}
                {filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={e => { e.preventDefault(); handleSelect(s.id, labelOf(s)); }}
                    className={`px-3 py-2 cursor-pointer text-sm transition-colors flex items-center gap-2 ${value === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                  >
                    {value === s.id ? <Check className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5 opacity-50" />}
                    <span className="truncate">{labelOf(s)}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setShowCreate(true); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-primary font-medium border-t border-border/30 hover:bg-primary/10 transition-colors"
              >
                <Plus className="h-4 w-4" /> Nouveau fournisseur
              </button>
            </>
          )}

          {showCreate && (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouveau fournisseur</p>
              <Input className="h-8 text-sm" placeholder="Nom *" value={newForm.nom} onChange={e => setNewForm(f => ({ ...f, nom: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="Version du tarif (ex: 02/2025)" value={newForm.version_tarif} onChange={e => setNewForm(f => ({ ...f, version_tarif: e.target.value }))} />
              <Input className="h-8 text-sm" placeholder="Contact (nom)" value={newForm.contact_nom} onChange={e => setNewForm(f => ({ ...f, contact_nom: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-8 text-sm" placeholder="Email" value={newForm.contact_email} onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} />
                <Input className="h-8 text-sm" placeholder="Téléphone" value={newForm.contact_tel} onChange={e => setNewForm(f => ({ ...f, contact_tel: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button size="sm" className="h-7" disabled={!newForm.nom.trim() || createFournisseur.isPending} onClick={handleCreate}>
                  {createFournisseur.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Créer"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
