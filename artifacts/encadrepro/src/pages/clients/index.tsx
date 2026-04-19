import { useState, useMemo } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus, Search, ChevronRight, TrendingUp, FileText, Clock, ArrowUpDown,
  Users, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";

const clientSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;
type SortKey = "nom" | "ca" | "activite" | "devis";

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: "nom", label: "Nom", icon: <ArrowUpDown className="h-3 w-3" /> },
  { key: "ca", label: "CA", icon: <TrendingUp className="h-3 w-3" /> },
  { key: "activite", label: "Activité", icon: <Clock className="h-3 w-3" /> },
  { key: "devis", label: "Devis", icon: <FileText className="h-3 w-3" /> },
];

export default function ClientsList() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("nom");
  const [actifsOnly, setActifsOnly] = useState(false);
  const { data: clients, isLoading } = useListClients({ search: search || undefined });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createClient = useCreateClient();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { nom: "", prenom: "", email: "", telephone: "", adresse: "", code_postal: "", ville: "", notes: "" }
  });

  const onSubmit = (data: ClientFormValues) => {
    createClient.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Client créé", description: "Le client a été ajouté avec succès." });
      },
      onError: () => {
        toast({ title: "Erreur", description: "Impossible de créer le client.", variant: "destructive" });
      }
    });
  };

  const sortedClients = useMemo(() => {
    if (!clients) return [];
    let list = [...clients];
    if (actifsOnly) list = list.filter(c => (c.ca_total ?? 0) > 0);
    list.sort((a, b) => {
      if (sortBy === "nom") return a.nom.localeCompare(b.nom);
      if (sortBy === "ca") return (b.ca_total ?? 0) - (a.ca_total ?? 0);
      if (sortBy === "devis") return (b.devis_count ?? 0) - (a.devis_count ?? 0);
      if (sortBy === "activite") {
        const da = a.derniere_activite ?? a.cree_le;
        const db_ = b.derniere_activite ?? b.cree_le;
        return db_.localeCompare(da);
      }
      return 0;
    });
    return list;
  }, [clients, sortBy, actifsOnly]);

  const totalCA = useMemo(() => sortedClients.reduce((s, c) => s + (c.ca_total ?? 0), 0), [sortedClients]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Chargement..." : `${sortedClients.length} client${sortedClients.length !== 1 ? "s" : ""}${totalCA > 0 ? ` · CA total : ${formatCurrency(totalCA)}` : ""}`}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] glass-panel">
            <DialogHeader>
              <DialogTitle>Ajouter un client</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="prenom" render={({ field }) => (
                    <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nom" render={({ field }) => (
                    <FormItem><FormLabel>Nom *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="telephone" render={({ field }) => (
                    <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="adresse" render={({ field }) => (
                  <FormItem><FormLabel>Adresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="code_postal" render={({ field }) => (
                    <FormItem><FormLabel>Code Postal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="ville" render={({ field }) => (
                    <FormItem><FormLabel>Ville</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={createClient.isPending}>
                    {createClient.isPending ? "Création..." : "Créer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-card/50 px-3 py-2 rounded-lg border flex-1 max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Nom, email, téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none bg-transparent p-0 h-auto text-sm"
          />
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1 bg-card/50 p-1 rounded-lg border">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Actifs toggle */}
        <button
          onClick={() => setActifsOnly(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
            actifsOnly
              ? "bg-accent/15 border-accent/40 text-accent"
              : "bg-card/50 border-border/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {actifsOnly ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          Actifs seulement
        </button>
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      <div className="grid gap-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : sortedClients.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-card/30">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">{actifsOnly ? "Aucun client actif" : "Aucun client trouvé"}</p>
            {actifsOnly && (
              <button onClick={() => setActifsOnly(false)} className="text-sm text-primary hover:underline mt-1">
                Afficher tous les clients
              </button>
            )}
          </div>
        ) : (
          sortedClients.map(client => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="glass-panel hover:bg-white/5 transition-all cursor-pointer group border-border/50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm border border-primary/25 shrink-0">
                      {client.prenom?.[0] ?? ""}{client.nom[0] ?? ""}
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {client.prenom} {client.nom}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        {client.telephone && <span>{client.telephone}</span>}
                        {client.email && <span className="truncate max-w-[200px]">{client.email}</span>}
                        {client.ville && <span>{client.ville}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    {/* CA */}
                    {(client.ca_total ?? 0) > 0 ? (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-accent">{formatCurrency(client.ca_total ?? 0)}</p>
                        <p className="text-[10px] text-muted-foreground">CA total</p>
                      </div>
                    ) : (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground/40">—</p>
                        <p className="text-[10px] text-muted-foreground/40">Aucun CA</p>
                      </div>
                    )}
                    {/* Devis count */}
                    {(client.devis_count ?? 0) > 0 && (
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-semibold">{client.devis_count}</p>
                        <p className="text-[10px] text-muted-foreground">devis</p>
                      </div>
                    )}
                    {/* Last activity */}
                    {client.derniere_activite && (
                      <div className="text-right hidden lg:block">
                        <p className="text-xs text-muted-foreground">{formatDate(client.derniere_activite)}</p>
                        <p className="text-[10px] text-muted-foreground/60">Dernière activité</p>
                      </div>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
