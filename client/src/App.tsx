import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/api";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth/AuthPage";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/ceo/Dashboard";
import DealManagement from "@/pages/ceo/DealManagement";
import DocumentGenerator from "@/pages/shared/DocumentGenerator";
import InvestorMatching from "@/pages/ceo/InvestorMatching";
import EmployeeInvestorMatching from "@/pages/employee/InvestorMatching";
import TeamAssignment from "@/pages/ceo/TeamAssignment";
import PipelineForecasting from "@/pages/ceo/PipelineForecasting";
import CapitalRaisingCalendar from "@/pages/ceo/CapitalRaisingCalendar";
import TeamPerformance from "@/pages/ceo/TeamPerformance";
import WarRoom from "@/pages/shared/WarRoom";
import DealComparison from "@/pages/shared/DealComparison";
import AuditTrail from "@/pages/ceo/AuditTrail";
import WinLossAnalysis from "@/pages/ceo/WinLossAnalysis";
import InvestorCRM from "@/pages/ceo/InvestorCRM";
import TimeTracking from "@/pages/shared/TimeTracking";
import VacationCalendar from "@/pages/shared/VacationCalendar";
import SkillMatrix from "@/pages/shared/SkillMatrix";
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
const CeoWarRoom = () => <WarRoom role="CEO" />;
const EmployeeWarRoom = () => <WarRoom role="Employee" />;
const CeoDealComparison = () => <DealComparison role="CEO" />;
const EmployeeDealComparison = () => <DealComparison role="Employee" />;
const CeoTimeTracking = () => <TimeTracking role="CEO" />;
const EmployeeTimeTracking = () => <TimeTracking role="Employee" />;
const CeoVacationCalendar = () => <VacationCalendar role="CEO" />;
const EmployeeVacationCalendar = () => <VacationCalendar role="Employee" />;
const CeoSkillMatrix = () => <SkillMatrix role="CEO" />;
const EmployeeSkillMatrix = () => <SkillMatrix role="Employee" />;

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
      <Route path="/reset-password" component={ResetPassword} />
      
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
      <Route path="/ceo/forecasting">
        {() => <ProtectedRoute component={PipelineForecasting} />}
      </Route>
      <Route path="/ceo/capital-calendar">
        {() => <ProtectedRoute component={CapitalRaisingCalendar} />}
      </Route>
      <Route path="/ceo/team-performance">
        {() => <ProtectedRoute component={TeamPerformance} />}
      </Route>
      <Route path="/ceo/war-room">
        {() => <ProtectedRoute component={CeoWarRoom} />}
      </Route>
      <Route path="/ceo/deal-comparison">
        {() => <ProtectedRoute component={CeoDealComparison} />}
      </Route>
      <Route path="/ceo/audit-trail">
        {() => <ProtectedRoute component={AuditTrail} />}
      </Route>
      <Route path="/ceo/win-loss">
        {() => <ProtectedRoute component={WinLossAnalysis} />}
      </Route>
      <Route path="/ceo/investor-crm">
        {() => <ProtectedRoute component={InvestorCRM} />}
      </Route>
      <Route path="/ceo/time-tracking">
        {() => <ProtectedRoute component={CeoTimeTracking} />}
      </Route>
      <Route path="/ceo/vacation-calendar">
        {() => <ProtectedRoute component={CeoVacationCalendar} />}
      </Route>
      <Route path="/ceo/skill-matrix">
        {() => <ProtectedRoute component={CeoSkillMatrix} />}
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
      <Route path="/employee/investors">
        {() => <ProtectedRoute component={EmployeeInvestorMatching} />}
      </Route>
      <Route path="/employee/chat">
        {() => <ProtectedRoute component={EmployeeChat} />}
      </Route>
      <Route path="/employee/war-room">
        {() => <ProtectedRoute component={EmployeeWarRoom} />}
      </Route>
      <Route path="/employee/deal-comparison">
        {() => <ProtectedRoute component={EmployeeDealComparison} />}
      </Route>
      <Route path="/employee/time-tracking">
        {() => <ProtectedRoute component={EmployeeTimeTracking} />}
      </Route>
      <Route path="/employee/vacation-calendar">
        {() => <ProtectedRoute component={EmployeeVacationCalendar} />}
      </Route>
      <Route path="/employee/skill-matrix">
        {() => <ProtectedRoute component={EmployeeSkillMatrix} />}
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
