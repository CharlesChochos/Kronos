import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Reorder } from "framer-motion";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
} from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  Area, 
  AreaChart,
  ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Briefcase, 
  Users, 
  Clock,
  ArrowUpRight,
  Plus,
  Settings,
  CheckSquare,
  User,
  Bell,
  BookOpen,
  Palette,
  FileText,
  Download,
  Calendar,
  Mail,
  MapPin,
  X,
  ChevronRight,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Eye,
  Trash2,
  Check,
  AlertCircle,
  Info,
  Paperclip,
  Search,
  Lock,
  Phone,
  Pencil,
  GripVertical,
  LayoutDashboard,
  Video,
  Link as LinkIcon,
  ChevronsUpDown
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCurrentUser, useUsers, useDeals, useTasks, useCreateDeal, useNotifications, useCreateMeeting, useMeetings, useUpdateUserPreferences, useMarketData, useMarketNews, useUserPreferences, useSaveUserPreferences, useCalendarEvents, useAllDealFees, useCustomSectors, useCreateCustomSector } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, subDays, startOfDay, isAfter, isSameDay } from "date-fns";
import { jsPDF } from "jspdf";
import type { User as UserType, Deal, Task } from "@shared/schema";
import { useDashboardContext } from "@/contexts/DashboardContext";

type WidgetConfig = {
  id: string;
  name: string;
  enabled: boolean;
};

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'quickActions', name: 'Quick Actions', enabled: true },
  { id: 'activeDeals', name: 'Active Deals Analytics', enabled: true },
  { id: 'marketPulse', name: 'Market Pulse', enabled: true },
  { id: 'marketIntelligence', name: 'Market Intelligence', enabled: true },
  { id: 'teamTaskProgress', name: 'Team Task Progress', enabled: true },
  { id: 'upcomingMeetings', name: 'Upcoming Meetings', enabled: true },
  { id: 'recentActivity', name: 'Recent Activity', enabled: true },
  { id: 'capitalAtWork', name: 'Capital At Work', enabled: true },
  { id: 'feeSummary', name: 'Fee Summary', enabled: true },
  { id: 'dealPipeline', name: 'Deal Pipeline Overview', enabled: false },
  { id: 'performanceMetrics', name: 'Performance Metrics', enabled: false },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: notifications = [] } = useNotifications();
  const { data: meetings = [] } = useMeetings();
  const { data: allDealFees = [] } = useAllDealFees();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const createDeal = useCreateDeal();
  const createMeeting = useCreateMeeting();
  const updateUserPreferences = useUpdateUserPreferences();
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  const { data: customSectors = [] } = useCustomSectors();
  const createCustomSector = useCreateCustomSector();

  // Use context for shared sheet states (only Customize is rendered here, others moved to Layout)
  const {
    showCustomizeSheet,
    setShowCustomizeSheet,
  } = useDashboardContext();

  // Local modal states
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showScheduleMeetingModal, setShowScheduleMeetingModal] = useState(false);
  const [showEmployeeDetailModal, setShowEmployeeDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);
  const [viewTab, setViewTab] = useState<'dashboard' | 'analytics'>('dashboard');
  
  // Widget filter states
  const [activeDealsFilter, setActiveDealsFilter] = useState<'all' | 'IB' | 'AM'>('all');
  const [capitalAtWorkFilter, setCapitalAtWorkFilter] = useState<'all' | 'IB' | 'AM'>('all');
  
  // Widget configuration - load from user preferences (database)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [widgetsInitialized, setWidgetsInitialized] = useState(false);
  
  // Normalize widget order: Recent Activity should come before Capital At Work and Fee Summary
  const normalizeWidgetOrder = (widgets: WidgetConfig[]): WidgetConfig[] => {
    const recentActivityIndex = widgets.findIndex(w => w.id === 'recentActivity');
    const capitalAtWorkIndex = widgets.findIndex(w => w.id === 'capitalAtWork');
    const feeSummaryIndex = widgets.findIndex(w => w.id === 'feeSummary');
    
    // If Recent Activity is after Capital At Work or Fee Summary, we need to reorder
    if (recentActivityIndex > capitalAtWorkIndex || recentActivityIndex > feeSummaryIndex) {
      // Create a new array with the correct order
      const result = widgets.filter(w => !['recentActivity', 'capitalAtWork', 'feeSummary'].includes(w.id));
      
      // Find the position where we should insert (after upcomingMeetings if it exists)
      const upcomingMeetingsIndex = result.findIndex(w => w.id === 'upcomingMeetings');
      const insertPosition = upcomingMeetingsIndex >= 0 ? upcomingMeetingsIndex + 1 : result.length;
      
      // Insert in correct order: Recent Activity, then Capital At Work, then Fee Summary
      const recentActivity = widgets.find(w => w.id === 'recentActivity');
      const capitalAtWork = widgets.find(w => w.id === 'capitalAtWork');
      const feeSummary = widgets.find(w => w.id === 'feeSummary');
      
      const toInsert = [recentActivity, capitalAtWork, feeSummary].filter(Boolean) as WidgetConfig[];
      result.splice(insertPosition, 0, ...toInsert);
      
      return result;
    }
    
    return widgets;
  };
  
  // Load widget config from user preferences when available
  useEffect(() => {
    if (!prefsLoading && userPrefs?.dashboardWidgets && userPrefs.dashboardWidgets.length > 0 && !widgetsInitialized) {
      // Normalize the order to ensure Recent Activity comes before Capital At Work and Fee Summary
      const loadedWidgets = userPrefs.dashboardWidgets as WidgetConfig[];
      const normalizedWidgets = normalizeWidgetOrder(loadedWidgets);
      setWidgets(normalizedWidgets);
      setWidgetsInitialized(true);
      
      // If order was changed, save the corrected order
      if (JSON.stringify(loadedWidgets) !== JSON.stringify(normalizedWidgets)) {
        saveUserPrefs.mutateAsync({ dashboardWidgets: normalizedWidgets });
      }
    } else if (!prefsLoading && !widgetsInitialized) {
      setWidgetsInitialized(true);
    }
  }, [prefsLoading, userPrefs, widgetsInitialized]);
  
  // Save widget order to database when it changes (debounced with error handling and rollback)
  const saveWidgetsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastSavedWidgetsRef = useRef<WidgetConfig[]>(DEFAULT_WIDGETS);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Store the last successfully saved widgets for rollback
  useEffect(() => {
    if (userPrefs?.dashboardWidgets && userPrefs.dashboardWidgets.length > 0) {
      lastSavedWidgetsRef.current = userPrefs.dashboardWidgets as WidgetConfig[];
    }
  }, [userPrefs]);
  
  useEffect(() => {
    if (!widgetsInitialized) return;
    
    // Skip if widgets haven't actually changed from last saved state
    if (JSON.stringify(widgets) === JSON.stringify(lastSavedWidgetsRef.current)) {
      return;
    }
    
    if (saveWidgetsTimeoutRef.current) {
      clearTimeout(saveWidgetsTimeoutRef.current);
    }
    saveWidgetsTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      
      // Double-check we still need to save
      if (JSON.stringify(widgets) === JSON.stringify(lastSavedWidgetsRef.current)) {
        return;
      }
      
      try {
        await saveUserPrefs.mutateAsync({ dashboardWidgets: widgets });
        lastSavedWidgetsRef.current = widgets;
      } catch (error: any) {
        console.error('Failed to save widget preferences:', error);
        // Only show toast and revert for non-auth errors
        // 401 errors are typically session timeouts, handle silently
        if (error?.response?.status !== 401 && error?.status !== 401) {
          toast.error('Failed to save dashboard preferences - reverting changes');
          if (isMountedRef.current) {
            setWidgets(lastSavedWidgetsRef.current);
          }
        }
      }
    }, 2000);
    return () => {
      if (saveWidgetsTimeoutRef.current) {
        clearTimeout(saveWidgetsTimeoutRef.current);
      }
    };
  }, [widgets, widgetsInitialized]);
  
  // Widget detail modals
  const [activeDealsModalOpen, setActiveDealsModalOpen] = useState(false);
  const [capitalAtWorkModalOpen, setCapitalAtWorkModalOpen] = useState(false);
  const [feeSummaryModalOpen, setFeeSummaryModalOpen] = useState(false);
  
  // Market symbols - load from preferences with effect for hydration
  const [marketSymbols, setMarketSymbols] = useState<string[]>(['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY']);
  const [symbolsInitialized, setSymbolsInitialized] = useState(false);
  
  // Hydrate market symbols from user preferences when loaded
  useEffect(() => {
    if (!prefsLoading && userPrefs?.marketSymbols && userPrefs.marketSymbols.length > 0 && !symbolsInitialized) {
      setMarketSymbols(userPrefs.marketSymbols);
      setSymbolsInitialized(true);
    } else if (!prefsLoading && !symbolsInitialized) {
      setSymbolsInitialized(true);
    }
  }, [prefsLoading, userPrefs, symbolsInitialized]);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [showMarketSearch, setShowMarketSearch] = useState(false);
  
  // New deal form
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Technology',
    customSector: '',
    value: '',
    stage: 'Origination',
    lead: '',
    status: 'Active',
    progress: 0,
    description: '',
    attachments: [] as File[],
  });
  const [sectorOpen, setSectorOpen] = useState(false);
  
  const BASE_SECTORS = ['Technology', 'Healthcare', 'Energy', 'Consumer', 'Industrials', 'Financial'];
  const SECTORS = useMemo(() => {
    const customNames = customSectors.map((s: any) => s.name);
    const allSectors = [...BASE_SECTORS, ...customNames.filter((name: string) => !BASE_SECTORS.includes(name))];
    return [...allSectors, 'Other'];
  }, [customSectors]);

  // Meeting form
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduledFor: '',
    scheduledTime: '09:00',
    duration: 60,
    location: '',
    participants: '',
    dealId: '',
    videoPlatform: '' as '' | 'zoom' | 'google_meet' | 'teams',
    videoLink: '',
  });

  // Open video conferencing app in new tab
  const openVideoApp = (platform: 'zoom' | 'google_meet' | 'teams') => {
    const urls = {
      zoom: 'https://zoom.us/meeting/schedule',
      google_meet: 'https://meet.google.com/new',
      teams: 'https://teams.microsoft.com/l/meeting/new',
    };
    window.open(urls[platform], '_blank');
    setNewMeeting({ ...newMeeting, videoPlatform: platform });
  };

  // Market data from API (refreshes every 30 seconds)
  const { data: marketDataResponse, isLoading: marketLoading } = useMarketData(marketSymbols);
  const marketData = marketDataResponse?.data || [];
  const marketSource = marketDataResponse?.source || 'simulated';
  
  // Market news from API (refreshes every minute)
  const { data: marketNewsResponse, isLoading: newsLoading } = useMarketNews();
  const rawMarketNews = marketNewsResponse?.data || [];
  const newsSource = marketNewsResponse?.source || 'sample';
  
  // Filter for investment banking and finance related news - broader filter to ensure content shows
  const financeKeywords = ['merger', 'm&a', 'acquisition', 'ipo', 'capital', 'deal', 'buyout', 'investment', 'equity', 'debt', 'bond', 'underwriting', 'financing', 'valuation', 'securities', 'advisory', 'banking', 'fund', 'private equity', 'venture', 'syndicate', 'offering', 'raise', 'billion', 'million', 'stock', 'market', 'trading', 'earnings', 'revenue', 'profit', 'growth', 'company', 'business', 'economy', 'financial', 'investor', 'shares', 'nasdaq', 'dow', 's&p', 'fed', 'rate', 'inflation', 'gdp', 'sector', 'industry', 'quarter', 'forecast', 'analyst', 'dividend', 'portfolio'];
  const filteredNews = rawMarketNews.filter((news: any) => {
    const headline = news.headline?.toLowerCase() || '';
    const summary = news.summary?.toLowerCase() || '';
    return financeKeywords.some(keyword => headline.includes(keyword) || summary.includes(keyword));
  });
  // If no news matches the filter, show all news (fallback to raw data)
  const marketNews = filteredNews.length > 0 ? filteredNews : rawMarketNews;

  // Check if current user is Sergio (Global head of Asset Management)
  const isAssetManagementHead = currentUser?.name?.toLowerCase().includes('sergio');
  
  // Split deals by division for breakdown display
  const amDeals = deals.filter((d: any) => d.dealType === 'Asset Management');
  const ibDeals = deals.filter((d: any) => d.dealType !== 'Asset Management');
  const amActiveDeals = amDeals.filter(d => d.status === 'Active');
  const ibActiveDeals = ibDeals.filter(d => d.status === 'Active');
  
  // Compute analytics using all deals (for general metrics)
  const activeDeals = deals.filter(d => d.status === 'Active');
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const activeValue = activeDeals.reduce((sum, deal) => sum + deal.value, 0);
  
  // Division-specific values
  const ibActiveValue = ibActiveDeals.reduce((sum, deal) => sum + deal.value, 0);
  const amActiveValue = amActiveDeals.reduce((sum, deal) => sum + deal.value, 0);
  
  // Display active deals - show all for combined view
  const displayActiveDeals = activeDeals;
  const displayActiveValue = activeValue;
  
  // Sector breakdown - All deals
  const sectorStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    activeDeals.forEach(deal => {
      if (!stats[deal.sector]) {
        stats[deal.sector] = { count: 0, value: 0 };
      }
      stats[deal.sector].count++;
      stats[deal.sector].value += deal.value;
    });
    return stats;
  }, [activeDeals]);
  
  // Sector breakdown - IB only
  const ibSectorStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    ibActiveDeals.forEach(deal => {
      if (!stats[deal.sector]) {
        stats[deal.sector] = { count: 0, value: 0 };
      }
      stats[deal.sector].count++;
      stats[deal.sector].value += deal.value;
    });
    return stats;
  }, [ibActiveDeals]);
  
  // Sector breakdown - AM only
  const amSectorStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    amActiveDeals.forEach(deal => {
      if (!stats[deal.sector]) {
        stats[deal.sector] = { count: 0, value: 0 };
      }
      stats[deal.sector].count++;
      stats[deal.sector].value += deal.value;
    });
    return stats;
  }, [amActiveDeals]);

  // Stage breakdown by division
  const IB_STAGES = ['Origination', 'Execution', 'Negotiation', 'Due Diligence', 'Signing', 'Closed'];
  const AM_STAGES = ['Reception', 'Initial Review', 'Hard Diligence', 'Structure', 'Negotiation', 'Closing', 'Invested'];
  
  const ibStageStats = useMemo(() => {
    return IB_STAGES.map(stage => ({
      stage,
      count: ibActiveDeals.filter(d => d.stage === stage).length,
    }));
  }, [ibActiveDeals]);
  
  const amStageStats = useMemo(() => {
    return AM_STAGES.map(stage => ({
      stage,
      count: amActiveDeals.filter(d => d.stage === stage).length,
    }));
  }, [amActiveDeals]);

  // Calculate velocity scores
  const employeeStats = useMemo(() => {
    // Filter to only show active users (not pending or suspended)
    const activeUsers = users.filter(user => user.status === 'active');
    return activeUsers.map(user => {
      const userTasks = tasks.filter(t => t.assignedTo === user.id);
      const completedTasks = userTasks.filter(t => t.status === 'Completed').length;
      const inProgressTasks = userTasks.filter(t => t.status === 'In Progress').length;
      const pendingTasks = userTasks.filter(t => t.status === 'Pending').length;
      
      // Get tasks by deal with task names
      const tasksByDeal: Record<string, { 
        dealName: string; 
        completed: number; 
        inProgress: number; 
        pending: number;
        taskNames: { id: string; name: string; status: string; priority: string; dueDate?: string }[];
      }> = {};
      
      userTasks.forEach(task => {
        if (task.dealId) {
          const deal = deals.find(d => d.id === task.dealId);
          if (deal) {
            if (!tasksByDeal[task.dealId]) {
              tasksByDeal[task.dealId] = { 
                dealName: deal.name, 
                completed: 0, 
                inProgress: 0, 
                pending: 0,
                taskNames: []
              };
            }
            tasksByDeal[task.dealId].taskNames.push({
              id: task.id,
              name: task.title,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate || undefined,
            });
            if (task.status === 'Completed') tasksByDeal[task.dealId].completed++;
            else if (task.status === 'In Progress') tasksByDeal[task.dealId].inProgress++;
            else tasksByDeal[task.dealId].pending++;
          }
        }
      });

      // Calculate velocity score based on:
      // - Completed tasks (40%)
      // - In-progress efficiency (30%)
      // - Active deals involvement (30%)
      const completionRate = userTasks.length > 0 ? (completedTasks / userTasks.length) * 100 : 0;
      const activeDealsCount = Object.keys(tasksByDeal).length;
      const velocityScore = Math.round(
        (completedTasks * 4) + 
        (inProgressTasks * 2) + 
        (activeDealsCount * 5) +
        (completionRate * 0.5)
      );

      return {
        ...user,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        totalTasks: userTasks.length,
        tasksByDeal,
        userTasks,
        velocityScore: Math.min(velocityScore, 100),
      };
    }).sort((a, b) => b.velocityScore - a.velocityScore);
  }, [users, tasks, deals]);

  const topUsers = employeeStats.slice(0, 5);
  const unreadNotifications = notifications.filter(n => !n.read);

  const handleCreateDeal = async () => {
    if (!newDeal.name || !newDeal.client || !newDeal.value) {
      toast.error("Please fill in all required fields");
      return;
    }
    const parsedValue = parseInt(newDeal.value);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Please enter a valid deal value");
      return;
    }
    
    const finalSector = newDeal.sector === 'Other' && newDeal.customSector ? newDeal.customSector : newDeal.sector;
    
    // Save custom sector if it's a new one not in the existing list
    const isCustomSector = newDeal.sector === 'Other' && newDeal.customSector;
    const existingCustomSectorNames = customSectors.map((s: any) => s.name.toLowerCase());
    const isNewCustomSector = isCustomSector && !existingCustomSectorNames.includes(newDeal.customSector.toLowerCase()) && !BASE_SECTORS.includes(newDeal.customSector);
    
    try {
      // Save the custom sector first if it's new
      if (isNewCustomSector) {
        try {
          await createCustomSector.mutateAsync(newDeal.customSector);
        } catch (e) {
          console.log("Custom sector may already exist:", e);
        }
      }
      
      // Convert File objects to serializable metadata
      const attachmentMeta = newDeal.attachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      }));
      
      await createDeal.mutateAsync({
        name: newDeal.name,
        client: newDeal.client,
        sector: finalSector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: newDeal.progress || 0,
        description: newDeal.description || null,
        dealType: 'M&A',
        attachments: attachmentMeta,
        podTeam: [],
        taggedInvestors: [],
        auditTrail: [{
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: 'Deal Created',
          user: currentUser?.name || 'System',
          details: `Deal "${newDeal.name}" created`,
        }],
      });
      toast.success("Deal created successfully!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Technology', customSector: '', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0, description: '', attachments: [] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create deal");
    }
  };

  const handleScheduleMeeting = async () => {
    if (!newMeeting.title || !newMeeting.scheduledFor) {
      toast.error("Please fill in meeting title and date");
      return;
    }
    try {
      const scheduledDateTime = new Date(`${newMeeting.scheduledFor}T${newMeeting.scheduledTime}`);
      const participantEmails = newMeeting.participants.split(',').map(e => e.trim()).filter(e => e);
      
      // Get organizer's timezone for email display
      const organizerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      await createMeeting.mutateAsync({
        title: newMeeting.title,
        description: newMeeting.description || null,
        scheduledFor: scheduledDateTime,
        duration: newMeeting.duration,
        location: newMeeting.location || null,
        organizerId: currentUser?.id || null,
        participants: participantEmails,
        dealId: newMeeting.dealId || null,
        status: 'scheduled',
        videoPlatform: newMeeting.videoPlatform || null,
        videoLink: newMeeting.videoLink || null,
        localDate: newMeeting.scheduledFor,
        localTime: newMeeting.scheduledTime,
        organizerTimezone,
      } as any);
      
      toast.success("Meeting scheduled! Notifications sent to participants.");
      setShowScheduleMeetingModal(false);
      setNewMeeting({ title: '', description: '', scheduledFor: '', scheduledTime: '09:00', duration: 60, location: '', participants: '', dealId: '', videoPlatform: '', videoLink: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule meeting");
    }
  };

  const handleGenerateReport = async () => {
    toast.info("Generating dashboard report...");
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;
      
      // Colors
      const primaryColor: [number, number, number] = [26, 26, 46];
      const accentColor: [number, number, number] = [34, 197, 94];
      const mutedColor: [number, number, number] = [100, 100, 120];
      
      // Header with gradient effect
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Kronos', margin, 25);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Dashboard Report', margin, 35);
      
      // Generated info
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), 'PPpp')}`, pageWidth - margin - 60, 25);
      doc.text(`By: ${currentUser?.name}`, pageWidth - margin - 60, 33);
      
      y = 60;
      
      // Executive Summary Section
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin, y);
      
      y += 10;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;
      
      // Summary boxes
      const boxWidth = (pageWidth - margin * 2 - 15) / 4;
      const summaryData = [
        { label: 'Active Deals', value: activeDeals.length.toString(), color: accentColor },
        { label: 'Pipeline Value', value: `$${activeValue.toLocaleString()}M`, color: accentColor },
        { label: 'Team Members', value: users.length.toString(), color: accentColor },
        { label: 'Open Tasks', value: tasks.filter(t => t.status !== 'Completed').length.toString(), color: accentColor },
      ];
      
      summaryData.forEach((item, i) => {
        const x = margin + i * (boxWidth + 5);
        doc.setFillColor(245, 245, 250);
        doc.roundedRect(x, y, boxWidth, 25, 3, 3, 'F');
        
        doc.setTextColor(...primaryColor);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x + boxWidth / 2, y + 12, { align: 'center' });
        
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + boxWidth / 2, y + 20, { align: 'center' });
      });
      
      y += 40;
      
      // Deal Analytics by Sector
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Deal Analytics by Sector', margin, y);
      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setFontSize(10);
      Object.entries(sectorStats).forEach(([sector, stats]) => {
        doc.setTextColor(...mutedColor);
        doc.setFont('helvetica', 'normal');
        doc.text(sector, margin, y);
        
        doc.setTextColor(...primaryColor);
        doc.text(`${stats.count} deals`, margin + 80, y);
        
        doc.setTextColor(...accentColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${stats.value.toLocaleString()}M`, margin + 120, y);
        y += 8;
      });
      
      y += 10;
      
      // Pipeline by Stage
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Pipeline by Stage', margin, y);
      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setFontSize(10);
      ibStageStats.forEach((s) => {
        doc.setTextColor(...mutedColor);
        doc.setFont('helvetica', 'normal');
        doc.text(s.stage, margin, y);
        
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`${s.count} deals`, margin + 80, y);
        y += 8;
      });
      
      y += 10;
      
      // Check if we need a new page
      if (y > 220) {
        doc.addPage();
        y = 20;
      }
      
      // Top Performers
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Performers', margin, y);
      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setFontSize(10);
      topUsers.slice(0, 5).forEach((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`${medal} ${u.name}`, margin, y);
        
        doc.setTextColor(...mutedColor);
        doc.setFont('helvetica', 'normal');
        doc.text(`(${u.role})`, margin + 50, y);
        
        doc.setTextColor(...accentColor);
        doc.text(`Score: ${u.velocityScore}`, margin + 100, y);
        
        doc.setTextColor(...primaryColor);
        doc.text(`${u.completedTasks} tasks completed`, margin + 140, y);
        y += 8;
      });
      
      y += 10;
      
      // Market Conditions
      if (marketData.length > 0) {
        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Market Conditions', margin, y);
        y += 8;
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
        
        doc.setFontSize(10);
        marketData.forEach((m) => {
          doc.setTextColor(...mutedColor);
          doc.setFont('helvetica', 'normal');
          doc.text(m.name, margin, y);
          
          doc.setTextColor(...primaryColor);
          doc.setFont('helvetica', 'bold');
          doc.text(m.value, margin + 60, y);
          
          const changeColor: [number, number, number] = m.trend === 'up' ? [34, 197, 94] : [239, 68, 68];
          doc.setTextColor(...changeColor);
          doc.text(m.change, margin + 110, y);
          y += 8;
        });
      }
      
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setTextColor(...mutedColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Kronos - Investment Banking Operations Platform', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });
      
      // Save the PDF
      doc.save(`kronos-dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("Report downloaded successfully!");
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error("Failed to generate report");
    }
  };

  const handleWidgetToggle = (widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setNewDeal(prev => ({ ...prev, attachments: [...prev.attachments, ...files] }));
      toast.success(`${files.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setNewDeal(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const openEmployeeDetail = (employee: any) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetailModal(true);
  };

  // Analytics data preparation - separate IB and AM stage data
  const ibDealsByStage = ibStageStats.map((s, i) => ({
    ...s,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }));
  
  const amDealsByStage = amStageStats.map((s, i) => ({
    ...s,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }));

  const dealsBySector = Object.entries(sectorStats).map(([sector, stats], index) => ({
    sector,
    count: stats.count,
    value: stats.value,
    fill: `hsl(var(--chart-${(index % 5) + 1}))`,
  }));
  
  const ibDealsBySector = Object.entries(ibSectorStats).map(([sector, stats], index) => ({
    sector,
    count: stats.count,
    value: stats.value,
    fill: `hsl(var(--chart-${(index % 5) + 1}))`,
  }));
  
  const amDealsBySector = Object.entries(amSectorStats).map(([sector, stats], index) => ({
    sector,
    count: stats.count,
    value: stats.value,
    fill: `hsl(var(--chart-${(index % 5) + 1}))`,
  }));

  const taskCompletion = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    return [
      { status: 'Completed', count: completed, fill: 'hsl(var(--chart-3))' },
      { status: 'In Progress', count: inProgress, fill: 'hsl(var(--chart-2))' },
      { status: 'Pending', count: pending, fill: 'hsl(var(--chart-1))' },
    ];
  }, [tasks]);

  const weeklyDeals = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, 'EEE');
      const dealsOnDay = deals.filter(d => {
        const dealDate = new Date(d.createdAt || date);
        return format(dealDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      }).length;
      return { day: dayStr, deals: dealsOnDay, value: Math.floor(Math.random() * 50) + 10 };
    });
  }, [deals]);

  const topPerformers = useMemo(() => {
    return employeeStats
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map(e => ({
        name: e.name.split(' ')[0],
        score: e.score || 0,
        tasks: e.completedTasks,
      }));
  }, [employeeStats]);

  const chartConfig = {
    count: { label: 'Count', color: 'hsl(var(--chart-1))' },
    value: { label: 'Value (M)', color: 'hsl(var(--chart-2))' },
    deals: { label: 'Deals', color: 'hsl(var(--chart-3))' },
    score: { label: 'Score', color: 'hsl(var(--chart-4))' },
    tasks: { label: 'Tasks', color: 'hsl(var(--chart-5))' },
  };

  const renderAnalyticsView = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase">Total Pipeline</p>
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}M</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-blue-400">IB: ${ibDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}M</span>
                  <span className="text-emerald-400">AM: ${amDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}M</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase">Active Deals</p>
                <p className="text-2xl font-bold">{activeDeals.length}</p>
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-blue-400">IB: {ibActiveDeals.length}</span>
                  <span className="text-emerald-400">AM: {amActiveDeals.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Team Members</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Task Completion</p>
                <p className="text-2xl font-bold">{tasks.length > 0 ? Math.round((taskCompletion[0].count / tasks.length) * 100) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 - IB and AM Stage Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IB Deal Pipeline by Stage */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Investment Banking Pipeline
            </CardTitle>
            <CardDescription>{ibActiveDeals.length} active deals across {IB_STAGES.length} stages</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={ibDealsByStage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={9} angle={-20} textAnchor="end" height={50} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(217, 91%, 60%)">
                  {ibDealsByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(217, 91%, ${60 - index * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* AM Deal Pipeline by Stage */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Asset Management Pipeline
            </CardTitle>
            <CardDescription>{amActiveDeals.length} active deals across {AM_STAGES.length} stages</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={amDealsByStage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={9} angle={-20} textAnchor="end" height={50} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(160, 84%, 39%)">
                  {amDealsByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(160, 84%, ${45 - index * 4}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Deals by Sector Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* IB Deals by Sector */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-500" />
              IB Deals by Sector
            </CardTitle>
            <CardDescription>Investment Banking sector breakdown ({ibActiveDeals.length} active deals, ${ibActiveValue.toLocaleString()}M)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <RechartsPieChart>
                <Pie
                  data={ibDealsBySector}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="sector"
                  label={({ sector, count }) => count > 0 ? `${sector}: ${count}` : ''}
                  labelLine={false}
                >
                  {ibDealsBySector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(217, 91%, ${60 - index * 8}%)`} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* AM Deals by Sector */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5 text-emerald-500" />
              AM Deals by Sector
            </CardTitle>
            <CardDescription>Asset Management sector breakdown ({amActiveDeals.length} active deals, ${amActiveValue.toLocaleString()}M)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <RechartsPieChart>
                <Pie
                  data={amDealsBySector}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="sector"
                  label={({ sector, count }) => count > 0 ? `${sector}: ${count}` : ''}
                  labelLine={false}
                >
                  {amDealsBySector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(160, 84%, ${50 - index * 8}%)`} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Division Distribution */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Division Distribution
          </CardTitle>
          <CardDescription>Active deals split by Investment Banking and Asset Management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <div className="text-4xl font-bold text-blue-400">{ibActiveDeals.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Investment Banking</div>
              <div className="text-lg font-semibold text-blue-300 mt-2">${ibActiveValue.toLocaleString()}M</div>
            </div>
            <div className="text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <div className="text-4xl font-bold text-emerald-400">{amActiveDeals.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Asset Management</div>
              <div className="text-lg font-semibold text-emerald-300 mt-2">${amActiveValue.toLocaleString()}M</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Weekly Deal Activity
            </CardTitle>
            <CardDescription>Deal activity trend over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={weeklyDeals} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" fillOpacity={1} fill="url(#colorDeals)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task Completion Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Task Status Overview
            </CardTitle>
            <CardDescription>Team-wide task completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={taskCompletion} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="status" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {taskCompletion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Top Performers
          </CardTitle>
          <CardDescription>Team members with highest velocity scores</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={topPerformers} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="score" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );

  if (usersLoading || dealsLoading || tasksLoading) {
    return (
      <Layout role="CEO" pageTitle="Dashboard" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="CEO" pageTitle="Dashboard" userName={currentUser?.name || ""}>
      {/* View Tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'dashboard' | 'analytics')} className="w-full space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-dashboard">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="grid grid-cols-12 gap-6">
            
            {/* Left Column: Quick Actions & Active Deals Analytics */}
            <div className="col-span-12 md:col-span-3 space-y-6">
          {widgets.find(w => w.id === 'quickActions')?.enabled && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                    onClick={() => isAssetManagementHead ? setLocation('/ceo/asset-management') : setShowNewDealModal(true)}
                    data-testid="button-new-deal"
                  >
                    <Plus className="w-4 h-4" /> {isAssetManagementHead ? 'New AM Deal' : 'New Deal'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                    onClick={handleGenerateReport}
                    data-testid="button-generate-report"
                  >
                    <FileText className="w-4 h-4" /> Generate Report
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                    onClick={() => setLocation('/ceo/team')}
                    data-testid="button-assign-team"
                  >
                    <Users className="w-4 h-4" /> Assign Team
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                    onClick={() => setShowScheduleMeetingModal(true)}
                    data-testid="button-schedule-meeting"
                  >
                    <Calendar className="w-4 h-4" /> Schedule Meeting
                  </Button>
                </CardContent>
              </Card>
          )}

          {widgets.find(w => w.id === 'activeDeals')?.enabled && (
              <Card 
                className="bg-card border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setActiveDealsModalOpen(true)}
                data-testid="card-active-deals"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider truncate">
                    Active Deals
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-md overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant={activeDealsFilter === 'IB' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-6 px-2 rounded-none text-[10px]"
                        onClick={(e) => { e.stopPropagation(); setActiveDealsFilter(activeDealsFilter === 'IB' ? 'all' : 'IB'); }}
                      >
                        IB
                      </Button>
                      <Button 
                        variant={activeDealsFilter === 'AM' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="h-6 px-2 rounded-none text-[10px]"
                        onClick={(e) => { e.stopPropagation(); setActiveDealsFilter(activeDealsFilter === 'AM' ? 'all' : 'AM'); }}
                      >
                        AM
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 flex-shrink-0" 
                      onClick={(e) => { e.stopPropagation(); setLocation(activeDealsFilter === 'AM' ? '/ceo/asset-management' : '/ceo/deals'); }}
                    >
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/30 rounded-lg p-2 text-center overflow-hidden">
                    <div className="text-xl font-bold text-primary truncate">
                      {activeDealsFilter === 'IB' ? ibActiveDeals.length : activeDealsFilter === 'AM' ? amActiveDeals.length : displayActiveDeals.length}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase truncate">Active</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2 text-center overflow-hidden">
                    <div className="text-xl font-bold text-green-400 truncate">
                      ${(activeDealsFilter === 'IB' ? ibActiveValue : activeDealsFilter === 'AM' ? amActiveValue : displayActiveValue).toLocaleString()}M
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase truncate">Value</div>
                  </div>
                </div>

                <Separator className="bg-border/50" />
                
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <PieChart className="w-3 h-3 flex-shrink-0" /> <span className="truncate">By Sector</span>
                  </div>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {Object.entries(activeDealsFilter === 'IB' ? ibSectorStats : activeDealsFilter === 'AM' ? amSectorStats : sectorStats).map(([sector, stats]) => (
                      <div key={sector} className="flex items-center justify-between text-xs gap-1">
                        <span className="text-muted-foreground truncate flex-1 min-w-0">{sector}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant="secondary" className="text-[9px] px-1">{stats.count}</Badge>
                          <span className="text-green-400 font-mono text-[10px]">${stats.value}M</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/50" />
                
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{activeDealsFilter === 'AM' ? 'AM Stages' : 'IB Stages'}</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {(activeDealsFilter === 'AM' ? amStageStats : ibStageStats).map(({ stage, count }: { stage: string; count: number }) => {
                      const totalDeals = activeDealsFilter === 'AM' ? amActiveDeals.length : ibActiveDeals.length;
                      return (
                        <div key={stage} className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground w-16 truncate flex-shrink-0">{stage}</span>
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-0">
                            <div 
                              className={cn("h-full rounded-full transition-all", activeDealsFilter === 'AM' ? "bg-emerald-500/60" : "bg-blue-500/60")}
                              style={{ width: `${totalDeals > 0 ? (count / totalDeals) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono w-4 text-right flex-shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
              </Card>
          )}
          
          {widgets.find(w => w.id === 'marketPulse')?.enabled && (
            <Card className="bg-card border-border">
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Market Pulse</CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={() => setShowMarketSearch(!showMarketSearch)}
                    data-testid="button-market-search-toggle"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                  <Badge variant={marketSource === 'live' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                    {marketSource === 'live' ? 'Live' : 'Demo'}
                  </Badge>
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", marketSource === 'live' ? "bg-green-500" : "bg-yellow-500")}></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showMarketSearch && (
                  <div className="space-y-2 pb-2 border-b border-border/50">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search stock, index, or asset..."
                        value={marketSearchQuery}
                        onChange={(e) => setMarketSearchQuery(e.target.value.toUpperCase())}
                        className="h-8 pl-8 text-xs"
                        data-testid="input-market-search"
                      />
                    </div>
                    {marketSearchQuery && (
                      <div className="space-y-1">
                        {[
                          { symbol: marketSearchQuery, name: `Add ${marketSearchQuery}` },
                          ...([
                            { symbol: 'AAPL', name: 'Apple Inc.' },
                            { symbol: 'GOOGL', name: 'Alphabet Inc.' },
                            { symbol: 'MSFT', name: 'Microsoft Corp.' },
                            { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                            { symbol: 'TSLA', name: 'Tesla Inc.' },
                            { symbol: 'SPY', name: 'S&P 500 ETF' },
                            { symbol: 'NVDA', name: 'NVIDIA Corp.' },
                            { symbol: 'META', name: 'Meta Platforms' },
                            { symbol: 'JPM', name: 'JPMorgan Chase' },
                            { symbol: 'V', name: 'Visa Inc.' },
                            { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
                            { symbol: 'DIA', name: 'Dow Jones ETF' },
                            { symbol: 'GS', name: 'Goldman Sachs' },
                            { symbol: 'MS', name: 'Morgan Stanley' },
                          ].filter(s => 
                            s.symbol.includes(marketSearchQuery) || 
                            s.name.toUpperCase().includes(marketSearchQuery)
                          ))
                        ].slice(0, 5).map((item) => (
                          <div 
                            key={item.symbol} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors",
                              marketSymbols.includes(item.symbol) 
                                ? "bg-primary/10 text-primary" 
                                : "bg-secondary/30 hover:bg-secondary/50"
                            )}
                            onClick={() => {
                              if (marketSymbols.includes(item.symbol)) {
                                setMarketSymbols(prev => prev.filter(s => s !== item.symbol));
                                toast.success(`Removed ${item.symbol} from watchlist`);
                              } else {
                                setMarketSymbols(prev => [...prev, item.symbol]);
                                toast.success(`Added ${item.symbol} to watchlist`);
                              }
                              setMarketSearchQuery('');
                            }}
                            data-testid={`market-search-result-${item.symbol}`}
                          >
                            <div>
                              <span className="font-mono font-bold">{item.symbol}</span>
                              <span className="text-muted-foreground ml-2">{item.name}</span>
                            </div>
                            {marketSymbols.includes(item.symbol) ? (
                              <X className="w-3 h-3 text-red-400" />
                            ) : (
                              <Plus className="w-3 h-3 text-green-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!marketSearchQuery && marketSymbols.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {marketSymbols.map(symbol => (
                          <Badge 
                            key={symbol} 
                            variant="secondary" 
                            className="text-[10px] cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                            onClick={() => {
                              setMarketSymbols(prev => prev.filter(s => s !== symbol));
                              toast.success(`Removed ${symbol} from watchlist`);
                            }}
                            data-testid={`market-symbol-badge-${symbol}`}
                          >
                            {symbol} <X className="w-2.5 h-2.5 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {marketLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading market data...</div>
                ) : (
                  marketData
                    .filter(metric => marketSymbols.includes(metric.symbol))
                    .map((metric) => (
                    <div key={metric.symbol} className="flex items-center justify-between hover:bg-secondary/30 p-2 rounded -mx-2 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{metric.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{metric.description}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2 flex items-center gap-2">
                        <div>
                          <div className="text-sm font-bold">{metric.value}</div>
                          <div className={cn("text-xs flex items-center gap-1 justify-end", metric.trend === 'up' ? "text-green-400" : "text-red-400")}>
                            {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {metric.change}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setMarketSymbols(prev => prev.filter(s => s !== metric.symbol));
                            toast.success(`Removed ${metric.symbol} from watchlist`);
                          }}
                          data-testid={`button-remove-market-${metric.symbol}`}
                        >
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {!marketLoading && marketData.filter(metric => marketSymbols.includes(metric.symbol)).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    No symbols tracked. Click the search icon to add stocks.
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
                  {marketSource === 'simulated' && <span className="text-yellow-500">Add FINNHUB_API_KEY for live data • </span>}
                  Updated: {format(new Date(), 'HH:mm:ss')}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Middle Column: Main Content */}
        <div className="col-span-12 md:col-span-6 space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
            <h1 className="text-3xl font-display font-bold">
              Welcome back, {currentUser?.name?.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground mt-1">Here's your personalized command center.</p>
          </div>

          {/* Team Task Progress */}
          {widgets.find(w => w.id === 'teamTaskProgress')?.enabled && (
            <Card className="bg-card border-border h-[500px] overflow-hidden flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Task Progress</CardTitle>
                <div className="text-[10px] text-green-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Live
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                {employeeStats.map((employee, index) => (
                  <div 
                    key={employee.id} 
                    className="p-4 border-b border-border/50 hover:bg-secondary/30 transition-colors group cursor-pointer"
                    onClick={() => openEmployeeDetail(employee)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          index === 0 ? "bg-primary" : "bg-secondary border border-border"
                        )}>
                          {employee.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            {employee.name}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h4>
                          <p className="text-xs text-muted-foreground">{employee.jobTitle || employee.role}</p>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {employee.totalTasks} tasks • {Object.keys(employee.tasksByDeal).length} deals
                      </div>
                    </div>
                    
                    <div className="pl-11">
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckSquare className="w-3 h-3" /> {employee.completedTasks} completed
                        </span>
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Activity className="w-3 h-3" /> {employee.inProgressTasks} in progress
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {employee.pendingTasks} pending
                        </span>
                      </div>
                      
                      {/* Mini deal breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(employee.tasksByDeal).slice(0, 3).map(([dealId, stats]) => (
                          <Badge key={dealId} variant="secondary" className="text-[9px] font-normal">
                            {stats.dealName}: {stats.completed}/{stats.completed + stats.inProgress + stats.pending}
                          </Badge>
                        ))}
                        {Object.keys(employee.tasksByDeal).length > 3 && (
                          <Badge variant="outline" className="text-[9px] font-normal">
                            +{Object.keys(employee.tasksByDeal).length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Market Intelligence Widget - Moved to middle column */}
          {widgets.find(w => w.id === 'marketIntelligence')?.enabled && (
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Market Intelligence</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                    {newsSource === 'live' ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div> Live
                      </span>
                    ) : (
                      <span className="text-yellow-400">Sample</span>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {newsLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading news...</div>
                ) : (
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2 pr-3">
                      {marketNews.slice(0, 6).map((news) => (
                        <a 
                          key={news.id}
                          href={news.url !== '#' ? news.url : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                        >
                          <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                            {news.headline}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground">{news.source}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(news.datetime), 'h:mm a')}
                            </span>
                          </div>
                        </a>
                      ))}
                      {marketNews.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          No news available
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Meetings & Activity Widgets */}
        <div className="col-span-12 md:col-span-3 space-y-6">
          {/* Upcoming Meetings & Events Widget */}
          {widgets.find(w => w.id === 'upcomingMeetings')?.enabled && (() => {
            const today = startOfDay(new Date());
            const upcomingEvents = calendarEvents
              .filter(e => {
                const eventDate = startOfDay(new Date(e.date));
                return isAfter(eventDate, today) || isSameDay(eventDate, today);
              })
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 3);
            const upcomingMeetings = meetings.slice(0, 3);
            const hasItems = upcomingMeetings.length > 0 || upcomingEvents.length > 0;
            
            return (
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
                  <Link href="/ceo/calendar" className="hover:text-primary transition-colors">
                    <Calendar className="w-4 h-4 text-muted-foreground hover:text-primary cursor-pointer" />
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!hasItems ? (
                    <div className="text-center py-4 text-muted-foreground text-xs">No upcoming meetings or events</div>
                  ) : (
                    <>
                      {upcomingMeetings.map((meeting) => (
                        <div key={meeting.id} className="p-2 bg-secondary/30 rounded-lg">
                          <div className="text-sm font-medium truncate">{meeting.title}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {meeting.scheduledFor ? format(new Date(meeting.scheduledFor), 'MMM d, h:mm a') : 'TBD'}
                          </div>
                          {meeting.location && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{meeting.location}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px] px-1 py-0">Event</Badge>
                            <span className="text-sm font-medium truncate">{event.title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {event.time 
                              ? `${format(new Date(event.date + 'T00:00:00'), 'MMM d')}, ${event.time.replace(/^(\d{1,2}):(\d{2})$/, (_, h, m) => {
                                  const hour = parseInt(h);
                                  const ampm = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour % 12 || 12;
                                  return `${displayHour}:${m} ${ampm}`;
                                })}`
                              : format(new Date(event.date + 'T00:00:00'), 'MMM d')}
                          </div>
                          {event.investor && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span className="truncate">{event.investor}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs text-muted-foreground hover:text-primary"
                    onClick={() => setShowScheduleMeetingModal(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Schedule Meeting
                  </Button>
                </CardContent>
              </Card>
            );
          })()}

          {/* Recent Activity Widget */}
          {widgets.find(w => w.id === 'recentActivity')?.enabled && (
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Activity</CardTitle>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">No recent activity</div>
                ) : (
                  notifications.slice(0, 4).map((notification) => (
                    <div 
                      key={notification.id} 
                      className={cn(
                        "p-2 rounded-lg text-xs",
                        notification.read ? "bg-secondary/20" : "bg-primary/10 border border-primary/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                          notification.type === 'success' ? "bg-green-500" :
                          notification.type === 'warning' ? "bg-yellow-500" :
                          notification.type === 'alert' ? "bg-red-500" : "bg-blue-500"
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{notification.title}</div>
                          <div className="text-muted-foreground text-[10px] truncate">{notification.message}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Capital At Work Widget */}
          {widgets.find(w => w.id === 'capitalAtWork')?.enabled && (
            <Card 
              className="bg-card border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setCapitalAtWorkModalOpen(true)}
              data-testid="card-capital-at-work"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Capital At Work
                </CardTitle>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex rounded-md overflow-hidden border border-border">
                    <Button 
                      variant={capitalAtWorkFilter === 'IB' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="h-6 px-2 rounded-none text-[10px]"
                      onClick={(e) => { e.stopPropagation(); setCapitalAtWorkFilter(capitalAtWorkFilter === 'IB' ? 'all' : 'IB'); }}
                    >
                      IB
                    </Button>
                    <Button 
                      variant={capitalAtWorkFilter === 'AM' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="h-6 px-2 rounded-none text-[10px]"
                      onClick={(e) => { e.stopPropagation(); setCapitalAtWorkFilter(capitalAtWorkFilter === 'AM' ? 'all' : 'AM'); }}
                    >
                      AM
                    </Button>
                  </div>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-2">
                  <div className={cn("text-3xl font-bold", capitalAtWorkFilter === 'AM' ? "text-emerald-400" : capitalAtWorkFilter === 'IB' ? "text-blue-400" : "text-primary")}>
                    ${(capitalAtWorkFilter === 'IB' ? ibActiveValue : capitalAtWorkFilter === 'AM' ? amActiveValue : displayActiveValue).toLocaleString()}M
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {capitalAtWorkFilter === 'IB' ? 'IB' : capitalAtWorkFilter === 'AM' ? 'AM' : 'Total'} Active Deal Value
                  </div>
                </div>
                <Separator className="bg-border/50" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold text-green-400">
                      {capitalAtWorkFilter === 'IB' ? ibActiveDeals.length : capitalAtWorkFilter === 'AM' ? amActiveDeals.length : activeDeals.length}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase">Active</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-yellow-400">
                      {capitalAtWorkFilter === 'IB' 
                        ? ibDeals.filter(d => d.status === 'On Hold').length 
                        : capitalAtWorkFilter === 'AM' 
                          ? amDeals.filter(d => d.status === 'On Hold').length 
                          : deals.filter(d => d.status === 'On Hold').length}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase">On Hold</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-muted-foreground">
                      {capitalAtWorkFilter === 'IB' 
                        ? ibDeals.filter(d => d.status === 'Closed').length 
                        : capitalAtWorkFilter === 'AM' 
                          ? amDeals.filter(d => d.status === 'Closed').length 
                          : deals.filter(d => d.status === 'Closed').length}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase">Closed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fee Summary Widget */}
          {widgets.find(w => w.id === 'feeSummary')?.enabled && (
            <Card 
              className="bg-card border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setFeeSummaryModalOpen(true)}
              data-testid="card-fee-summary"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Fee Summary
                </CardTitle>
                <Briefcase className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  // Calculate fees for IB deals only
                  const ibDealIds = new Set(ibDeals.map(d => d.id));
                  const ibFees = allDealFees.filter(fee => ibDealIds.has(fee.dealId));
                  
                  const feesByType = ibFees.reduce((acc, fee) => {
                    const type = fee.feeType || 'other';
                    if (!acc[type]) acc[type] = { total: 0, count: 0 };
                    if (fee.amount) {
                      acc[type].total += fee.amount;
                      acc[type].count++;
                    }
                    return acc;
                  }, {} as Record<string, { total: number; count: number }>);
                  
                  const feeLabels: Record<string, string> = {
                    engagement: 'Engagement Fees',
                    monthly: 'Monthly Retainers',
                    success: 'Success Fees',
                    transaction: 'Transaction Fees',
                    spread: 'Spreads'
                  };
                  
                  const totalFees = Object.values(feesByType).reduce((sum, f) => sum + f.total, 0);
                  
                  return (
                    <>
                      <div className="text-center py-2">
                        <div className="text-2xl font-bold text-green-400">
                          ${totalFees.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">IB Fixed Fees</div>
                      </div>
                      <Separator className="bg-border/50" />
                      <div className="space-y-2">
                        {Object.entries(feesByType).map(([type, data]) => (
                          <div key={type} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate">{feeLabels[type] || type}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px] px-1">{data.count}</Badge>
                              <span className="font-mono text-green-400">${data.total.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                        {Object.keys(feesByType).length === 0 && (
                          <div className="text-center text-xs text-muted-foreground py-4">
                            No IB fees configured yet
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          {renderAnalyticsView()}
        </TabsContent>
      </Tabs>

      {/* New Deal Modal */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>Enter the details for the new deal below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Deal Name *</Label>
              <Input 
                placeholder="Project Codename" 
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Input 
                placeholder="Client Company Name" 
                value={newDeal.client}
                onChange={(e) => setNewDeal({ ...newDeal, client: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value (in millions) *</Label>
                <Input 
                  type="number" 
                  placeholder="100" 
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Popover open={sectorOpen} onOpenChange={setSectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={sectorOpen} className="w-full justify-between">
                      {newDeal.sector === 'Other' && newDeal.customSector ? newDeal.customSector : newDeal.sector}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search sector or type custom..." />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2">
                            <Input 
                              placeholder="Enter custom sector..."
                              value={newDeal.customSector}
                              onChange={(e) => setNewDeal({ ...newDeal, customSector: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newDeal.customSector) {
                                  setNewDeal({ ...newDeal, sector: 'Other' });
                                  setSectorOpen(false);
                                }
                              }}
                            />
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {SECTORS.map((sector) => (
                            <CommandItem
                              key={sector}
                              value={sector}
                              onSelect={() => {
                                setNewDeal({ ...newDeal, sector, customSector: sector === 'Other' ? newDeal.customSector : '' });
                                setSectorOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", newDeal.sector === sector ? "opacity-100" : "opacity-0")} />
                              {sector}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {newDeal.sector === 'Other' && (
              <div className="space-y-2">
                <Label>Custom Sector Name</Label>
                <Input 
                  placeholder="Enter custom sector name..."
                  value={newDeal.customSector}
                  onChange={(e) => setNewDeal({ ...newDeal, customSector: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Origination">Origination</SelectItem>
                  <SelectItem value="Structuring">Structuring</SelectItem>
                  <SelectItem value="Diligence">Diligence</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Close">Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Enter deal description, key terms, and notes..."
                value={newDeal.description}
                onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> Attachments
              </Label>
              <div className="border border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload" 
                  className="flex flex-col items-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="w-8 h-8 mb-2" />
                  <span className="text-sm">Click to upload files</span>
                  <span className="text-xs">PDF, DOC, XLS, PPT up to 10MB</span>
                </label>
              </div>
              {newDeal.attachments.length > 0 && (
                <div className="space-y-2 mt-2">
                  {newDeal.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-secondary/30 rounded px-3 py-2">
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending}>
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Modal - Simplified */}
      <Dialog open={showScheduleMeetingModal} onOpenChange={setShowScheduleMeetingModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Schedule Meeting
            </DialogTitle>
            <DialogDescription>Click a platform to create your meeting, then paste the link below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Platform Icons */}
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">1. Create meeting on your platform</Label>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => openVideoApp('zoom')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105",
                    newMeeting.videoPlatform === 'zoom' 
                      ? "border-blue-500 bg-blue-500/10" 
                      : "border-border hover:border-blue-500/50"
                  )}
                  data-testid="button-zoom"
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium">Zoom</span>
                </button>
                <button
                  type="button"
                  onClick={() => openVideoApp('google_meet')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105",
                    newMeeting.videoPlatform === 'google_meet' 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-border hover:border-green-500/50"
                  )}
                  data-testid="button-meet"
                >
                  <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium">Google Meet</span>
                </button>
                <button
                  type="button"
                  onClick={() => openVideoApp('teams')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105",
                    newMeeting.videoPlatform === 'teams' 
                      ? "border-purple-500 bg-purple-500/10" 
                      : "border-border hover:border-purple-500/50"
                  )}
                  data-testid="button-teams"
                >
                  <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium">Teams</span>
                </button>
              </div>
            </div>
            
            {/* Meeting Link Input */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">2. Paste your meeting link</Label>
              <Input 
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                value={newMeeting.videoLink}
                onChange={(e) => setNewMeeting({ ...newMeeting, videoLink: e.target.value })}
                className="text-sm"
                data-testid="input-video-link"
              />
            </div>
            
            {/* Basic Meeting Info */}
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Meeting Title</Label>
                <Input 
                  placeholder="Q4 Deal Review" 
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={newMeeting.scheduledFor}
                    onChange={(e) => setNewMeeting({ ...newMeeting, scheduledFor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select
                    value={newMeeting.scheduledTime}
                    onValueChange={(v) => setNewMeeting({ ...newMeeting, scheduledTime: v })}
                  >
                    <SelectTrigger data-testid="select-meeting-time">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 36 }, (_, i) => {
                        const hour = Math.floor(i / 2) + 6;
                        const minute = (i % 2) * 30;
                        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                        const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const display = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
                        return <SelectItem key={time24} value={time24}>{display}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Invite Participants (emails, comma-separated)</Label>
                <Input 
                  placeholder="john@company.com, jane@client.com"
                  value={newMeeting.participants}
                  onChange={(e) => setNewMeeting({ ...newMeeting, participants: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleMeetingModal(false)}>Cancel</Button>
            <Button 
              onClick={handleScheduleMeeting} 
              disabled={createMeeting.isPending || !newMeeting.title || !newMeeting.scheduledFor}
            >
              {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Sheet */}
      <Sheet open={showCustomizeSheet} onOpenChange={setShowCustomizeSheet}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Customize Dashboard
            </SheetTitle>
            <SheetDescription>Show or hide widgets and configure market data.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-150px)] mt-6">
            <div className="space-y-6 pr-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">WIDGETS (drag to reorder)</h4>
                <Reorder.Group 
                  axis="y" 
                  values={widgets} 
                  onReorder={setWidgets}
                  className="space-y-2"
                >
                  {widgets.map((widget) => (
                    <Reorder.Item
                      key={widget.id}
                      value={widget}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm cursor-grab">{widget.name}</Label>
                      </div>
                      <Switch 
                        checked={widget.enabled}
                        onCheckedChange={() => handleWidgetToggle(widget.id)}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
              
              <Separator />
              
              {/* Dashboard Background Color */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">DASHBOARD THEME</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: 'Default', value: 'default', color: 'bg-background' },
                    { name: 'Navy', value: 'navy', color: 'bg-[#0f172a]' },
                    { name: 'Slate', value: 'slate', color: 'bg-[#1e293b]' },
                    { name: 'Charcoal', value: 'charcoal', color: 'bg-[#18181b]' },
                    { name: 'Ocean', value: 'ocean', color: 'bg-[#0c4a6e]' },
                    { name: 'Forest', value: 'forest', color: 'bg-[#14532d]' },
                    { name: 'Wine', value: 'wine', color: 'bg-[#450a0a]' },
                    { name: 'Purple', value: 'purple', color: 'bg-[#3b0764]' },
                  ].map((themeOption) => (
                    <button
                      key={themeOption.value}
                      onClick={() => {
                        saveUserPrefs.mutate({ theme: themeOption.value });
                        toast.success(`Theme set to ${themeOption.name}`);
                      }}
                      className={cn(
                        "w-full aspect-square rounded-lg border-2 transition-all",
                        themeOption.color,
                        userPrefs?.theme === themeOption.value 
                          ? "border-primary ring-2 ring-primary/30" 
                          : "border-border hover:border-primary/50"
                      )}
                      title={themeOption.name}
                    />
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setWidgets(DEFAULT_WIDGETS);
                  saveUserPrefs.mutate({ 
                    dashboardWidgets: DEFAULT_WIDGETS,
                    theme: 'system',
                    marketSymbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY'],
                  });
                  toast.success("Dashboard reset to defaults");
                }}
              >
                Reset to Defaults
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Employee Detail Modal */}
      <Dialog open={showEmployeeDetailModal} onOpenChange={setShowEmployeeDetailModal}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {selectedEmployee?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
              </div>
              <div>
                <div>{selectedEmployee?.name}</div>
                <div className="text-sm font-normal text-muted-foreground">{selectedEmployee?.role}</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="space-y-6 py-4">
              {/* Stats Overview */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary">
                    <Zap className="w-5 h-5 inline mr-1" />
                    {(selectedEmployee as any).velocityScore || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Velocity Score</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{(selectedEmployee as any).completedTasks || 0}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{(selectedEmployee as any).inProgressTasks || 0}</div>
                  <div className="text-xs text-muted-foreground">In Progress</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{(selectedEmployee as any).pendingTasks || 0}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>

              <Separator />

              {/* Tasks by Deal */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Tasks by Deal</h4>
                <div className="space-y-3">
                  {(selectedEmployee as any).tasksByDeal && Object.entries((selectedEmployee as any).tasksByDeal).map(([dealId, stats]: [string, any]) => (
                    <div key={dealId} className="bg-secondary/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium">{stats.dealName}</h5>
                        <Badge variant="secondary">
                          {stats.completed + stats.inProgress + stats.pending} total
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> {stats.completed} done
                        </span>
                        <span className="text-yellow-400 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> {stats.inProgress} active
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {stats.pending} pending
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div 
                            className="bg-green-400 h-full"
                            style={{ width: `${(stats.completed / (stats.completed + stats.inProgress + stats.pending)) * 100}%` }}
                          />
                          <div 
                            className="bg-yellow-400 h-full"
                            style={{ width: `${(stats.inProgress / (stats.completed + stats.inProgress + stats.pending)) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Task Names List */}
                      {stats.taskNames && stats.taskNames.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {stats.taskNames.map((task: any) => (
                            <div 
                              key={task.id} 
                              className="flex items-center justify-between text-xs p-2 bg-background/50 rounded border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  task.status === 'Completed' ? "bg-green-400" :
                                  task.status === 'In Progress' ? "bg-yellow-400" : "bg-muted-foreground"
                                )} />
                                <span className={task.status === 'Completed' ? "line-through text-muted-foreground" : ""}>
                                  {task.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.dueDate && (
                                  <span className="text-muted-foreground text-[10px]">
                                    {format(new Date(task.dueDate), 'MMM d')}
                                  </span>
                                )}
                                <Badge variant="outline" className={cn(
                                  "text-[9px] h-4",
                                  task.priority === 'High' || task.priority === 'Critical' ? "text-red-400 border-red-400/30" :
                                  task.priority === 'Medium' ? "text-yellow-400 border-yellow-400/30" : ""
                                )}>
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!((selectedEmployee as any).tasksByDeal) || Object.keys((selectedEmployee as any).tasksByDeal).length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No deals assigned yet
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Progress Overview */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Progress Overview</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Task Completion Rate</span>
                      <span className="font-medium text-green-400">
                        {(selectedEmployee as any).totalTasks > 0 
                          ? Math.round(((selectedEmployee as any).completedTasks / (selectedEmployee as any).totalTasks) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={(selectedEmployee as any).totalTasks > 0 
                        ? ((selectedEmployee as any).completedTasks / (selectedEmployee as any).totalTasks) * 100 
                        : 0} 
                      className="h-2" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="text-muted-foreground text-xs">Active Deals</p>
                      <p className="text-xl font-bold">{Object.keys((selectedEmployee as any).tasksByDeal || {}).length}</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <p className="text-muted-foreground text-xs">Workload Status</p>
                      <p className="text-xl font-bold">
                        {(selectedEmployee as any).totalTasks > 8 ? 'High' : 
                         (selectedEmployee as any).totalTasks > 4 ? 'Medium' : 'Low'}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-yellow-400" />
                      {(selectedEmployee as any).inProgressTasks} tasks currently in progress
                    </p>
                    <p className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      {(selectedEmployee as any).pendingTasks} tasks pending assignment
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDetailModal(false)}>Close</Button>
            <Button onClick={() => { setShowEmployeeDetailModal(false); setLocation('/ceo/team'); }}>
              View in Team Management
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Deals Detail Modal */}
      <Dialog open={activeDealsModalOpen} onOpenChange={setActiveDealsModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Active Deals Analytics
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of all active deals across Investment Banking and Asset Management
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold text-primary">{activeDeals.length}</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Total Active</div>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-400">${displayActiveValue.toLocaleString()}M</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Total Value</div>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {activeDeals.length > 0 ? Math.round(displayActiveValue / activeDeals.length) : 0}M
                  </div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Avg Deal Size</div>
                </div>
              </div>

              <Separator />

              {/* Division Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">By Division</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Investment Banking</span>
                      <Badge className="bg-blue-500/20 text-blue-400">{ibActiveDeals.length} deals</Badge>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">${ibActiveValue.toLocaleString()}M</div>
                  </div>
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Asset Management</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400">{amActiveDeals.length} deals</Badge>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">${amActiveValue.toLocaleString()}M</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sector Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">By Sector</h4>
                <div className="space-y-2">
                  {Object.entries(sectorStats).map(([sector, stats]) => (
                    <div key={sector} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="font-medium">{sector}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{stats.count} deals</Badge>
                        <span className="text-green-400 font-mono font-bold">${stats.value}M</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Deal List */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">All Active Deals</h4>
                <div className="space-y-2">
                  {activeDeals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors">
                      <div>
                        <div className="font-medium">{deal.name}</div>
                        <div className="text-xs text-muted-foreground">{deal.client} • {deal.sector}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-mono font-bold">${deal.value}M</div>
                        <Badge variant="outline" className="text-xs">{deal.stage}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDealsModalOpen(false)}>Close</Button>
            <Button onClick={() => { setActiveDealsModalOpen(false); setLocation('/ceo/deals'); }}>
              Go to Deal Management
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capital At Work Detail Modal */}
      <Dialog open={capitalAtWorkModalOpen} onOpenChange={setCapitalAtWorkModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Capital At Work Analysis
            </DialogTitle>
            <DialogDescription>
              Comprehensive view of capital deployment across all active engagements
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Total Capital */}
              <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg text-center">
                <div className="text-4xl font-bold text-primary">${displayActiveValue.toLocaleString()}M</div>
                <div className="text-sm text-muted-foreground mt-2">Total Capital at Work</div>
              </div>

              {/* Status Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Deal Status Distribution</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">{activeDeals.length}</div>
                    <div className="text-xs text-muted-foreground uppercase mt-1">Active</div>
                    <div className="text-sm text-green-400 font-mono mt-2">${displayActiveValue.toLocaleString()}M</div>
                  </div>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-400">{deals.filter(d => d.status === 'On Hold').length}</div>
                    <div className="text-xs text-muted-foreground uppercase mt-1">On Hold</div>
                    <div className="text-sm text-yellow-400 font-mono mt-2">
                      ${deals.filter(d => d.status === 'On Hold').reduce((sum, d) => sum + d.value, 0).toLocaleString()}M
                    </div>
                  </div>
                  <div className="p-4 bg-secondary/30 rounded-lg text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{deals.filter(d => d.status === 'Closed').length}</div>
                    <div className="text-xs text-muted-foreground uppercase mt-1">Closed</div>
                    <div className="text-sm text-muted-foreground font-mono mt-2">
                      ${deals.filter(d => d.status === 'Closed').reduce((sum, d) => sum + d.value, 0).toLocaleString()}M
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Division Split */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Division Allocation</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        Investment Banking
                      </span>
                      <span className="text-blue-400 font-bold">${ibActiveValue.toLocaleString()}M ({ibActiveDeals.length} deals)</span>
                    </div>
                    <Progress value={displayActiveValue > 0 ? (ibActiveValue / displayActiveValue) * 100 : 0} className="h-3" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        Asset Management
                      </span>
                      <span className="text-emerald-400 font-bold">${amActiveValue.toLocaleString()}M ({amActiveDeals.length} deals)</span>
                    </div>
                    <Progress value={displayActiveValue > 0 ? (amActiveValue / displayActiveValue) * 100 : 0} className="h-3" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stage Distribution */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Pipeline by Stage</h4>
                <div className="space-y-2">
                  {['Origination', 'Due Diligence', 'Structuring', 'Negotiation', 'Closing'].map((stage) => {
                    const stageDeals = activeDeals.filter(d => d.stage === stage);
                    const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
                    return (
                      <div key={stage} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                        <span className="font-medium">{stage}</span>
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary">{stageDeals.length} deals</Badge>
                          <span className="text-primary font-mono font-bold">${stageValue.toLocaleString()}M</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapitalAtWorkModalOpen(false)}>Close</Button>
            <Button onClick={() => { setCapitalAtWorkModalOpen(false); setLocation('/ceo/deals'); }}>
              View All Deals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Summary Detail Modal */}
      <Dialog open={feeSummaryModalOpen} onOpenChange={setFeeSummaryModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-green-400" />
              Fee Summary Details
            </DialogTitle>
            <DialogDescription>
              Complete breakdown of fees across all Investment Banking deals
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {(() => {
              const ibDealIds = new Set(ibDeals.map(d => d.id));
              const ibFees = allDealFees.filter(fee => ibDealIds.has(fee.dealId));
              
              const feesByType = ibFees.reduce((acc, fee) => {
                const type = fee.feeType || 'other';
                if (!acc[type]) acc[type] = { total: 0, count: 0, fees: [] as typeof ibFees };
                if (fee.amount) {
                  acc[type].total += fee.amount;
                  acc[type].count++;
                  acc[type].fees.push(fee);
                }
                return acc;
              }, {} as Record<string, { total: number; count: number; fees: typeof ibFees }>);
              
              const feeLabels: Record<string, { name: string; description: string }> = {
                engagement: { name: 'Engagement Fees', description: 'Upfront fees charged at deal initiation' },
                monthly: { name: 'Monthly Retainers', description: 'Recurring monthly advisory fees' },
                success: { name: 'Success Fees', description: 'Fees contingent on deal completion' },
                transaction: { name: 'Transaction Fees', description: 'Fees based on transaction value' },
                spread: { name: 'Spreads', description: 'Fee spreads on capital raised' }
              };
              
              const totalFees = Object.values(feesByType).reduce((sum, f) => sum + f.total, 0);
              
              return (
                <div className="space-y-6">
                  {/* Total Fees */}
                  <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg text-center">
                    <div className="text-4xl font-bold text-green-400">${totalFees.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-2">Total IB Fixed Fees</div>
                  </div>

                  <Separator />

                  {/* Fee Type Breakdown */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Fee Types</h4>
                    {Object.entries(feesByType).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(feesByType).map(([type, data]) => (
                          <div key={type} className="p-4 bg-secondary/20 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium">{feeLabels[type]?.name || type}</div>
                                <div className="text-xs text-muted-foreground">{feeLabels[type]?.description || ''}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-400">${data.total.toLocaleString()}</div>
                                <Badge variant="secondary" className="mt-1">{data.count} fees</Badge>
                              </div>
                            </div>
                            {data.fees.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                                {data.fees.slice(0, 5).map((fee) => {
                                  const deal = ibDeals.find(d => d.id === fee.dealId);
                                  return (
                                    <div key={fee.id} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground truncate">{deal?.name || 'Unknown Deal'}</span>
                                      <span className="text-green-400 font-mono">${fee.amount?.toLocaleString()}</span>
                                    </div>
                                  );
                                })}
                                {data.fees.length > 5 && (
                                  <div className="text-xs text-muted-foreground text-center">
                                    +{data.fees.length - 5} more fees
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No fees configured yet</p>
                        <p className="text-xs mt-1">Add fees to deals to see them here</p>
                      </div>
                    )}
                  </div>

                  {Object.entries(feesByType).length > 0 && (
                    <>
                      <Separator />

                      {/* Fee Distribution Chart Summary */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Distribution</h4>
                        <div className="space-y-2">
                          {Object.entries(feesByType).map(([type, data]) => {
                            const percentage = totalFees > 0 ? (data.total / totalFees) * 100 : 0;
                            return (
                              <div key={type}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{feeLabels[type]?.name || type}</span>
                                  <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeSummaryModalOpen(false)}>Close</Button>
            <Button onClick={() => { setFeeSummaryModalOpen(false); setLocation('/ceo/deals'); }}>
              Manage Deal Fees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
