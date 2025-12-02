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
import TeamPerformance from "@/pages/ceo/TeamPerformance";
import WarRoom from "@/pages/shared/WarRoom";
import DealComparison from "@/pages/shared/DealComparison";
import InvestorCRM from "@/pages/ceo/InvestorCRM";
import VacationCalendar from "@/pages/shared/VacationCalendar";
import ClientPortal from "@/pages/shared/ClientPortal";
import MentorshipPairing from "@/pages/shared/MentorshipPairing";
import GoalSettingOKRs from "@/pages/shared/GoalSettingOKRs";
import DealAnnouncements from "@/pages/shared/DealAnnouncements";
import QuickPolls from "@/pages/shared/QuickPolls";
import VoiceNotes from "@/pages/shared/VoiceNotes";
import StakeholderDirectory from "@/pages/shared/StakeholderDirectory";
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
const CeoVacationCalendar = () => <VacationCalendar role="CEO" />;
const EmployeeVacationCalendar = () => <VacationCalendar role="Employee" />;
const CeoClientPortal = () => <ClientPortal role="CEO" />;
const EmployeeClientPortal = () => <ClientPortal role="Employee" />;
const CeoMentorshipPairing = () => <MentorshipPairing role="CEO" />;
const EmployeeMentorshipPairing = () => <MentorshipPairing role="Employee" />;
const CeoGoalSettingOKRs = () => <GoalSettingOKRs role="CEO" />;
const EmployeeGoalSettingOKRs = () => <GoalSettingOKRs role="Employee" />;
const CeoDealAnnouncements = () => <DealAnnouncements role="CEO" />;
const EmployeeDealAnnouncements = () => <DealAnnouncements role="Employee" />;
const CeoQuickPolls = () => <QuickPolls role="CEO" />;
const EmployeeQuickPolls = () => <QuickPolls role="Employee" />;
const CeoVoiceNotes = () => <VoiceNotes role="CEO" />;
const EmployeeVoiceNotes = () => <VoiceNotes role="Employee" />;
const CeoStakeholderDirectory = () => <StakeholderDirectory role="CEO" />;
const EmployeeStakeholderDirectory = () => <StakeholderDirectory role="Employee" />;

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
      // Use actual role from database - CEO role goes to CEO dashboard, others to employee home
      if (user.role === 'CEO') {
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
      <Route path="/ceo/war-room">
        {() => <ProtectedRoute component={CeoWarRoom} />}
      </Route>
      <Route path="/ceo/deal-comparison">
        {() => <ProtectedRoute component={CeoDealComparison} />}
      </Route>
      <Route path="/ceo/investor-crm">
        {() => <ProtectedRoute component={InvestorCRM} />}
      </Route>
      <Route path="/ceo/vacation-calendar">
        {() => <ProtectedRoute component={CeoVacationCalendar} />}
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
      <Route path="/ceo/polls">
        {() => <ProtectedRoute component={CeoQuickPolls} />}
      </Route>
      <Route path="/ceo/voice-notes">
        {() => <ProtectedRoute component={CeoVoiceNotes} />}
      </Route>
      <Route path="/ceo/stakeholders">
        {() => <ProtectedRoute component={CeoStakeholderDirectory} />}
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
      <Route path="/employee/vacation-calendar">
        {() => <ProtectedRoute component={EmployeeVacationCalendar} />}
      </Route>
      <Route path="/employee/client-portal">
        {() => <ProtectedRoute component={EmployeeClientPortal} />}
      </Route>
      <Route path="/employee/mentorship">
        {() => <ProtectedRoute component={EmployeeMentorshipPairing} />}
      </Route>
      <Route path="/employee/okrs">
        {() => <ProtectedRoute component={EmployeeGoalSettingOKRs} />}
      </Route>
      <Route path="/employee/announcements">
        {() => <ProtectedRoute component={EmployeeDealAnnouncements} />}
      </Route>
      <Route path="/employee/polls">
        {() => <ProtectedRoute component={EmployeeQuickPolls} />}
      </Route>
      <Route path="/employee/voice-notes">
        {() => <ProtectedRoute component={EmployeeVoiceNotes} />}
      </Route>
      <Route path="/employee/stakeholders">
        {() => <ProtectedRoute component={EmployeeStakeholderDirectory} />}
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
