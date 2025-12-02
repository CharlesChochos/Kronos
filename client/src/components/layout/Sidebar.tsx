import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Users, 
  UserPlus, 
  PieChart, 
  LogOut,
  CheckSquare,
  Home,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/api";
import { toast } from "sonner";
import { useDashboardContext } from "@/contexts/DashboardContext";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";

type SidebarProps = {
  role: 'CEO' | 'Employee';
  collapsed?: boolean;
};

export function Sidebar({ role, collapsed = false }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const { unreadMessageCount, clearUnreadMessages } = useDashboardContext();
  
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

  const ceoLinks = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/ceo/dashboard" },
    { icon: Briefcase, label: "Deal Management", path: "/ceo/deals" },
    { icon: FileText, label: "Document Generator", path: "/ceo/documents" },
    { icon: PieChart, label: "Investor Match", path: "/ceo/investors" },
    { icon: Users, label: "Team Assignment", path: "/ceo/team" },
    { icon: MessageCircle, label: "Messages", path: "/ceo/chat" },
  ];

  const employeeLinks = [
    { icon: Home, label: "Home", path: "/employee/home" },
    { icon: CheckSquare, label: "My Tasks", path: "/employee/tasks" },
    { icon: FileText, label: "Document Generator", path: "/employee/documents" },
    { icon: Briefcase, label: "Deal Management", path: "/employee/deals" },
    { icon: PieChart, label: "Investor Match", path: "/employee/investors" },
    { icon: MessageCircle, label: "Messages", path: "/employee/chat" },
  ];

  const links = role === 'CEO' ? ceoLinks : employeeLinks;

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
            <h1 className="font-display font-bold text-lg leading-none tracking-tight">OSReaper</h1>
            <p className="text-xs text-muted-foreground mt-0.5">v2.4</p>
          </div>
        )}
      </div>

      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Platform
          </div>
        )}
        {links.map((link) => {
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
                  "flex items-center rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2",
                  isActive(link.path)
                    ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
                data-testid={`sidebar-link-${link.path.split('/').pop()}`}
                title={collapsed ? link.label : undefined}
              >
                <div className="relative">
                  <link.icon className={cn("w-4 h-4 flex-shrink-0", isActive(link.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {showBadge && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <span className="flex-1">{link.label}</span>
                )}
                {!collapsed && showBadge && (
                  <div className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </div>
                )}
              </div>
            </Link>
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
