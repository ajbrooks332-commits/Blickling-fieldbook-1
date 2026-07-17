import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { useEffect } from 'react';

// Layouts
import AppShell from '@/layouts/AppShell';

// Pages
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import MyActions from '@/pages/MyActions';
import ActionList from '@/pages/ActionList';
import ActionDetail from '@/pages/ActionDetail';
import ActionNew from '@/pages/ActionNew';
import ObservationList from '@/pages/ObservationList';
import ObservationNew from '@/pages/ObservationNew';
import ObservationDetail from '@/pages/ObservationDetail';
import ObservationEdit from '@/pages/ObservationEdit';
import MapView from '@/pages/MapView';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import Categories from '@/pages/Categories';
import Locations from '@/pages/Locations';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey()
    }
  });

  useEffect(() => {
    if (!isLoading && (error || !user) && location !== '/login') {
      setLocation('/login');
    }
    if (!isLoading && user && location === '/login') {
      setLocation('/');
    }
  }, [isLoading, error, user, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return <Login />;
  }

  return <AppShell user={user}>{children}</AppShell>;
}

function Router() {
  const [location] = useLocation();
  
  if (location === '/login') {
    return <Login />;
  }

  return (
    <AuthWrapper>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        {/* Observations */}
        <Route path="/observations/new" component={ObservationNew} />
        <Route path="/observations/:id/edit" component={ObservationEdit} />
        <Route path="/observations/:id" component={ObservationDetail} />
        <Route path="/observations" component={ObservationList} />
        
        {/* Actions */}
        <Route path="/actions/my" component={MyActions} />
        <Route path="/actions/new" component={ActionNew} />
        <Route path="/actions/:id" component={ActionDetail} />
        <Route path="/actions" component={ActionList} />
        
        {/* Main views */}
        <Route path="/map" component={MapView} />
        <Route path="/reports" component={Reports} />
        
        {/* Admin/Settings */}
        <Route path="/users" component={Users} />
        <Route path="/categories" component={Categories} />
        <Route path="/locations" component={Locations} />
        <Route path="/settings" component={Settings} />
        
        <Route component={NotFound} />
      </Switch>
    </AuthWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
