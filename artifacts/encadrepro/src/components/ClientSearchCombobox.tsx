import { useState, useEffect, useRef } from "react";
import { Search, Plus, Phone, Mail, TrendingUp, Loader2, X, Check, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export type ClientSearchResult = {
  id: number;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  ca_total: number;
};

type NewClientForm = {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
};

interface ClientSearchComboboxProps {
  selectedClient: ClientSearchResult | null;
  onSelect: (client: ClientSearchResult) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ClientSearchCombobox({
  selectedClient,
  onSelect,
  onClear,
  placeholder = "Rechercher par nom, téléphone, email...",
  autoFocus = false,
}: ClientSearchComboboxProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<NewClientForm>({ prenom: "", nom: "", telephone: "", email: "", adresse: "" });
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && !selectedClient) inputRef.current?.focus();
  }, [autoFocus, selectedClient]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/clients/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as ClientSearchResult[];
        setResults(data);
        setOpen(true);
        setHighlightedIndex(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 220);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNewForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showNewForm) return;
    const total = results.length + 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex < results.length) handleSelect(results[highlightedIndex]);
      else { setShowNewForm(true); setNewForm(f => ({ ...f, nom: query })); }
    }
    else if (e.key === "Escape") { setOpen(false); setShowNewForm(false); }
  };

  const handleSelect = (client: ClientSearchResult) => {
    onSelect(client);
    setQuery("");
    setOpen(false);
    setResults([]);
    setShowNewForm(false);
  };

  const handleSaveNew = async () => {
    if (!newForm.nom.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newForm.nom.trim(),
          prenom: newForm.prenom.trim() || null,
          telephone: newForm.telephone.trim() || null,
          email: newForm.email.trim() || null,
          adresse: newForm.adresse.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const created = await res.json() as { id: number; nom: string; prenom?: string | null; telephone?: string | null; email?: string | null };
      const newClient: ClientSearchResult = {
        id: created.id, nom: created.nom,
        prenom: created.prenom ?? null, telephone: created.telephone ?? null,
        email: created.email ?? null, ca_total: 0,
      };
      toast({ title: "Client créé", description: `${newForm.prenom} ${newForm.nom}`.trim() });
      handleSelect(newClient);
      setNewForm({ prenom: "", nom: "", telephone: "", email: "", adresse: "" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le client.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const initials = (client: ClientSearchResult) =>
    `${client.prenom?.[0] ?? ""}${client.nom[0] ?? ""}`.toUpperCase() || "?";

  if (selectedClient) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
        <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {initials(selectedClient)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{selectedClient.prenom} {selectedClient.nom}</p>
          <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
            {selectedClient.telephone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{selectedClient.telephone}</span>}
            {selectedClient.email && <span className="truncate max-w-[160px]">{selectedClient.email}</span>}
            {selectedClient.ca_total > 0 && (
              <span className="flex items-center gap-0.5 text-accent font-medium">
                <TrendingUp className="h-2.5 w-2.5" />{formatCurrency(selectedClient.ca_total)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Check className="h-4 w-4 text-green-400" />
          {onClear && (
            <button type="button" onClick={onClear} className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />}
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9 h-10 bg-background/60 border-border/60"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border/50 bg-popover shadow-xl shadow-black/30 overflow-hidden">
          {showNewForm ? (
            /* ── Inline new client form ──────────────────── */
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-primary">Nouveau client</p>
                <button type="button" onClick={() => setShowNewForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newForm.prenom}
                  onChange={e => setNewForm(f => ({ ...f, prenom: e.target.value }))}
                  placeholder="Prénom"
                  className="h-8 text-sm bg-background/60 border-border/60"
                />
                <Input
                  value={newForm.nom}
                  onChange={e => setNewForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom *"
                  className="h-8 text-sm bg-background/60 border-border/60"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={newForm.telephone}
                    onChange={e => setNewForm(f => ({ ...f, telephone: e.target.value }))}
                    placeholder="Téléphone"
                    className="h-8 text-sm pl-7 bg-background/60 border-border/60"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={newForm.email}
                    onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    type="email"
                    className="h-8 text-sm pl-7 bg-background/60 border-border/60"
                  />
                </div>
              </div>
              <Input
                value={newForm.adresse}
                onChange={e => setNewForm(f => ({ ...f, adresse: e.target.value }))}
                placeholder="Adresse (optionnel)"
                className="h-8 text-sm bg-background/60 border-border/60"
              />
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowNewForm(false)}>Annuler</Button>
                <Button size="sm" className="flex-1 h-8 text-xs" disabled={!newForm.nom.trim() || saving} onClick={handleSaveNew}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Créer et sélectionner
                </Button>
              </div>
            </div>
          ) : (
            /* ── Results list ──────────────────────────────── */
            <ul className="py-1 max-h-72 overflow-y-auto">
              {results.length === 0 && !loading && (
                <li className="px-4 py-3 text-sm text-muted-foreground text-center">Aucun résultat pour "{query}"</li>
              )}
              {results.map((c, i) => (
                <li
                  key={c.id}
                  className={`px-3 py-2.5 cursor-pointer transition-colors ${i === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {initials(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.prenom} {c.nom}</p>
                      <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                        {c.telephone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{c.telephone}</span>}
                        {c.email && <span className="truncate max-w-[180px]">{c.email}</span>}
                      </div>
                    </div>
                    {c.ca_total > 0 && (
                      <span className="text-xs font-semibold text-accent shrink-0">{formatCurrency(c.ca_total)}</span>
                    )}
                  </div>
                </li>
              ))}
              <li
                className={`px-3 py-2.5 cursor-pointer transition-colors border-t border-border/30 ${highlightedIndex === results.length ? "bg-primary/10" : "hover:bg-muted/50"}`}
                onMouseEnter={() => setHighlightedIndex(results.length)}
                onMouseDown={e => {
                  e.preventDefault();
                  setShowNewForm(true);
                  setNewForm(f => ({ ...f, nom: query.length >= 2 ? query : "" }));
                }}
              >
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <div className="h-7 w-7 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <span>Nouveau client{query.length >= 2 ? ` "${query}"` : ""}...</span>
                </div>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* Prompt to type when not open */}
      {!open && query.length < 2 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <User className="h-3 w-3" />
          <span>Tapez 2+ caractères pour rechercher</span>
          <span className="mx-1">·</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => { setShowNewForm(true); setOpen(true); }}
          >
            + Nouveau client
          </button>
        </div>
      )}
    </div>
  );
}
