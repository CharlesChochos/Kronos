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
  UserPlus,
  CheckCircle,
  Clock,
  Paperclip,
  X,
  FileText
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
    description: '',
    priority: 'Medium',
    type: 'Analysis',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [taskAttachments, setTaskAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setTaskAttachments(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setTaskAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAssignTask = async () => {
    if (!selectedUser || !selectedDeal || !newTask.title) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      // Convert files to attachment objects (in a real app, you'd upload these to storage first)
      const attachmentObjects = taskAttachments.map(file => ({
        id: crypto.randomUUID(),
        filename: file.name,
        url: URL.createObjectURL(file), // In production, this would be a real upload URL
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }));

      await createTask.mutateAsync({
        title: newTask.title,
        description: newTask.description || null,
        dealId: selectedDeal,
        assignedTo: selectedUser.id,
        assignedBy: currentUser?.id || null,
        priority: newTask.priority,
        type: newTask.type,
        dueDate: newTask.dueDate,
        status: 'Pending',
        attachments: attachmentObjects.length > 0 ? attachmentObjects : [],
      });
      toast.success(`Task assigned to ${selectedUser.name}!`);
      setShowAssignModal(false);
      setNewTask({ title: '', description: '', priority: 'Medium', type: 'Analysis', dueDate: new Date().toISOString().split('T')[0] });
      setTaskAttachments([]);
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
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Task to {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Provide detailed instructions for the task..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
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
            <div className="space-y-2">
              <Label>Attachments</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4 mr-2" /> Add Files
              </Button>
              {taskAttachments.length > 0 && (
                <div className="space-y-2 mt-2">
                  {taskAttachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm truncate max-w-48">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
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
