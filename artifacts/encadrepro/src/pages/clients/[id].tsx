import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetClient, getGetClientQueryKey,
  useGetClientStats,
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, FileText, FileSpreadsheet,
  CalendarDays, TrendingUp, Building2, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const clientSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  adresse: z.string().optional().or(z.literal("")),
  code_postal: z.string().optional().or(z.literal("")),
  ville: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const devisStatutColors: Record<string, string> = {
  brouillon: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  envoye: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  accepte: "bg-green-500/15 text-green-400 border-green-500/30",
  refuse: "bg-red-500/15 text-red-400 border-red-500/30",
  converti: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};
const devisStatutLabels: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", converti: "Converti",
};

const factureStatutColors: Record<string, string> = {
  brouillon: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  envoyee: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  partiellement_payee: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  soldee: "bg-green-500/15 text-green-400 border-green-500/30",
  annulee: "bg-red-500/15 text-red-400 border-red-500/30",
};
const factureStatutLabels: Record<string, string> = {
  brouillon: "Brouillon", envoyee: "Envoyée", partiellement_payee: "Part. payée", soldee: "Soldée", annulee: "Annulée",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useGetClient(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) }
  });
  const { data: stats, isLoading: statsLoading } = useGetClientStats(clientId, {
    query: { enabled: !!clientId, queryKey: ["clientStats", clientId] }
  });

  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    values: client ? {
      nom: client.nom ?? "",
      prenom: client.prenom ?? "",
      email: client.email ?? "",
      telephone: client.telephone ?? "",
      adresse: client.adresse ?? "",
      code_postal: client.code_postal ?? "",
      ville: client.ville ?? "",
      notes: client.notes ?? "",
    } : undefined,
  });

  const onEditSubmit = (data: ClientFormValues) => {
    updateClient.mutate({ id: clientId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        setIsEditOpen(false);
        toast({ title: "Client mis à jour" });
      },
      onError: () => {
        toast({ title: "Erreur", description: "Impossible de mettre à jour le client.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    deleteClient.mutate({ id: clientId }, {
      onSuccess: () => {
        toast({ title: "Client supprimé" });
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setLocation("/clients");
      },
      onError: (err: unknown) => {
        const apiErr = err as { data?: { error?: string } };
        const msg = apiErr?.data?.error ?? "Impossible de supprimer ce client.";
        toast({ title: "Suppression impossible", description: msg, variant: "destructive" });
      }
    });
  };

  if (clientLoading) return (
    <div className="space-y-6 p-2">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
  if (!client) return <div className="p-8 text-muted-foreground">Client introuvable</div>;

  const fullName = [client.prenom, client.nom].filter(Boolean).join(" ");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Edit Dialog ────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] glass-panel">
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
            <DialogDescription>Informations de {fullName}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
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
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={updateClient.isPending}>
                  {updateClient.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-card mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            {/* Avatar + Name */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                {client.prenom?.[0] ?? ""}{client.nom[0] ?? ""}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{fullName}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  {client.telephone && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />{client.telephone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />{client.email}
                    </span>
                  )}
                  {client.ville && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{client.ville}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <CalendarDays className="h-3 w-3" />Client depuis {formatDate(client.cree_le)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="glass-panel" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4 mr-2" /> Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel">
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. {fullName} sera supprimé définitivement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-panel border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <p className="text-sm font-medium text-accent">Chiffre d'affaires</p>
            </div>
            <div className="text-2xl font-bold text-accent">
              {statsLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(stats?.caTotal ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Factures soldées / envoyées</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Devis</p>
            </div>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.devisCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total créés</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Factures</p>
            </div>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.facturesCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total émises</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="devis" className="w-full">
        <TabsList className="glass-panel bg-card/50">
          <TabsTrigger value="devis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Devis {stats && stats.devisCount > 0 && <span className="ml-1.5 text-[10px] opacity-70">({stats.devisCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="factures" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Factures {stats && stats.facturesCount > 0 && <span className="ml-1.5 text-[10px] opacity-70">({stats.facturesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="infos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Informations
          </TabsTrigger>
        </TabsList>

        {/* Devis tab */}
        <TabsContent value="devis" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-0">
              {statsLoading ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (stats?.devis.length ?? 0) === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Aucun devis pour ce client</p>
                  <Link href="/devis" className="text-primary text-sm hover:underline mt-1 block">Créer un devis →</Link>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {stats?.devis.map(doc => (
                    <Link key={doc.id} href={`/devis/${doc.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <div>
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{doc.numero}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(doc.date_creation)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${devisStatutColors[doc.statut] ?? ""}`}>
                          {devisStatutLabels[doc.statut] ?? doc.statut}
                        </span>
                        <span className="font-bold text-sm text-accent min-w-[80px] text-right">{formatCurrency(doc.total_ttc)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Factures tab */}
        <TabsContent value="factures" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-0">
              {statsLoading ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (stats?.factures.length ?? 0) === 0 ? (
                <div className="p-10 text-center">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Aucune facture pour ce client</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {stats?.factures.map(doc => (
                    <Link key={doc.id} href={`/factures/${doc.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <div>
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{doc.numero}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(doc.date_creation)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${factureStatutColors[doc.statut] ?? ""}`}>
                          {factureStatutLabels[doc.statut] ?? doc.statut}
                        </span>
                        <span className="font-bold text-sm text-accent min-w-[80px] text-right">{formatCurrency(doc.total_ttc)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Infos tab */}
        <TabsContent value="infos" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                    <p className="text-sm mt-0.5">{client.email || <span className="text-muted-foreground/50">—</span>}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Téléphone</p>
                    <p className="text-sm mt-0.5">{client.telephone || <span className="text-muted-foreground/50">—</span>}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adresse</p>
                    {client.adresse ? (
                      <p className="text-sm mt-0.5">
                        {client.adresse}<br />
                        {[client.code_postal, client.ville].filter(Boolean).join(" ")}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 mt-0.5">—</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client depuis</p>
                    <p className="text-sm mt-0.5">{formatDate(client.cree_le)}</p>
                    <p className="text-xs text-muted-foreground/60">Modifié le {formatDate(client.modifie_le)}</p>
                  </div>
                </div>
              </div>
              {client.notes && (
                <div className="pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                </div>
              )}
              <div className="pt-4 border-t border-border/40">
                <Button variant="outline" size="sm" className="glass-panel" onClick={() => setIsEditOpen(true)}>
                  <Edit className="h-3.5 w-3.5 mr-2" /> Modifier les informations
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
