import { useState } from "react";
import { useListFactures, useUpdateFactureStatut, getListFacturesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Filter, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export const factureStatutColors: Record<string, string> = {
  brouillon: "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/30",
  envoyee: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  partiellement_payee: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  soldee: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  annulee: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

const FACTURE_STATUT_OPTIONS: { value: string; label: string; dot: string }[] = [
  { value: "brouillon", label: "Brouillon", dot: "bg-gray-400" },
  { value: "envoyee", label: "Envoyée", dot: "bg-blue-400" },
  { value: "partiellement_payee", label: "Part. payée", dot: "bg-orange-400" },
  { value: "soldee", label: "Soldée", dot: "bg-green-400" },
  { value: "annulee", label: "Annulée", dot: "bg-red-400" },
];

export default function FacturesList() {
  const [statut, setStatut] = useState<string>("tous");
  const { data: facturesList, isLoading } = useListFactures(statut !== "tous" ? { statut } : {});
  const queryClient = useQueryClient();
  const updateStatut = useUpdateFactureStatut();
  const { toast } = useToast();

  const handleChangeStatut = (id: number, newStatut: string) => {
    updateStatut.mutate({ id, data: { statut: newStatut } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFacturesQueryKey() });
        toast({ title: "Statut mis à jour" });
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
          <p className="text-muted-foreground mt-1">Suivez vos paiements et votre facturation.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card/50 p-2 rounded-lg border w-fit">
        <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-[180px] border-0 focus:ring-0 bg-transparent">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="envoyee">Envoyée</SelectItem>
            <SelectItem value="partiellement_payee">Partiellement payée</SelectItem>
            <SelectItem value="soldee">Soldée</SelectItem>
            <SelectItem value="annulee">Annulée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : facturesList?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card/30">
            Aucune facture trouvée.
          </div>
        ) : (
          facturesList?.map(facture => {
            const isPaid = facture.solde_restant <= 0;
            return (
              <Link key={facture.id} href={`/factures/${facture.id}`}>
                <Card className="glass-panel hover:bg-white/5 transition-all cursor-pointer group border-border/50">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-secondary/10 border border-secondary/20 flex flex-col items-center justify-center text-secondary">
                        <span className="text-xs font-medium">Fact.</span>
                        <span className="text-[10px] opacity-70">#{facture.numero.split('-')[1] || facture.numero}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-lg">
                          {facture.client_prenom} {facture.client_nom}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span>Émise le {formatDate(facture.date_creation)}</span>
                          {facture.date_echeance && <span className={!isPaid && new Date(facture.date_echeance) < new Date() ? "text-destructive" : ""}>
                            • Échéance: {formatDate(facture.date_echeance)}
                          </span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 sm:justify-end">
                      <div className="flex flex-col items-end" onClick={e => e.preventDefault()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 focus:outline-none ${factureStatutColors[facture.statut] || ""}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {FACTURE_STATUT_OPTIONS.find(o => o.value === facture.statut)?.label ?? facture.statut.replace('_', ' ')}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-panel" onClick={e => e.stopPropagation()}>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le statut</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {FACTURE_STATUT_OPTIONS.filter(o => o.value !== facture.statut).map(opt => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() => handleChangeStatut(facture.id, opt.value)}
                                className="cursor-pointer"
                              >
                                <span className={`mr-2 h-2 w-2 rounded-full inline-block ${opt.dot}`} />
                                {opt.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {!isPaid && facture.total_paye > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-1">Reste: {formatCurrency(facture.solde_restant)}</span>
                        )}
                      </div>
                      <div className="text-right min-w-[120px]">
                        <p className="text-lg font-bold text-accent tracking-tight">{formatCurrency(facture.total_ttc)}</p>
                        <p className="text-xs text-muted-foreground">TTC</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  );
}
