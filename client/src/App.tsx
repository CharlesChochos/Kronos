import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/api";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth/AuthPage";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/ceo/Dashboard";
import DealManagement from "@/pages/ceo/DealManagement";
import DocumentGenerator from "@/pages/shared/DocumentGenerator";
import InvestorMatching from "@/pages/ceo/InvestorMatching";
import EmployeeInvestorMatching from "@/pages/employee/InvestorMatching";
import TeamAssignment from "@/pages/ceo/TeamAssignment";
import TeamPerformance from "@/pages/ceo/TeamPerformance";
import InvestorCRM from "@/pages/ceo/InvestorCRM";
import ClientPortal from "@/pages/shared/ClientPortal";
import MentorshipPairing from "@/pages/shared/MentorshipPairing";
import GoalSettingOKRs from "@/pages/shared/GoalSettingOKRs";
import DealAnnouncements from "@/pages/shared/DealAnnouncements";
import StakeholderDirectory from "@/pages/shared/StakeholderDirectory";
import EventCalendar from "@/pages/shared/EventCalendar";
import MyTasks from "@/pages/employee/MyTasks";
import EmployeeHome from "@/pages/employee/Home";
import Chat from "@/pages/shared/Chat";
import UserManagement from "@/pages/ceo/UserManagement";
import InvestorDatabase from "@/pages/ceo/InvestorDatabase";
import DealTemplates from "@/pages/shared/DealTemplates";
import DocumentManagement from "@/pages/shared/DocumentManagement";
import AuditLogs from "@/pages/ceo/AuditLogs";
import Opportunities from "@/pages/ceo/Opportunities";
import AssetManagement from "@/pages/employee/AssetManagement";
import PortalLogin from "@/pages/portal/PortalLogin";
import PortalRegister from "@/pages/portal/PortalRegister";
import PortalDashboard from "@/pages/portal/PortalDashboard";
import { useEffect } from "react";
import { DashboardProvider } from "@/contexts/DashboardContext";

// Wrapper components to ensure props are passed correctly with wouter
const CeoDealManagement = () => <DealManagement role="CEO" />;
const EmployeeDealManagement = () => <DealManagement role="Employee" />;
const CeoChat = () => <Chat role="CEO" />;
const EmployeeChat = () => <Chat role="Employee" />;
const CeoClientPortal = () => <ClientPortal role="CEO" />;
const CeoMentorshipPairing = () => <MentorshipPairing role="CEO" />;
const CeoGoalSettingOKRs = () => <GoalSettingOKRs role="CEO" />;
const EmployeeGoalSettingOKRs = () => <GoalSettingOKRs role="Employee" />;
const CeoDealAnnouncements = () => <DealAnnouncements role="CEO" />;
const EmployeeDealAnnouncements = () => <DealAnnouncements role="Employee" />;
const CeoStakeholderDirectory = () => <StakeholderDirectory role="CEO" />;
const EmployeeStakeholderDirectory = () => <StakeholderDirectory role="Employee" />;
const CeoEventCalendar = () => <EventCalendar role="CEO" />;
const EmployeeEventCalendar = () => <EventCalendar role="Employee" />;
const CeoDealTemplates = () => <DealTemplates role="CEO" />;
const CeoDocumentGenerator = () => <DocumentManagement role="CEO" defaultTab="templates" />;
const EmployeeDocumentGenerator = () => <DocumentManagement role="Employee" defaultTab="templates" />;
const CeoDocumentLibrary = () => <DocumentManagement role="CEO" defaultTab="library" />;
const EmployeeDocumentLibrary = () => <DocumentManagement role="Employee" defaultTab="library" />;

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

function PortalProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/portal/login");
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    if (!isLoading && user && user.role !== 'External') {
      if (user.accessLevel === 'admin') {
        setLocation("/ceo/dashboard");
      } else {
        setLocation("/employee/home");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'External') {
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
      // Use accessLevel from database - admin goes to CEO dashboard, others to employee home
      if (user.accessLevel === 'admin') {
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
      <Route path="/ceo/team-performance">
        {() => <ProtectedRoute component={TeamPerformance} />}
      </Route>
      <Route path="/ceo/investor-crm">
        {() => <ProtectedRoute component={InvestorCRM} />}
      </Route>
      <Route path="/ceo/client-portal">
        {() => <ProtectedRoute component={CeoClientPortal} />}
      </Route>
      <Route path="/ceo/mentorship">
        {() => <ProtectedRoute component={CeoMentorshipPairing} />}
      </Route>
      <Route path="/ceo/okrs">
        {() => <ProtectedRoute component={CeoGoalSettingOKRs} />}
      </Route>
      <Route path="/ceo/announcements">
        {() => <ProtectedRoute component={CeoDealAnnouncements} />}
      </Route>
      <Route path="/ceo/calendar">
        {() => <ProtectedRoute component={CeoEventCalendar} />}
      </Route>
      <Route path="/ceo/stakeholders">
        {() => <ProtectedRoute component={CeoStakeholderDirectory} />}
      </Route>
      <Route path="/ceo/admin">
        {() => <ProtectedRoute component={UserManagement} />}
      </Route>
      <Route path="/ceo/investor-database">
        {() => <ProtectedRoute component={InvestorDatabase} />}
      </Route>
      <Route path="/ceo/audit-logs">
        {() => <ProtectedRoute component={AuditLogs} />}
      </Route>
      <Route path="/ceo/deal-templates">
        {() => <ProtectedRoute component={CeoDealTemplates} />}
      </Route>
      <Route path="/ceo/document-library">
        {() => <ProtectedRoute component={CeoDocumentLibrary} />}
      </Route>
      <Route path="/ceo/opportunities">
        {() => <ProtectedRoute component={Opportunities} />}
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
      <Route path="/employee/calendar">
        {() => <ProtectedRoute component={EmployeeEventCalendar} />}
      </Route>
      <Route path="/employee/okrs">
        {() => <ProtectedRoute component={EmployeeGoalSettingOKRs} />}
      </Route>
      <Route path="/employee/announcements">
        {() => <ProtectedRoute component={EmployeeDealAnnouncements} />}
      </Route>
      <Route path="/employee/stakeholders">
        {() => <ProtectedRoute component={EmployeeStakeholderDirectory} />}
      </Route>
      <Route path="/employee/document-library">
        {() => <ProtectedRoute component={EmployeeDocumentLibrary} />}
      </Route>
      <Route path="/employee/asset-management">
        {() => <ProtectedRoute component={AssetManagement} />}
      </Route>
      <Route path="/employee/audit-logs">
        {() => <ProtectedRoute component={() => <AuditLogs role="Employee" />} />}
      </Route>
      
      {/* External Portal Routes */}
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/register/:token" component={PortalRegister} />
      <Route path="/portal">
        {() => <PortalProtectedRoute component={PortalDashboard} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DashboardProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DashboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
