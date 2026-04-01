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
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, FileText, FileSpreadsheet, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
    query: { enabled: !!clientId }
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
        toast({ title: "Client mis à jour", description: "Les informations ont été enregistrées." });
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
      }
    });
  };

  if (clientLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!client) return <div className="p-8">Client introuvable</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover-elevate">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{client.prenom} {client.nom}</h1>
            {client.ville && <p className="text-sm text-muted-foreground mt-0.5">{client.ville}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="glass-panel" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4 mr-2" /> Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="shadow-lg shadow-destructive/20">
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel">
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Le client sera supprimé définitivement.
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] glass-panel">
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
            <DialogDescription>
              Modifiez les informations de {client.prenom} {client.nom}.
            </DialogDescription>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel col-span-1 border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" /> Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{client.email || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Téléphone</p>
                <p className="text-sm text-muted-foreground">{client.telephone || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Adresse</p>
                <p className="text-sm text-muted-foreground">
                  {client.adresse || "-"}
                  {client.adresse && <><br />{client.code_postal} {client.ville}</>}
                </p>
              </div>
            </div>
            {client.notes && (
              <div className="pt-4 border-t border-border/50">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass-panel border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm text-primary font-medium mb-1">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-accent">
                  {statsLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(stats?.caTotal || 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Devis</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.devisCount || 0}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-panel">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Factures</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.facturesCount || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="devis" className="w-full">
            <TabsList className="glass-panel bg-card/50">
              <TabsTrigger value="devis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Devis</TabsTrigger>
              <TabsTrigger value="factures" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Factures</TabsTrigger>
            </TabsList>
            
            <TabsContent value="devis" className="mt-4">
              <Card className="glass-panel">
                <CardContent className="p-0">
                  {statsLoading ? (
                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                  ) : stats?.devis.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Aucun devis</div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {stats?.devis.map(doc => (
                        <Link key={doc.id} href={`/devis/${doc.id}`} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors group">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            <div>
                              <p className="font-medium group-hover:text-primary transition-colors">{doc.numero}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(doc.date_creation)}</p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <Badge variant="outline">{doc.statut}</Badge>
                            <span className="font-bold text-accent min-w-[80px] text-right">{formatCurrency(doc.total_ttc)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="factures" className="mt-4">
              <Card className="glass-panel">
                <CardContent className="p-0">
                  {statsLoading ? (
                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                  ) : stats?.factures.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Aucune facture</div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {stats?.factures.map(doc => (
                        <Link key={doc.id} href={`/factures/${doc.id}`} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors group">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            <div>
                              <p className="font-medium group-hover:text-primary transition-colors">{doc.numero}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(doc.date_creation)}</p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <Badge variant="outline">{doc.statut}</Badge>
                            <span className="font-bold text-accent min-w-[80px] text-right">{formatCurrency(doc.total_ttc)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
