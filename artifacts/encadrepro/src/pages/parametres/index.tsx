import { useEffect } from "react";
import { useGetAtelier, getGetAtelierQueryKey, useSaveAtelier } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Save, Building2, Receipt, Mail } from "lucide-react";
import { ImportSection } from "./ImportSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const atelierSchema = z.object({
  nom: z.string().min(1, "Requis"),
  tagline: z.string().optional().or(z.literal("")),
  subtitre: z.string().optional().or(z.literal("")),
  siret: z.string().optional().or(z.literal("")),
  adresse: z.string().optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalide").optional().or(z.literal("")),
  prefixe_devis: z.string().min(1, "Requis"),
  prefixe_facture: z.string().min(1, "Requis"),
  tva_defaut: z.coerce.number().min(0).max(100),
  conditions_generales: z.string().optional().or(z.literal("")),
  smtp_host: z.string().optional().or(z.literal("")),
  smtp_port: z.preprocess((v) => v === "" || v === null ? undefined : v, z.coerce.number().int().optional()),
  smtp_user: z.string().optional().or(z.literal("")),
  smtp_pass: z.string().optional().or(z.literal("")),
});

type AtelierFormValues = z.infer<typeof atelierSchema>;

export default function Parametres() {
  const { data: atelier, isLoading } = useGetAtelier();
  const saveAtelier = useSaveAtelier();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AtelierFormValues>({
    resolver: zodResolver(atelierSchema),
    defaultValues: {
      nom: "", tagline: "", subtitre: "", siret: "", adresse: "", telephone: "", email: "",
      prefixe_devis: "DEV-", prefixe_facture: "FAC-", tva_defaut: 20,
      conditions_generales: "", smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: ""
    }
  });

  useEffect(() => {
    if (atelier) {
      form.reset({
        nom: atelier.nom,
        tagline: atelier.tagline || "",
        subtitre: atelier.subtitre || "",
        siret: atelier.siret || "",
        adresse: atelier.adresse || "",
        telephone: atelier.telephone || "",
        email: atelier.email || "",
        prefixe_devis: atelier.prefixe_devis,
        prefixe_facture: atelier.prefixe_facture,
        tva_defaut: atelier.tva_defaut,
        conditions_generales: atelier.conditions_generales || "",
        smtp_host: atelier.smtp_host || "",
        smtp_port: atelier.smtp_port || 587,
        smtp_user: atelier.smtp_user || "",
        smtp_pass: atelier.smtp_pass ? "********" : "", // Don't expose real pass in form if possible, but we don't have it anyway usually
      });
    }
  }, [atelier, form]);

  const onSubmit = (data: AtelierFormValues) => {
    // Prevent sending dummy password string if unchanged
    if (data.smtp_pass === "********") {
      delete (data as any).smtp_pass;
    }
    
    saveAtelier.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAtelierQueryKey() });
        toast({ title: "Paramètres enregistrés", description: "La configuration de l'atelier a été mise à jour." });
      },
      onError: () => {
        toast({ title: "Erreur", description: "Impossible d'enregistrer les paramètres.", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-[600px] w-full max-w-4xl" /></div>;

  return (
    <div className="space-y-6 max-w-4xl pb-10 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Configurez les informations de votre atelier et les valeurs par défaut.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" /> Informations de l'atelier
              </CardTitle>
              <CardDescription>Ces informations apparaîtront sur vos devis et factures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="nom" render={({ field }) => (
                  <FormItem><FormLabel>Nom de l'atelier *</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="siret" render={({ field }) => (
                  <FormItem><FormLabel>SIRET</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="tagline" render={({ field }) => (
                <FormItem><FormLabel>Tagline (italique)</FormLabel><FormControl><Input {...field} placeholder="Encadrement d'art & Miroiterie artisanale" className="bg-background/50" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="subtitre" render={({ field }) => (
                <FormItem><FormLabel>Sous-titre</FormLabel><FormControl><Input {...field} placeholder="Maison familiale · Paris 13e · Depuis quatre générations" className="bg-background/50" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="adresse" render={({ field }) => (
                <FormItem><FormLabel>Adresse complète</FormLabel><FormControl><Textarea {...field} className="bg-background/50 resize-none h-20" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email de contact</FormLabel><FormControl><Input type="email" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="telephone" render={({ field }) => (
                  <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Receipt className="h-5 w-5 text-primary" /> Facturation & Devis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <FormField control={form.control} name="prefixe_devis" render={({ field }) => (
                  <FormItem><FormLabel>Préfixe devis</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="prefixe_facture" render={({ field }) => (
                  <FormItem><FormLabel>Préfixe factures</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tva_defaut" render={({ field }) => (
                  <FormItem><FormLabel>TVA par défaut (%)</FormLabel><FormControl><Input type="number" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="conditions_generales" render={({ field }) => (
                <FormItem><FormLabel>Conditions générales (affichées en pied de page)</FormLabel><FormControl><Textarea {...field} className="bg-background/50 min-h-[100px]" placeholder="Paiement à 30 jours, acompte 30%..." /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Mail className="h-5 w-5 text-primary" /> Configuration Email (SMTP)
              </CardTitle>
              <CardDescription>Pour l'envoi direct depuis l'application (fonctionnalité Desktop).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="smtp_host" render={({ field }) => (
                  <FormItem><FormLabel>Serveur SMTP</FormLabel><FormControl><Input {...field} placeholder="smtp.gmail.com" className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="smtp_port" render={({ field }) => (
                  <FormItem><FormLabel>Port</FormLabel><FormControl><Input type="number" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="smtp_user" render={({ field }) => (
                  <FormItem><FormLabel>Utilisateur</FormLabel><FormControl><Input {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="smtp_pass" render={({ field }) => (
                  <FormItem><FormLabel>Mot de passe</FormLabel><FormControl><Input type="password" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="shadow-lg shadow-primary/20" disabled={saveAtelier.isPending}>
              <Save className="mr-2 h-5 w-5" />
              {saveAtelier.isPending ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </form>
      </Form>

      <ImportSection />
    </div>
  );
}
