import { useState, useEffect, useRef } from "react";
import { Search, Plus, Building2, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { getProductType, type ProductTypeCode } from "@/lib/product-types";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/* WEB-TO-DESKTOP NOTE: type filter is the new 5-code typology (VR/FA/AU/SD/EN). */

export type ProduitSearchResult = {
  id: number;
  type_code: ProductTypeCode | null;
  pricing_mode: string | null;
  type_produit: string | null;
  designation: string;
  reference: string | null;
  fournisseur: string | null;
  fournisseur_id: number | null;
  sous_categorie: string | null;
  unite: string | null;
  unite_calcul: string;
  prix_ht: number;
  prix_achat_ht: number | null;
  coefficient_marge: number | null;
  taux_tva: number;
};

interface ProductSearchComboboxProps {
  /** Filter the search to one or more 5-code types (VR/FA/AU/SD/EN). */
  typeCodes?: ProductTypeCode[];
  placeholder?: string;
  onSelect: (produit: ProduitSearchResult) => void;
  onCreateNew?: () => void;
  autoFocus?: boolean;
  showSupplierPills?: boolean;
}

export function ProductSearchCombobox({
  typeCodes,
  placeholder = "Rechercher un produit... (2+ caractères)",
  onSelect,
  onCreateNew,
  autoFocus = false,
  showSupplierPills = false,
}: ProductSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProduitSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!showSupplierPills) return;
    fetch(`${BASE_URL}/api/produits/fournisseurs`)
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => setSuppliers([]));
  }, [showSupplierPills]);

  const typeKey = (typeCodes ?? []).join(",");

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        // The backend currently filters by a single type_code; for multi-type
        // searches (e.g. EN+VR+AU in the matière bucket) we fetch unfiltered
        // and apply the union client-side.
        if (typeCodes && typeCodes.length === 1) params.set("type_code", typeCodes[0]);
        if (activeSupplier) params.set("fournisseur", activeSupplier);
        const res = await fetch(`${BASE_URL}/api/produits/search?${params}`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json() as ProduitSearchResult[];
        const filtered = typeCodes && typeCodes.length > 1
          ? data.filter(p => p.type_code && typeCodes.includes(p.type_code))
          : data;
        setResults(filtered);
        setOpen(true);
        setHighlightedIndex(0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 220);
  }, [query, typeKey, activeSupplier]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const total = results.length + (onCreateNew ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex]);
      } else if (onCreateNew) {
        onCreateNew();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleSelect = (produit: ProduitSearchResult) => {
    onSelect(produit);
    setQuery("");
    setOpen(false);
    setResults([]);
  };

  function typeBadge(code: ProductTypeCode | null) {
    const meta = getProductType(code);
    return (
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.color}`}>
        {meta.code}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Supplier pills */}
      {showSupplierPills && suppliers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suppliers.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSupplier(activeSupplier === s ? null : s)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all ${
                activeSupplier === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Building2 className="h-2.5 w-2.5" />
              {s}
              {activeSupplier === s && <X className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />}
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={activeSupplier ? `Chercher chez ${activeSupplier}...` : placeholder}
          className="pl-9 pr-9 h-9 text-sm bg-background/60 border-border/60"
        />
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || onCreateNew) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border/50 bg-popover shadow-xl shadow-black/30 overflow-hidden">
          <ul className="py-1 max-h-64 overflow-y-auto">
            {results.map((p, i) => (
              <li
                key={p.id}
                className={`px-3 py-2.5 cursor-pointer transition-colors ${i === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/50"}`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
              >
                <div className="flex items-center gap-2">
                  {typeBadge(p.type_code)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.designation}</span>
                      {p.reference && <span className="text-[10px] text-muted-foreground font-mono shrink-0">[{p.reference}]</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.fournisseur && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                          <Building2 className="h-2.5 w-2.5" />{p.fournisseur}
                        </span>
                      )}
                      {p.sous_categorie && <span className="text-[10px] text-muted-foreground/50">· {p.sous_categorie}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-accent">{formatCurrency(p.prix_ht)}</div>
                    <div className="text-[10px] text-muted-foreground">{p.unite ?? p.unite_calcul} · TVA {p.taux_tva}%</div>
                  </div>
                </div>
              </li>
            ))}
            {onCreateNew && (
              <li
                className={`px-3 py-2.5 cursor-pointer transition-colors border-t border-border/30 ${highlightedIndex === results.length ? "bg-primary/10" : "hover:bg-muted/50"}`}
                onMouseEnter={() => setHighlightedIndex(results.length)}
                onMouseDown={e => { e.preventDefault(); onCreateNew(); setOpen(false); setQuery(""); }}
              >
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <Plus className="h-4 w-4" />
                  Créer un nouveau produit...
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
