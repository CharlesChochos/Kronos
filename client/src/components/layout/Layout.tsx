import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Bell, Search, User, BookOpen, Palette, Briefcase, CheckSquare, Users, FileText, X, Settings, BarChart3, Target, Mail, Phone, Lock, Pencil, AlertCircle, Info, Check } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { useNotifications, useDeals, useTasks, useUsers, useLogout, useCurrentUser, useMarkNotificationRead, useUpdateUserProfile, useChangePassword } from "@/lib/api";
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
  const { data: currentUser } = useCurrentUser();
  const markNotificationRead = useMarkNotificationRead();
  const updateUserProfile = useUpdateUserProfile();
  const changePassword = useChangePassword();
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const { 
    showProfileSheet,
    setShowProfileSheet, 
    showSettingsSheet,
    setShowSettingsSheet, 
    showNotificationsSheet,
    setShowNotificationsSheet,
    showResourcesSheet,
    setShowResourcesSheet,
    setShowCustomizeSheet
  } = useDashboardContext();
  
  const { data: notifications = [] } = useNotifications();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  const { data: users = [] } = useUsers();
  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const unreadNotifications = notifications.filter((n: any) => !n.read);
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };
  
  // Profile handlers
  const handleStartEditProfile = () => {
    setProfileForm({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      phone: (currentUser as any)?.phone || '',
    });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileForm({ name: '', email: '', phone: '' });
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name || !profileForm.email) {
      toast.error("Name and email are required");
      return;
    }
    
    if (!currentUser?.id) {
      toast.error("User not found");
      return;
    }
    
    try {
      await updateUserProfile.mutateAsync({
        userId: currentUser.id,
        updates: {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
        },
      });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleCancelChangePassword = () => {
    setIsChangingPassword(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("All password fields are required");
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    
    if (!currentUser?.id) {
      toast.error("User not found");
      return;
    }
    
    try {
      await changePassword.mutateAsync({
        userId: currentUser.id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password changed successfully");
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
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
    
    // For employees, filter to only show deals where they're on the pod team
    let accessibleDeals = deals as any[];
    if (role === 'Employee' && currentUser) {
      accessibleDeals = (deals as any[]).filter((deal: any) => {
        if (!deal.podTeam || !Array.isArray(deal.podTeam)) return false;
        return deal.podTeam.some((member: any) => 
          (currentUser.id && member.userId === currentUser.id) ||
          (currentUser.email && member.email === currentUser.email) ||
          (currentUser.name && member.name === currentUser.name)
        );
      });
    }
    
    const filteredDeals = accessibleDeals.filter((deal: any) => 
      deal.name?.toLowerCase().includes(query) ||
      deal.client?.toLowerCase().includes(query) ||
      deal.sector?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    // For employees, filter to only show their own tasks
    let accessibleTasks = tasks as any[];
    if (role === 'Employee' && currentUser) {
      accessibleTasks = (tasks as any[]).filter((task: any) => 
        task.assigneeId === currentUser.id
      );
    }
    
    const filteredTasks = accessibleTasks.filter((task: any) => 
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    // For employees, only show team members (not CEO search capability)
    let accessibleUsers = users as any[];
    if (role === 'Employee') {
      accessibleUsers = (users as any[]).filter((user: any) => 
        user.role !== 'CEO'
      );
    }
    
    const filteredUsers = accessibleUsers.filter((user: any) => 
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    ).slice(0, 5);
    
    return { deals: filteredDeals, tasks: filteredTasks, users: filteredUsers };
  }, [searchQuery, deals, tasks, users, role, currentUser]);
  
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
                              onClick={() => { 
                                if (role === 'CEO') {
                                  setLocation(`/ceo/team?id=${user.id}`);
                                } else {
                                  toast.info(`${user.name}`, {
                                    description: `${user.role} • ${user.email}`,
                                    duration: 3000,
                                  });
                                }
                                setShowSearchResults(false); 
                                setSearchQuery(""); 
                              }}
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
                    <p className="text-xs text-muted-foreground mt-0.5">{currentUser?.role || role}</p>
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
                {role === 'CEO' && (
                  <>
                    <DropdownMenuItem 
                      className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                      onClick={() => setShowCustomizeSheet(true)}
                      data-testid="menu-item-customize"
                    >
                      <Palette className="w-4 h-4 mr-2" />
                      Customize Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                  </>
                )}
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

      {/* Profile Sheet */}
      <Sheet open={showProfileSheet} onOpenChange={(open) => {
        setShowProfileSheet(open);
        if (open) {
          setProfileForm({
            name: currentUser?.name || '',
            email: currentUser?.email || '',
            phone: (currentUser as any)?.phone || '',
          });
        } else {
          setIsEditingProfile(false);
          setIsChangingPassword(false);
          setProfileForm({ name: '', email: '', phone: '' });
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        }
      }}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              My Profile
            </SheetTitle>
            <SheetDescription>View and manage your profile information.</SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-6 pr-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">
                  {currentUser?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{currentUser?.name}</h3>
                  <p className="text-muted-foreground">{currentUser?.role}</p>
                </div>
                {!isEditingProfile && !isChangingPassword && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleStartEditProfile}
                    data-testid="button-edit-profile"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              
              <Separator />
              
              {/* Edit Profile Form */}
              {isEditingProfile ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Edit Contact Information</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Your full name"
                      data-testid="input-edit-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="Your email address"
                      data-testid="input-edit-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone Number</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="Your phone number (optional)"
                      data-testid="input-edit-phone"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEditProfile}
                      className="flex-1"
                      data-testid="button-cancel-edit-profile"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveProfile}
                      disabled={updateUserProfile.isPending}
                      className="flex-1"
                      data-testid="button-save-profile"
                    >
                      {updateUserProfile.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              ) : isChangingPassword ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Change Password</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      data-testid="input-current-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Enter new password (min 6 characters)"
                      data-testid="input-new-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCancelChangePassword}
                      className="flex-1"
                      data-testid="button-cancel-password"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending}
                      className="flex-1"
                      data-testid="button-save-password"
                    >
                      {changePassword.isPending ? "Changing..." : "Change Password"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contact Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Email</Label>
                          <p className="text-sm">{currentUser?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Phone</Label>
                          <p className="text-sm">{(currentUser as any)?.phone || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Performance Stats */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{currentUser?.score || 0}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold">{currentUser?.activeDeals || 0}</p>
                        <p className="text-xs text-muted-foreground">Active Deals</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-green-500">{currentUser?.completedTasks || 0}</p>
                        <p className="text-xs text-muted-foreground">Tasks Done</p>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Security */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Security</h4>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setIsChangingPassword(true)}
                      data-testid="button-change-password"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet open={showSettingsSheet} onOpenChange={(open) => {
        setShowSettingsSheet(open);
        if (open && currentUser) {
          setProfileForm({
            name: currentUser.name || '',
            email: currentUser.email || '',
            phone: (currentUser as any)?.phone || '',
          });
        }
      }}>
        <SheetContent className="bg-card border-border w-[450px] sm:max-w-[450px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings
            </SheetTitle>
            <SheetDescription>Manage your account and preferences</SheetDescription>
          </SheetHeader>
          
          <Tabs defaultValue="profile" className="mt-6">
            <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
              <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs">Alerts</TabsTrigger>
              <TabsTrigger value="display" className="text-xs">Display</TabsTrigger>
              <TabsTrigger value="account" className="text-xs">Account</TabsTrigger>
            </TabsList>
            
            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                  {currentUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>
                <div>
                  <Button variant="outline" size="sm">Upload Photo</Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input 
                    value={profileForm.name} 
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input 
                    type="email" 
                    value={profileForm.email} 
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Input value={currentUser?.role || ''} disabled />
                </div>
              </div>
              
              <Button 
                className="w-full" 
                size="sm" 
                onClick={handleSaveProfile}
                disabled={updateUserProfile.isPending}
              >
                {updateUserProfile.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </TabsContent>
            
            {/* Notifications Tab */}
            <TabsContent value="notifications" className="mt-4 space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Email Preferences</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Deal Updates</Label>
                      <p className="text-xs text-muted-foreground">Notifications about deals you're assigned to</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Task Reminders</Label>
                      <p className="text-xs text-muted-foreground">Reminders for upcoming due dates</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Team Activity</Label>
                      <p className="text-xs text-muted-foreground">Updates when teammates make changes</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Weekly Summary</Label>
                      <p className="text-xs text-muted-foreground">Weekly digest of your activity</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Push Notifications</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Desktop Alerts</Label>
                    <p className="text-xs text-muted-foreground">Browser push notifications</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </TabsContent>
            
            {/* Display Tab */}
            <TabsContent value="display" className="mt-4 space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Appearance</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Dark Mode</Label>
                      <p className="text-xs text-muted-foreground">Use dark theme</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Compact View</Label>
                      <p className="text-xs text-muted-foreground">Show more data in less space</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Animations</Label>
                      <p className="text-xs text-muted-foreground">Enable UI animations</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Data</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-refresh</Label>
                    <p className="text-xs text-muted-foreground">Update data automatically</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </TabsContent>
            
            {/* Account Tab */}
            <TabsContent value="account" className="mt-4 space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Security</h4>
                <Button variant="outline" className="w-full justify-start" onClick={() => setIsChangingPassword(true)}>
                  <Lock className="w-4 h-4 mr-2" /> Change Password
                </Button>
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <Label className="text-sm">Two-Factor Authentication</Label>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
                <Button variant="outline" className="w-full justify-start text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10">
                  Deactivate Account
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-500 border-red-500/30 hover:bg-red-500/10">
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground">
                  Deleting your account is permanent and cannot be undone. Contact support if you need assistance.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Resources Sheet */}
      <Sheet open={showResourcesSheet} onOpenChange={setShowResourcesSheet}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Resources
            </SheetTitle>
            <SheetDescription>Help documentation and useful resources.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <a 
              href="https://www.equiturn.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-left p-4 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
              data-testid="resource-my-organization"
            >
              <h4 className="font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                My Organization
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Visit Equiturn's main website</p>
            </a>
            <button 
              className="w-full text-left p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
              onClick={() => {
                setShowResourcesSheet(false);
                setLocation(`${rolePrefix}/documents`);
              }}
              data-testid="resource-user-guide"
            >
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Document Generator
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Create and manage documents</p>
            </button>
            <button 
              className="w-full text-left p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
              onClick={() => {
                setShowResourcesSheet(false);
                setLocation(`${rolePrefix}/deals`);
              }}
              data-testid="resource-deal-management"
            >
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Deal Management
              </h4>
              <p className="text-xs text-muted-foreground mt-1">View and manage your deals</p>
            </button>
            <button 
              className="w-full text-left p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
              onClick={() => {
                setShowResourcesSheet(false);
                if (role === 'CEO') {
                  setLocation('/ceo/team');
                } else {
                  setLocation('/employee/tasks');
                }
              }}
              data-testid="resource-team-collaboration"
            >
              <h4 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {role === 'CEO' ? 'Team Assignment' : 'My Tasks'}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {role === 'CEO' ? 'Assign tasks to team members' : 'View your assigned tasks'}
              </p>
            </button>
            {role === 'CEO' && (
              <button 
                className="w-full text-left p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => {
                  setShowResourcesSheet(false);
                  setLocation('/ceo/investors');
                }}
                data-testid="resource-investor-match"
              >
                <h4 className="font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Investor Match
                </h4>
                <p className="text-xs text-muted-foreground mt-1">Find matching investors for deals</p>
              </button>
            )}
            <a 
              href="https://www.equiturn.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-left p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
              data-testid="resource-contact-support"
            >
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Contact Support
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Get help from our support team</p>
            </a>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Sheet */}
      <Sheet open={showNotificationsSheet} onOpenChange={(open) => {
        setShowNotificationsSheet(open);
        if (!open) {
          unreadNotifications.forEach((notification: any) => {
            markNotificationRead.mutate(notification.id);
          });
        }
      }}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
              {unreadNotifications.length > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadNotifications.length}</Badge>
              )}
            </SheetTitle>
            <SheetDescription>Recent alerts and updates.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-6 h-[calc(100vh-200px)]">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification: any) => (
                  <div 
                    key={notification.id} 
                    className={cn(
                      "p-4 rounded-lg border transition-colors cursor-pointer",
                      notification.read 
                        ? "bg-secondary/20 border-border" 
                        : "bg-primary/5 border-primary/20"
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        markNotificationRead.mutate(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        notification.type === 'info' && "bg-blue-500/10 text-blue-500",
                        notification.type === 'success' && "bg-green-500/10 text-green-500",
                        notification.type === 'warning' && "bg-yellow-500/10 text-yellow-500",
                        notification.type === 'error' && "bg-red-500/10 text-red-500"
                      )}>
                        {notification.type === 'info' && <Info className="w-4 h-4" />}
                        {notification.type === 'success' && <Check className="w-4 h-4" />}
                        {notification.type === 'warning' && <AlertCircle className="w-4 h-4" />}
                        {notification.type === 'error' && <X className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
