import { useState, useMemo, useRef, useEffect, ChangeEvent } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { ReaperAssistant } from "../assistant/ReaperAssistant";
import { Bell, Search, User, BookOpen, Palette, Briefcase, CheckSquare, Users, FileText, X, Settings, BarChart3, Target, Mail, Phone, Lock, Pencil, AlertCircle, Info, Check, Rocket, TrendingUp, UserCheck, ChevronRight, PanelLeftClose, PanelLeft, Camera, Trash2, Calendar, Paperclip, ExternalLink, Loader2, Shield, ShieldCheck, ShieldOff, Copy, Smartphone, QrCode } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { useNotifications, useDeals, useTasks, useUsers, useLogout, useCurrentUser, useMarkNotificationRead, useUpdateUserProfile, useChangePassword, useUserPreferences, useSaveUserPreferences, use2FAStatus, useSetup2FA, useVerify2FA, useDisable2FA } from "@/lib/api";
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
    role: '',
    jobTitle: '',
  });
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // 2FA state
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qrCode: string } | null>(null);
  const { data: twoFAStatus, isLoading: twoFALoading } = use2FAStatus();
  const setup2FA = useSetup2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();
  
  // User preferences from database
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  
  // Default settings values
  const DEFAULT_SETTINGS = {
    dealUpdates: true,
    taskReminders: true,
    teamActivity: false,
    weeklySummary: true,
    desktopAlerts: false,
    darkMode: true,
    compactView: false,
    animations: true,
    autoRefresh: true,
    twoFactorAuth: false,
  };
  
  // Sidebar collapsed state - from database preferences
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarInitialized, setSidebarInitialized] = useState(false);
  
  // Settings preferences - from database preferences
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  
  // Refs for tracking last saved state and mounted status
  const isMountedRef = useRef(true);
  const lastSavedSidebarRef = useRef(false);
  const lastSavedSettingsRef = useRef(DEFAULT_SETTINGS);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Hydrate sidebar state from user preferences
  useEffect(() => {
    if (!prefsLoading && !sidebarInitialized) {
      const savedState = userPrefs?.sidebarCollapsed ?? false;
      setSidebarCollapsed(savedState);
      lastSavedSidebarRef.current = savedState;
      setSidebarInitialized(true);
    }
  }, [prefsLoading, userPrefs, sidebarInitialized]);
  
  // Hydrate settings from user preferences
  useEffect(() => {
    if (!prefsLoading && !settingsInitialized) {
      const savedSettings = userPrefs?.settings as typeof DEFAULT_SETTINGS | undefined;
      if (savedSettings && typeof savedSettings === 'object') {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
        setSettings(mergedSettings);
        lastSavedSettingsRef.current = mergedSettings;
      }
      setSettingsInitialized(true);
    }
  }, [prefsLoading, userPrefs, settingsInitialized]);
  
  // Helper to extract only mutable preference fields (strip readonly columns)
  const getMutablePrefs = (prefs: any) => {
    if (!prefs) return {};
    const { id, userId, updatedAt, ...mutableFields } = prefs;
    return mutableFields;
  };
  
  // Save sidebar state to database (debounced) - merge with existing preferences
  const saveSidebarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!sidebarInitialized) return;
    
    // Skip save if sidebar state hasn't changed
    if (sidebarCollapsed === lastSavedSidebarRef.current) return;
    
    if (saveSidebarTimeoutRef.current) {
      clearTimeout(saveSidebarTimeoutRef.current);
    }
    saveSidebarTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        // Merge with existing preferences (stripped of readonly fields)
        const mutablePrefs = getMutablePrefs(userPrefs);
        await saveUserPrefs.mutateAsync({
          ...mutablePrefs,
          sidebarCollapsed,
        });
        lastSavedSidebarRef.current = sidebarCollapsed;
      } catch (error) {
        console.error('Failed to save sidebar state:', error);
      }
    }, 2000);
    return () => {
      if (saveSidebarTimeoutRef.current) {
        clearTimeout(saveSidebarTimeoutRef.current);
      }
    };
  }, [sidebarCollapsed, sidebarInitialized]);
  
  // Save settings to database (debounced) - merge with existing preferences
  const saveSettingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!settingsInitialized) return;
    
    // Skip save if settings haven't actually changed
    if (JSON.stringify(settings) === JSON.stringify(lastSavedSettingsRef.current)) return;
    
    if (saveSettingsTimeoutRef.current) {
      clearTimeout(saveSettingsTimeoutRef.current);
    }
    saveSettingsTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        // Merge with existing preferences (stripped of readonly fields)
        const mutablePrefs = getMutablePrefs(userPrefs);
        await saveUserPrefs.mutateAsync({
          ...mutablePrefs,
          settings,
        });
        lastSavedSettingsRef.current = settings;
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }, 2000);
    return () => {
      if (saveSettingsTimeoutRef.current) {
        clearTimeout(saveSettingsTimeoutRef.current);
      }
    };
  }, [settings, settingsInitialized]);
  
  const updateSetting = (key: string, value: boolean) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    toast.success(`Setting updated`);
  };
  
  // Apply display settings to the document
  useEffect(() => {
    const root = document.documentElement;
    
    // Dark mode - toggle the dark class on html element
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Compact view - add/remove compact class
    if (settings.compactView) {
      root.classList.add('compact-view');
      root.style.setProperty('--compact-spacing', '0.5');
    } else {
      root.classList.remove('compact-view');
      root.style.removeProperty('--compact-spacing');
    }
    
    // Animations - disable/enable animations
    if (settings.animations) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }, [settings.darkMode, settings.compactView, settings.animations]);
  
  // Photo upload ref
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // Task detail modal state
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedSearchTask, setSelectedSearchTask] = useState<any>(null);
  
  const { 
    showProfileSheet,
    setShowProfileSheet, 
    showSettingsSheet,
    setShowSettingsSheet, 
    showNotificationsSheet,
    setShowNotificationsSheet,
    showResourcesSheet,
    setShowResourcesSheet,
    showCustomizeSheet,
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
      role: currentUser?.role || '',
      jobTitle: (currentUser as any)?.jobTitle || '',
    });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileForm({ name: '', email: '', phone: '', role: '', jobTitle: '' });
  };

  const handleSaveProfile = async () => {
    if (!currentUser?.id) {
      toast.error("User not found");
      return;
    }
    
    try {
      const updates: { name?: string; email?: string; phone?: string; role?: string; jobTitle?: string } = {};
      
      // Only include fields that have changed
      if (profileForm.name && profileForm.name !== currentUser.name) {
        updates.name = profileForm.name;
      }
      if (profileForm.email && profileForm.email !== currentUser.email) {
        updates.email = profileForm.email;
      }
      if (profileForm.phone !== ((currentUser as any)?.phone || '')) {
        updates.phone = profileForm.phone;
      }
      
      // Only include role if user is not CEO and role has changed
      if (currentUser.role !== 'CEO' && profileForm.role && profileForm.role !== currentUser.role) {
        updates.role = profileForm.role;
      }
      
      // Include jobTitle if role is Custom
      if (profileForm.role === 'Custom' && profileForm.jobTitle) {
        updates.jobTitle = profileForm.jobTitle;
      } else if (profileForm.role !== 'Custom' && (currentUser as any)?.jobTitle) {
        updates.jobTitle = '';
      }
      
      // Check if there are any updates to make
      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setIsEditingProfile(false);
        return;
      }
      
      await updateUserProfile.mutateAsync({
        userId: currentUser.id,
        updates,
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
  
  // 2FA handlers
  const handleStart2FASetup = async () => {
    try {
      const result = await setup2FA.mutateAsync();
      setQrCodeData({ secret: result.secret, qrCode: result.qrCode });
      setIsSettingUp2FA(true);
      setTwoFACode('');
    } catch (error: any) {
      toast.error(error.message || "Failed to setup 2FA");
    }
  };
  
  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    try {
      await verify2FA.mutateAsync(twoFACode);
      toast.success("Two-factor authentication enabled successfully!");
      setIsSettingUp2FA(false);
      setQrCodeData(null);
      setTwoFACode('');
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
    }
  };
  
  const handleCancel2FASetup = () => {
    setIsSettingUp2FA(false);
    setQrCodeData(null);
    setTwoFACode('');
  };
  
  const handleDisable2FA = async () => {
    if (twoFACode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    try {
      await disable2FA.mutateAsync(twoFACode);
      toast.success("Two-factor authentication disabled");
      setIsDisabling2FA(false);
      setTwoFACode('');
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
    }
  };
  
  const handleCancelDisable2FA = () => {
    setIsDisabling2FA(false);
    setTwoFACode('');
  };
  
  const copySecretToClipboard = () => {
    if (qrCodeData?.secret) {
      navigator.clipboard.writeText(qrCodeData.secret);
      toast.success("Secret key copied to clipboard");
    }
  };
  
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }
    
    setIsUploadingPhoto(true);
    
    try {
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        await updateUserProfile.mutateAsync({
          userId: currentUser.id,
          updates: { avatar: base64 },
        });
        
        toast.success("Photo uploaded successfully");
        setIsUploadingPhoto(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read image file");
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload photo");
      setIsUploadingPhoto(false);
    }
  };
  
  const handleRemovePhoto = async () => {
    if (!currentUser?.id) return;
    
    try {
      await updateUserProfile.mutateAsync({
        userId: currentUser.id,
        updates: { avatar: '' },
      });
      toast.success("Photo removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove photo");
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
    if (!searchQuery.trim()) return { deals: [], tasks: [], users: [], documents: [] };
    
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
        task.assignedTo === currentUser.id
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
    
    // Search documents across accessible deals
    const documents: { doc: any; deal: any }[] = [];
    accessibleDeals.forEach((deal: any) => {
      const attachments = deal.attachments || [];
      if (Array.isArray(attachments)) {
        attachments.forEach((doc: any) => {
          if (doc.filename?.toLowerCase().includes(query)) {
            documents.push({ doc, deal });
          }
        });
      }
    });
    const filteredDocuments = documents.slice(0, 5);
    
    return { deals: filteredDeals, tasks: filteredTasks, users: filteredUsers, documents: filteredDocuments };
  }, [searchQuery, deals, tasks, users, role, currentUser]);
  
  const hasResults = searchResults.deals.length > 0 || searchResults.tasks.length > 0 || searchResults.users.length > 0 || searchResults.documents.length > 0;
  
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Sidebar role={role} collapsed={sidebarCollapsed} />
      
      <div className={cn("flex flex-col min-h-screen transition-all duration-300", sidebarCollapsed ? "pl-20" : "pl-64")}>
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-8 h-8"
              data-testid="button-toggle-sidebar"
            >
              {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
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
                          {searchResults.tasks.map((task: any) => {
                            const taskDeal = deals.find((d: any) => d.id === task.dealId);
                            return (
                              <button
                                key={task.id}
                                onClick={() => { 
                                  setSelectedSearchTask({ ...task, dealName: taskDeal?.name || 'No Deal' }); 
                                  setShowTaskDetailModal(true); 
                                  setShowSearchResults(false); 
                                  setSearchQuery(""); 
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-3"
                                data-testid={`search-result-task-${task.id}`}
                              >
                                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                  <CheckSquare className="w-4 h-4 text-green-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{taskDeal?.name || 'No Deal'} • {task.status}</p>
                                </div>
                                <Badge variant="outline" className={cn(
                                  "text-[10px] shrink-0",
                                  task.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                  task.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                  "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                )}>
                                  {task.priority}
                                </Badge>
                              </button>
                            );
                          })}
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
                      
                      {searchResults.documents.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-3 h-3" /> Documents
                          </div>
                          {searchResults.documents.map((item: any, index: number) => (
                            <button
                              key={`${item.deal.id}-${item.doc.id || index}`}
                              onClick={() => { 
                                if (item.doc.url) {
                                  window.open(item.doc.url, '_blank');
                                }
                                setShowSearchResults(false); 
                                setSearchQuery(""); 
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-3"
                              data-testid={`search-result-doc-${item.doc.id || index}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-orange-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.doc.filename}</p>
                                <p className="text-xs text-muted-foreground">{item.deal.name} • {(item.doc.size / 1024).toFixed(1)} KB</p>
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
                    <AvatarImage src={(currentUser as any)?.avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {currentUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-medium leading-none">{currentUser?.name || userName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {currentUser?.role === 'Custom' && (currentUser as any)?.jobTitle 
                        ? (currentUser as any).jobTitle 
                        : currentUser?.role || role}
                    </p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
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
                      onClick={() => {
                        setLocation('/ceo/dashboard');
                        setTimeout(() => setShowCustomizeSheet(true), 100);
                      }}
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

      {/* Settings Sheet */}
      <Sheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
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
            <TabsContent value="profile" className="mt-4">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-6 pr-4">
                  {/* Profile Header */}
                  <div className="flex flex-col items-center text-center space-y-3 p-4 bg-secondary/30 rounded-lg">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-2 border-primary/30">
                        <AvatarImage src={currentUser?.avatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                          {(currentUser?.name || userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 rounded-full w-7 h-7 p-0"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        data-testid="button-change-photo"
                      >
                        {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{currentUser?.name || userName}</h3>
                      <Badge variant="outline" className="mt-1 text-primary border-primary/30">
                        {currentUser?.role || role}
                      </Badge>
                    </div>
                  </div>

                  {/* Profile Details */}
                  {isEditingProfile ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="profile-name">Full Name</Label>
                        <Input
                          id="profile-name"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          placeholder="Enter your name"
                          data-testid="input-profile-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="profile-email">Email Address</Label>
                        <Input
                          id="profile-email"
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          placeholder="Enter your email"
                          data-testid="input-profile-email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="profile-phone">Phone Number</Label>
                        <Input
                          id="profile-phone"
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          placeholder="Enter phone number"
                          data-testid="input-profile-phone"
                        />
                      </div>
                      
                      {currentUser?.role !== 'CEO' && (
                        <div className="space-y-2">
                          <Label htmlFor="profile-role">Role</Label>
                          <Select
                            value={profileForm.role}
                            onValueChange={(value) => setProfileForm({ ...profileForm, role: value })}
                          >
                            <SelectTrigger data-testid="select-profile-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Analyst">Analyst</SelectItem>
                              <SelectItem value="Associate">Associate</SelectItem>
                              <SelectItem value="Director">Director</SelectItem>
                              <SelectItem value="Managing Director">Managing Director</SelectItem>
                              <SelectItem value="Custom">Custom Title</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {profileForm.role === 'Custom' && (
                        <div className="space-y-2">
                          <Label htmlFor="profile-job-title">Custom Job Title</Label>
                          <Input
                            id="profile-job-title"
                            value={profileForm.jobTitle}
                            onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                            placeholder="Enter your job title"
                            data-testid="input-profile-job-title"
                          />
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          onClick={handleCancelEditProfile}
                          className="flex-1"
                          data-testid="button-cancel-profile"
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
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm font-medium truncate">{currentUser?.email || 'Not set'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium">{(currentUser as any)?.phone || 'Not set'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Department</p>
                            <p className="text-sm font-medium">Investment Banking</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Performance Score</p>
                            <p className="text-sm font-medium">{currentUser?.score || 0}%</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <CheckSquare className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Tasks Completed</p>
                            <p className="text-sm font-medium">{currentUser?.completedTasks || 0}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Active Deals</p>
                            <p className="text-sm font-medium">{currentUser?.activeDeals || 0}</p>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleStartEditProfile}
                        data-testid="button-edit-profile"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
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
                    <Switch 
                      checked={settings.dealUpdates} 
                      onCheckedChange={(checked) => updateSetting('dealUpdates', checked)} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Task Reminders</Label>
                      <p className="text-xs text-muted-foreground">Reminders for upcoming due dates</p>
                    </div>
                    <Switch 
                      checked={settings.taskReminders} 
                      onCheckedChange={(checked) => updateSetting('taskReminders', checked)} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Team Activity</Label>
                      <p className="text-xs text-muted-foreground">Updates when teammates make changes</p>
                    </div>
                    <Switch 
                      checked={settings.teamActivity} 
                      onCheckedChange={(checked) => updateSetting('teamActivity', checked)} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Weekly Summary</Label>
                      <p className="text-xs text-muted-foreground">Weekly digest of your activity</p>
                    </div>
                    <Switch 
                      checked={settings.weeklySummary} 
                      onCheckedChange={(checked) => updateSetting('weeklySummary', checked)} 
                    />
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
                  <Switch 
                    checked={settings.desktopAlerts} 
                    onCheckedChange={(checked) => updateSetting('desktopAlerts', checked)} 
                  />
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
                    <Switch 
                      checked={settings.darkMode} 
                      onCheckedChange={(checked) => updateSetting('darkMode', checked)} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Compact View</Label>
                      <p className="text-xs text-muted-foreground">Show more data in less space</p>
                    </div>
                    <Switch 
                      checked={settings.compactView} 
                      onCheckedChange={(checked) => updateSetting('compactView', checked)} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Animations</Label>
                      <p className="text-xs text-muted-foreground">Enable UI animations</p>
                    </div>
                    <Switch 
                      checked={settings.animations} 
                      onCheckedChange={(checked) => updateSetting('animations', checked)} 
                    />
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
                  <Switch 
                    checked={settings.autoRefresh} 
                    onCheckedChange={(checked) => updateSetting('autoRefresh', checked)} 
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Account Tab */}
            <TabsContent value="account" className="mt-4 space-y-4">
              {isChangingPassword ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Change Password</h4>
                  
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
              ) : isSettingUp2FA ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-primary" />
                    <h4 className="text-sm font-medium">Setup Two-Factor Authentication</h4>
                  </div>
                  
                  <div className="p-4 bg-secondary/30 rounded-lg space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      {qrCodeData?.qrCode && (
                        <div className="flex justify-center mb-4">
                          <img 
                            src={qrCodeData.qrCode} 
                            alt="2FA QR Code" 
                            className="w-48 h-48 bg-white p-2 rounded-lg"
                            data-testid="img-2fa-qr-code"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Or enter this secret key manually:</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-background rounded text-xs font-mono break-all">
                          {qrCodeData?.secret}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copySecretToClipboard}
                          data-testid="button-copy-2fa-secret"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label htmlFor="2fa-code">Enter verification code from your app:</Label>
                      <Input
                        id="2fa-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="text-center text-lg tracking-widest font-mono"
                        data-testid="input-2fa-verify-code"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCancel2FASetup}
                      className="flex-1"
                      data-testid="button-cancel-2fa-setup"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleVerify2FA}
                      disabled={verify2FA.isPending || twoFACode.length !== 6}
                      className="flex-1"
                      data-testid="button-verify-2fa"
                    >
                      {verify2FA.isPending ? "Verifying..." : "Enable 2FA"}
                    </Button>
                  </div>
                </div>
              ) : isDisabling2FA ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldOff className="w-5 h-5 text-red-400" />
                    <h4 className="text-sm font-medium">Disable Two-Factor Authentication</h4>
                  </div>
                  
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-4">
                    <p className="text-sm text-muted-foreground">
                      To disable two-factor authentication, enter the current code from your authenticator app.
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="2fa-disable-code">Verification Code:</Label>
                      <Input
                        id="2fa-disable-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="text-center text-lg tracking-widest font-mono"
                        data-testid="input-2fa-disable-code"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCancelDisable2FA}
                      className="flex-1"
                      data-testid="button-cancel-disable-2fa"
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleDisable2FA}
                      disabled={disable2FA.isPending || twoFACode.length !== 6}
                      className="flex-1"
                      data-testid="button-confirm-disable-2fa"
                    >
                      {disable2FA.isPending ? "Disabling..." : "Disable 2FA"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Security</h4>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setIsChangingPassword(true)}>
                      <Lock className="w-4 h-4 mr-2" /> Change Password
                    </Button>
                    
                    {twoFALoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : twoFAStatus?.enabled ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-green-500" />
                          <div>
                            <Label className="text-sm text-green-400">Two-Factor Authentication Enabled</Label>
                            <p className="text-xs text-muted-foreground">Your account is protected with 2FA</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10"
                          onClick={() => setIsDisabling2FA(true)}
                          data-testid="button-start-disable-2fa"
                        >
                          <ShieldOff className="w-4 h-4 mr-2" /> Disable 2FA
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <Label className="text-sm">Two-Factor Authentication</Label>
                            <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={handleStart2FASetup}
                          disabled={setup2FA.isPending}
                          data-testid="button-setup-2fa"
                        >
                          {setup2FA.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-4 h-4 mr-2" /> Setup 2FA
                            </>
                          )}
                        </Button>
                      </div>
                    )}
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
                </>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Resources Sheet */}
      <Sheet open={showResourcesSheet} onOpenChange={setShowResourcesSheet}>
        <SheetContent className="bg-card border-border w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Resources
            </SheetTitle>
            <SheetDescription>Help documentation and useful resources.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
            <div className="space-y-4">
              {/* Quick Links */}
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href="https://www.equiturn.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                  data-testid="resource-my-organization"
                >
                  <Briefcase className="w-5 h-5 text-primary mb-2" />
                  <h4 className="font-medium text-sm">My Organization</h4>
                  <p className="text-xs text-muted-foreground mt-1">Visit Equiturn's website</p>
                </a>
                <a 
                  href="https://www.equiturn.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  data-testid="resource-contact-support"
                >
                  <Mail className="w-5 h-5 text-primary mb-2" />
                  <h4 className="font-medium text-sm">Contact Support</h4>
                  <p className="text-xs text-muted-foreground mt-1">Get help from our team</p>
                </a>
              </div>

              <Separator />

              {/* Documentation Sections */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Documentation</h4>
                <Accordion type="single" collapsible className="w-full">
                  {/* Get Started */}
                  <AccordionItem value="get-started" className="border-border">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Rocket className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">Get Started with Kronos</p>
                          <p className="text-xs text-muted-foreground">Learn the basics of the platform</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-4 pt-2">
                      <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                        <h5 className="font-medium text-foreground">Welcome to Kronos</h5>
                        <p>Kronos is your comprehensive investment banking operations platform designed to streamline deal management, task assignments, and investor relations.</p>
                        
                        <h5 className="font-medium text-foreground mt-4">Quick Start Guide</h5>
                        <ol className="list-decimal list-inside space-y-2">
                          <li><strong>Dashboard Overview:</strong> Your central hub showing active deals, tasks, and team performance metrics.</li>
                          <li><strong>Navigation:</strong> Use the left sidebar to access all platform features. Click the collapse button to minimize the sidebar.</li>
                          <li><strong>Profile Settings:</strong> Click your avatar in the top-right to access profile, settings, and resources.</li>
                          <li><strong>Search:</strong> Use the search bar to quickly find deals, tasks, or team members.</li>
                        </ol>

                        <h5 className="font-medium text-foreground mt-4">Key Features</h5>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Real-time deal pipeline tracking</li>
                          <li>AI-powered document generation</li>
                          <li>Investor matching algorithm</li>
                          <li>Team task assignment and tracking</li>
                          <li>In-platform messaging and collaboration</li>
                        </ul>

                        <h5 className="font-medium text-foreground mt-4">Getting Help</h5>
                        <p>If you need assistance, click "Contact Support" above or reach out to your team administrator.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Managing Deals */}
                  <AccordionItem value="managing-deals" className="border-border">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">Managing Deals</p>
                          <p className="text-xs text-muted-foreground">Complete deal lifecycle guide</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-4 pt-2">
                      <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                        <h5 className="font-medium text-foreground">Deal Lifecycle Overview</h5>
                        <p>Successfully closing a deal requires careful management through five key stages:</p>
                        
                        <div className="space-y-3 mt-3">
                          <div className="border-l-2 border-blue-500 pl-3">
                            <h6 className="font-medium text-foreground">1. Origination</h6>
                            <p className="text-xs">Identify and qualify potential deals. Create the deal record with client information, sector, and estimated value. Assign initial team members.</p>
                          </div>
                          <div className="border-l-2 border-purple-500 pl-3">
                            <h6 className="font-medium text-foreground">2. Structuring</h6>
                            <p className="text-xs">Develop the deal structure, valuation models, and preliminary terms. Generate initial documentation and create task assignments for team members.</p>
                          </div>
                          <div className="border-l-2 border-yellow-500 pl-3">
                            <h6 className="font-medium text-foreground">3. Diligence</h6>
                            <p className="text-xs">Conduct thorough due diligence. Coordinate information requests, review financials, and identify potential risks. Track progress with milestone tasks.</p>
                          </div>
                          <div className="border-l-2 border-orange-500 pl-3">
                            <h6 className="font-medium text-foreground">4. Legal</h6>
                            <p className="text-xs">Draft and negotiate legal documents. Coordinate with external counsel, manage document revisions, and ensure compliance requirements are met.</p>
                          </div>
                          <div className="border-l-2 border-green-500 pl-3">
                            <h6 className="font-medium text-foreground">5. Close</h6>
                            <p className="text-xs">Finalize all documentation, complete closing checklists, and execute the transaction. Update deal status and archive relevant materials.</p>
                          </div>
                        </div>

                        <h5 className="font-medium text-foreground mt-4">Best Practices</h5>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Update deal progress regularly to keep stakeholders informed</li>
                          <li>Assign clear task owners and deadlines for each milestone</li>
                          <li>Use the document generator for consistent, professional deliverables</li>
                          <li>Tag relevant investors early using the Investor Match feature</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Investor Matching */}
                  <AccordionItem value="investor-matching" className="border-border">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">Investor Matching</p>
                          <p className="text-xs text-muted-foreground">Find the right investors for deals</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-4 pt-2">
                      <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                        <h5 className="font-medium text-foreground">Investor Matching Overview</h5>
                        <p>Kronos's intelligent investor matching system helps you identify the most suitable investors for each deal based on multiple criteria.</p>
                        
                        <h5 className="font-medium text-foreground mt-4">How Matching Works</h5>
                        <ol className="list-decimal list-inside space-y-2 text-xs">
                          <li><strong>Sector Alignment:</strong> The system analyzes investor portfolio history and sector preferences.</li>
                          <li><strong>Investment Size:</strong> Matches based on typical investment ranges and fund capacity.</li>
                          <li><strong>Geographic Focus:</strong> Considers regional preferences and portfolio concentration.</li>
                          <li><strong>Stage Preference:</strong> Aligns deal stage with investor maturity preferences.</li>
                          <li><strong>Historical Performance:</strong> Factors in past successful investments in similar deals.</li>
                        </ol>

                        <h5 className="font-medium text-foreground mt-4">Using the Investor Match Feature</h5>
                        <ol className="list-decimal list-inside space-y-2 text-xs">
                          <li>Navigate to the Investor Match section from the sidebar</li>
                          <li>Select or create a deal to match investors against</li>
                          <li>Review the match scores and investor profiles</li>
                          <li>Tag promising investors directly to the deal</li>
                          <li>Track investor outreach and response status</li>
                        </ol>

                        <h5 className="font-medium text-foreground mt-4">Tips for Success</h5>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Keep investor profiles updated with recent activity</li>
                          <li>Use match scores as a guide, not absolute rankings</li>
                          <li>Consider relationship history when prioritizing outreach</li>
                          <li>Document all investor interactions for team visibility</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </ScrollArea>
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
                      "p-4 rounded-lg border transition-colors cursor-pointer hover:bg-primary/10",
                      notification.read 
                        ? "bg-secondary/20 border-border" 
                        : "bg-primary/5 border-primary/20"
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        markNotificationRead.mutate(notification.id);
                      }
                      setShowNotificationsSheet(false);
                      if (notification.link) {
                        let link = notification.link;
                        const isCeo = role === 'CEO';
                        const linkMap: Record<string, string> = {
                          '/ceo/users': '/ceo/admin',
                          '/mentorship': isCeo ? '/ceo/mentorship' : '/employee/home',
                          '/chat': isCeo ? '/ceo/chat' : '/employee/chat',
                          '/ceo/chat': isCeo ? '/ceo/chat' : '/employee/chat',
                          '/ceo/dashboard': isCeo ? '/ceo/dashboard' : '/employee/home',
                          '/ceo/calendar': isCeo ? '/ceo/calendar' : '/employee/calendar',
                          '/ceo/mentorship': isCeo ? '/ceo/mentorship' : '/employee/home',
                        };
                        if (linkMap[link]) {
                          link = linkMap[link];
                        } else if (!isCeo && link.startsWith('/ceo/')) {
                          link = link.replace('/ceo/', '/employee/');
                        }
                        setLocation(link);
                      } else {
                        const title = notification.title?.toLowerCase() || '';
                        const message = notification.message?.toLowerCase() || '';
                        if (title.includes('deal') || message.includes('deal')) {
                          setLocation(role === 'CEO' ? '/ceo/deals' : '/employee/deals');
                        } else if (title.includes('task') || message.includes('task')) {
                          setLocation(role === 'CEO' ? '/ceo/dashboard' : '/employee/tasks');
                        } else if (title.includes('meeting') || message.includes('meeting') || title.includes('calendar')) {
                          setLocation(role === 'CEO' ? '/ceo/calendar' : '/employee/calendar');
                        } else if (title.includes('document') || message.includes('document')) {
                          setLocation(role === 'CEO' ? '/ceo/document-library' : '/employee/document-library');
                        } else if (title.includes('user') || message.includes('approved') || message.includes('pending')) {
                          setLocation('/ceo/team');
                        } else if (title.includes('investor') || message.includes('investor')) {
                          setLocation(role === 'CEO' ? '/ceo/investors' : '/employee/investors');
                        } else if (title.includes('announcement')) {
                          setLocation(role === 'CEO' ? '/ceo/announcements' : '/employee/announcements');
                        } else {
                          setLocation(role === 'CEO' ? '/ceo/dashboard' : '/employee/home');
                        }
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
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
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

      {/* Task Detail Modal from Search */}
      <Dialog open={showTaskDetailModal} onOpenChange={setShowTaskDetailModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSearchTask?.title}</DialogTitle>
            <DialogDescription>Task Details</DialogDescription>
          </DialogHeader>
          {selectedSearchTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn(
                  "text-xs",
                  selectedSearchTask.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                  selectedSearchTask.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                  "bg-blue-500/10 text-blue-500 border-blue-500/20"
                )}>
                  {selectedSearchTask.priority} Priority
                </Badge>
                <Badge variant="secondary">{selectedSearchTask.type}</Badge>
                <Badge variant={selectedSearchTask.status === 'Completed' ? 'default' : 'outline'}>
                  {selectedSearchTask.status}
                </Badge>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{selectedSearchTask.description || 'No description provided'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Project / Deal</Label>
                  <p className="text-sm mt-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-primary" />
                    {selectedSearchTask.dealName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date</Label>
                  <p className="text-sm mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {selectedSearchTask.dueDate || 'No due date'}
                  </p>
                </div>
              </div>
              
              {selectedSearchTask.assignedTo && (
                <div>
                  <Label className="text-xs text-muted-foreground">Assigned To</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {users.find((u: any) => u.id === selectedSearchTask.assignedTo)?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{users.find((u: any) => u.id === selectedSearchTask.assignedTo)?.name || 'Unknown'}</span>
                  </div>
                </div>
              )}
              
              {selectedSearchTask.attachments && Array.isArray(selectedSearchTask.attachments) && selectedSearchTask.attachments.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </Label>
                  <div className="mt-2 space-y-2">
                    {selectedSearchTask.attachments.map((attachment: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{typeof attachment === 'string' ? attachment : attachment?.name || 'Attachment'}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTaskDetailModal(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setLocation(`${role === 'CEO' ? '/ceo/deals' : '/employee/tasks'}?id=${selectedSearchTask?.id}`);
              setShowTaskDetailModal(false);
            }}>
              Go to Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Kronos AI Assistant - Global access */}
      <ReaperAssistant />
    </div>
  );
}
