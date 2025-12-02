import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  Paperclip
} from "lucide-react";
import { useCurrentUser, useUsers, useDeals, useTasks, useCreateDeal, useNotifications, useMarkNotificationRead, useCreateMeeting, useMeetings, useUpdateUserPreferences } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
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
  { id: 'teamTaskProgress', name: 'Team Task Progress', enabled: true },
  { id: 'velocityScoreboard', name: 'Live Velocity Scoreboard', enabled: true },
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
  const markNotificationRead = useMarkNotificationRead();
  const updateUserPreferences = useUpdateUserPreferences();

  // Use context for shared sheet states
  const {
    showProfileSheet,
    setShowProfileSheet,
    showSettingsSheet,
    setShowSettingsSheet,
    showResourcesSheet,
    setShowResourcesSheet,
    showNotificationsSheet,
    setShowNotificationsSheet,
    showCustomizeSheet,
    setShowCustomizeSheet,
  } = useDashboardContext();

  // Local modal states
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showScheduleMeetingModal, setShowScheduleMeetingModal] = useState(false);
  const [showEmployeeDetailModal, setShowEmployeeDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);
  
  // Widget configuration
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  
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
  });

  // Market data state
  const [marketData, setMarketData] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);

  // Fetch live market data
  useEffect(() => {
    const fetchMarketData = async () => {
      setMarketLoading(true);
      try {
        // Simulate live data with realistic random variations
        // In production, replace with actual API call (e.g., Finnhub, Alpha Vantage)
        const baseData = [
          { name: 'S&P 500', symbol: 'SPY', baseValue: 4567.89, description: 'US Large Cap' },
          { name: 'NASDAQ', symbol: 'QQQ', baseValue: 15234.56, description: 'Tech Heavy' },
          { name: 'Dow Jones', symbol: 'DIA', baseValue: 35678.90, description: 'Blue Chips' },
          { name: 'VIX', symbol: 'VIX', baseValue: 18.45, description: 'Volatility Index' },
          { name: '10Y Treasury', symbol: 'TNX', baseValue: 4.25, description: 'Yield', isPercent: true },
          { name: 'Gold', symbol: 'GLD', baseValue: 2045.30, description: 'Spot Price', isCurrency: true },
        ];
        
        const liveData = baseData.map(item => {
          // Generate realistic random change (-2% to +2%)
          const changePercent = (Math.random() - 0.5) * 4;
          const newValue = item.baseValue * (1 + changePercent / 100);
          const trend = changePercent >= 0 ? 'up' : 'down';
          
          let displayValue: string;
          let displayChange: string;
          
          if (item.isPercent) {
            displayValue = `${newValue.toFixed(2)}%`;
            displayChange = `${changePercent >= 0 ? '+' : ''}${(changePercent / 100).toFixed(2)}`;
          } else if (item.isCurrency) {
            displayValue = `$${newValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            displayChange = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
          } else {
            displayValue = newValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            displayChange = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
          }
          
          return {
            name: item.name,
            symbol: item.symbol,
            value: displayValue,
            change: displayChange,
            trend,
            description: item.description,
          };
        });
        
        setMarketData(liveData);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      } finally {
        setMarketLoading(false);
      }
    };
    
    fetchMarketData();
    // Refresh every 30 seconds for more dynamic updates
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

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
      
      // Get tasks by deal
      const tasksByDeal: Record<string, { dealName: string; completed: number; inProgress: number; pending: number }> = {};
      userTasks.forEach(task => {
        if (task.dealId) {
          const deal = deals.find(d => d.id === task.dealId);
          if (deal) {
            if (!tasksByDeal[task.dealId]) {
              tasksByDeal[task.dealId] = { dealName: deal.name, completed: 0, inProgress: 0, pending: 0 };
            }
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
        // Include original local time info for email formatting
        localDate: newMeeting.scheduledFor,
        localTime: newMeeting.scheduledTime,
        organizerTimezone,
      } as any);
      
      toast.success("Meeting scheduled! Notifications sent to participants.");
      setShowScheduleMeetingModal(false);
      setNewMeeting({ title: '', description: '', scheduledFor: '', scheduledTime: '09:00', duration: 60, location: '', participants: '', dealId: '' });
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
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Deals Analytics</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation('/ceo/deals')}>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{activeDeals.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Active</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">${activeValue.toLocaleString()}M</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Value</div>
                  </div>
                </div>

                <Separator className="bg-border/50" />
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <PieChart className="w-3 h-3" /> By Sector
                  </div>
                  <div className="space-y-2">
                    {Object.entries(sectorStats).map(([sector, stats]) => (
                      <div key={sector} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{sector}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{stats.count}</Badge>
                          <span className="text-green-400 font-mono">${stats.value}M</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/50" />
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> By Stage
                  </div>
                  <div className="space-y-1">
                    {stageStats.map(({ stage, count }) => (
                      <div key={stage} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-20">{stage}</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary/60 rounded-full transition-all"
                            style={{ width: `${activeDeals.length > 0 ? (count / activeDeals.length) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono w-6 text-right">{count}</span>
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
                  <div className="text-[10px] text-muted-foreground">Live</div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {marketLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading market data...</div>
                ) : (
                  marketData.map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 p-2 rounded -mx-2 transition-colors">
                      <div>
                        <div className="text-sm font-medium">{metric.name}</div>
                        <div className="text-[10px] text-muted-foreground">{metric.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{metric.value}</div>
                        <div className={cn("text-xs flex items-center gap-1 justify-end", metric.trend === 'up' ? "text-green-400" : "text-red-400")}>
                          {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {metric.change}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
                  Last updated: {format(new Date(), 'HH:mm:ss')}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle Column: Main Content */}
        <div className="col-span-12 md:col-span-6 space-y-6">
          {/* Welcome Banner with Customize Button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {currentUser?.name?.split(' ')[0]}. Here's your personalized command center.</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs bg-secondary/50 border-border"
              onClick={() => setShowCustomizeSheet(true)}
              data-testid="button-customize"
            >
              <Palette className="w-3 h-3 mr-1" /> Customize
            </Button>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 text-green-500 text-xs font-medium rounded border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            System Active • Real-time Data Sync Enabled
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
        </div>

        {/* Right Column: Velocity Scoreboard */}
        <div className="col-span-12 md:col-span-3 space-y-6">
          {widgets.find(w => w.id === 'velocityScoreboard')?.enabled && (
            <Card className="bg-card border-border h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live Velocity Scoreboard</CardTitle>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {topUsers.map((user, index) => (
                    <div 
                      key={user.id} 
                      className="p-4 border-l-2 border-transparent hover:border-primary hover:bg-secondary/30 transition-all cursor-pointer"
                      onClick={() => openEmployeeDetail(user)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                        <span className={cn(
                          "text-sm font-bold font-mono",
                          index === 0 ? "text-accent" : "text-primary"
                        )}>
                          <Zap className="w-3 h-3 inline mr-1" />
                          {user.velocityScore}
                        </span>
                      </div>
                      <div className="font-medium text-sm flex items-center gap-1">
                        {user.name}
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{user.role}</div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-secondary/50 rounded py-1">
                          <div className="text-[10px] text-muted-foreground">Done</div>
                          <div className="text-xs font-bold text-green-400">{user.completedTasks}</div>
                        </div>
                        <div className="bg-secondary/50 rounded py-1">
                          <div className="text-[10px] text-muted-foreground">Active</div>
                          <div className="text-xs font-bold text-yellow-400">{user.inProgressTasks}</div>
                        </div>
                        <div className="bg-secondary/50 rounded py-1">
                          <div className="text-[10px] text-muted-foreground">Deals</div>
                          <div className="text-xs font-bold">{Object.keys(user.tasksByDeal).length}</div>
                        </div>
                      </div>
                      
                      <div className="mt-2 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            index === 0 ? "bg-accent" : "bg-primary/60"
                          )}
                          style={{ width: `${user.velocityScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </Label>
              <Input 
                placeholder="Conference Room A / Zoom Link" 
                value={newMeeting.location}
                onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
              />
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

      {/* Profile Sheet */}
      <Sheet open={showProfileSheet} onOpenChange={setShowProfileSheet}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              My Profile
            </SheetTitle>
            <SheetDescription>View and manage your profile information.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">
                {currentUser?.name?.split(' ').map(n => n[0]).join('') || 'U'}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{currentUser?.name}</h3>
                <p className="text-muted-foreground">{currentUser?.role}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p className="text-sm">{currentUser?.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Role</Label>
                <p className="text-sm">{currentUser?.role}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Performance Score</Label>
                <p className="text-sm font-mono text-primary">{currentUser?.score || 0}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Active Deals</Label>
                <p className="text-sm">{currentUser?.activeDeals || 0}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Completed Tasks</Label>
                <p className="text-sm">{currentUser?.completedTasks || 0}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings
            </SheetTitle>
            <SheetDescription>Configure your dashboard preferences.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Display</h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact View</Label>
                  <p className="text-xs text-muted-foreground">Show more data in less space</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Animations</Label>
                  <p className="text-xs text-muted-foreground">Enable UI animations</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notifications</h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive email updates</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Desktop Notifications</Label>
                  <p className="text-xs text-muted-foreground">Browser push notifications</p>
                </div>
                <Switch />
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data</h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-refresh</Label>
                  <p className="text-xs text-muted-foreground">Update data every 5 minutes</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
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
            <div className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                User Guide
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Complete guide to using OSReaper</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Deal Management
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Learn how to manage deals effectively</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Team Collaboration
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Best practices for team coordination</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <h4 className="font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Analytics & Reporting
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Understanding your dashboard metrics</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Contact Support
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Get help from our support team</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Customize Sheet */}
      <Sheet open={showCustomizeSheet} onOpenChange={setShowCustomizeSheet}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Customize Dashboard
            </SheetTitle>
            <SheetDescription>Show or hide dashboard widgets.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {widgets.map((widget) => (
              <div key={widget.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div>
                  <Label>{widget.name}</Label>
                </div>
                <Switch 
                  checked={widget.enabled}
                  onCheckedChange={() => handleWidgetToggle(widget.id)}
                />
              </div>
            ))}
            
            <Separator />
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setWidgets(DEFAULT_WIDGETS);
                toast.success("Widgets reset to defaults");
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Sheet */}
      <Sheet open={showNotificationsSheet} onOpenChange={setShowNotificationsSheet}>
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
                {notifications.map((notification) => (
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
                      <div className="flex-1">
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {notification.createdAt ? format(new Date(notification.createdAt), 'PPp') : 'Just now'}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

              {/* Score Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Score Calculation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed Tasks ({(selectedEmployee as any).completedTasks} × 4)</span>
                    <span className="font-mono">+{((selectedEmployee as any).completedTasks || 0) * 4}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Tasks ({(selectedEmployee as any).inProgressTasks} × 2)</span>
                    <span className="font-mono">+{((selectedEmployee as any).inProgressTasks || 0) * 2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deal Involvement ({Object.keys((selectedEmployee as any).tasksByDeal || {}).length} × 5)</span>
                    <span className="font-mono">+{Object.keys((selectedEmployee as any).tasksByDeal || {}).length * 5}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total Velocity Score</span>
                    <span className="font-mono text-primary">{(selectedEmployee as any).velocityScore || 0}</span>
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
