import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { useCurrentUser, onSessionExpired, useUserPreferences, useUpdateUserPreferences } from "@/lib/api";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useEffect, lazy, Suspense, useCallback, useRef, useState } from "react";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { toast } from "sonner";
import { WelcomeModal } from "@/components/WelcomeModal";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { PWAFeatures } from "@/components/PWAFeatures";

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-muted-foreground">Loading...</div>
  </div>
);

// Lazy load all page components for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth/AuthPage"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/ceo/Dashboard"));
const DealManagement = lazy(() => import("@/pages/ceo/DealManagement"));
const InvestorMatching = lazy(() => import("@/pages/ceo/InvestorMatching"));
const EmployeeInvestorMatching = lazy(() => import("@/pages/employee/InvestorMatching"));
const TeamAssignment = lazy(() => import("@/pages/ceo/TeamAssignment"));
const TeamPerformance = lazy(() => import("@/pages/ceo/TeamPerformance"));
const TimeAnalytics = lazy(() => import("@/pages/ceo/TimeAnalytics"));
const TeamProfiles = lazy(() => import("@/pages/ceo/TeamProfiles"));
const InvestorCRM = lazy(() => import("@/pages/ceo/InvestorCRM"));
const ClientPortal = lazy(() => import("@/pages/shared/ClientPortal"));
const MentorshipPairing = lazy(() => import("@/pages/shared/MentorshipPairing"));
const GoalSettingOKRs = lazy(() => import("@/pages/shared/GoalSettingOKRs"));
const DealAnnouncements = lazy(() => import("@/pages/shared/DealAnnouncements"));
const StakeholderDirectory = lazy(() => import("@/pages/shared/StakeholderDirectory"));
const EventCalendar = lazy(() => import("@/pages/shared/EventCalendar"));
const MyTasks = lazy(() => import("@/pages/employee/MyTasks"));
const EmployeeHome = lazy(() => import("@/pages/employee/Home"));
const Chat = lazy(() => import("@/pages/shared/Chat"));
const UserManagement = lazy(() => import("@/pages/ceo/UserManagement"));
const InvestorDatabase = lazy(() => import("@/pages/ceo/InvestorDatabase"));
const DealTemplates = lazy(() => import("@/pages/shared/DealTemplates"));
const DocumentManagement = lazy(() => import("@/pages/shared/DocumentManagement"));
const AuditLogs = lazy(() => import("@/pages/ceo/AuditLogs"));
const Opportunities = lazy(() => import("@/pages/ceo/Opportunities"));
const ArchivedDeals = lazy(() => import("@/pages/ceo/ArchivedDeals"));
const AssetManagement = lazy(() => import("@/pages/employee/AssetManagement"));
const PortalLogin = lazy(() => import("@/pages/portal/PortalLogin"));
const PortalRegister = lazy(() => import("@/pages/portal/PortalRegister"));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const Forms = lazy(() => import("@/pages/shared/Forms"));
const PublicForm = lazy(() => import("@/pages/shared/PublicForm"));
const TaskTemplates = lazy(() => import("@/pages/shared/TaskTemplates"));
const PersonalityAssessment = lazy(() => import("@/pages/shared/PersonalityAssessment"));
const ResumeOnboarding = lazy(() => import("@/pages/shared/ResumeOnboarding"));

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
const CeoMyTasks = () => <MyTasks role="CEO" />;

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function WelcomeModalWrapper({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  const { data: preferences, isLoading: prefsLoading, isSuccess } = useUserPreferences();
  const updatePreferences = useUpdateUserPreferences();
  const [showWelcome, setShowWelcome] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    // Only check when:
    // 1. User is logged in
    // 2. Preferences query succeeded  
    // 3. Preferences data exists (not null from 401)
    // 4. Haven't checked this user yet
    if (user && !prefsLoading && isSuccess && preferences && checkedUserId !== user.id) {
      setCheckedUserId(user.id);
      // Show welcome modal if hasSeenWelcome is false, undefined, or null (new users)
      const hasNotSeenWelcome = !preferences?.hasSeenWelcome;
      if (hasNotSeenWelcome) {
        setShowWelcome(true);
      }
    }
  }, [user, preferences, prefsLoading, checkedUserId, isSuccess]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    updatePreferences.mutate({ hasSeenWelcome: true }, {
      onError: (error) => {
        console.error('Failed to save welcome preference:', error);
      }
    });
  };

  return (
    <>
      {children}
      {user && (
        <WelcomeModal 
          isOpen={showWelcome} 
          onClose={handleCloseWelcome}
          userName={user.name?.split(' ')[0]}
        />
      )}
    </>
  );
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
    return <PageLoader />;
  }

  if (!user || user.role !== 'External') {
    return null;
  }

  return <Component />;
}

function Router() {
  const { data: user, refetch } = useCurrentUser();
  const [location, setLocation] = useLocation();
  const sessionExpiredHandled = useRef(false);

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiredHandled.current) return;
    if (location === "/" || location === "/auth" || location.startsWith("/portal/login") || location.startsWith("/form/")) return;
    
    sessionExpiredHandled.current = true;
    
    toast.error("Your session has expired. Please log in again.", {
      duration: 5000,
      id: "session-expired",
    });
    
    queryClient.clear();
    
    setTimeout(() => {
      setLocation("/");
      sessionExpiredHandled.current = false;
    }, 500);
  }, [location, setLocation]);

  useEffect(() => {
    const unsubscribe = onSessionExpired(handleSessionExpired);
    return unsubscribe;
  }, [handleSessionExpired]);

  useEffect(() => {
    const welcomePending = sessionStorage.getItem('welcomePending');
    if (welcomePending === 'true') {
      return;
    }
    
    if (user && location === "/") {
      if (user.accessLevel === 'admin') {
        setLocation("/ceo/dashboard");
      } else {
        setLocation("/employee/home");
      }
    }
  }, [user, location, setLocation]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={AuthPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/form/:shareToken" component={PublicForm} />
        
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
        <Route path="/ceo/messages">
          {() => <ProtectedRoute component={CeoChat} />}
        </Route>
        <Route path="/ceo/team-performance">
          {() => <ProtectedRoute component={TeamPerformance} />}
        </Route>
        <Route path="/ceo/time-analytics">
          {() => <ProtectedRoute component={TimeAnalytics} />}
        </Route>
        <Route path="/ceo/team-profiles">
          {() => <ProtectedRoute component={TeamProfiles} />}
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
          {() => <ProtectedRoute component={() => <AuditLogs role="CEO" />} />}
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
        <Route path="/ceo/archived-deals">
          {() => <ProtectedRoute component={ArchivedDeals} />}
        </Route>
        <Route path="/ceo/asset-management">
          {() => <ProtectedRoute component={() => <AssetManagement role="CEO" />} />}
        </Route>
        <Route path="/ceo/tasks">
          {() => <ProtectedRoute component={CeoMyTasks} />}
        </Route>
        <Route path="/ceo/forms">
          {() => <ProtectedRoute component={Forms} />}
        </Route>
        <Route path="/ceo/task-templates">
          {() => <ProtectedRoute component={TaskTemplates} />}
        </Route>
        <Route path="/ceo/personality-assessment">
          {() => <ProtectedRoute component={PersonalityAssessment} />}
        </Route>
        <Route path="/ceo/resume-onboarding">
          {() => <ProtectedRoute component={ResumeOnboarding} />}
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
        <Route path="/employee/opportunities">
          {() => <ProtectedRoute component={() => <Opportunities role="Employee" />} />}
        </Route>
        <Route path="/employee/archived-deals">
          {() => <ProtectedRoute component={ArchivedDeals} />}
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
        <Route path="/employee/messages">
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
        <Route path="/employee/forms">
          {() => <ProtectedRoute component={Forms} />}
        </Route>
        <Route path="/employee/task-templates">
          {() => <ProtectedRoute component={TaskTemplates} />}
        </Route>
        <Route path="/employee/personality-assessment">
          {() => <ProtectedRoute component={PersonalityAssessment} />}
        </Route>
        <Route path="/employee/resume-onboarding">
          {() => <ProtectedRoute component={ResumeOnboarding} />}
        </Route>
        
        {/* External Portal Routes */}
        <Route path="/portal/login" component={PortalLogin} />
        <Route path="/portal/register/:token" component={PortalRegister} />
        <Route path="/portal">
          {() => <PortalProtectedRoute component={PortalDashboard} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <DashboardProvider>
            <TooltipProvider>
              <Toaster />
              <WelcomeModalWrapper>
                <Router />
              </WelcomeModalWrapper>
              <PWAInstallPrompt />
              <MobileBottomNav />
              <NotificationPermissionPrompt />
              <PWAFeatures />
            </TooltipProvider>
          </DashboardProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
