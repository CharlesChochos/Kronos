import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth/AuthPage";
import Dashboard from "@/pages/ceo/Dashboard";
import DealManagement from "@/pages/ceo/DealManagement";
import DocumentGenerator from "@/pages/shared/DocumentGenerator";
import InvestorMatching from "@/pages/ceo/InvestorMatching";
import TeamAssignment from "@/pages/ceo/TeamAssignment";
import MyTasks from "@/pages/employee/MyTasks";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      
      {/* CEO Routes */}
      <Route path="/ceo/dashboard" component={Dashboard} />
      <Route path="/ceo/deals" component={DealManagement} />
      <Route path="/ceo/documents">
        <DocumentGenerator role="CEO" />
      </Route>
      <Route path="/ceo/investors" component={InvestorMatching} />
      <Route path="/ceo/team" component={TeamAssignment} />
      
      {/* Employee Routes */}
      <Route path="/employee/tasks" component={MyTasks} />
      <Route path="/employee/documents">
        <DocumentGenerator role="Employee" />
      </Route>
      <Route path="/employee/deals" component={DealManagement} /> {/* Reusing deal view for now */}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
