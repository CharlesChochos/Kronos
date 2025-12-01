import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  FileText, 
  MessageSquare, 
  BarChart,
  Check
} from "lucide-react";
import { useCurrentUser, useTasks, useDeals, useUpdateTask } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@shared/schema";

export default function MyTasks() {
  const { data: currentUser } = useCurrentUser();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: deals = [] } = useDeals();
  const updateTask = useUpdateTask();
  
  const myTasks = currentUser ? allTasks.filter(t => t.assignedTo === currentUser.id) : [];
  const pendingTasks = myTasks.filter(t => t.status === 'Pending');
  const inProgressTasks = myTasks.filter(t => t.status === 'In Progress');
  const completedTasks = myTasks.filter(t => t.status === 'Completed');
  const highPriorityTasks = myTasks.filter(t => t.priority === 'High' && t.status !== 'Completed');

  const getTaskWithDealName = (task: Task) => {
    const deal = deals.find(d => d.id === task.dealId);
    return { ...task, dealName: deal?.name || 'No Deal' };
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'Completed' });
      toast.success("Task marked as completed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'In Progress' });
      toast.success("Task started!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  if (isLoading) {
    return (
      <Layout role="Employee" pageTitle="My Tasks" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading tasks...</div>
        </div>
      </Layout>
    );
  }

  const todayTasks = [...pendingTasks, ...inProgressTasks].slice(0, 4);
  const upcomingTasks = pendingTasks.slice(4);

  return (
    <Layout role="Employee" pageTitle="My Tasks" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold" data-testid="stat-pending">{pendingTasks.length + inProgressTasks.length}</div>
                        <div className="text-xs text-muted-foreground">Pending Tasks</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold" data-testid="stat-high-priority">{highPriorityTasks.length}</div>
                        <div className="text-xs text-muted-foreground">High Priority</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                        <Check className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold" data-testid="stat-completed">{completedTasks.length}</div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
                        <BarChart className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold" data-testid="stat-score">{currentUser?.score || 0}</div>
                        <div className="text-xs text-muted-foreground">Efficiency Score</div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Task Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Today / In Progress */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Tasks</h3>
                    <Badge variant="secondary" className="text-xs">{todayTasks.length}</Badge>
                </div>
                
                {todayTasks.length === 0 ? (
                  <Card className="bg-card/50 border-border border-dashed">
                    <CardContent className="p-4 text-center text-muted-foreground text-sm">
                      No active tasks
                    </CardContent>
                  </Card>
                ) : (
                  todayTasks.map((task) => {
                    const taskWithDeal = getTaskWithDealName(task);
                    return (
                      <Card key={task.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group" data-testid={`card-task-${task.id}`}>
                          <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                  <Badge variant="outline" className={cn(
                                      "text-[10px] px-1.5 py-0.5 h-5",
                                      task.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                      task.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                      "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                  )}>
                                      {task.priority}
                                  </Badge>
                                  <div className="flex gap-1">
                                    {task.status === 'Pending' && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleStartTask(task.id)}
                                        data-testid={`button-start-${task.id}`}
                                      >
                                        <Clock className="w-4 h-4 text-blue-500" />
                                      </Button>
                                    )}
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleCompleteTask(task.id)}
                                      data-testid={`button-complete-${task.id}`}
                                    >
                                        <Check className="w-4 h-4 text-green-500" />
                                    </Button>
                                  </div>
                              </div>
                              
                              <div>
                                  <h4 className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">{taskWithDeal.dealName}</p>
                              </div>
                              
                              <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                  {task.type === 'Document' && <FileText className="w-3 h-3" />}
                                  {task.type === 'Meeting' && <Calendar className="w-3 h-3" />}
                                  {task.type === 'Analysis' && <BarChart className="w-3 h-3" />}
                                  {task.type === 'Review' && <MessageSquare className="w-3 h-3" />}
                                  <span>{task.type}</span>
                                  <Badge variant={task.status === 'In Progress' ? 'default' : 'secondary'} className="ml-auto text-[10px]">
                                    {task.status}
                                  </Badge>
                              </div>
                          </CardContent>
                      </Card>
                    );
                  })
                )}
            </div>

            {/* Column 2: Upcoming */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</h3>
                    <Badge variant="secondary" className="text-xs">{upcomingTasks.length}</Badge>
                </div>
                
                {upcomingTasks.length === 0 ? (
                  <Card className="bg-card/50 border-border border-dashed">
                    <CardContent className="p-4 text-center text-muted-foreground text-sm">
                      No upcoming tasks
                    </CardContent>
                  </Card>
                ) : (
                  upcomingTasks.map((task) => {
                    const taskWithDeal = getTaskWithDealName(task);
                    return (
                      <Card key={task.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group opacity-80 hover:opacity-100">
                          <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-secondary text-muted-foreground border-border">
                                      {task.priority}
                                  </Badge>
                              </div>
                              
                              <div>
                                  <h4 className="font-medium text-sm">{task.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">{taskWithDeal.dealName}</p>
                              </div>
                              
                              <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>Due: {task.dueDate}</span>
                              </div>
                          </CardContent>
                      </Card>
                    );
                  })
                )}
            </div>

            {/* Column 3: Completed */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</h3>
                    <Badge variant="secondary" className="text-xs">{completedTasks.length}</Badge>
                </div>
                
                {completedTasks.length === 0 ? (
                  <Card className="bg-card/50 border-border border-dashed">
                    <CardContent className="p-4 text-center text-muted-foreground text-sm">
                      No completed tasks yet
                    </CardContent>
                  </Card>
                ) : (
                  completedTasks.map((task) => {
                    const taskWithDeal = getTaskWithDealName(task);
                    return (
                      <Card key={task.id} className="bg-card/50 border-border border-dashed">
                          <CardContent className="p-4 space-y-3 opacity-60">
                               <div className="flex justify-between items-start">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-green-500/10 text-green-500 border-green-500/20">
                                          Done
                                      </Badge>
                                  </div>
                                  
                                  <div>
                                      <h4 className="font-medium text-sm line-through">{task.title}</h4>
                                      <p className="text-xs text-muted-foreground mt-1">{taskWithDeal.dealName}</p>
                                  </div>
                          </CardContent>
                      </Card>
                    );
                  })
                )}
            </div>
            
        </div>
      </div>
    </Layout>
  );
}
