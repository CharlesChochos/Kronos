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
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";

type SidebarProps = {
  role: 'CEO' | 'Employee';
  collapsed?: boolean;
};

export function Sidebar({ role, collapsed = false }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  
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
        {links.map((link) => (
          <Link key={link.path} href={link.path}>
            <div
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2",
                isActive(link.path)
                  ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
              data-testid={`sidebar-link-${link.path.split('/').pop()}`}
              title={collapsed ? link.label : undefined}
            >
              <link.icon className={cn("w-4 h-4 flex-shrink-0", isActive(link.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {!collapsed && link.label}
            </div>
          </Link>
        ))}
        
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
