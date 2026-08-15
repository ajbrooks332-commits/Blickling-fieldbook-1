import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { getGetMeQueryKey, getGetSetupStatusQueryKey, useGetMe, useGetSetupStatus, type AuthUser } from "@workspace/api-client-react";
import { clearOfflineAccount, setOfflineAccount } from "@/lib/offlineFallback";
import { lazy, Suspense, useEffect } from "react";
import { Loader2, ShieldX } from "lucide-react";
import AppShell from "@/layouts/AppShell";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Login = lazy(() => import("@/pages/Login"));
const Setup = lazy(() => import("@/pages/Setup"));
const MyActions = lazy(() => import("@/pages/MyActions"));
const ActionList = lazy(() => import("@/pages/ActionList"));
const ActionDetail = lazy(() => import("@/pages/ActionDetail"));
const ActionNew = lazy(() => import("@/pages/ActionNew"));
const ActionEdit = lazy(() => import("@/pages/ActionEdit"));
const ObservationList = lazy(() => import("@/pages/ObservationList"));
const ObservationNew = lazy(() => import("@/pages/ObservationNew"));
const ObservationDetail = lazy(() => import("@/pages/ObservationDetail"));
const ObservationEdit = lazy(() => import("@/pages/ObservationEdit"));
const MapView = lazy(() => import("@/pages/MapView"));
const Activities = lazy(() => import("@/pages/Activities"));
const Reports = lazy(() => import("@/pages/Reports"));
const Users = lazy(() => import("@/pages/Users"));
const Categories = lazy(() => import("@/pages/Categories"));
const Locations = lazy(() => import("@/pages/Locations"));
const Settings = lazy(() => import("@/pages/Settings"));
const Archive = lazy(() => import("@/pages/Archive"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
});

const Loading = () => <div className="min-h-[100dvh] flex items-center justify-center bg-background" role="status" aria-label="Loading">
  <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none text-primary" />
</div>;

function Forbidden() {
  const [, setLocation] = useLocation();
  return <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
    <ShieldX className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
    <h1 className="text-2xl font-semibold">You do not have permission to view this page</h1>
    <button className="text-primary underline" onClick={() => setLocation("/")}>Return to dashboard</button>
  </div>;
}

function RolePage({ user, roles, children }: { user: AuthUser; roles: AuthUser["role"][]; children: React.ReactNode }) {
  return roles.includes(user.role) ? children : <Forbidden />;
}

function AuthenticatedRoutes({ user }: { user: AuthUser }) {
  const managers: AuthUser["role"][] = ["administrator", "manager"];
  if (user.mustChangePassword) return <AppShell user={user}><Settings forcePasswordChange /></AppShell>;
  return <AppShell user={user}>
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/observations/new" component={ObservationNew} />
      <Route path="/observations/:id/edit">{() => <RolePage user={user} roles={managers}><ObservationEdit /></RolePage>}</Route>
      <Route path="/observations/:id" component={ObservationDetail} />
      <Route path="/observations" component={ObservationList} />
      <Route path="/actions/my" component={MyActions} />
      <Route path="/actions/new">{() => <RolePage user={user} roles={managers}><ActionNew /></RolePage>}</Route>
      <Route path="/actions/:id/edit">{() => <RolePage user={user} roles={managers}><ActionEdit /></RolePage>}</Route>
      <Route path="/actions/:id" component={ActionDetail} />
      <Route path="/actions" component={ActionList} />
      <Route path="/map" component={MapView} />
      <Route path="/activities" component={Activities} />
      <Route path="/reports">{() => <RolePage user={user} roles={managers}><Reports /></RolePage>}</Route>
      <Route path="/archive">{() => <RolePage user={user} roles={managers}><Archive /></RolePage>}</Route>
      <Route path="/users">{() => <RolePage user={user} roles={["administrator"]}><Users /></RolePage>}</Route>
      <Route path="/categories">{() => <RolePage user={user} roles={managers}><Categories /></RolePage>}</Route>
      <Route path="/locations">{() => <RolePage user={user} roles={managers}><Locations /></RolePage>}</Route>
      <Route path="/settings">{() => <Settings />}</Route>
      <Route component={NotFound} />
    </Switch>
  </AppShell>;
}

function AuthRouter() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  useEffect(() => {
    if (!isLoading && user && (location === "/login" || location === "/setup")) setLocation("/");
    if (!isLoading && !user && !error && location !== "/login") setLocation("/login");
  }, [isLoading, user, error, location, setLocation]);
  // Bind the offline read fallback to the signed-in account so cached estate
  // data is only ever served to the account that downloaded it.
  useEffect(() => {
    if (user) setOfflineAccount(user.id, (user as { propertyId?: number | null }).propertyId ?? 0);
    else clearOfflineAccount();
  }, [user?.id]);
  if (isLoading) return <Loading />;
  if (error || !user) return <Login />;
  return <AuthenticatedRoutes user={user} />;
}

function Router() {
  const { data: setup, isLoading, error } = useGetSetupStatus({ query: { retry: 1, queryKey: getGetSetupStatusQueryKey() } });
  if (isLoading) return <Loading />;
  if (error || !setup) return <div className="min-h-[100dvh] flex items-center justify-center p-6 text-center">Unable to contact the Fieldbook service. Check the deployment and try again.</div>;
  if (setup.required) return <Setup />;
  return <AuthRouter />;
}

export default function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Suspense fallback={<Loading />}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter>
      </Suspense>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}
