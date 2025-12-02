import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Reorder } from "framer-motion";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent 
} from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  Area, 
  AreaChart,
  ResponsiveContainer 
} from "recharts";
import { 
  CheckSquare, 
  Clock, 
  AlertCircle,
  Briefcase,
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Target,
  User,
  Paperclip,
  ExternalLink,
  MessageSquare,
  Settings2,
  Palette,
  GripVertical,
  BarChart3,
  PieChartIcon,
  Activity
} from "lucide-react";
import { useCurrentUser, useTasks, useDeals, useMeetings, useNotifications, useUsers, useUpdateTask } from "@/lib/api";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, parseISO, subDays } from "date-fns";
import { toast } from "sonner";
import type { PodTeamMember, Task } from "@shared/schema";

type WidgetSize = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
};

type WidgetSizes = Record<string, WidgetSize>;

const DEFAULT_EMPLOYEE_WIDGET_SIZES: WidgetSizes = {
  quickStats: { minWidth: 200, minHeight: 80 },
  myTasks: { minWidth: 300, minHeight: 250 },
  myProjects: { minWidth: 300, minHeight: 200 },
  schedule: { minWidth: 300, minHeight: 200 },
  quickActions: { minWidth: 200, minHeight: 150 },
};

export default function EmployeeHome() {
  const { data: currentUser } = useCurrentUser();
  const { data: allTasks = [] } = useTasks();
  const { data: allDeals = [] } = useDeals();
  const { data: meetings = [] } = useMeetings();
  const { data: notifications = [] } = useNotifications();
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask();
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showCustomizePopover, setShowCustomizePopover] = useState(false);
  const [viewTab, setViewTab] = useState<'overview' | 'analytics'>('overview');
  
  // Widget definitions for drag and drop
  type WidgetId = 'quickStats' | 'myTasks' | 'myProjects' | 'schedule' | 'quickActions';
  const defaultWidgetOrder: WidgetId[] = ['quickStats', 'myTasks', 'myProjects', 'schedule', 'quickActions'];
  
  // Load widget order from localStorage
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    const saved = localStorage.getItem('employeeHomeWidgetOrder');
    return saved ? JSON.parse(saved) : defaultWidgetOrder;
  });
  
  // Customization state
  const [widgetSettings, setWidgetSettings] = useState(() => {
    const saved = localStorage.getItem('employeeHomeWidgetSettings');
    return saved ? JSON.parse(saved) : {
      showQuickStats: true,
      showMyTasks: true,
      showMyProjects: true,
      showSchedule: true,
      showQuickActions: true,
    };
  });
  const [bgColor, setBgColor] = useState<string>(() => {
    return localStorage.getItem('employeeHomeBgColor') || 'default';
  });
  
  // Widget sizes - load from localStorage
  const [widgetSizes, setWidgetSizes] = useState<WidgetSizes>(() => {
    const saved = localStorage.getItem('employeeHomeWidgetSizes');
    return saved ? { ...DEFAULT_EMPLOYEE_WIDGET_SIZES, ...JSON.parse(saved) } : DEFAULT_EMPLOYEE_WIDGET_SIZES;
  });
  
  // Resize state
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('employeeHomeWidgetOrder', JSON.stringify(widgetOrder));
  }, [widgetOrder]);
  
  useEffect(() => {
    localStorage.setItem('employeeHomeWidgetSettings', JSON.stringify(widgetSettings));
  }, [widgetSettings]);
  
  useEffect(() => {
    localStorage.setItem('employeeHomeBgColor', bgColor);
  }, [bgColor]);
  
  // Save widget sizes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('employeeHomeWidgetSizes', JSON.stringify(widgetSizes));
  }, [widgetSizes]);
  
  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, widgetId: string, currentWidth: number, currentHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(widgetId);
    setResizeStart({ x: e.clientX, y: e.clientY, width: currentWidth, height: currentHeight });
  };
  
  // Handle resize move
  useEffect(() => {
    if (!isResizing || !resizeStart) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const minWidth = widgetSizes[isResizing]?.minWidth || 150;
      const minHeight = widgetSizes[isResizing]?.minHeight || 100;
      
      setWidgetSizes(prev => ({
        ...prev,
        [isResizing]: {
          ...prev[isResizing],
          width: Math.max(minWidth, resizeStart.width + deltaX),
          height: Math.max(minHeight, resizeStart.height + deltaY),
        }
      }));
    };
    
    const handleMouseUp = () => {
      setIsResizing(null);
      setResizeStart(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, widgetSizes]);
  
  // Resizable widget wrapper component
  const ResizableWidget = ({ 
    id, 
    children, 
    className = '' 
  }: { 
    id: string; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    const size = widgetSizes[id];
    const widgetRef = useRef<HTMLDivElement>(null);
    
    return (
      <div 
        ref={widgetRef}
        className={cn("relative group", className)}
        style={{
          width: size?.width ? `${size.width}px` : undefined,
          height: size?.height ? `${size.height}px` : undefined,
        }}
      >
        {children}
        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={(e) => {
            const rect = widgetRef.current?.getBoundingClientRect();
            if (rect) {
              handleResizeStart(e, id, rect.width, rect.height);
            }
          }}
        >
          <svg 
            className="w-4 h-4 text-muted-foreground/50 hover:text-primary transition-colors"
            viewBox="0 0 16 16" 
            fill="currentColor"
          >
            <path d="M11 11V13H13V11H11ZM7 11V13H9V11H7ZM11 7V9H13V7H11ZM7 7V9H9V7H7ZM11 3V5H13V3H11Z" />
          </svg>
        </div>
      </div>
    );
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  const getAssignerName = (assignerId: string | null) => {
    if (!assignerId) return "System";
    const user = users.find((u: any) => u.id === assignerId);
    return user?.name || "Unknown";
  };

  const getDealName = (dealId: string | null) => {
    if (!dealId) return null;
    const deal = allDeals.find((d: any) => d.id === dealId);
    return deal?.name || null;
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: newStatus });
      toast.success(`Task marked as ${newStatus}`);
      setShowTaskDetailModal(false);
    } catch (error) {
      toast.error("Failed to update task status");
    }
  };

  // Filter tasks assigned to current user
  const myTasks = allTasks.filter((task: any) => task.assignedTo === currentUser?.id);
  const completedTasks = myTasks.filter((t: any) => t.status === 'Completed');
  
  // Task categorization for tabs
  const now = new Date();
  const activeTasks = myTasks.filter((t: any) => t.status === 'In Progress');
  const upcomingTasksAll = myTasks.filter((t: any) => {
    if (t.status === 'Completed') return false;
    const dueDate = new Date(t.dueDate);
    return dueDate > now;
  }).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const overdueTasks = myTasks.filter((t: any) => {
    if (t.status === 'Completed') return false;
    const dueDate = new Date(t.dueDate);
    return dueDate < now;
  });
  const pendingTasks = myTasks.filter((t: any) => t.status === 'Pending');
  const inProgressTasks = activeTasks;
  
  // Calculate task completion rate
  const taskCompletionRate = myTasks.length > 0 
    ? Math.round((completedTasks.length / myTasks.length) * 100) 
    : 0;
    
  // Background color classes
  const getBackgroundClass = () => {
    switch (bgColor) {
      case 'blue': return 'bg-blue-950/20';
      case 'purple': return 'bg-purple-950/20';
      case 'green': return 'bg-green-950/20';
      case 'orange': return 'bg-orange-950/20';
      case 'red': return 'bg-red-950/20';
      case 'pink': return 'bg-pink-950/20';
      case 'cyan': return 'bg-cyan-950/20';
      case 'amber': return 'bg-amber-950/20';
      case 'emerald': return 'bg-emerald-950/20';
      case 'indigo': return 'bg-indigo-950/20';
      case 'rose': return 'bg-rose-950/20';
      case 'slate': return 'bg-slate-800/30';
      default: return '';
    }
  };

  // Filter deals where user is on the pod team
  const myDeals = allDeals.filter((deal: any) => {
    if (!deal.podTeam || !Array.isArray(deal.podTeam)) return false;
    return deal.podTeam.some((member: PodTeamMember) => 
      (currentUser?.id && member.userId === currentUser.id) ||
      (currentUser?.email && member.email === currentUser.email) ||
      (currentUser?.name && member.name === currentUser.name)
    );
  });

  // Get upcoming tasks (due within next 7 days)
  const upcomingTasks = myTasks
    .filter((t: any) => t.status !== 'Completed')
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // Get unread notifications
  const unreadNotifications = notifications.filter((n: any) => !n.read).slice(0, 3);

  // Get today's meetings
  const todayMeetings = meetings.filter((m: any) => {
    const meetingDate = new Date(m.scheduledFor);
    return isToday(meetingDate);
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-400 bg-red-500/10';
      case 'Medium': return 'text-yellow-400 bg-yellow-500/10';
      case 'Low': return 'text-green-400 bg-green-500/10';
      default: return 'text-muted-foreground bg-secondary';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };
  
  const renderQuickStats = () => widgetSettings.showQuickStats && (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4" key="quickStats">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold mt-1">{activeTasks.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Upcoming</p>
              <p className="text-2xl font-bold mt-1">{upcomingTasksAll.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p>
              <p className="text-2xl font-bold mt-1 text-red-400">{overdueTasks.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold mt-1">{completedTasks.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">My Deals</p>
              <p className="text-2xl font-bold mt-1">{myDeals.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMyTasks = () => widgetSettings.showMyTasks && (
    <ResizableWidget id="myTasks" key="myTasks">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              My Tasks
            </CardTitle>
            <CardDescription>Your tasks organized by status</CardDescription>
          </div>
          <Link href="/employee/tasks">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="active" className="text-xs">
              Active ({activeTasks.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming ({upcomingTasksAll.length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs">
              Overdue ({overdueTasks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              Completed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <ScrollArea className="h-[200px]">
              {activeTasks.length > 0 ? (
                <div className="space-y-2">
                  {activeTasks.map((task: any) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group"
                      onClick={() => openTaskDetail(task)}
                      data-testid={`task-active-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDueDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No active tasks</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upcoming">
            <ScrollArea className="h-[200px]">
              {upcomingTasksAll.length > 0 ? (
                <div className="space-y-2">
                  {upcomingTasksAll.map((task: any) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group"
                      onClick={() => openTaskDetail(task)}
                      data-testid={`task-upcoming-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDueDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming tasks</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="overdue">
            <ScrollArea className="h-[200px]">
              {overdueTasks.length > 0 ? (
                <div className="space-y-2">
                  {overdueTasks.map((task: any) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer group"
                      onClick={() => openTaskDetail(task)}
                      data-testid={`task-overdue-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs text-red-400 bg-red-500/10">
                          Overdue
                        </Badge>
                        <span className="text-xs text-red-400">
                          {formatDueDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-green-500" />
                  <p>No overdue tasks</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="completed">
            <ScrollArea className="h-[200px]">
              {completedTasks.length > 0 ? (
                <div className="space-y-2">
                  {completedTasks.slice(0, 10).map((task: any) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg cursor-pointer group"
                      onClick={() => openTaskDetail(task)}
                      data-testid={`task-completed-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="font-medium text-sm line-through opacity-70">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      <Badge className="text-xs text-green-400 bg-green-500/10">
                        Completed
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No completed tasks yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Task Completion Rate</span>
            <span className="text-sm font-medium">{taskCompletionRate}%</span>
          </div>
          <Progress value={taskCompletionRate} className="h-2" />
        </div>
      </CardContent>
      </Card>
    </ResizableWidget>
  );

  const renderMyProjects = () => widgetSettings.showMyProjects && (
    <ResizableWidget id="myProjects" key="myProjects">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              My Projects
            </CardTitle>
            <CardDescription>Deals you're assigned to</CardDescription>
          </div>
          <Link href="/employee/deals">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
      <CardContent>
        {myDeals.length > 0 ? (
          <div className="space-y-3">
            {myDeals.slice(0, 4).map((deal: any) => (
              <div 
                key={deal.id} 
                className="p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{deal.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {deal.stage}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{deal.client}</span>
                  <span>${deal.value}M</span>
                </div>
                <Progress value={deal.progress || 0} className="h-1.5 mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No assigned projects</p>
          </div>
        )}
      </CardContent>
      </Card>
    </ResizableWidget>
  );

  const renderSchedule = () => widgetSettings.showSchedule && (
    <Card className="bg-card border-border" key="schedule">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Today's Schedule
        </CardTitle>
        <CardDescription>Your meetings and events for today</CardDescription>
      </CardHeader>
      <CardContent>
        {todayMeetings.length > 0 ? (
          <div className="space-y-3">
            {todayMeetings.map((meeting: any) => (
              <div 
                key={meeting.id} 
                className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {format(new Date(meeting.scheduledFor), 'HH:mm')}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.location || 'No location'} • {meeting.duration} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No meetings scheduled for today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderQuickActions = () => widgetSettings.showQuickActions && (
    <Card className="bg-card border-border" key="quickActions">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Frequently used features</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/employee/tasks">
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <CheckSquare className="w-5 h-5" />
              <span className="text-xs">View Tasks</span>
            </Button>
          </Link>
          <Link href="/employee/documents">
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs">Documents</span>
            </Button>
          </Link>
          <Link href="/employee/deals">
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <Briefcase className="w-5 h-5" />
              <span className="text-xs">My Deals</span>
            </Button>
          </Link>
          <Link href="/employee/chat">
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs">Messages</span>
            </Button>
          </Link>
        </div>

        {unreadNotifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Recent Notifications</p>
            <div className="space-y-2">
              {unreadNotifications.map((notification: any) => (
                <div key={notification.id} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const widgetRenderers: Record<WidgetId, () => React.ReactNode> = {
    quickStats: renderQuickStats,
    myTasks: renderMyTasks,
    myProjects: renderMyProjects,
    schedule: renderSchedule,
    quickActions: renderQuickActions,
  };

  // Analytics data preparation
  const tasksByStatus = [
    { status: 'Pending', count: pendingTasks.length, fill: 'hsl(var(--chart-1))' },
    { status: 'In Progress', count: inProgressTasks.length, fill: 'hsl(var(--chart-2))' },
    { status: 'Completed', count: completedTasks.length, fill: 'hsl(var(--chart-3))' },
    { status: 'Overdue', count: overdueTasks.length, fill: 'hsl(var(--chart-4))' },
  ];

  const tasksByPriority = [
    { priority: 'High', count: myTasks.filter((t: any) => t.priority === 'High').length, fill: 'hsl(var(--destructive))' },
    { priority: 'Medium', count: myTasks.filter((t: any) => t.priority === 'Medium').length, fill: 'hsl(var(--chart-5))' },
    { priority: 'Low', count: myTasks.filter((t: any) => t.priority === 'Low').length, fill: 'hsl(var(--chart-3))' },
  ];

  // Generate weekly activity data (last 7 days)
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStr = format(date, 'EEE');
    const completedOnDay = completedTasks.filter((t: any) => {
      const taskDate = new Date(t.updatedAt || t.dueDate);
      return format(taskDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    }).length;
    return { day: dayStr, completed: completedOnDay, assigned: Math.floor(Math.random() * 3) + 1 };
  });

  const dealProgress = myDeals.slice(0, 5).map((deal: any) => ({
    name: deal.name?.substring(0, 15) + (deal.name?.length > 15 ? '...' : ''),
    progress: deal.progress || 0,
    value: deal.dealValue ? deal.dealValue / 1000000 : 0,
  }));

  const chartConfig = {
    completed: { label: 'Completed', color: 'hsl(var(--chart-3))' },
    assigned: { label: 'Assigned', color: 'hsl(var(--chart-2))' },
    count: { label: 'Tasks', color: 'hsl(var(--chart-1))' },
    progress: { label: 'Progress', color: 'hsl(var(--chart-2))' },
    value: { label: 'Value (M)', color: 'hsl(var(--chart-4))' },
  };

  const renderAnalyticsView = () => (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Completion Rate</p>
                <p className="text-2xl font-bold">{taskCompletionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Completed</p>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Active Deals</p>
                <p className="text-2xl font-bold">{myDeals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Meetings Today</p>
                <p className="text-2xl font-bold">{todayMeetings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Weekly Activity
            </CardTitle>
            <CardDescription>Tasks completed over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart data={weeklyActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="completed" stroke="hsl(var(--chart-3))" fillOpacity={1} fill="url(#colorCompleted)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Tasks by Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              Tasks by Status
            </CardTitle>
            <CardDescription>Distribution of your current tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => count > 0 ? `${status}: ${count}` : ''}
                  labelLine={false}
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Priority */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Tasks by Priority
            </CardTitle>
            <CardDescription>Task breakdown by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={tasksByPriority} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="priority" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {tasksByPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Deal Progress */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Deal Progress
            </CardTitle>
            <CardDescription>Progress on your active deals</CardDescription>
          </CardHeader>
          <CardContent>
            {dealProgress.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={dealProgress} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={75} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="progress" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p>No active deals to display</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <Layout role="Employee" pageTitle="Home" userName={currentUser?.name || ""}>
      <div className={cn("space-y-6 min-h-full", getBackgroundClass())}>
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'User'}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's an overview of your work today. You have {pendingTasks.length + inProgressTasks.length} active tasks.
              </p>
            </div>
            <Popover open={showCustomizePopover} onOpenChange={setShowCustomizePopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  Customize
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-card border-border" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3">Background Color</h4>
                    <div className="grid grid-cols-7 gap-2">
                      <button
                        onClick={() => setBgColor('default')}
                        className={cn("w-8 h-8 rounded-full bg-background border-2 transition-all", bgColor === 'default' ? "border-primary ring-2 ring-primary/20" : "border-border")}
                        title="Default"
                      />
                      <button
                        onClick={() => setBgColor('blue')}
                        className={cn("w-8 h-8 rounded-full bg-blue-950/50 border-2 transition-all", bgColor === 'blue' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Blue"
                      />
                      <button
                        onClick={() => setBgColor('purple')}
                        className={cn("w-8 h-8 rounded-full bg-purple-950/50 border-2 transition-all", bgColor === 'purple' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Purple"
                      />
                      <button
                        onClick={() => setBgColor('green')}
                        className={cn("w-8 h-8 rounded-full bg-green-950/50 border-2 transition-all", bgColor === 'green' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Green"
                      />
                      <button
                        onClick={() => setBgColor('orange')}
                        className={cn("w-8 h-8 rounded-full bg-orange-950/50 border-2 transition-all", bgColor === 'orange' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Orange"
                      />
                      <button
                        onClick={() => setBgColor('red')}
                        className={cn("w-8 h-8 rounded-full bg-red-950/50 border-2 transition-all", bgColor === 'red' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Red"
                      />
                      <button
                        onClick={() => setBgColor('pink')}
                        className={cn("w-8 h-8 rounded-full bg-pink-950/50 border-2 transition-all", bgColor === 'pink' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Pink"
                      />
                      <button
                        onClick={() => setBgColor('cyan')}
                        className={cn("w-8 h-8 rounded-full bg-cyan-950/50 border-2 transition-all", bgColor === 'cyan' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Cyan"
                      />
                      <button
                        onClick={() => setBgColor('amber')}
                        className={cn("w-8 h-8 rounded-full bg-amber-950/50 border-2 transition-all", bgColor === 'amber' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Amber"
                      />
                      <button
                        onClick={() => setBgColor('emerald')}
                        className={cn("w-8 h-8 rounded-full bg-emerald-950/50 border-2 transition-all", bgColor === 'emerald' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Emerald"
                      />
                      <button
                        onClick={() => setBgColor('indigo')}
                        className={cn("w-8 h-8 rounded-full bg-indigo-950/50 border-2 transition-all", bgColor === 'indigo' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Indigo"
                      />
                      <button
                        onClick={() => setBgColor('rose')}
                        className={cn("w-8 h-8 rounded-full bg-rose-950/50 border-2 transition-all", bgColor === 'rose' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Rose"
                      />
                      <button
                        onClick={() => setBgColor('slate')}
                        className={cn("w-8 h-8 rounded-full bg-slate-700/50 border-2 transition-all", bgColor === 'slate' ? "border-primary ring-2 ring-primary/20" : "border-transparent")}
                        title="Slate"
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium text-sm mb-3">Widgets (drag to reorder)</h4>
                    <Reorder.Group 
                      axis="y" 
                      values={widgetOrder} 
                      onReorder={setWidgetOrder}
                      className="space-y-2"
                    >
                      {widgetOrder.map((widgetId) => {
                        const widgetLabels: Record<WidgetId, string> = {
                          quickStats: 'Quick Stats',
                          myTasks: 'My Tasks',
                          myProjects: 'My Projects',
                          schedule: "Today's Schedule",
                          quickActions: 'Quick Actions',
                        };
                        const settingsKey: Record<WidgetId, keyof typeof widgetSettings> = {
                          quickStats: 'showQuickStats',
                          myTasks: 'showMyTasks',
                          myProjects: 'showMyProjects',
                          schedule: 'showSchedule',
                          quickActions: 'showQuickActions',
                        };
                        return (
                          <Reorder.Item
                            key={widgetId}
                            value={widgetId}
                            className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                              <Label className="text-sm cursor-grab">{widgetLabels[widgetId]}</Label>
                            </div>
                            <Switch 
                              checked={widgetSettings[settingsKey[widgetId]]} 
                              onCheckedChange={(c) => setWidgetSettings((prev: typeof widgetSettings) => ({ ...prev, [settingsKey[widgetId]]: c }))} 
                            />
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'overview' | 'analytics')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <Target className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {/* Widgets rendered in custom order - drag enabled on canvas */}
            <Reorder.Group 
              axis="y" 
              values={widgetOrder} 
              onReorder={setWidgetOrder}
              className="space-y-6"
            >
              {widgetOrder.map((widgetId) => (
                <Reorder.Item
                  key={widgetId}
                  value={widgetId}
                  className="relative group"
                  whileDrag={{ scale: 1.02, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
                >
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
                    <div className="p-1.5 rounded-md bg-secondary/80 border border-border hover:bg-secondary">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {widgetRenderers[widgetId]()}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            {renderAnalyticsView()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Task Detail Modal */}
      <Dialog open={showTaskDetailModal} onOpenChange={setShowTaskDetailModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Task Details
            </DialogTitle>
            <DialogDescription>View and manage your task</DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                {/* Task Title & Status */}
                <div>
                  <h3 className="text-lg font-semibold">{selectedTask.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={cn(
                      selectedTask.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                      selectedTask.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {selectedTask.status}
                    </Badge>
                    <Badge className={cn("text-xs", getPriorityColor(selectedTask.priority))}>
                      {selectedTask.priority} Priority
                    </Badge>
                    <Badge variant="outline">{selectedTask.type}</Badge>
                  </div>
                </div>
                
                <Separator />
                
                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Due Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedTask.dueDate ? format(parseISO(selectedTask.dueDate), 'MMM d, yyyy') : 'No due date'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Assigned By</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{getAssignerName(selectedTask.assignedBy)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Related Deal */}
                {getDealName(selectedTask.dealId) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Related Deal</p>
                      <Link href="/employee/deals">
                        <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                          <Briefcase className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{getDealName(selectedTask.dealId)}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
                        </div>
                      </Link>
                    </div>
                  </>
                )}
                
                {/* Description */}
                {selectedTask.description && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                      <div className="p-3 bg-secondary/20 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Attachments */}
                {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Attachments</p>
                      <div className="space-y-2">
                        {selectedTask.attachments.map((attachment: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                          >
                            <Paperclip className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate flex-1">{attachment.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(attachment.size / 1024)}KB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTaskDetailModal(false)}>
              Close
            </Button>
            {selectedTask && selectedTask.status === 'Pending' && (
              <Button onClick={() => handleUpdateTaskStatus(selectedTask.id, 'In Progress')}>
                Start Task
              </Button>
            )}
            {selectedTask && selectedTask.status === 'In Progress' && (
              <Button onClick={() => handleUpdateTaskStatus(selectedTask.id, 'Completed')} className="bg-green-600 hover:bg-green-700">
                Mark Complete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
