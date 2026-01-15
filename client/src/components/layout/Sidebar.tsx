import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Users, 
  PieChart, 
  Bot,
  CheckSquare,
  Home,
  MessageCircle,
  Calendar,
  BarChart3,
  Target,
  UserCheck,
  GraduationCap,
  Megaphone,
  Building,
  ChevronDown,
  ChevronRight,
  Shield,
  Database,
  FileStack,
  FolderOpen,
  ClipboardList,
  ClipboardCheck,
  Brain,
  Clock,
  Archive,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useUserPreferences, useSaveUserPreferences, useCurrentUser } from "@/lib/api";
import { useDashboardContext } from "@/contexts/DashboardContext";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";

type SidebarProps = {
  role: 'CEO' | 'Employee';
  collapsed?: boolean;
  inMobileDrawer?: boolean; // When true, uses fixed width without responsive classes
};

type LinkItem = {
  icon: any;
  label: string;
  path: string;
};

type CategoryGroup = {
  category: string;
  links: LinkItem[];
};

export function Sidebar({ role, collapsed = false, inMobileDrawer = false }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const { unreadMessageCount, clearUnreadMessages } = useDashboardContext();
  const queryClient = useQueryClient();
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  const { setTheme, theme } = useTheme();
  
  // Expanded categories state - persist to user_preferences.settings.sidebarCategories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoriesInitialized, setCategoriesInitialized] = useState(false);
  const prevCategoriesRef = useRef<string | null>(null);
  
  // Load categories from user preferences
  useEffect(() => {
    if (!prefsLoading && !categoriesInitialized) {
      const savedCategories = (userPrefs?.settings as any)?.sidebarCategories;
      if (savedCategories && typeof savedCategories === 'object') {
        setExpandedCategories(savedCategories);
      }
      setCategoriesInitialized(true);
    }
  }, [prefsLoading, userPrefs, categoriesInitialized]);
  
  // Save categories to database (debounced)
  useEffect(() => {
    if (!categoriesInitialized || prefsLoading) return;
    
    const currentJson = JSON.stringify(expandedCategories);
    if (prevCategoriesRef.current === currentJson) return;
    
    // Skip initial save if values match server state
    if (prevCategoriesRef.current === null) {
      const serverCategories = (userPrefs?.settings as any)?.sidebarCategories;
      if (serverCategories && JSON.stringify(serverCategories) === currentJson) {
        prevCategoriesRef.current = currentJson;
        return;
      }
    }
    
    const timeout = setTimeout(() => {
      const freshPrefs = queryClient.getQueryData<UserPreferences>(['userPreferences']) || userPrefs;
      const { id, userId, updatedAt, ...mutablePrefs } = (freshPrefs || {}) as any;
      const existingSettings = (freshPrefs?.settings as any) || {};
      saveUserPrefs.mutate({
        ...mutablePrefs,
        settings: {
          ...existingSettings,
          sidebarCategories: expandedCategories,
        },
      });
      prevCategoriesRef.current = currentJson;
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [expandedCategories, categoriesInitialized, prefsLoading, userPrefs]);
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  const openAIAssistant = () => {
    // Dispatch custom event to open the AI assistant
    window.dispatchEvent(new CustomEvent('openKronosAssistant'));
  };

  const isActive = (path: string) => location === path;
  const isMessagesPath = location.includes('/chat');
  
  const isCategoryActive = (links: LinkItem[]) => {
    return links.some(link => isActive(link.path));
  };

  // Check if user is an admin - for showing Asset Management in CEO view
  const isAdmin = currentUser?.accessLevel === 'admin';
  const canAccessForms = currentUser?.name?.toLowerCase().includes('dimitra') || 
                         currentUser?.email?.toLowerCase().includes('dimitra') ||
                         currentUser?.name?.toLowerCase().includes('charles') || 
                         currentUser?.email?.toLowerCase().includes('charles');
  const isDimitra = canAccessForms;

  // CEO grouped links - ordered: Dashboard, My Tasks, Opportunities, Deal Management, Asset Management (admin only), Documents
  const ceoGroups: CategoryGroup[] = [
    {
      category: "Platform",
      links: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/ceo/dashboard" },
        { icon: CheckSquare, label: "My Tasks", path: "/ceo/tasks" },
        { icon: Target, label: "Opportunities", path: "/ceo/opportunities" },
        { icon: Briefcase, label: "Deal Management", path: "/ceo/deals" },
        ...(isAdmin ? [{ icon: BarChart3, label: "Asset Management", path: "/ceo/asset-management" }] : []),
        { icon: Archive, label: "Archived Deals", path: "/ceo/archived-deals" },
        { icon: FileText, label: "Documents", path: "/ceo/documents" },
      ]
    },
    {
      category: "People",
      links: [
        { icon: BarChart3, label: "Team Performance", path: "/ceo/team-performance" },
        { icon: Clock, label: "Time Analytics", path: "/ceo/time-analytics" },
        { icon: Brain, label: "Team Profiles", path: "/ceo/team-profiles" },
        { icon: Users, label: "Team Assignment", path: "/ceo/team" },
        { icon: GraduationCap, label: "Mentorship", path: "/ceo/mentorship" },
        { icon: FileText, label: "Resume Onboarding", path: "/ceo/resume-onboarding" },
        { icon: Brain, label: "Personality Profile", path: "/ceo/personality-assessment" },
      ]
    },
    {
      category: "Schedule",
      links: [
        { icon: Calendar, label: "Calendar", path: "/ceo/calendar" },
        { icon: Target, label: "Goals & OKRs", path: "/ceo/okrs" },
      ]
    },
    {
      category: "Collaboration",
      links: [
        { icon: Megaphone, label: "Communications", path: "/ceo/announcements" },
        { icon: MessageCircle, label: "Messages", path: "/ceo/chat" },
      ]
    },
    {
      category: "Clients",
      links: [
        { icon: UserCheck, label: "Client Portal", path: "/ceo/client-portal" },
        { icon: PieChart, label: "Investor Match", path: "/ceo/investors" },
        { icon: Building, label: "CRM", path: "/ceo/stakeholders" },
      ]
    },
    {
      category: "Administration",
      links: [
        { icon: Shield, label: "User Management", path: "/ceo/admin" },
        { icon: ClipboardList, label: "Audit Logs", path: "/ceo/audit-logs" },
        { icon: FileStack, label: "Templates", path: "/ceo/deal-templates" },
        { icon: FolderOpen, label: "Document Library", path: "/ceo/document-library" },
        ...(isDimitra ? [
          { icon: ClipboardCheck, label: "Forms", path: "/ceo/forms" },
          { icon: FileStack, label: "HR Templates", path: "/ceo/task-templates" },
        ] : []),
      ]
    }
  ];

  // Check if user can access Asset Management division
  // Uses database flag hasAssetManagementAccess, plus all admins have access
  const canAccessAssetManagement = 
    currentUser?.hasAssetManagementAccess === true ||
    currentUser?.accessLevel === 'admin';

  // Employee grouped links - dynamically filter based on user
  const employeePlatformLinks = [
    { icon: Home, label: "Home", path: "/employee/home" },
    { icon: CheckSquare, label: "My Tasks", path: "/employee/tasks" },
    { icon: Target, label: "Opportunities", path: "/employee/opportunities" },
    { icon: Briefcase, label: "Deal Management", path: "/employee/deals" },
    ...(canAccessAssetManagement ? [{ icon: BarChart3, label: "Asset Management", path: "/employee/asset-management" }] : []),
    { icon: Archive, label: "Archived Deals", path: "/employee/archived-deals" },
    { icon: FileText, label: "Documents", path: "/employee/documents" },
    { icon: FolderOpen, label: "Document Library", path: "/employee/document-library" },
  ];

  const employeeGroups: CategoryGroup[] = [
    {
      category: "Platform",
      links: employeePlatformLinks as LinkItem[],
    },
    {
      category: "People",
      links: [
        { icon: FileText, label: "Resume Onboarding", path: "/employee/resume-onboarding" },
        { icon: Brain, label: "Personality Profile", path: "/employee/personality-assessment" },
      ]
    },
    {
      category: "Collaboration",
      links: [
        { icon: Megaphone, label: "Communications", path: "/employee/announcements" },
        { icon: MessageCircle, label: "Messages", path: "/employee/chat" },
      ]
    },
    {
      category: "Clients",
      links: [
        { icon: PieChart, label: "Investor Match", path: "/employee/investors" },
        { icon: Building, label: "CRM", path: "/employee/stakeholders" },
      ]
    },
    {
      category: "Schedule",
      links: [
        { icon: Calendar, label: "Calendar", path: "/employee/calendar" },
        { icon: Target, label: "Goals & OKRs", path: "/employee/okrs" },
      ]
    },
    {
      category: "Compliance",
      links: [
        { icon: ClipboardList, label: "My Activity Log", path: "/employee/audit-logs" },
      ]
    },
    ...(isDimitra ? [{
      category: "Administration",
      links: [
        { icon: ClipboardCheck, label: "Forms", path: "/employee/forms" },
        { icon: FileStack, label: "HR Templates", path: "/employee/task-templates" },
      ]
    }] : [])
  ];

  // Use the role prop to determine navigation (supports preview mode for admins)
  const groups = role === 'CEO' ? ceoGroups : employeeGroups;

  // Determine if sidebar should show in collapsed state (icons only)
  // In mobile drawer, always show expanded (labels visible)
  const showCollapsed = inMobileDrawer ? false : collapsed;
  
  return (
    <div className={cn(
      "h-screen bg-sidebar flex flex-col text-sidebar-foreground transition-all duration-300",
      // In mobile drawer: no fixed positioning, no border (Sheet handles it)
      inMobileDrawer ? "w-64 border-0" : [
        "fixed left-0 top-0 z-50 border-r border-sidebar-border",
        // Width: collapsed on md, full on lg, unless explicitly collapsed
        collapsed ? "w-20" : "w-64",
        "md:w-20 lg:w-64",
        collapsed && "lg:w-20"
      ]
    )}>
      <div className={cn("p-6 flex items-center", showCollapsed ? "justify-center" : "gap-3")}>
        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
        </div>
        {!showCollapsed && (
          <div>
            <h1 className="font-display font-bold text-lg leading-none tracking-tight">Kronos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">v2.4</p>
          </div>
        )}
      </div>

      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {groups.map((group) => {
          const isGroupActive = isCategoryActive(group.links);
          const isExpanded = expandedCategories[group.category] !== false;
          
          return (
            <div key={group.category} className="mb-2">
              {!showCollapsed ? (
                <>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 mb-1 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                      isGroupActive 
                        ? "text-primary bg-primary/10" 
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                    data-testid={`sidebar-category-${group.category.toLowerCase()}`}
                  >
                    <span>{group.category}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-0.5 pl-1">
                      {group.links.map((link) => {
                        const isMessageLink = link.path.includes('/chat');
                        const showBadge = isMessageLink && unreadMessageCount > 0 && !isMessagesPath;
                        
                        return (
                          <Link 
                            key={link.path} 
                            href={link.path}
                            onClick={() => {
                              if (isMessageLink) {
                                clearUnreadMessages();
                              }
                            }}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                                isActive(link.path)
                                  ? "bg-primary/15 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))] dark:bg-primary/20"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                              data-testid={`sidebar-link-${link.path.split('/').pop()}`}
                            >
                              <div className="relative">
                                <link.icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive(link.path) ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                                {showBadge && (
                                  <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                                  </div>
                                )}
                              </div>
                              <span className="flex-1">{link.label}</span>
                              {showBadge && (
                                <div className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  {group.links.map((link) => {
                    const isMessageLink = link.path.includes('/chat');
                    const showBadge = isMessageLink && unreadMessageCount > 0 && !isMessagesPath;
                    
                    return (
                      <Link 
                        key={link.path} 
                        href={link.path}
                        onClick={() => {
                          if (isMessageLink) {
                            clearUnreadMessages();
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center px-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                            isActive(link.path)
                              ? "bg-primary/15 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))] dark:bg-primary/20"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                          data-testid={`sidebar-link-${link.path.split('/').pop()}`}
                          title={link.label}
                        >
                          <div className="relative">
                            <link.icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive(link.path) ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                            {showBadge && (
                              <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <button
          onClick={() => {
            if (theme === "light") setTheme("dark");
            else if (theme === "dark") setTheme("system");
            else setTheme("light");
          }}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium cursor-pointer transition-all w-full border",
            "text-sidebar-foreground/80 hover:text-sidebar-foreground",
            "bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border",
            showCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5 text-left"
          )}
          data-testid="sidebar-theme-toggle"
          title={showCollapsed ? (theme === "dark" ? "Dark Mode" : theme === "light" ? "Light Mode" : "System Theme") : undefined}
        >
          <div className="relative w-4 h-4">
            <Sun className="w-4 h-4 absolute rotate-0 scale-100 transition-all text-amber-500 dark:-rotate-90 dark:scale-0" />
            <Moon className="w-4 h-4 absolute rotate-90 scale-0 transition-all text-blue-400 dark:rotate-0 dark:scale-100" />
          </div>
          {!showCollapsed && (
            <span>{theme === "dark" ? "Dark Mode" : theme === "light" ? "Light Mode" : "System Theme"}</span>
          )}
        </button>
        <button
          onClick={openAIAssistant}
          className={cn(
            "flex items-center rounded-lg text-sm font-semibold bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 text-primary cursor-pointer transition-all w-full group shadow-sm hover:shadow-md border border-primary/20",
            showCollapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3 text-left"
          )}
          data-testid="sidebar-ai-assistant"
          title={showCollapsed ? "Ask Kronos AI" : undefined}
        >
          <div className="relative">
            <Bot className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          {!showCollapsed && (
            <div className="flex flex-col">
              <span>Ask Kronos AI</span>
              <span className="text-[10px] text-primary/70 font-normal">Click to chat</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
