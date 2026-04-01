import { 
  useGetDashboardStats, 
  useGetDashboardCaMensuel, 
  useGetDashboardRecentDevis, 
  useGetDashboardRecentFactures 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, FileSpreadsheet, Users, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: caMensuel, isLoading: caLoading } = useGetDashboardCaMensuel();
  const { data: recentDevis, isLoading: devisLoading } = useGetDashboardRecentDevis();
  const { data: recentFactures, isLoading: facturesLoading } = useGetDashboardRecentFactures();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Aperçu de l'activité de l'atelier.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full glass-panel" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CA du mois</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{formatCurrency(stats.caMois)}</div>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Devis en attente</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.devisEnAttente.n}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: <span className="text-accent">{formatCurrency(stats.devisEnAttente.montant)}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Factures impayées</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.facturesImpayees.n}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Restant: <span className="text-accent">{formatCurrency(stats.facturesImpayees.montant)}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nouveaux clients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nouveauxClients}</div>
              <p className="text-xs text-muted-foreground mt-1">Ce mois-ci</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 glass-panel flex flex-col">
          <CardHeader>
            <CardTitle>Chiffre d'affaires mensuel</CardTitle>
            <CardDescription>Évolution sur les 12 derniers mois</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {caLoading ? (
              <Skeleton className="h-full w-full" />
            ) : caMensuel && caMensuel.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caMensuel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mois" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${value}`} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--accent))' }}
                    formatter={(value: number) => [formatCurrency(value), 'CA']}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Aucune donnée disponible</div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card className="glass-panel">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Derniers devis</CardTitle>
              </div>
              <Link href="/devis" className="text-xs text-primary hover:underline">Voir tout</Link>
            </CardHeader>
            <CardContent>
              {devisLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentDevis && recentDevis.length > 0 ? (
                <div className="space-y-3">
                  {recentDevis.map(doc => (
                    <Link key={doc.id} href={`/devis/${doc.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors group">
                      <div>
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{doc.numero}</p>
                        <p className="text-xs text-muted-foreground">{doc.client_prenom} {doc.client_nom}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">{formatCurrency(doc.total_ttc)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(doc.cree_le)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                 <div className="text-sm text-muted-foreground py-4 text-center">Aucun devis récent</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Dernières factures</CardTitle>
              </div>
              <Link href="/factures" className="text-xs text-primary hover:underline">Voir tout</Link>
            </CardHeader>
            <CardContent>
              {facturesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentFactures && recentFactures.length > 0 ? (
                <div className="space-y-3">
                  {recentFactures.map(doc => (
                    <Link key={doc.id} href={`/factures/${doc.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors group">
                      <div>
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{doc.numero}</p>
                        <p className="text-xs text-muted-foreground">{doc.client_prenom} {doc.client_nom}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">{formatCurrency(doc.total_ttc)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(doc.cree_le)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">Aucune facture récente</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
