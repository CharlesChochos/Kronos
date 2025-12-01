import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Users, 
  UserPlus, 
  PieChart, 
  Settings, 
  LogOut,
  CheckSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";

type SidebarProps = {
  role: 'CEO' | 'Employee';
};

export function Sidebar({ role }: SidebarProps) {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  const ceoLinks = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/ceo/dashboard" },
    { icon: Briefcase, label: "Deal Management", path: "/ceo/deals" },
    { icon: FileText, label: "Document Generator", path: "/ceo/documents" },
    { icon: PieChart, label: "Investor Match", path: "/ceo/investors" },
    { icon: Users, label: "Team Assignment", path: "/ceo/team" },
  ];

  const employeeLinks = [
    { icon: CheckSquare, label: "My Tasks", path: "/employee/tasks" },
    { icon: FileText, label: "Document Generator", path: "/employee/documents" },
    { icon: Briefcase, label: "Active Deals", path: "/employee/deals" },
  ];

  const links = role === 'CEO' ? ceoLinks : employeeLinks;

  return (
    <div className="h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col text-sidebar-foreground fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-none tracking-tight">Equiturn</h1>
          <p className="text-xs text-muted-foreground mt-0.5">OSReaper v2.4</p>
        </div>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Platform
        </div>
        {links.map((link) => (
          <Link key={link.path} href={link.path}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                isActive(link.path)
                  ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <link.icon className={cn("w-4 h-4", isActive(link.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {link.label}
            </div>
          </Link>
        ))}
        
        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          System
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer transition-colors">
          <Users className="w-4 h-4" />
          Resources
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-400/10 cursor-pointer transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </div>
        </Link>
      </div>
    </div>
  );
}
