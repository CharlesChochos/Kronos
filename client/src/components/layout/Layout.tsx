import { Sidebar } from "./Sidebar";
import { Bell, Search, User } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { useNotifications } from "@/lib/api";

type LayoutProps = {
  children: React.ReactNode;
  role?: 'CEO' | 'Employee';
  userName?: string;
  pageTitle?: string;
};

export function Layout({ children, role = 'CEO', userName = "Joshua Orlinsky", pageTitle }: LayoutProps) {
  const { 
    setShowProfileSheet, 
    setShowSettingsSheet, 
    setShowNotificationsSheet,
    setShowResourcesSheet 
  } = useDashboardContext();
  
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter((n: any) => !n.read).length;
  
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Sidebar role={role} />
      
      <div className="pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-display font-semibold tracking-tight">{pageTitle}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-secondary/50 border border-border rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-64 transition-all hover:bg-secondary"
                data-testid="input-search"
              />
            </div>
            
            <button 
              className="relative p-2 rounded-full hover:bg-secondary transition-colors"
              onClick={() => setShowNotificationsSheet(true)}
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full border-2 border-background text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" data-testid="dropdown-user">
                <div className="flex items-center gap-3 hover:bg-secondary/50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-border">
                  <Avatar className="w-8 h-8 border border-border">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">JO</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem 
                  className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                  onClick={() => setShowProfileSheet(true)}
                  data-testid="menu-item-profile"
                >
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                  onClick={() => setShowSettingsSheet(true)}
                  data-testid="menu-item-settings"
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer" data-testid="menu-item-logout">Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto bg-background relative">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
