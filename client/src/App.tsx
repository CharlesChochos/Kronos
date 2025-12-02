import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/api";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth/AuthPage";
import Dashboard from "@/pages/ceo/Dashboard";
import DealManagement from "@/pages/ceo/DealManagement";
import DocumentGenerator from "@/pages/shared/DocumentGenerator";
import InvestorMatching from "@/pages/ceo/InvestorMatching";
import TeamAssignment from "@/pages/ceo/TeamAssignment";
import MyTasks from "@/pages/employee/MyTasks";
import { useEffect } from "react";
import { DashboardProvider } from "@/contexts/DashboardContext";

// Wrapper components to ensure props are passed correctly with wouter
const CeoDocumentGenerator = () => <DocumentGenerator role="CEO" />;
const EmployeeDocumentGenerator = () => <DocumentGenerator role="Employee" />;

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  const { data: user } = useCurrentUser();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (user && location === "/") {
      if (user.email.includes("admin") || user.email.includes("josh")) {
        setLocation("/ceo/dashboard");
      } else {
        setLocation("/employee/tasks");
      }
    }
  }, [user, location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      
      {/* CEO Routes */}
      <Route path="/ceo/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/ceo/deals">
        {() => <ProtectedRoute component={DealManagement} />}
      </Route>
      <Route path="/ceo/documents">
        {() => <ProtectedRoute component={CeoDocumentGenerator} />}
      </Route>
      <Route path="/ceo/investors">
        {() => <ProtectedRoute component={InvestorMatching} />}
      </Route>
      <Route path="/ceo/team">
        {() => <ProtectedRoute component={TeamAssignment} />}
      </Route>
      
      {/* Employee Routes */}
      <Route path="/employee/tasks">
        {() => <ProtectedRoute component={MyTasks} />}
      </Route>
      <Route path="/employee/documents">
        {() => <ProtectedRoute component={EmployeeDocumentGenerator} />}
      </Route>
      <Route path="/employee/deals">
        {() => <ProtectedRoute component={DealManagement} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </DashboardProvider>
    </QueryClientProvider>
  );
}

export default App;
