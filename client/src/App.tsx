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
import EmployeeHome from "@/pages/employee/Home";
import Chat from "@/pages/shared/Chat";
import { useEffect } from "react";
import { DashboardProvider } from "@/contexts/DashboardContext";

// Wrapper components to ensure props are passed correctly with wouter
const CeoDocumentGenerator = () => <DocumentGenerator role="CEO" />;
const EmployeeDocumentGenerator = () => <DocumentGenerator role="Employee" />;
const CeoDealManagement = () => <DealManagement role="CEO" />;
const EmployeeDealManagement = () => <DealManagement role="Employee" />;
const CeoChat = () => <Chat role="CEO" />;
const EmployeeChat = () => <Chat role="Employee" />;

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
    // Check if welcome animation is pending - don't redirect during animation
    const welcomePending = sessionStorage.getItem('welcomePending');
    if (welcomePending === 'true') {
      return; // Let AuthPage handle the redirect after animation
    }
    
    if (user && location === "/") {
      if (user.email.includes("admin") || user.email.includes("josh")) {
        setLocation("/ceo/dashboard");
      } else {
        setLocation("/employee/home");
      }
    }
  }, [user, location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/auth" component={AuthPage} />
      
      {/* CEO Routes */}
      <Route path="/ceo/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/ceo/deals">
        {() => <ProtectedRoute component={CeoDealManagement} />}
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
      <Route path="/ceo/chat">
        {() => <ProtectedRoute component={CeoChat} />}
      </Route>
      
      {/* Employee Routes */}
      <Route path="/employee/home">
        {() => <ProtectedRoute component={EmployeeHome} />}
      </Route>
      <Route path="/employee/tasks">
        {() => <ProtectedRoute component={MyTasks} />}
      </Route>
      <Route path="/employee/documents">
        {() => <ProtectedRoute component={EmployeeDocumentGenerator} />}
      </Route>
      <Route path="/employee/deals">
        {() => <ProtectedRoute component={EmployeeDealManagement} />}
      </Route>
      <Route path="/employee/chat">
        {() => <ProtectedRoute component={EmployeeChat} />}
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
