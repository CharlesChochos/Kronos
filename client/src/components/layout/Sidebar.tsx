import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Users, 
  PieChart, 
  LogOut,
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
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout, useUserPreferences, useSaveUserPreferences, useCurrentUser } from "@/lib/api";
import { toast } from "sonner";
import { useDashboardContext } from "@/contexts/DashboardContext";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";

type SidebarProps = {
  role: 'CEO' | 'Employee';
  collapsed?: boolean;
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

export function Sidebar({ role, collapsed = false }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const { data: currentUser } = useCurrentUser();
  const { unreadMessageCount, clearUnreadMessages } = useDashboardContext();
  const queryClient = useQueryClient();
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  
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
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };

  const isActive = (path: string) => location === path;
  const isMessagesPath = location.includes('/chat');
  
  const isCategoryActive = (links: LinkItem[]) => {
    return links.some(link => isActive(link.path));
  };

  // Check if user is an admin - for showing Asset Management in CEO view
  const isAdmin = currentUser?.accessLevel === 'admin';

  // CEO grouped links - ordered: Dashboard, Opportunities, Deal Management, Asset Management (admin only), Documents
  const ceoGroups: CategoryGroup[] = [
    {
      category: "Platform",
      links: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/ceo/dashboard" },
        { icon: Target, label: "Opportunities", path: "/ceo/opportunities" },
        { icon: Briefcase, label: "Deal Management", path: "/ceo/deals" },
        ...(isAdmin ? [{ icon: BarChart3, label: "Asset Management", path: "/ceo/asset-management" }] : []),
        { icon: FileText, label: "Documents", path: "/ceo/documents" },
      ]
    },
    {
      category: "People",
      links: [
        { icon: BarChart3, label: "Team Performance", path: "/ceo/team-performance" },
        { icon: Users, label: "Team Assignment", path: "/ceo/team" },
        { icon: GraduationCap, label: "Mentorship", path: "/ceo/mentorship" },
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
        { icon: Building, label: "Stakeholders", path: "/ceo/stakeholders" },
      ]
    },
    {
      category: "Clients",
      links: [
        { icon: UserCheck, label: "Client Portal", path: "/ceo/client-portal" },
        { icon: PieChart, label: "Investor Match", path: "/ceo/investors" },
        { icon: Users, label: "Investor CRM", path: "/ceo/investor-crm" },
        { icon: Database, label: "Investor Database", path: "/ceo/investor-database" },
      ]
    },
    {
      category: "Administration",
      links: [
        { icon: Shield, label: "User Management", path: "/ceo/admin" },
        { icon: ClipboardList, label: "Audit Logs", path: "/ceo/audit-logs" },
        { icon: FileStack, label: "Deal Templates", path: "/ceo/deal-templates" },
        { icon: FolderOpen, label: "Document Library", path: "/ceo/document-library" },
      ]
    }
  ];

  // Check if user is a division head (Asset Management division)
  // Sergio manages Asset Management division - only he (and admins) should see it
  const isAssetManagementDivisionHead = currentUser?.name?.toLowerCase().includes('sergio') || 
    currentUser?.accessLevel === 'admin';

  // Employee grouped links - dynamically filter based on user
  const employeePlatformLinks = [
    { icon: Home, label: "Home", path: "/employee/home" },
    { icon: CheckSquare, label: "My Tasks", path: "/employee/tasks" },
    { icon: Briefcase, label: "Deal Management", path: "/employee/deals" },
    ...(isAssetManagementDivisionHead ? [{ icon: BarChart3, label: "Asset Management", path: "/employee/asset-management" }] : []),
    { icon: PieChart, label: "Investor Match", path: "/employee/investors" },
    { icon: FileText, label: "Documents", path: "/employee/documents" },
    { icon: FolderOpen, label: "Document Library", path: "/employee/document-library" },
  ];

  const employeeGroups: CategoryGroup[] = [
    {
      category: "Platform",
      links: employeePlatformLinks as LinkItem[],
    },
    {
      category: "Collaboration",
      links: [
        { icon: Megaphone, label: "Communications", path: "/employee/announcements" },
        { icon: MessageCircle, label: "Messages", path: "/employee/chat" },
        { icon: Building, label: "Stakeholders", path: "/employee/stakeholders" },
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
    }
  ];

  // Use the role prop to determine navigation (supports preview mode for admins)
  const groups = role === 'CEO' ? ceoGroups : employeeGroups;

  return (
    <div className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col text-sidebar-foreground fixed left-0 top-0 z-50 transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("p-6 flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
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
              {!collapsed ? (
                <>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 mb-1 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                      isGroupActive 
                        ? "text-primary bg-primary/5" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    )}
                    data-testid={`sidebar-category-${group.category.toLowerCase()}`}
                  >
                    <span>{group.category}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
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
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                                isActive(link.path)
                                  ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                              )}
                              data-testid={`sidebar-link-${link.path.split('/').pop()}`}
                            >
                              <div className="relative">
                                <link.icon className={cn("w-4 h-4 flex-shrink-0", isActive(link.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
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
                            "flex items-center justify-center px-2 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                            isActive(link.path)
                              ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                          )}
                          data-testid={`sidebar-link-${link.path.split('/').pop()}`}
                          title={link.label}
                        >
                          <div className="relative">
                            <link.icon className={cn("w-4 h-4 flex-shrink-0", isActive(link.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
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

      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className={cn(
            "flex items-center rounded-md text-sm font-medium text-red-400 hover:bg-red-400/10 cursor-pointer transition-colors w-full disabled:opacity-50",
            collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2 text-left"
          )}
          data-testid="sidebar-signout"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (logoutMutation.isPending ? "Signing Out..." : "Sign Out")}
        </button>
      </div>
    </div>
  );
}
