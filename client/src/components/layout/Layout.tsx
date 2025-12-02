import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Bell, Search, User, BookOpen, Palette, Briefcase, CheckSquare, Users, FileText, X } from "lucide-react";
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
import { useNotifications, useDeals, useTasks, useUsers, useLogout } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LayoutProps = {
  children: React.ReactNode;
  role?: 'CEO' | 'Employee';
  userName?: string;
  pageTitle?: string;
};

export function Layout({ children, role = 'CEO', userName = "Joshua Orlinsky", pageTitle }: LayoutProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const logoutMutation = useLogout();
  
  const { 
    setShowProfileSheet, 
    setShowSettingsSheet, 
    setShowNotificationsSheet,
    setShowResourcesSheet,
    setShowCustomizeSheet
  } = useDashboardContext();
  
  const { data: notifications = [] } = useNotifications();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  const { data: users = [] } = useUsers();
  const unreadCount = notifications.filter((n: any) => !n.read).length;
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };
  
  // Get role-based route prefixes
  const rolePrefix = role === 'CEO' ? '/ceo' : '/employee';
  
  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { deals: [], tasks: [], users: [] };
    
    const query = searchQuery.toLowerCase();
    
    const filteredDeals = (deals as any[]).filter((deal: any) => 
      deal.name?.toLowerCase().includes(query) ||
      deal.client?.toLowerCase().includes(query) ||
      deal.sector?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    const filteredTasks = (tasks as any[]).filter((task: any) => 
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    const filteredUsers = (users as any[]).filter((user: any) => 
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    return { deals: filteredDeals, tasks: filteredTasks, users: filteredUsers };
  }, [searchQuery, deals, tasks, users]);
  
  const hasResults = searchResults.deals.length > 0 || searchResults.tasks.length > 0 || searchResults.users.length > 0;
  
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
            <div className="relative" ref={searchRef}>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search deals, tasks, users..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="bg-secondary/50 border border-border rounded-full pl-9 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-72 transition-all hover:bg-secondary"
                data-testid="input-search"
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              
              {showSearchResults && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  {hasResults ? (
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.deals.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Briefcase className="w-3 h-3" /> Deals
                          </div>
                          {searchResults.deals.map((deal: any) => (
                            <button
                              key={deal.id}
                              onClick={() => { setLocation(`${rolePrefix}/deals?id=${deal.id}`); setShowSearchResults(false); setSearchQuery(""); }}
                              className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-3"
                              data-testid={`search-result-deal-${deal.id}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Briefcase className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{deal.name}</p>
                                <p className="text-xs text-muted-foreground">{deal.client} • {deal.sector}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {searchResults.tasks.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <CheckSquare className="w-3 h-3" /> Tasks
                          </div>
                          {searchResults.tasks.map((task: any) => (
                            <button
                              key={task.id}
                              onClick={() => { setLocation(`${role === 'CEO' ? '/ceo/deals' : '/employee/tasks'}?id=${task.id}`); setShowSearchResults(false); setSearchQuery(""); }}
                              className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-3"
                              data-testid={`search-result-task-${task.id}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckSquare className="w-4 h-4 text-green-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-48">{task.description || 'No description'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {searchResults.users.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-3 h-3" /> Team Members
                          </div>
                          {searchResults.users.map((user: any) => (
                            <button
                              key={user.id}
                              onClick={() => { setLocation(`/ceo/team?id=${user.id}`); setShowSearchResults(false); setSearchQuery(""); }}
                              className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-3"
                              data-testid={`search-result-user-${user.id}`}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-purple-500/10 text-purple-500 text-xs">
                                  {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.role} • {user.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
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
                <DropdownMenuItem 
                  className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                  onClick={() => setShowResourcesSheet(true)}
                  data-testid="menu-item-resources"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Resources
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                  onClick={() => setShowCustomizeSheet(true)}
                  data-testid="menu-item-customize"
                >
                  <Palette className="w-4 h-4 mr-2" />
                  Customize Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem 
                  className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer" 
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  data-testid="menu-item-logout"
                >
                  {logoutMutation.isPending ? "Logging out..." : "Log out"}
                </DropdownMenuItem>
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
