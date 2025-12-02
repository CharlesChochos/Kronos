import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  Users, 
  MoreHorizontal,
  Calendar,
  BarChart2,
  UserPlus,
  CheckCircle,
  Clock
} from "lucide-react";
import { useCurrentUser, useUsers, useDeals, useTasks, useCreateTask } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Deal, User } from "@shared/schema";

export default function TeamAssignment() {
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const userRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  
  // Handle URL query parameter for highlighting a specific user
  useEffect(() => {
    if (searchString && users.length > 0) {
      const params = new URLSearchParams(searchString);
      const userId = params.get('id');
      if (userId) {
        setHighlightedUserId(userId);
        setTimeout(() => {
          const element = userRefs.current[userId];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        setTimeout(() => setHighlightedUserId(null), 3000);
      }
    }
  }, [searchString, users]);
  const [filterAvailability, setFilterAvailability] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    priority: 'Medium',
    type: 'Analysis',
    dueDate: new Date().toISOString().split('T')[0],
  });

  const getUserTaskCount = (userId: string) => tasks.filter(t => t.assignedTo === userId && t.status !== 'Completed').length;
  const getUserAvailability = (userId: string) => {
    const taskCount = getUserTaskCount(userId);
    if (taskCount === 0) return 'Available';
    if (taskCount <= 2) return 'Light';
    return 'Busy';
  };

  const filteredUsers = users.filter(user => {
    if (!filterAvailability) return true;
    return getUserAvailability(user.id) === filterAvailability;
  });

  const handleAssignTask = async () => {
    if (!selectedUser || !selectedDeal || !newTask.title) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await createTask.mutateAsync({
        title: newTask.title,
        dealId: selectedDeal,
        assignedTo: selectedUser.id,
        priority: newTask.priority,
        type: newTask.type,
        dueDate: newTask.dueDate,
        status: 'Pending',
      });
      toast.success(`Task assigned to ${selectedUser.name}!`);
      setShowAssignModal(false);
      setNewTask({ title: '', priority: 'Medium', type: 'Analysis', dueDate: new Date().toISOString().split('T')[0] });
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to assign task");
    }
  };

  const openAssignModal = (user: User) => {
    if (!selectedDeal) {
      toast.error("Please select a deal first");
      return;
    }
    setSelectedUser(user);
    setShowAssignModal(true);
  };

  const handleExportReport = () => {
    const report = users.map(u => ({
      name: u.name,
      role: u.role,
      activeTasks: getUserTaskCount(u.id),
      availability: getUserAvailability(u.id),
      score: u.score || 0,
    }));
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team-workload-report.json';
    a.click();
    toast.success("Report exported!");
  };

  if (usersLoading || dealsLoading) {
    return (
      <Layout role="CEO" pageTitle="Team Assignment" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading team data...</div>
        </div>
      </Layout>
    );
  }

  const currentDeal = deals.find(d => d.id === selectedDeal);

  return (
    <Layout role="CEO" pageTitle="Team Assignment" userName={currentUser?.name || ""}>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Left: Filters */}
        <div className="col-span-12 md:col-span-3 space-y-6">
             <Card className="bg-card border-border h-full overflow-auto">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                      variant={filterAvailability === null ? "secondary" : "ghost"} 
                      className={cn("w-full justify-start", filterAvailability === null && "bg-accent text-accent-foreground")}
                      onClick={() => setFilterAvailability(null)}
                    >
                        <Users className="w-4 h-4 mr-2" /> All Teams ({users.length})
                    </Button>
                    <Button 
                      variant={filterAvailability === 'Available' ? "secondary" : "ghost"} 
                      className="w-full justify-start hover:bg-secondary/50"
                      onClick={() => setFilterAvailability('Available')}
                    >
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Available ({users.filter(u => getUserAvailability(u.id) === 'Available').length})
                    </Button>
                    <Button 
                      variant={filterAvailability === 'Light' ? "secondary" : "ghost"} 
                      className="w-full justify-start hover:bg-secondary/50"
                      onClick={() => setFilterAvailability('Light')}
                    >
                        <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div> Light Load ({users.filter(u => getUserAvailability(u.id) === 'Light').length})
                    </Button>
                    <Button 
                      variant={filterAvailability === 'Busy' ? "secondary" : "ghost"} 
                      className="w-full justify-start hover:bg-secondary/50"
                      onClick={() => setFilterAvailability('Busy')}
                    >
                         <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Busy ({users.filter(u => getUserAvailability(u.id) === 'Busy').length})
                    </Button>
                    
                    <div className="pt-4 border-t border-border">
                        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Active Deals</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {deals.filter(d => d.status === 'Active').map(deal => (
                                <div 
                                  key={deal.id} 
                                  className={cn(
                                    "p-3 rounded cursor-pointer transition-all",
                                    selectedDeal === deal.id 
                                      ? "bg-primary/20 border border-primary" 
                                      : "bg-secondary/30 border border-border/50 hover:border-primary/50"
                                  )}
                                  onClick={() => setSelectedDeal(deal.id)}
                                  data-testid={`deal-select-${deal.id}`}
                                >
                                    <div className="font-medium mb-1 text-sm">{deal.name}</div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{deal.stage}</span>
                                        <span>${deal.value}M</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
             </Card>
        </div>

        {/* Main: Team Assignment Area */}
        <div className="col-span-12 md:col-span-9">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {selectedDeal ? `Assigning team for: ${currentDeal?.name}` : 'Select a deal to assign team members'}
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportReport}>
                      <BarChart2 className="w-4 h-4 mr-2" /> Export Report
                    </Button>
                </div>
            </div>
            
            <Card className="bg-card border-border h-[calc(100%-3rem)] flex flex-col">
                <div className="p-4 border-b border-border bg-secondary/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Team Members</span>
                      <Badge variant="secondary">{filteredUsers.length} members</Badge>
                    </div>
                </div>
                
                {selectedDeal ? (
                  <div className="flex-1 p-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredUsers.map(user => {
                        const availability = getUserAvailability(user.id);
                        const taskCount = getUserTaskCount(user.id);
                        return (
                          <Card 
                            key={user.id}
                            ref={(el) => { userRefs.current[user.id] = el; }}
                            className={cn(
                              "bg-secondary/20 border-border hover:border-primary/50 transition-all",
                              highlightedUserId === user.id && "ring-2 ring-primary border-primary animate-pulse"
                            )}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                                    {user.name.split(' ').map((n: string) => n[0]).join('')}
                                  </div>
                                  <div>
                                    <h4 className="font-medium">{user.name}</h4>
                                    <p className="text-xs text-muted-foreground">{user.role}</p>
                                  </div>
                                </div>
                                <Badge className={cn(
                                  "text-xs",
                                  availability === 'Available' ? "bg-green-500/20 text-green-400" :
                                  availability === 'Light' ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-red-500/20 text-red-400"
                                )}>
                                  {availability}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                                <div className="bg-secondary/50 rounded p-2">
                                  <div className="font-bold">{taskCount}</div>
                                  <div className="text-muted-foreground">Active</div>
                                </div>
                                <div className="bg-secondary/50 rounded p-2">
                                  <div className="font-bold">{user.completedTasks || 0}</div>
                                  <div className="text-muted-foreground">Done</div>
                                </div>
                                <div className="bg-secondary/50 rounded p-2">
                                  <div className="font-bold">{user.score || 0}</div>
                                  <div className="text-muted-foreground">Score</div>
                                </div>
                              </div>
                              
                              <Button 
                                className="w-full" 
                                size="sm"
                                onClick={() => openAssignModal(user)}
                                data-testid={`button-assign-${user.id}`}
                              >
                                <UserPlus className="w-4 h-4 mr-2" /> Assign Task
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-8 flex items-center justify-center border-2 border-dashed border-border/50 m-4 rounded-lg bg-secondary/5">
                      <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                              <Users className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-medium">Select a Deal</h3>
                          <p className="text-muted-foreground text-sm mt-1">Choose a deal from the sidebar to start assigning team members</p>
                      </div>
                  </div>
                )}
            </Card>
        </div>
      </div>

      {/* Assign Task Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Assign Task to {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Assigning to deal: <span className="font-medium text-foreground">{currentDeal?.name}</span>
            </div>
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input 
                placeholder="e.g., Review financial model" 
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Analysis">Analysis</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input 
                type="date" 
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssignTask} disabled={createTask.isPending}>
              {createTask.isPending ? "Assigning..." : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
