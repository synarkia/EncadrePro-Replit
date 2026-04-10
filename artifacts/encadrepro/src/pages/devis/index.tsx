import { useState } from "react";
import { useListDevis, useCreateDevis, useListClients, useUpdateDevisStatut, getListDevisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Plus, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const statutColors: Record<string, string> = {
  brouillon: "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/30",
  envoye: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  accepte: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  refuse: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  converti: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

const STATUT_OPTIONS: { value: string; label: string; dot: string }[] = [
  { value: "brouillon", label: "Brouillon", dot: "bg-gray-400" },
  { value: "envoye", label: "Envoyé", dot: "bg-blue-400" },
  { value: "accepte", label: "Accepté", dot: "bg-green-400" },
  { value: "refuse", label: "Refusé", dot: "bg-red-400" },
  { value: "converti", label: "Converti", dot: "bg-violet-400" },
];

export default function DevisList() {
  const search = useSearch();
  const initialStatut = new URLSearchParams(search).get("statut") || "tous";
  const [statut, setStatut] = useState<string>(initialStatut);
  const { data: devisList, isLoading } = useListDevis(statut !== "tous" ? { statut } : {});
  const { data: clients } = useListClients();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  
  const queryClient = useQueryClient();
  const createDevis = useCreateDevis();
  const updateStatut = useUpdateDevisStatut();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!selectedClientId) return;
    createDevis.mutate({ data: { client_id: parseInt(selectedClientId) } }, {
      onSuccess: (newDevis) => {
        queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
        setIsCreateOpen(false);
        setLocation(`/devis/${newDevis.id}`);
      }
    });
  };

  const handleChangeStatut = (id: number, newStatut: string) => {
    updateStatut.mutate({ id, data: { statut: newStatut } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
        toast({ title: "Statut mis à jour" });
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devis</h1>
          <p className="text-muted-foreground mt-1">Gérez vos propositions commerciales.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Nouveau devis
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer un devis</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sélectionner un client *</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.prenom} {client.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!selectedClientId || createDevis.isPending}>
                {createDevis.isPending ? "Création..." : "Créer le devis"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <SelectItem value="envoye">Envoyé</SelectItem>
            <SelectItem value="accepte">Accepté</SelectItem>
            <SelectItem value="refuse">Refusé</SelectItem>
            <SelectItem value="converti">Converti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : devisList?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card/30">
            Aucun devis trouvé.
          </div>
        ) : (
          devisList?.map(devis => (
            <Link key={devis.id} href={`/devis/${devis.id}`}>
              <Card className="glass-panel hover:bg-white/5 transition-all cursor-pointer group border-border/50">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
                      <span className="text-xs font-medium">Devis</span>
                      <span className="text-[10px] opacity-70">#{devis.numero.split('-')[1] || devis.numero}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-lg">
                        {devis.client_prenom} {devis.client_nom}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        <span>Créé le {formatDate(devis.date_creation)}</span>
                        {devis.date_validite && <span>• Valide j. {formatDate(devis.date_validite)}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 sm:justify-end">
                    <div onClick={e => e.preventDefault()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 focus:outline-none ${statutColors[devis.statut] || ""}`}
                            onClick={e => e.stopPropagation()}
                          >
                            {STATUT_OPTIONS.find(o => o.value === devis.statut)?.label ?? devis.statut}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-panel" onClick={e => e.stopPropagation()}>
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le statut</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {STATUT_OPTIONS.filter(o => o.value !== devis.statut).map(opt => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => handleChangeStatut(devis.id, opt.value)}
                              className="cursor-pointer"
                            >
                              <span className={`mr-2 h-2 w-2 rounded-full inline-block ${opt.dot}`} />
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-lg font-bold text-accent tracking-tight">{formatCurrency(devis.total_ttc)}</p>
                      <p className="text-xs text-muted-foreground">TTC</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
