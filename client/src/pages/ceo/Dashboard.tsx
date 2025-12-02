import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
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
  LayoutDashboard
} from "lucide-react";
import { useCurrentUser, useUsers, useDeals, useTasks, useCreateDeal, useNotifications, useCreateMeeting, useMeetings, useUpdateUserPreferences, useMarketData, useMarketNews } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
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
  const createDeal = useCreateDeal();
  const createMeeting = useCreateMeeting();
  const updateUserPreferences = useUpdateUserPreferences();

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
  
  // Widget configuration - load from localStorage
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('ceoDashboardWidgets');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });
  
  // Save widget order to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('ceoDashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);
  
  // Market symbols state
  const [marketSymbols, setMarketSymbols] = useState<string[]>(['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY']);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [showMarketSearch, setShowMarketSearch] = useState(false);
  
  // New deal form
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Technology',
    value: '',
    stage: 'Origination',
    lead: '',
    status: 'Active',
    progress: 0,
    description: '',
    attachments: [] as File[],
  });

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
  });

  // Market data from API (refreshes every 30 seconds)
  const { data: marketDataResponse, isLoading: marketLoading } = useMarketData(marketSymbols);
  const marketData = marketDataResponse?.data || [];
  const marketSource = marketDataResponse?.source || 'simulated';
  
  // Market news from API (refreshes every minute)
  const { data: marketNewsResponse, isLoading: newsLoading } = useMarketNews();
  const rawMarketNews = marketNewsResponse?.data || [];
  const newsSource = marketNewsResponse?.source || 'sample';
  
  // Filter for investment banking related news
  const ibKeywords = ['merger', 'm&a', 'acquisition', 'ipo', 'capital', 'deal', 'buyout', 'investment', 'equity', 'debt', 'bond', 'underwriting', 'financing', 'valuation', 'securities', 'advisory', 'banking', 'fund', 'private equity', 'venture', 'syndicate', 'offering', 'raise', 'billion', 'million'];
  const marketNews = rawMarketNews.filter((news: any) => {
    const headline = news.headline?.toLowerCase() || '';
    const summary = news.summary?.toLowerCase() || '';
    return ibKeywords.some(keyword => headline.includes(keyword) || summary.includes(keyword));
  });

  // Compute analytics
  const activeDeals = deals.filter(d => d.status === 'Active');
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const activeValue = activeDeals.reduce((sum, deal) => sum + deal.value, 0);
  
  // Sector breakdown
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

  // Stage breakdown
  const stageStats = useMemo(() => {
    const stages = ['Origination', 'Structuring', 'Diligence', 'Legal', 'Close'];
    return stages.map(stage => ({
      stage,
      count: activeDeals.filter(d => d.stage === stage).length,
    }));
  }, [activeDeals]);

  // Calculate velocity scores
  const employeeStats = useMemo(() => {
    return users.map(user => {
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
    try {
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
        sector: newDeal.sector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: newDeal.progress || 0,
        description: newDeal.description || null,
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
      setNewDeal({ name: '', client: '', sector: 'Technology', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0, description: '', attachments: [] });
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
        localDate: newMeeting.scheduledFor,
        localTime: newMeeting.scheduledTime,
        organizerTimezone,
      } as any);
      
      toast.success("Meeting scheduled! Notifications sent to participants.");
      setShowScheduleMeetingModal(false);
      setNewMeeting({ title: '', description: '', scheduledFor: '', scheduledTime: '09:00', duration: 60, location: '', participants: '', dealId: '', videoPlatform: '' });
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
      doc.text('OSReaper', margin, 25);
      
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
      stageStats.forEach((s) => {
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
      doc.text('OSReaper - Investment Banking Operations Platform', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });
      
      // Save the PDF
      doc.save(`osreaper-dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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

  // Analytics data preparation
  const dealsByStage = stageStats.map(s => ({
    ...s,
    fill: s.stage === 'Origination' ? 'hsl(var(--chart-1))' :
          s.stage === 'Structuring' ? 'hsl(var(--chart-2))' :
          s.stage === 'Diligence' ? 'hsl(var(--chart-3))' :
          s.stage === 'Legal' ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-5))',
  }));

  const dealsBySector = Object.entries(sectorStats).map(([sector, stats], index) => ({
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
              <div>
                <p className="text-xs text-muted-foreground uppercase">Total Pipeline</p>
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}M</p>
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
              <div>
                <p className="text-xs text-muted-foreground uppercase">Active Deals</p>
                <p className="text-2xl font-bold">{activeDeals.length}</p>
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Pipeline by Stage */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Deal Pipeline by Stage
            </CardTitle>
            <CardDescription>Distribution of deals across pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={dealsByStage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dealsByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Deals by Sector */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Deals by Sector
            </CardTitle>
            <CardDescription>Sector breakdown of active deals</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <RechartsPieChart>
                <Pie
                  data={dealsBySector}
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
                  {dealsBySector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

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
                    onClick={() => setShowNewDealModal(true)}
                    data-testid="button-new-deal"
                  >
                    <Plus className="w-4 h-4" /> New Deal
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
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider truncate">Active Deals</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setLocation('/ceo/deals')}>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/30 rounded-lg p-2 text-center overflow-hidden">
                    <div className="text-xl font-bold text-primary truncate">{activeDeals.length}</div>
                    <div className="text-[9px] text-muted-foreground uppercase truncate">Active</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2 text-center overflow-hidden">
                    <div className="text-xl font-bold text-green-400 truncate">${activeValue.toLocaleString()}M</div>
                    <div className="text-[9px] text-muted-foreground uppercase truncate">Value</div>
                  </div>
                </div>

                <Separator className="bg-border/50" />
                
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <PieChart className="w-3 h-3 flex-shrink-0" /> <span className="truncate">By Sector</span>
                  </div>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {Object.entries(sectorStats).map(([sector, stats]) => (
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
                    <BarChart3 className="w-3 h-3 flex-shrink-0" /> <span className="truncate">By Stage</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {stageStats.map(({ stage, count }) => (
                      <div key={stage} className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground w-16 truncate flex-shrink-0">{stage}</span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-0">
                          <div 
                            className="h-full bg-primary/60 rounded-full transition-all"
                            style={{ width: `${activeDeals.length > 0 ? (count / activeDeals.length) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono w-4 text-right flex-shrink-0">{count}</span>
                      </div>
                    ))}
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
                          <p className="text-xs text-muted-foreground">{employee.role}</p>
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
          {/* Upcoming Meetings Widget */}
          {widgets.find(w => w.id === 'upcomingMeetings')?.enabled && (
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {meetings.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">No upcoming meetings</div>
                ) : (
                  meetings.slice(0, 3).map((meeting) => (
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
                  ))
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
          )}

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
                <Select value={newDeal.sector} onValueChange={(v) => setNewDeal({ ...newDeal, sector: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="Consumer">Consumer</SelectItem>
                    <SelectItem value="Industrials">Industrials</SelectItem>
                    <SelectItem value="Financial">Financial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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

      {/* Schedule Meeting Modal */}
      <Dialog open={showScheduleMeetingModal} onOpenChange={setShowScheduleMeetingModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Schedule Meeting
            </DialogTitle>
            <DialogDescription>Schedule a meeting and notify participants via email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meeting Title *</Label>
              <Input 
                placeholder="Q4 Deal Review" 
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input 
                  type="date" 
                  value={newMeeting.scheduledFor}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduledFor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input 
                  type="time" 
                  value={newMeeting.scheduledTime}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduledTime: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Select value={newMeeting.duration.toString()} onValueChange={(v) => setNewMeeting({ ...newMeeting, duration: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Related Deal</Label>
                <Select value={newMeeting.dealId} onValueChange={(v) => setNewMeeting({ ...newMeeting, dealId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deals.map(deal => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </Label>
                <Input 
                  placeholder="Conference Room A" 
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Video Conference</Label>
                <Select 
                  value={newMeeting.videoPlatform || "none"} 
                  onValueChange={(v) => setNewMeeting({ ...newMeeting, videoPlatform: v === "none" ? '' : v as 'zoom' | 'google_meet' | 'teams' })}
                >
                  <SelectTrigger data-testid="select-video-platform">
                    <SelectValue placeholder="Optional video link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No video link</SelectItem>
                    <SelectItem value="zoom">Zoom Meeting</SelectItem>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Participants (email addresses)
              </Label>
              <Textarea 
                placeholder="Enter email addresses separated by commas..."
                value={newMeeting.participants}
                onChange={(e) => setNewMeeting({ ...newMeeting, participants: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Participants will receive email notifications about this meeting.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Description / Agenda</Label>
              <Textarea 
                placeholder="Meeting agenda and discussion points..."
                value={newMeeting.description}
                onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleMeetingModal(false)}>Cancel</Button>
            <Button onClick={handleScheduleMeeting} disabled={createMeeting.isPending}>
              {createMeeting.isPending ? "Scheduling..." : "Schedule & Send Invites"}
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
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => {
                        localStorage.setItem('dashboardTheme', theme.value);
                        toast.success(`Theme set to ${theme.name}`);
                      }}
                      className={cn(
                        "w-full aspect-square rounded-lg border-2 transition-all",
                        theme.color,
                        localStorage.getItem('dashboardTheme') === theme.value 
                          ? "border-primary ring-2 ring-primary/30" 
                          : "border-border hover:border-primary/50"
                      )}
                      title={theme.name}
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
                  localStorage.removeItem('ceoDashboardWidgets');
                  localStorage.removeItem('dashboardTheme');
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
    </Layout>
  );
}
