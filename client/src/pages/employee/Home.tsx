import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  MessageSquare
} from "lucide-react";
import { useCurrentUser, useTasks, useDeals, useMeetings, useNotifications, useUsers, useUpdateTask } from "@/lib/api";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { toast } from "sonner";
import type { PodTeamMember, Task } from "@shared/schema";

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
  const pendingTasks = myTasks.filter((t: any) => t.status === 'Pending');
  const inProgressTasks = myTasks.filter((t: any) => t.status === 'In Progress');
  const completedTasks = myTasks.filter((t: any) => t.status === 'Completed');
  
  // Calculate task completion rate
  const taskCompletionRate = myTasks.length > 0 
    ? Math.round((completedTasks.length / myTasks.length) * 100) 
    : 0;

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

  return (
    <Layout role="Employee" pageTitle="Home" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
          <h1 className="text-2xl font-bold">
            {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your work today. You have {pendingTasks.length + inProgressTasks.length} active tasks.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Tasks</p>
                  <p className="text-2xl font-bold mt-1">{pendingTasks.length}</p>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
                  <p className="text-2xl font-bold mt-1">{inProgressTasks.length}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tasks Overview */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  My Tasks
                </CardTitle>
                <CardDescription>Your upcoming and active tasks</CardDescription>
              </div>
              <Link href="/employee/tasks">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTasks.map((task: any) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group"
                      onClick={() => openTaskDetail(task)}
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          task.status === 'In Progress' ? 'bg-blue-500' : 'bg-yellow-500'
                        )} />
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDueDate(task.dueDate)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No pending tasks</p>
                </div>
              )}

              {/* Task Progress */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Task Completion Rate</span>
                  <span className="text-sm font-medium">{taskCompletionRate}%</span>
                </div>
                <Progress value={taskCompletionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* My Projects (Deals) */}
          <Card className="bg-card border-border">
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
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <Card className="bg-card border-border">
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

          {/* Quick Actions & Notifications */}
          <Card className="bg-card border-border">
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
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-xs">Messages</span>
                  </Button>
                </Link>
              </div>

              {/* Recent Notifications */}
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
        </div>
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
