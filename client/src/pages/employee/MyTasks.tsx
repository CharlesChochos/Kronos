import { useState, useEffect, useRef, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  FileText, 
  MessageSquare, 
  BarChart,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Send,
  Sparkles,
  User,
  Briefcase,
  Paperclip,
  ExternalLink,
  X,
  Loader2,
  Brain,
  Flag,
  Plus
} from "lucide-react";
import { useCurrentUser, useTasks, useDeals, useUpdateTask, useCreateTask, useUsers, apiRequest, useUserPreferences, useSaveUserPreferences } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO, isToday, isBefore, addDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import type { Task, Deal } from "@shared/schema";

type SwipeDirection = 'left' | 'right' | 'up' | null;

export default function MyTasks() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: deals = [] } = useDeals();
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    dueDate: '',
    dealId: '',
    type: 'General' as 'General' | 'Document Review' | 'Due Diligence' | 'Client Communication' | 'Financial Analysis' | 'Legal' | 'Compliance'
  });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [forwardToUser, setForwardToUser] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{action: string, reasoning: string, tools: string[]} | null>(null);
  const [deferredTasks, setDeferredTasks] = useState<string[]>([]);
  
  // Flagged tasks - persisted to user_preferences.settings.flaggedTasks
  const [flaggedTasks, setFlaggedTasks] = useState<Record<string, string>>({});
  const [flaggedTasksInitialized, setFlaggedTasksInitialized] = useState(false);
  const prevFlaggedRef = useRef<string | null>(null);
  
  // Load flagged tasks from user preferences
  useEffect(() => {
    if (!prefsLoading && !flaggedTasksInitialized) {
      const savedFlagged = (userPrefs?.settings as any)?.flaggedTasks;
      if (savedFlagged && typeof savedFlagged === 'object') {
        setFlaggedTasks(savedFlagged);
      }
      setFlaggedTasksInitialized(true);
    }
  }, [prefsLoading, userPrefs, flaggedTasksInitialized]);
  
  // Flag note dialog state
  const [showFlagNoteDialog, setShowFlagNoteDialog] = useState(false);
  const [flagNoteTaskId, setFlagNoteTaskId] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState("");
  
  const openFlagDialog = (taskId: string) => {
    if (flaggedTasks[taskId]) {
      unflagTask(taskId);
    } else {
      setFlagNoteTaskId(taskId);
      setFlagNote("");
      setShowFlagNoteDialog(true);
    }
  };
  
  const saveFlaggedTasksToDb = (newFlaggedTasks: Record<string, string>) => {
    const freshPrefs = queryClient.getQueryData<UserPreferences>(['userPreferences']) || userPrefs;
    const { id, userId, updatedAt, ...mutablePrefs } = (freshPrefs || {}) as any;
    const existingSettings = (freshPrefs?.settings as any) || {};
    saveUserPrefs.mutate({
      ...mutablePrefs,
      settings: {
        ...existingSettings,
        flaggedTasks: newFlaggedTasks,
      },
    });
  };
  
  const unflagTask = (taskId: string) => {
    const newFlaggedTasks = { ...flaggedTasks };
    delete newFlaggedTasks[taskId];
    setFlaggedTasks(newFlaggedTasks);
    saveFlaggedTasksToDb(newFlaggedTasks);
    toast.info("Task unflagged");
  };
  
  const confirmFlag = async () => {
    if (!flagNoteTaskId) return;
    
    const newFlaggedTasks = { ...flaggedTasks, [flagNoteTaskId]: flagNote };
    setFlaggedTasks(newFlaggedTasks);
    saveFlaggedTasksToDb(newFlaggedTasks);
    
    const task = myTasks.find(t => t.id === flagNoteTaskId);
    if (task && task.dealId) {
      const deal = getDeal(task.dealId);
      if (deal) {
        try {
          const result = await apiRequest('POST', '/api/notifications/flag', {
            taskId: flagNoteTaskId,
            taskTitle: task.title,
            dealId: deal.id,
            dealName: deal.name,
            flaggedBy: currentUser?.name || 'Team member',
            flagNote: flagNote || undefined,
          });
          const data = await result.json();
          if (data.notifiedCount > 0) {
            toast.success(`Task flagged! ${data.notifiedCount} pod team member(s) notified.`);
          } else {
            toast.success("Task flagged!");
          }
        } catch (error) {
          toast.error("Task flagged but failed to notify team. Please try again.");
        }
      } else {
        toast.success("Task flagged!");
      }
    } else {
      toast.success("Task flagged!");
    }
    
    setShowFlagNoteDialog(false);
    setFlagNoteTaskId(null);
    setFlagNote("");
  };
  
  const toggleTaskFlag = (taskId: string) => {
    openFlagDialog(taskId);
  };
  
  const taskRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  useEffect(() => {
    if (searchString && allTasks.length > 0) {
      const params = new URLSearchParams(searchString);
      const taskId = params.get('id');
      if (taskId) {
        setHighlightedTaskId(taskId);
        setTimeout(() => {
          const element = taskRefs.current[taskId];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        setTimeout(() => setHighlightedTaskId(null), 3000);
      }
    }
  }, [searchString, allTasks]);
  
  const myTasks = currentUser ? allTasks.filter(t => t.assignedTo === currentUser.id) : [];
  
  const getDealName = (dealId: string | null) => {
    const deal = deals.find(d => d.id === dealId);
    return deal?.name || 'No Deal';
  };

  const getDeal = (dealId: string | null): Deal | null => {
    return deals.find(d => d.id === dealId) || null;
  };

  const isDateWithinThisWeek = (dateStr: string | null) => {
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });
    return isWithinInterval(date, { start: weekStart, end: weekEnd }) && !isToday(date);
  };

  const dueTodayTasks = myTasks.filter(t => 
    t.status !== 'Completed' && t.dueDate && isToday(parseISO(t.dueDate))
  );
  
  const dueNextWeekTasks = myTasks.filter(t => 
    t.status !== 'Completed' && t.dueDate && isDateWithinThisWeek(t.dueDate)
  );
  
  const dueLaterTasks = myTasks.filter(t => {
    if (t.status === 'Completed') return false;
    if (!t.dueDate) return true;
    const dueDate = parseISO(t.dueDate);
    return !isToday(dueDate) && !isDateWithinThisWeek(t.dueDate);
  });
  
  const completedTasks = myTasks.filter(t => t.status === 'Completed');

  const swipeableTasks = useMemo(() => {
    const todayNonDeferred = dueTodayTasks.filter(t => !deferredTasks.includes(t.id));
    const todayDeferred = dueTodayTasks.filter(t => deferredTasks.includes(t.id));
    return [...todayNonDeferred, ...todayDeferred];
  }, [dueTodayTasks, deferredTasks]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { tasks: [], deals: [] };
    const query = searchQuery.toLowerCase();
    const matchedTasks = myTasks.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description?.toLowerCase().includes(query)
    );
    const matchedDeals = deals.filter(d => 
      d.name.toLowerCase().includes(query) || 
      d.client.toLowerCase().includes(query)
    );
    return { tasks: matchedTasks, deals: matchedDeals };
  }, [searchQuery, myTasks, deals]);

  const handleSwipe = async (direction: SwipeDirection, task: Task) => {
    if (direction === 'right') {
      setDeferredTasks(prev => [...prev, task.id]);
      toast.info("Task deferred to later");
      setCurrentSwipeIndex(prev => Math.min(prev + 1, swipeableTasks.length - 1));
    } else if (direction === 'left') {
      setSelectedTask(task);
      setShowForwardModal(true);
    } else if (direction === 'up') {
      setSelectedTask(task);
      setShowAIModal(true);
      analyzeTaskWithAI(task);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'Completed' });
      toast.success("Task marked as completed!");
      setShowTaskDetailModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  const handleForwardTask = async () => {
    if (!selectedTask || !forwardToUser) {
      toast.error("Please select a team member");
      return;
    }
    try {
      await updateTask.mutateAsync({ 
        id: selectedTask.id, 
        assignedTo: forwardToUser,
        status: 'Pending'
      });
      toast.success("Task forwarded successfully!");
      setShowForwardModal(false);
      setForwardToUser("");
      setSelectedTask(null);
      setCurrentSwipeIndex(prev => Math.min(prev + 1, swipeableTasks.length - 1));
    } catch (error: any) {
      toast.error(error.message || "Failed to forward task");
    }
  };

  const analyzeTaskWithAI = async (task: Task) => {
    setIsAnalyzing(true);
    setAiSuggestion(null);
    
    try {
      const deal = getDeal(task.dealId);
      const response = await fetch('/api/ai/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: {
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
          },
          deal: deal ? {
            name: deal.name,
            client: deal.client,
            sector: deal.sector,
            stage: deal.stage,
          } : null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze task');
      }
      
      const data = await response.json();
      setAiSuggestion(data);
    } catch (error: any) {
      toast.error("Failed to analyze task with AI");
      setAiSuggestion({
        action: "Manual Analysis Required",
        reasoning: "Unable to get AI suggestions at this time. Please analyze the task manually.",
        tools: ["Document Editor", "Email Client", "Calendar"]
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSearchSelect = (type: 'task' | 'deal', id: string) => {
    setShowSearchResults(false);
    setSearchQuery("");
    if (type === 'task') {
      const task = myTasks.find(t => t.id === id);
      if (task) {
        setSelectedTask(task);
        setShowTaskDetailModal(true);
      }
    } else {
      setLocation(`/employee/deals?id=${id}`);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskForm.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    
    try {
      const taskData: any = {
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim() || null,
        priority: newTaskForm.priority,
        status: 'Pending',
        type: newTaskForm.type,
        assignedTo: currentUser?.id || '',
      };
      if (newTaskForm.dueDate) {
        taskData.dueDate = newTaskForm.dueDate;
      }
      if (newTaskForm.dealId) {
        taskData.dealId = newTaskForm.dealId;
        const selectedDeal = deals.find(d => d.id === newTaskForm.dealId);
        if (selectedDeal) {
          taskData.dealStage = selectedDeal.stage;
        }
      }
      await createTask.mutateAsync(taskData);
      
      toast.success("Task created successfully!");
      setShowCreateTaskModal(false);
      setNewTaskForm({
        title: '',
        description: '',
        priority: 'Medium',
        dueDate: '',
        dealId: '',
        type: 'General'
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
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

  const currentTask = swipeableTasks[currentSwipeIndex];

  return (
    <Layout role="Employee" pageTitle="My Tasks" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search tasks, deals, or projects..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(e.target.value.length > 0);
            }}
            onFocus={() => setShowSearchResults(searchQuery.length > 0)}
            className="pl-10 h-12 bg-card border-border text-lg"
            data-testid="input-task-search"
          />
          {showSearchResults && (searchResults.tasks.length > 0 || searchResults.deals.length > 0) && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-card border border-border rounded-lg shadow-xl max-h-[400px] overflow-y-auto">
              {searchResults.tasks.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/50">
                    Tasks
                  </div>
                  {searchResults.tasks.map(task => (
                    <div
                      key={task.id}
                      className="px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-b-0"
                      onClick={() => handleSearchSelect('task', task.id)}
                      data-testid={`search-result-task-${task.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <div>
                          <div className="font-medium text-sm">{task.title}</div>
                          <div className="text-xs text-muted-foreground">{getDealName(task.dealId)} • {task.status}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {searchResults.deals.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/50">
                    Deals / Projects
                  </div>
                  {searchResults.deals.map(deal => (
                    <div
                      key={deal.id}
                      className="px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-b-0"
                      onClick={() => handleSearchSelect('deal', deal.id)}
                      data-testid={`search-result-deal-${deal.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4 text-accent" />
                        <div>
                          <div className="font-medium text-sm">{deal.name}</div>
                          <div className="text-xs text-muted-foreground">{deal.client} • {deal.stage}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {searchResults.tasks.length === 0 && searchResults.deals.length === 0 && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-today">{dueTodayTasks.length}</div>
                <div className="text-xs text-muted-foreground">Due Today</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-week">{dueNextWeekTasks.length}</div>
                <div className="text-xs text-muted-foreground">Due This Week</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-later">{dueLaterTasks.length}</div>
                <div className="text-xs text-muted-foreground">Due Later</div>
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
        </div>

        {/* Swipeable Task Section */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Today's Focus
              </CardTitle>
              <div className="flex items-center gap-3">
                <Button 
                  size="sm" 
                  onClick={() => setShowCreateTaskModal(true)}
                  data-testid="button-create-task"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Task
                </Button>
                <div className="text-sm text-muted-foreground">
                  {currentSwipeIndex + 1} / {swipeableTasks.length}
                </div>
              </div>
            </div>
            <CardDescription className="text-xs">
              Swipe right to defer • Swipe up for AI assist • Swipe left to forward • Click for details
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {swipeableTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Check className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No tasks due today</p>
              </div>
            ) : (
              <div className="relative h-[300px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {currentTask && (
                    <SwipeableTaskCard
                      key={currentTask.id}
                      task={currentTask}
                      dealName={getDealName(currentTask.dealId)}
                      onSwipe={(direction) => handleSwipe(direction, currentTask)}
                      onClick={() => handleTaskClick(currentTask)}
                    />
                  )}
                </AnimatePresence>
                
                {/* Swipe indicators */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-green-500 opacity-30">
                  <div className="flex flex-col items-center gap-1">
                    <ChevronRight className="w-8 h-8" />
                    <span className="text-xs">Defer</span>
                  </div>
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-500 opacity-30">
                  <div className="flex flex-col items-center gap-1">
                    <ChevronLeft className="w-8 h-8" />
                    <span className="text-xs">Forward</span>
                  </div>
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 text-purple-500 opacity-30">
                  <div className="flex flex-col items-center gap-1">
                    <ArrowUp className="w-8 h-8" />
                    <span className="text-xs">AI Assist</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Due Today */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Due Today
              </h3>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">{dueTodayTasks.length}</Badge>
            </div>
            <ScrollArea className="h-[400px] pr-2">
              {dueTodayTasks.length === 0 ? (
                <Card className="bg-card/50 border-border border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    No tasks due today
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {dueTodayTasks.map((task) => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      dealName={getDealName(task.dealId)}
                      onClick={() => handleTaskClick(task)}
                      highlighted={highlightedTaskId === task.id}
                      isFlagged={!!flaggedTasks[task.id]}
                      onFlag={(e) => { e.stopPropagation(); toggleTaskFlag(task.id); }}
                      ref={(el) => { taskRefs.current[task.id] = el; }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Due This Week */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Due This Week
              </h3>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{dueNextWeekTasks.length}</Badge>
            </div>
            <ScrollArea className="h-[400px] pr-2">
              {dueNextWeekTasks.length === 0 ? (
                <Card className="bg-card/50 border-border border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    No tasks due this week
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {dueNextWeekTasks.map((task) => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      dealName={getDealName(task.dealId)}
                      onClick={() => handleTaskClick(task)}
                      highlighted={highlightedTaskId === task.id}
                      isFlagged={!!flaggedTasks[task.id]}
                      onFlag={(e) => { e.stopPropagation(); toggleTaskFlag(task.id); }}
                      ref={(el) => { taskRefs.current[task.id] = el; }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Due Later */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                Due Later
              </h3>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">{dueLaterTasks.length}</Badge>
            </div>
            <ScrollArea className="h-[400px] pr-2">
              {dueLaterTasks.length === 0 ? (
                <Card className="bg-card/50 border-border border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    No tasks due later
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {dueLaterTasks.map((task) => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      dealName={getDealName(task.dealId)}
                      onClick={() => handleTaskClick(task)}
                      highlighted={highlightedTaskId === task.id}
                      isFlagged={!!flaggedTasks[task.id]}
                      onFlag={(e) => { e.stopPropagation(); toggleTaskFlag(task.id); }}
                      ref={(el) => { taskRefs.current[task.id] = el; }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Completed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Completed
              </h3>
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">{completedTasks.length}</Badge>
            </div>
            <ScrollArea className="h-[400px] pr-2">
              {completedTasks.length === 0 ? (
                <Card className="bg-card/50 border-border border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    No completed tasks yet
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {completedTasks.slice(0, 10).map((task) => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      dealName={getDealName(task.dealId)}
                      onClick={() => handleTaskClick(task)}
                      highlighted={highlightedTaskId === task.id}
                      completed
                      ref={(el) => { taskRefs.current[task.id] = el; }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      <Dialog open={showTaskDetailModal} onOpenChange={setShowTaskDetailModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>Task Details</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "text-xs",
                  selectedTask.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                  selectedTask.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                  "bg-blue-500/10 text-blue-500 border-blue-500/20"
                )}>
                  {selectedTask.priority} Priority
                </Badge>
                <Badge variant="secondary">{selectedTask.type}</Badge>
                <Badge variant={selectedTask.status === 'Completed' ? 'default' : 'outline'}>
                  {selectedTask.status}
                </Badge>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{selectedTask.description || 'No description provided'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Deal</Label>
                  <p className="text-sm mt-1">{getDealName(selectedTask.dealId)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date</Label>
                  <p className="text-sm mt-1">{selectedTask.dueDate || 'No due date'}</p>
                </div>
              </div>
              
              {selectedTask.attachments && Array.isArray(selectedTask.attachments) && selectedTask.attachments.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </Label>
                  <div className="mt-2 space-y-2">
                    {(selectedTask.attachments as any[]).map((attachment: any, i: number) => (
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
            {selectedTask?.status !== 'Completed' && (
              <Button onClick={() => selectedTask && handleCompleteTask(selectedTask.id)}>
                <Check className="w-4 h-4 mr-2" /> Mark Complete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Task Modal */}
      <Dialog open={showForwardModal} onOpenChange={setShowForwardModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Task</DialogTitle>
            <DialogDescription>
              Choose a team member to forward "{selectedTask?.title}" to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Team Member</Label>
              <Select value={forwardToUser} onValueChange={setForwardToUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team member" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id !== currentUser?.id).map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{user.name}</span>
                        <span className="text-muted-foreground">({user.role})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForwardModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleForwardTask} disabled={!forwardToUser}>
              <Send className="w-4 h-4 mr-2" /> Forward Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Modal */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Task Analysis
            </DialogTitle>
            <DialogDescription>
              Analyzing "{selectedTask?.title}" to suggest next steps
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing task details...</p>
              </div>
            ) : aiSuggestion ? (
              <>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h4 className="font-medium text-sm mb-2">Recommended Action</h4>
                  <p className="text-lg font-semibold">{aiSuggestion.action}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-2">Reasoning</h4>
                  <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium text-sm mb-3">Suggested Tools</h4>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestion.tools.map((tool, i) => (
                      <Button key={i} variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="w-3 h-3" />
                        {tool}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No analysis available</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIModal(false)}>
              Close
            </Button>
            {selectedTask?.status !== 'Completed' && !isAnalyzing && (
              <Button onClick={() => {
                setShowAIModal(false);
                handleStartTask(selectedTask?.id || '');
              }}>
                Start Working
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Note Dialog */}
      <Dialog open={showFlagNoteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowFlagNoteDialog(false);
          setFlagNoteTaskId(null);
          setFlagNote("");
        }
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-orange-500" />
              Flag Task
            </DialogTitle>
            <DialogDescription>
              Add a note to explain why this task is being flagged
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Flag Note (Optional)</Label>
              <Textarea
                placeholder="Describe the issue or reason for flagging this task..."
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-flag-note"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              This note will be visible to pod team members working on this project.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFlagNoteDialog(false);
              setFlagNoteTaskId(null);
              setFlagNote("");
            }}>
              Cancel
            </Button>
            <Button onClick={confirmFlag} className="bg-orange-500 hover:bg-orange-600">
              <Flag className="w-4 h-4 mr-2" /> Flag Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskModal} onOpenChange={setShowCreateTaskModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create New Task
            </DialogTitle>
            <DialogDescription>
              Add a new task to your to-do list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                placeholder="Enter task title..."
                value={newTaskForm.title}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                data-testid="input-new-task-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Add details about this task..."
                value={newTaskForm.description}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                rows={3}
                className="resize-none"
                data-testid="textarea-new-task-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={newTaskForm.priority} 
                  onValueChange={(value: 'Low' | 'Medium' | 'High' | 'Urgent') => setNewTaskForm({ ...newTaskForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-new-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={newTaskForm.type} 
                  onValueChange={(value: typeof newTaskForm.type) => setNewTaskForm({ ...newTaskForm, type: value })}
                >
                  <SelectTrigger data-testid="select-new-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Document Review">Document Review</SelectItem>
                    <SelectItem value="Due Diligence">Due Diligence</SelectItem>
                    <SelectItem value="Client Communication">Client Communication</SelectItem>
                    <SelectItem value="Financial Analysis">Financial Analysis</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newTaskForm.dueDate}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                data-testid="input-new-task-due-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Related Deal (Optional)</Label>
              <Select 
                value={newTaskForm.dealId} 
                onValueChange={(value) => setNewTaskForm({ ...newTaskForm, dealId: value })}
              >
                <SelectTrigger data-testid="select-new-task-deal">
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No deal</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTaskModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={createTask.isPending}
              data-testid="button-create-task-submit"
            >
              {createTask.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );

  async function handleStartTask(taskId: string) {
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'In Progress' });
      toast.success("Task started!");
    } catch (error: any) {
      toast.error(error.message || "Failed to start task");
    }
  }
}

interface SwipeableTaskCardProps {
  task: Task;
  dealName: string;
  onSwipe: (direction: SwipeDirection) => void;
  onClick: () => void;
}

function SwipeableTaskCard({ task, dealName, onSwipe, onClick }: SwipeableTaskCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const isDragging = useRef(false);
  const dragDistance = useRef(0);
  
  const rotateZ = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const rightIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);
  const leftIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);
  const upIndicatorOpacity = useTransform(y, [-100, 0], [1, 0]);
  
  const handleDragStart = () => {
    isDragging.current = true;
    dragDistance.current = 0;
  };
  
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    dragDistance.current = Math.max(
      dragDistance.current,
      Math.abs(info.offset.x) + Math.abs(info.offset.y)
    );
  };
  
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    
    if (info.offset.y < -threshold) {
      onSwipe('up');
    } else if (info.offset.x > threshold) {
      onSwipe('right');
    } else if (info.offset.x < -threshold) {
      onSwipe('left');
    }
    
    setTimeout(() => {
      isDragging.current = false;
    }, 50);
  };
  
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current || dragDistance.current > 10) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotateZ, opacity }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={handleClick}
      className="absolute w-full max-w-md cursor-grab active:cursor-grabbing"
    >
      <Card className="bg-card border-border shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <Badge variant="outline" className={cn(
              "text-xs",
              task.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
              task.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
              "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}>
              {task.priority} Priority
            </Badge>
            <Badge variant="secondary">{task.type}</Badge>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold">{task.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {task.description || 'No description'}
            </p>
          </div>
          
          <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              <span>{dealName}</span>
            </div>
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{task.dueDate}</span>
              </div>
            )}
          </div>
          
          {/* Swipe overlay indicators */}
          <motion.div
            style={{ opacity: rightIndicatorOpacity }}
            className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center pointer-events-none"
          >
            <div className="bg-green-500 text-white px-4 py-2 rounded-full font-medium">
              Defer
            </div>
          </motion.div>
          
          <motion.div
            style={{ opacity: leftIndicatorOpacity }}
            className="absolute inset-0 bg-blue-500/20 rounded-lg flex items-center justify-center pointer-events-none"
          >
            <div className="bg-blue-500 text-white px-4 py-2 rounded-full font-medium">
              Forward
            </div>
          </motion.div>
          
          <motion.div
            style={{ opacity: upIndicatorOpacity }}
            className="absolute inset-0 bg-purple-500/20 rounded-lg flex items-center justify-center pointer-events-none"
          >
            <div className="bg-purple-500 text-white px-4 py-2 rounded-full font-medium">
              AI Assist
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface TaskCardProps {
  task: Task;
  dealName: string;
  onClick: () => void;
  highlighted?: boolean;
  completed?: boolean;
  isFlagged?: boolean;
  onFlag?: (e: React.MouseEvent) => void;
}

const TaskCard = ({ task, dealName, onClick, highlighted, completed, isFlagged, onFlag, ref }: TaskCardProps & { ref?: React.Ref<HTMLDivElement> }) => {
  return (
    <Card 
      ref={ref}
      className={cn(
        "bg-card border-border hover:border-primary/50 transition-all cursor-pointer group",
        highlighted && "ring-2 ring-primary border-primary animate-pulse",
        completed && "opacity-60",
        isFlagged && "border-orange-500/50 bg-orange-500/5"
      )}
      onClick={onClick}
      data-testid={`card-task-${task.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="outline" className={cn(
            "text-[10px] px-1.5 py-0.5 h-5 shrink-0",
            completed ? "bg-green-500/10 text-green-500 border-green-500/20" :
            task.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
            task.priority === 'Medium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
            "bg-blue-500/10 text-blue-500 border-blue-500/20"
          )}>
            {completed ? 'Done' : task.priority}
          </Badge>
          <div className="flex items-center gap-1">
            {onFlag && (
              <button
                onClick={onFlag}
                className={cn(
                  "p-1 rounded hover:bg-secondary/50 transition-colors",
                  isFlagged ? "text-orange-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                )}
                data-testid={`flag-task-${task.id}`}
              >
                <Flag className="w-3.5 h-3.5" fill={isFlagged ? "currentColor" : "none"} />
              </button>
            )}
            <Badge variant="secondary" className="text-[10px]">{task.type}</Badge>
          </div>
        </div>
        
        <div>
          <h4 className={cn(
            "font-medium text-sm",
            completed && "line-through"
          )}>{task.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{dealName}</p>
        </div>
        
        {task.dueDate && !completed && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{task.dueDate}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
