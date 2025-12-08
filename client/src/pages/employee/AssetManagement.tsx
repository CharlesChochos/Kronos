import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  Search, Filter, MoreVertical, ArrowRight, Calendar, DollarSign, Briefcase, 
  Pencil, Trash2, Eye, Users, Plus, X, Building2, TrendingUp, Clock, CheckCircle2,
  ChevronRight, BarChart3, PieChart
} from "lucide-react";
import { 
  useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers, useTasks, useCreateTask
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember } from "@shared/schema";

const DEAL_STAGES = ['Origination', 'Execution', 'Negotiation', 'Due Diligence', 'Signing', 'Closed'];
const AM_SECTORS = ['Real Estate', 'Infrastructure', 'Private Equity', 'Hedge Funds', 'Fixed Income', 'Equities', 'Commodities', 'Other'];

type AssetManagementProps = {
  role?: 'CEO' | 'Employee';
};

export default function AssetManagement({ role = 'Employee' }: AssetManagementProps) {
  const { data: currentUser } = useCurrentUser();
  const userRole = role || currentUser?.role || 'Employee';
  const { data: deals = [], isLoading } = useDeals();
  const { data: users = [] } = useUsers();
  const { data: tasks = [] } = useTasks();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const createTask = useCreateTask();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [showNewDealDialog, setShowNewDealDialog] = useState(false);
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  
  const [newDeal, setNewDeal] = useState({
    name: "",
    client: "",
    sector: "Real Estate",
    value: 0,
    description: "",
    lead: currentUser?.name || "",
  });
  
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
    type: "Analysis",
  });
  
  // Filter for Asset Management deals only
  const amDeals = useMemo(() => {
    return deals.filter((deal: Deal) => (deal as any).dealType === 'Asset Management');
  }, [deals]);
  
  // Apply search and stage filters
  const filteredDeals = useMemo(() => {
    return amDeals.filter((deal: Deal) => {
      const matchesSearch = !searchQuery || 
        deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.sector.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter === "all" || deal.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [amDeals, searchQuery, stageFilter]);
  
  // Group deals by stage for pipeline view
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    DEAL_STAGES.forEach(stage => {
      grouped[stage] = filteredDeals.filter((deal: Deal) => deal.stage === stage);
    });
    return grouped;
  }, [filteredDeals]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = amDeals.reduce((sum, deal: Deal) => sum + deal.value, 0);
    const activeDeals = amDeals.filter((deal: Deal) => deal.status === 'Active').length;
    const closedDeals = amDeals.filter((deal: Deal) => deal.stage === 'Closed').length;
    return { totalValue, activeDeals, closedDeals, totalDeals: amDeals.length };
  }, [amDeals]);
  
  const handleCreateDeal = async () => {
    if (!newDeal.name || !newDeal.client) {
      toast.error("Please fill in required fields");
      return;
    }
    try {
      await createDeal.mutateAsync({
        ...newDeal,
        dealType: 'Asset Management',
        stage: 'Origination',
        status: 'Active',
        progress: 0,
        podTeam: currentUser ? [{
          userId: currentUser.id,
          name: currentUser.name,
          role: 'Lead',
          email: currentUser.email || '',
        }] : [],
      } as any);
      toast.success("Asset management deal created");
      setShowNewDealDialog(false);
      setNewDeal({ name: "", client: "", sector: "Real Estate", value: 0, description: "", lead: currentUser?.name || "" });
    } catch (error) {
      toast.error("Failed to create deal");
    }
  };
  
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedTo || !newTask.dueDate || !selectedDeal) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await createTask.mutateAsync({
        title: newTask.title,
        description: newTask.description,
        dealId: selectedDeal.id,
        dealStage: selectedDeal.stage,
        assignedTo: newTask.assignedTo,
        assignedBy: currentUser?.id || '',
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        type: newTask.type,
        status: 'Pending',
        attachments: null,
        completedAt: null,
      });
      toast.success("Task assigned successfully");
      setShowTaskDialog(false);
      setNewTask({ title: "", description: "", assignedTo: "", priority: "Medium", dueDate: "", type: "Analysis" });
    } catch (error) {
      toast.error("Failed to assign task");
    }
  };
  
  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Origination': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Execution': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Negotiation': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      'Due Diligence': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      'Signing': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      'Closed': 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return colors[stage] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  return (
    <Layout role={userRole as 'CEO' | 'Employee'} pageTitle="Asset Management">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                  <p className="text-2xl font-bold">{stats.totalDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total AUM</p>
                  <p className="text-2xl font-bold">${stats.totalValue}M</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.activeDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="text-2xl font-bold">{stats.closedDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search AM deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50"
                data-testid="input-am-search"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-40 bg-secondary/50" data-testid="select-am-stage-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {DEAL_STAGES.map(stage => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowNewDealDialog(true)} data-testid="button-new-am-deal">
            <Plus className="w-4 h-4 mr-2" />
            New AM Deal
          </Button>
        </div>
        
        {/* Pipeline View */}
        <div className="grid grid-cols-6 gap-3">
          {DEAL_STAGES.map((stage) => (
            <div key={stage} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <Badge variant="outline" className={cn("text-xs", getStageColor(stage))}>
                  {stage}
                </Badge>
                <span className="text-xs text-muted-foreground">{dealsByStage[stage]?.length || 0}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {dealsByStage[stage]?.map((deal: Deal) => (
                  <Card 
                    key={deal.id} 
                    className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedDeal(deal); setShowDealDetail(true); }}
                    data-testid={`card-am-deal-${deal.id}`}
                  >
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm truncate">{deal.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{deal.client}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="text-[10px]">{deal.sector}</Badge>
                        <span className="text-xs font-medium text-primary">${deal.value}M</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Empty State */}
        {amDeals.length === 0 && !isLoading && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Asset Management Deals Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first AM deal to get started</p>
              <Button onClick={() => setShowNewDealDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create AM Deal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* New Deal Dialog */}
      <Dialog open={showNewDealDialog} onOpenChange={setShowNewDealDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>New Asset Management Deal</DialogTitle>
            <DialogDescription>Create a new deal for the AM division</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deal Name *</Label>
              <Input
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                placeholder="e.g., Alpha Real Estate Fund"
                data-testid="input-am-deal-name"
              />
            </div>
            <div>
              <Label>Client *</Label>
              <Input
                value={newDeal.client}
                onChange={(e) => setNewDeal({ ...newDeal, client: e.target.value })}
                placeholder="Client name"
                data-testid="input-am-deal-client"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sector</Label>
                <Select value={newDeal.sector} onValueChange={(v) => setNewDeal({ ...newDeal, sector: v })}>
                  <SelectTrigger data-testid="select-am-deal-sector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AM_SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value ($M)</Label>
                <Input
                  type="number"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: parseInt(e.target.value) || 0 })}
                  data-testid="input-am-deal-value"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newDeal.description}
                onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
                placeholder="Deal description..."
                rows={3}
                data-testid="textarea-am-deal-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending} data-testid="button-create-am-deal">
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Deal Detail Sheet */}
      <Sheet open={showDealDetail} onOpenChange={setShowDealDetail}>
        <SheetContent className="bg-card border-border w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {selectedDeal?.name}
            </SheetTitle>
            <SheetDescription>{selectedDeal?.client}</SheetDescription>
          </SheetHeader>
          
          {selectedDeal && (
            <ScrollArea className="h-[calc(100vh-200px)] mt-6">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">Stage</p>
                    <Badge className={cn("mt-1", getStageColor(selectedDeal.stage))}>{selectedDeal.stage}</Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="text-lg font-bold text-primary">${selectedDeal.value}M</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">Sector</p>
                    <p className="font-medium">{selectedDeal.sector}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <p className="font-medium">{selectedDeal.progress}%</p>
                  </div>
                </div>
                
                {selectedDeal.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1">{selectedDeal.description}</p>
                  </div>
                )}
                
                {/* Team */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs text-muted-foreground">Pod Team</Label>
                  </div>
                  <div className="space-y-2">
                    {(selectedDeal.podTeam as PodTeamMember[] || []).map((member, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Tasks Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs text-muted-foreground">Deal Tasks</Label>
                    <Button size="sm" variant="outline" onClick={() => setShowTaskDialog(true)} data-testid="button-assign-am-task">
                      <Plus className="w-3 h-3 mr-1" />
                      Assign Task
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {tasks.filter((t: any) => t.dealId === selectedDeal.id).map((task: any) => {
                      const assignee = users.find((u: any) => u.id === task.assignedTo);
                      return (
                        <div key={task.id} className="p-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{task.title}</p>
                            <Badge variant="outline" className={cn("text-[10px]",
                              task.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                              task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500' :
                              'bg-yellow-500/10 text-yellow-500'
                            )}>
                              {task.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Assigned to: {assignee?.name || 'Unknown'}</span>
                            <span>•</span>
                            <span>Due: {task.dueDate}</span>
                          </div>
                        </div>
                      );
                    })}
                    {tasks.filter((t: any) => t.dealId === selectedDeal.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
      
      {/* Assign Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>Create a task for {selectedDeal?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task Title *</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="e.g., Review fund prospectus"
                data-testid="input-am-task-title"
              />
            </div>
            <div>
              <Label>Assign To *</Label>
              <Select value={newTask.assignedTo} onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v })}>
                <SelectTrigger data-testid="select-am-task-assignee">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter((u: any) => u.status === 'active').map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger data-testid="select-am-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  data-testid="input-am-task-due-date"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task details..."
                rows={3}
                data-testid="textarea-am-task-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={createTask.isPending} data-testid="button-create-am-task">
              {createTask.isPending ? "Assigning..." : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
