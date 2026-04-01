import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ClientsList from "@/pages/clients/index";
import ClientDetail from "@/pages/clients/[id]";
import DevisList from "@/pages/devis/index";
import DevisDetail from "@/pages/devis/[id]";
import FacturesList from "@/pages/factures/index";
import FactureDetail from "@/pages/factures/[id]";
import Catalogue from "@/pages/catalogue/index";
import Parametres from "@/pages/parametres/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={ClientsList} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/devis" component={DevisList} />
        <Route path="/devis/:id" component={DevisDetail} />
        <Route path="/factures" component={FacturesList} />
        <Route path="/factures/:id" component={FactureDetail} />
        <Route path="/catalogue" component={Catalogue} />
        <Route path="/parametres" component={Parametres} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
