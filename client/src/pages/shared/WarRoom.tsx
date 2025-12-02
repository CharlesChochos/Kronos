import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Users,
  TrendingUp,
  Activity,
  MessageSquare,
  FileText,
  Calendar,
  Zap,
  Shield,
  AlertCircle,
  Flag,
  ChevronRight,
  Briefcase
} from "lucide-react";
import { useCurrentUser, useDeals, useTasks, useUsers } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { toast } from "sonner";

type WarRoomProps = {
  role: 'CEO' | 'Employee';
};

export default function WarRoom({ role }: WarRoomProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  const { data: users = [] } = useUsers();
  
  const [selectedDeal, setSelectedDeal] = useState<string>("all");
  
  // Detail modals
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedDetailDeal, setSelectedDetailDeal] = useState<any>(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState<any>(null);
  
  // Flagging system - stored in localStorage
  const [flaggedItems, setFlaggedItems] = useState<{dealIds: string[], taskIds: string[]}>(() => {
    const saved = localStorage.getItem('warRoomFlags');
    return saved ? JSON.parse(saved) : { dealIds: [], taskIds: [] };
  });
  
  const toggleDealFlag = (dealId: string) => {
    setFlaggedItems(prev => {
      const newFlags = prev.dealIds.includes(dealId)
        ? { ...prev, dealIds: prev.dealIds.filter(id => id !== dealId) }
        : { ...prev, dealIds: [...prev.dealIds, dealId] };
      localStorage.setItem('warRoomFlags', JSON.stringify(newFlags));
      toast.success(prev.dealIds.includes(dealId) ? 'Deal unflagged' : 'Deal flagged for attention');
      return newFlags;
    });
  };
  
  const toggleTaskFlag = (taskId: string) => {
    setFlaggedItems(prev => {
      const newFlags = prev.taskIds.includes(taskId)
        ? { ...prev, taskIds: prev.taskIds.filter(id => id !== taskId) }
        : { ...prev, taskIds: [...prev.taskIds, taskId] };
      localStorage.setItem('warRoomFlags', JSON.stringify(newFlags));
      toast.success(prev.taskIds.includes(taskId) ? 'Task unflagged' : 'Task flagged for attention');
      return newFlags;
    });
  };
  
  const openDealDetail = (deal: any) => {
    setSelectedDetailDeal(deal);
    setShowDealDetail(true);
  };
  
  const openTaskDetail = (task: any) => {
    setSelectedDetailTask(task);
    setShowTaskDetail(true);
  };

  const criticalDeals = useMemo(() => {
    return deals.filter(d => {
      if (d.status !== 'Active') return false;
      const isHighValue = d.value >= 50;
      const isLateStage = ['Negotiation', 'Documentation', 'Closing'].includes(d.stage);
      const hasLowProgress = (d.progress || 0) < 50;
      return isHighValue || (isLateStage && hasLowProgress);
    });
  }, [deals]);

  const urgentTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'Completed') return false;
      const dueDate = new Date(t.dueDate);
      const daysUntilDue = differenceInDays(dueDate, new Date());
      return daysUntilDue <= 3 && daysUntilDue >= 0;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'Completed') return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < new Date();
    });
  }, [tasks]);

  const teamWorkload = useMemo(() => {
    return users.filter(u => u.role !== 'CEO').map(user => {
      const userTasks = tasks.filter(t => t.assignedTo === user.id && t.status !== 'Completed');
      const overdue = userTasks.filter(t => new Date(t.dueDate) < new Date());
      return {
        ...user,
        activeTasks: userTasks.length,
        overdueTasks: overdue.length,
        workloadLevel: userTasks.length > 8 ? 'high' : userTasks.length > 4 ? 'medium' : 'low',
      };
    }).sort((a, b) => b.activeTasks - a.activeTasks);
  }, [users, tasks]);

  const riskFlags = useMemo(() => {
    const flags: { type: string; severity: 'high' | 'medium' | 'low'; message: string; dealId?: string }[] = [];
    
    criticalDeals.forEach(deal => {
      if ((deal.progress || 0) < 30 && ['Due Diligence', 'Negotiation'].includes(deal.stage)) {
        flags.push({
          type: 'progress',
          severity: 'high',
          message: `${deal.name} has low progress (${deal.progress}%) in ${deal.stage}`,
          dealId: deal.id,
        });
      }
    });
    
    if (overdueTasks.length > 5) {
      flags.push({
        type: 'tasks',
        severity: 'high',
        message: `${overdueTasks.length} tasks are overdue across the team`,
      });
    }
    
    teamWorkload.forEach(member => {
      if (member.workloadLevel === 'high') {
        flags.push({
          type: 'workload',
          severity: 'medium',
          message: `${member.name} has high workload (${member.activeTasks} active tasks)`,
        });
      }
    });
    
    return flags;
  }, [criticalDeals, overdueTasks, teamWorkload]);

  const filteredDeals = selectedDeal === 'all' 
    ? criticalDeals 
    : criticalDeals.filter(d => d.id === selectedDeal);

  const recentActivity = [
    { type: 'task', user: 'Sarah Johnson', action: 'completed task', target: 'Due Diligence Review', time: '2 hours ago' },
    { type: 'deal', user: 'Michael Chen', action: 'updated', target: 'TechCorp Acquisition', time: '3 hours ago' },
    { type: 'message', user: 'Emily Davis', action: 'sent message', target: 'Deal Team Alpha', time: '4 hours ago' },
    { type: 'document', user: 'James Wilson', action: 'uploaded', target: 'Term Sheet v3.pdf', time: '5 hours ago' },
  ];

  return (
    <Layout role={role} pageTitle="War Room" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              War Room
            </h1>
            <p className="text-muted-foreground">Real-time situation awareness for critical deals</p>
          </div>
          <Select value={selectedDeal} onValueChange={setSelectedDeal}>
            <SelectTrigger className="w-48" data-testid="select-deal-filter">
              <SelectValue placeholder="Filter by deal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Critical Deals</SelectItem>
              {criticalDeals.map(deal => (
                <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Risk Flags */}
        {riskFlags.length > 0 && (
          <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                Active Risk Flags ({riskFlags.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskFlags.map((flag, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border",
                      flag.severity === 'high' && "bg-red-500/10 border-red-500/30",
                      flag.severity === 'medium' && "bg-yellow-500/10 border-yellow-500/30",
                      flag.severity === 'low' && "bg-blue-500/10 border-blue-500/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className={cn(
                        "w-4 h-4",
                        flag.severity === 'high' && "text-red-500",
                        flag.severity === 'medium' && "text-yellow-500",
                        flag.severity === 'low' && "text-blue-500"
                      )} />
                      <Badge variant="secondary" className="text-xs capitalize">{flag.severity}</Badge>
                    </div>
                    <p className="text-sm mt-2">{flag.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Critical Deals */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Critical Deals ({filteredDeals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {filteredDeals.map(deal => (
                    <div 
                      key={deal.id} 
                      className={cn(
                        "p-4 rounded-lg border transition-colors cursor-pointer group",
                        flaggedItems.dealIds.includes(deal.id) 
                          ? "border-orange-500/50 bg-orange-500/5" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => openDealDetail(deal)}
                      data-testid={`deal-card-${deal.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDealFlag(deal.id); }}
                            className={cn(
                              "mt-1 p-1 rounded hover:bg-secondary/50 transition-colors",
                              flaggedItems.dealIds.includes(deal.id) ? "text-orange-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                            )}
                            data-testid={`flag-deal-${deal.id}`}
                          >
                            <Flag className="w-4 h-4" fill={flaggedItems.dealIds.includes(deal.id) ? "currentColor" : "none"} />
                          </button>
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {deal.name}
                              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h4>
                            <p className="text-sm text-muted-foreground">{deal.client} • {deal.sector}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${deal.value}M</p>
                          <Badge variant="secondary">{deal.stage}</Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className={cn(
                            "font-medium",
                            (deal.progress || 0) < 30 && "text-red-500",
                            (deal.progress || 0) >= 30 && (deal.progress || 0) < 70 && "text-yellow-500",
                            (deal.progress || 0) >= 70 && "text-green-500"
                          )}>{deal.progress || 0}%</span>
                        </div>
                        <Progress value={deal.progress || 0} className="h-2" />
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {deal.podTeam?.length || 0} team members
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {tasks.filter(t => t.dealId === deal.id && t.status !== 'Completed').length} pending tasks
                        </span>
                      </div>
                    </div>
                  ))}
                  {filteredDeals.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No critical deals requiring attention</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Urgent Tasks */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Urgent Tasks ({urgentTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {urgentTasks.slice(0, 5).map(task => {
                      const daysLeft = differenceInDays(new Date(task.dueDate), new Date());
                      const hoursLeft = differenceInHours(new Date(task.dueDate), new Date());
                      return (
                        <div 
                          key={task.id} 
                          className={cn(
                            "p-2 rounded border cursor-pointer group transition-colors",
                            flaggedItems.taskIds.includes(task.id)
                              ? "border-orange-500/50 bg-orange-500/5"
                              : "border-border hover:bg-secondary/50"
                          )}
                          onClick={() => openTaskDetail(task)}
                          data-testid={`urgent-task-${task.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTaskFlag(task.id); }}
                              className={cn(
                                "p-0.5 rounded hover:bg-secondary/50 transition-colors",
                                flaggedItems.taskIds.includes(task.id) ? "text-orange-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                              )}
                              data-testid={`flag-task-${task.id}`}
                            >
                              <Flag className="w-3 h-3" fill={flaggedItems.taskIds.includes(task.id) ? "currentColor" : "none"} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <div className="flex items-center justify-between mt-1">
                                <Badge variant={task.priority === 'High' ? 'destructive' : 'secondary'} className="text-xs">
                                  {task.priority}
                                </Badge>
                                <span className="text-xs text-orange-500">
                                  {daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {urgentTasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No urgent tasks</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Overdue Tasks */}
            <Card className="bg-red-500/5 border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Overdue ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 5).map(task => (
                      <div 
                        key={task.id} 
                        className={cn(
                          "p-2 rounded border cursor-pointer group transition-colors",
                          flaggedItems.taskIds.includes(task.id)
                            ? "border-orange-500/50 bg-orange-500/10"
                            : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                        )}
                        onClick={() => openTaskDetail(task)}
                        data-testid={`overdue-task-${task.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTaskFlag(task.id); }}
                            className={cn(
                              "p-0.5 rounded hover:bg-secondary/50 transition-colors",
                              flaggedItems.taskIds.includes(task.id) ? "text-orange-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                            )}
                            data-testid={`flag-overdue-task-${task.id}`}
                          >
                            <Flag className="w-3 h-3" fill={flaggedItems.taskIds.includes(task.id) ? "currentColor" : "none"} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-red-500 mt-1">
                              Due: {format(new Date(task.dueDate), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {overdueTasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No overdue tasks</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Team Workload & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Workload */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Team Workload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamWorkload.slice(0, 6).map(member => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <Badge variant={
                          member.workloadLevel === 'high' ? 'destructive' :
                          member.workloadLevel === 'medium' ? 'default' : 'secondary'
                        } className="text-xs">
                          {member.activeTasks} tasks
                        </Badge>
                      </div>
                      <Progress 
                        value={Math.min(member.activeTasks * 10, 100)} 
                        className={cn(
                          "h-1.5 mt-1",
                          member.workloadLevel === 'high' && "[&>div]:bg-red-500"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/50">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        activity.type === 'task' && "bg-green-500/20 text-green-500",
                        activity.type === 'deal' && "bg-blue-500/20 text-blue-500",
                        activity.type === 'message' && "bg-purple-500/20 text-purple-500",
                        activity.type === 'document' && "bg-orange-500/20 text-orange-500"
                      )}>
                        {activity.type === 'task' && <CheckCircle className="w-4 h-4" />}
                        {activity.type === 'deal' && <Target className="w-4 h-4" />}
                        {activity.type === 'message' && <MessageSquare className="w-4 h-4" />}
                        {activity.type === 'document' && <FileText className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user}</span>
                          {' '}{activity.action}{' '}
                          <span className="text-primary">{activity.target}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Deal Detail Modal */}
      <Dialog open={showDealDetail} onOpenChange={setShowDealDetail}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              {selectedDetailDeal?.name}
            </DialogTitle>
            <DialogDescription>{selectedDetailDeal?.client} • {selectedDetailDeal?.sector}</DialogDescription>
          </DialogHeader>
          
          {selectedDetailDeal && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">${selectedDetailDeal.value}M</p>
                  <p className="text-xs text-muted-foreground">Deal Value</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{selectedDetailDeal.progress || 0}%</p>
                  <p className="text-xs text-muted-foreground">Progress</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-center">
                  <Badge variant="secondary" className="text-lg">{selectedDetailDeal.stage}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">Current Stage</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm">{selectedDetailDeal.description || 'No description available'}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Related Tasks</h4>
                <div className="space-y-2">
                  {tasks.filter(t => t.dealId === selectedDetailDeal.id).slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className={cn(
                          "w-4 h-4",
                          task.status === 'Completed' ? 'text-green-500' : 'text-muted-foreground'
                        )} />
                        <span className="text-sm">{task.title}</span>
                      </div>
                      <Badge variant={task.status === 'Completed' ? 'default' : 'secondary'} className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                  {tasks.filter(t => t.dealId === selectedDetailDeal.id).length === 0 && (
                    <p className="text-sm text-muted-foreground">No tasks assigned to this deal</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant={flaggedItems.dealIds.includes(selectedDetailDeal.id) ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => toggleDealFlag(selectedDetailDeal.id)}
                >
                  <Flag className="w-4 h-4 mr-2" fill={flaggedItems.dealIds.includes(selectedDetailDeal.id) ? "currentColor" : "none"} />
                  {flaggedItems.dealIds.includes(selectedDetailDeal.id) ? 'Flagged' : 'Flag for Attention'}
                </Button>
                <Button variant="outline" onClick={() => setShowDealDetail(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Task Detail Modal */}
      <Dialog open={showTaskDetail} onOpenChange={setShowTaskDetail}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {selectedDetailTask?.title}
            </DialogTitle>
            <DialogDescription>Task Details</DialogDescription>
          </DialogHeader>
          
          {selectedDetailTask && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge variant={selectedDetailTask.priority === 'High' ? 'destructive' : 'secondary'} className="mt-1">
                    {selectedDetailTask.priority}
                  </Badge>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedDetailTask.status === 'Completed' ? 'default' : 'secondary'} className="mt-1">
                    {selectedDetailTask.status}
                  </Badge>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium mt-1">{format(new Date(selectedDetailTask.dueDate), 'MMM d, yyyy')}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Assigned To</p>
                  <p className="text-sm font-medium mt-1">
                    {users.find(u => u.id === selectedDetailTask.assignedTo)?.name || 'Unassigned'}
                  </p>
                </div>
              </div>
              
              {selectedDetailTask.dealId && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Related Deal</p>
                  <div className="p-2 bg-secondary/30 rounded-lg">
                    <p className="text-sm font-medium">{deals.find(d => d.id === selectedDetailTask.dealId)?.name || 'Unknown Deal'}</p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant={flaggedItems.taskIds.includes(selectedDetailTask.id) ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => toggleTaskFlag(selectedDetailTask.id)}
                >
                  <Flag className="w-4 h-4 mr-2" fill={flaggedItems.taskIds.includes(selectedDetailTask.id) ? "currentColor" : "none"} />
                  {flaggedItems.taskIds.includes(selectedDetailTask.id) ? 'Flagged' : 'Flag for Attention'}
                </Button>
                <Button variant="outline" onClick={() => setShowTaskDetail(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
