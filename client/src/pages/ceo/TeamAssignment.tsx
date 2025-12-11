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
  FileText,
  Loader2,
  Upload
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser, useUsers, useDealsListing, useTasks, useCreateTask, useCreateTaskAttachment, useUpdateDeal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Deal, User } from "@shared/schema";

type PodTeamMember = {
  name: string;
  role: string;
  userId?: string;
};

type UploadedFile = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export default function TeamAssignment() {
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: deals = [], isLoading: dealsLoading } = useDealsListing();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const createAttachment = useCreateTaskAttachment();
  const updateDeal = useUpdateDeal();
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const userRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [taskDealId, setTaskDealId] = useState<string | null>(null);

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
  const [dealSearchQuery, setDealSearchQuery] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    type: 'Analysis',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserTaskCount = (userId: string) => tasks.filter(t => t.assignedTo === userId && t.status !== 'Completed').length;
  const getUserAvailability = (userId: string) => {
    const taskCount = getUserTaskCount(userId);
    if (taskCount === 0) return 'Available';
    if (taskCount <= 2) return 'Light';
    return 'Busy';
  };

  const filteredUsers = users.filter(user => {
    // Filter by availability
    if (filterAvailability && getUserAvailability(user.id) !== filterAvailability) return false;
    // Filter by search query
    if (memberSearchQuery) {
      const searchLower = memberSearchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchLower) ||
        (user.email?.toLowerCase() || '').includes(searchLower) ||
        (user.role?.toLowerCase() || '').includes(searchLower) ||
        (user.jobTitle?.toLowerCase() || '').includes(searchLower)
      );
    }
    return true;
  });

  const filteredDeals = deals.filter(deal => {
    if (!deal.status || deal.status !== 'Active') return false;
    if (!dealSearchQuery) return true;
    const searchLower = dealSearchQuery.toLowerCase();
    return (
      deal.name.toLowerCase().includes(searchLower) ||
      (deal.client?.toLowerCase() || '').includes(searchLower) ||
      (deal.sector?.toLowerCase() || '').includes(searchLower) ||
      (deal.stage?.toLowerCase() || '').includes(searchLower)
    );
  });

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload file');
        }
        
        const uploadedFile: UploadedFile = await response.json();
        setUploadedFiles(prev => [...prev, uploadedFile]);
      }
      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const removeAttachment = async (index: number) => {
    const file = uploadedFiles[index];
    if (file) {
      try {
        const filename = file.url.replace('/uploads/', '');
        await fetch(`/api/upload/${filename}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAssignTask = async () => {
    if (!selectedUser || !taskDealId || !newTask.title) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      const attachmentObjects = uploadedFiles.map(file => ({
        id: file.id,
        filename: file.filename,
        url: file.url,
        size: file.size,
        uploadedAt: file.uploadedAt,
      }));

      // Combine date and time for full datetime
      const fullDueDate = newTask.dueTime 
        ? `${newTask.dueDate}T${newTask.dueTime}` 
        : newTask.dueDate;
      
      const createdTask = await createTask.mutateAsync({
        title: newTask.title,
        description: newTask.description || null,
        dealId: taskDealId,
        assignedTo: selectedUser.id,
        assignedBy: currentUser?.id || null,
        priority: newTask.priority,
        type: newTask.type,
        dueDate: fullDueDate,
        status: 'Pending',
        attachments: attachmentObjects.length > 0 ? attachmentObjects : [],
      });
      
      for (const file of uploadedFiles) {
        await createAttachment.mutateAsync({
          taskId: createdTask.id,
          filename: file.url.split('/').pop() || file.filename,
          originalName: file.filename,
          mimeType: file.type || null,
          size: file.size,
        });
      }
      
      toast.success(`Task assigned to ${selectedUser.name}!`);
      setShowAssignModal(false);
      setNewTask({ title: '', description: '', priority: 'Medium', type: 'Analysis', dueDate: new Date().toISOString().split('T')[0], dueTime: '' });
      setUploadedFiles([]);
      setSelectedUser(null);
      setTaskDealId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to assign task");
    }
  };

  const openAssignModal = (user: User) => {
    setSelectedUser(user);
    setTaskDealId(selectedDeal);
    setShowAssignModal(true);
  };

  const isUserInDealTeam = (userId: string, dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return false;
    const podTeam = (deal.podTeam as PodTeamMember[]) || [];
    return podTeam.some(m => m.userId === userId);
  };

  const handleAddToTeam = async (user: User) => {
    if (!selectedDeal) {
      toast.error("Please select a deal first");
      return;
    }
    const deal = deals.find(d => d.id === selectedDeal);
    if (!deal) return;
    
    const currentPodTeam = (deal.podTeam as PodTeamMember[]) || [];
    if (currentPodTeam.some(m => m.userId === user.id)) {
      toast.info(`${user.name} is already on this deal team`);
      return;
    }
    
    const newMember: PodTeamMember = {
      name: user.name,
      role: user.jobTitle || user.role,
      userId: user.id,
    };
    
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        podTeam: [...currentPodTeam, newMember],
      });
      toast.success(`${user.name} added to ${deal.name} team`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member");
    }
  };

  const handleRemoveFromTeam = async (user: User) => {
    if (!selectedDeal) return;
    const deal = deals.find(d => d.id === selectedDeal);
    if (!deal) return;
    
    const currentPodTeam = (deal.podTeam as PodTeamMember[]) || [];
    const updatedTeam = currentPodTeam.filter(m => m.userId !== user.id);
    
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        podTeam: updatedTeam,
      });
      toast.success(`${user.name} removed from ${deal.name} team`);
    } catch (error: any) {
      toast.error(error.message || "Failed to remove team member");
    }
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
                        <div className="relative mb-3">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search deals..."
                            value={dealSearchQuery}
                            onChange={(e) => setDealSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                            data-testid="input-search-deals"
                          />
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {filteredDeals.map(deal => (
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
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Team Members</span>
                      <Badge variant="secondary">{filteredUsers.length} members</Badge>
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search members by name, email, role..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                        data-testid="input-search-members"
                      />
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
                                    <p className="text-xs text-muted-foreground">{user.jobTitle || user.role}</p>
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
                              
                              <div className="flex gap-2">
                                {isUserInDealTeam(user.id, selectedDeal!) ? (
                                  <Button 
                                    variant="outline"
                                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10" 
                                    size="sm"
                                    onClick={() => handleRemoveFromTeam(user)}
                                    disabled={updateDeal.isPending}
                                    data-testid={`button-remove-team-${user.id}`}
                                  >
                                    <X className="w-4 h-4 mr-1" /> Remove
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline"
                                    className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10" 
                                    size="sm"
                                    onClick={() => handleAddToTeam(user)}
                                    disabled={updateDeal.isPending}
                                    data-testid={`button-add-team-${user.id}`}
                                  >
                                    <UserPlus className="w-4 h-4 mr-1" /> Add
                                  </Button>
                                )}
                                <Button 
                                  className="flex-1" 
                                  size="sm"
                                  onClick={() => openAssignModal(user)}
                                  data-testid={`button-assign-${user.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" /> Task
                                </Button>
                              </div>
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
            <div className="space-y-2">
              <Label>Related Deal *</Label>
              <Select value={taskDealId || ""} onValueChange={(v) => setTaskDealId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  {deals.filter(d => d.status === 'Active').map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Due Date & Time</Label>
              <div className="flex gap-2">
                <Input 
                  type="date" 
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="flex-1"
                />
                <Input 
                  type="time" 
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                  className="w-32"
                  placeholder="Time"
                />
              </div>
              <p className="text-xs text-muted-foreground">Time is optional - leave blank for end of day</p>
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer",
                  isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Drag & drop files here, or click to browse
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Supports documents, images, videos up to 500MB
                      </span>
                    </>
                  )}
                </div>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm truncate max-w-48">{file.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          {file.size >= 1024 * 1024 
                            ? `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`
                            : `(${(file.size / 1024).toFixed(1)} KB)`
                          }
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(index);
                        }}
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
