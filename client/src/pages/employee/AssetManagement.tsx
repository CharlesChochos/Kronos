import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, Filter, MoreVertical, Calendar, DollarSign, Briefcase, 
  Pencil, Trash2, Eye, Users, Phone, Mail, MessageSquare, Plus, X, 
  Building2, TrendingUp, FileText, Clock, CheckCircle2, ChevronRight,
  UserPlus, History, LayoutGrid, CalendarDays, ChevronLeft, Upload, BarChart3,
  Mic, MicOff, Play, Pause, Square, Volume2, PieChart
} from "lucide-react";
import { 
  useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers, useTasks, useCreateTask, useCreateDealFee,
  useStageDocuments, useCreateStageDocument, useDeleteStageDocument,
  useStagePodMembers, useCreateStagePodMember, useDeleteStagePodMember,
  useStageVoiceNotes, useCreateStageVoiceNote, useDeleteStageVoiceNote,
  useTaskComments, useCreateTaskComment,
  useDealFees, type DealFeeType
} from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isToday, isBefore, isAfter, parseISO } from "date-fns";
import type { Deal, PodTeamMember, AuditEntry } from "@shared/schema";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip
} from "recharts";

const DEAL_STAGES = ['Reception', 'Initial Review', 'Hard Diligence', 'Structure', 'Negotiation', 'Closing', 'Invested'];
const AM_SECTORS = ['Real Estate', 'Infrastructure', 'Private Equity', 'Hedge Funds', 'Fixed Income', 'Equities', 'Commodities', 'Other'];

type StageWorkSectionProps = {
  dealId: string;
  dealStage: string;
  allUsers: any[];
  currentUser: any;
  allTasks: any[];
  activeStageTab: string;
  setActiveStageTab: (stage: string) => void;
  createStageDocument: any;
  deleteStageDocument: any;
  createStagePodMember: any;
  deleteStagePodMember: any;
  createStageVoiceNote: any;
  deleteStageVoiceNote: any;
  createTaskComment: any;
};

function StageWorkSection({
  dealId,
  dealStage,
  allUsers,
  currentUser,
  allTasks,
  activeStageTab,
  setActiveStageTab,
  createStageDocument,
  deleteStageDocument,
  createStagePodMember,
  deleteStagePodMember,
  createStageVoiceNote,
  deleteStageVoiceNote,
  createTaskComment
}: StageWorkSectionProps) {
  const { data: stageDocuments = [] } = useStageDocuments(dealId, activeStageTab);
  const { data: stagePodMembers = [] } = useStagePodMembers(dealId, activeStageTab);
  const { data: stageVoiceNotes = [] } = useStageVoiceNotes(dealId, activeStageTab);
  
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentCategory, setDocumentCategory] = useState("General");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberRole, setMemberRole] = useState("");
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceTitle, setVoiceTitle] = useState("");
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  
  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);
  
  const stageTasks = useMemo(() => {
    return allTasks.filter((task: any) => 
      task.dealId === dealId && 
      (task.dealStage === activeStageTab || (!task.dealStage && activeStageTab === dealStage))
    );
  }, [allTasks, dealId, activeStageTab, dealStage]);
  
  const filteredMembers = useMemo(() => {
    if (!memberSearch || memberSearch.length < 2) return [];
    const query = memberSearch.toLowerCase();
    return allUsers.filter((user: any) => 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [allUsers, memberSearch]);
  
  const handleAddDocument = async () => {
    if (!documentTitle) {
      toast.error("Please enter a document title");
      return;
    }
    try {
      await createStageDocument.mutateAsync({
        dealId,
        stage: activeStageTab,
        document: {
          title: documentTitle,
          category: documentCategory,
          uploadedBy: currentUser?.id || ''
        }
      });
      toast.success("Document added to stage");
      setDocumentTitle("");
      setDocumentCategory("General");
      setShowAddDocument(false);
    } catch (error) {
      toast.error("Failed to add document");
    }
  };
  
  const handleAddMember = async () => {
    if (!selectedMember) {
      toast.error("Please select a team member");
      return;
    }
    try {
      await createStagePodMember.mutateAsync({
        dealId,
        stage: activeStageTab,
        member: {
          userId: selectedMember.id,
          role: memberRole || selectedMember.role || 'Team Member'
        }
      });
      toast.success("Team member added to stage");
      setSelectedMember(null);
      setMemberSearch("");
      setMemberRole("");
      setShowAddMember(false);
    } catch (error) {
      toast.error("Failed to add team member");
    }
  };
  
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    toast.info("Recording started");
  };
  
  const stopRecording = async () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    
    if (recordingTime > 0) {
      try {
        await createStageVoiceNote.mutateAsync({
          dealId,
          stage: activeStageTab,
          voiceNote: {
            title: voiceTitle || `Note ${format(new Date(), 'MMM d, h:mm a')}`,
            duration: recordingTime,
            authorId: currentUser?.id || '',
            authorName: currentUser?.name || 'Unknown'
          }
        });
        toast.success("Voice note saved!");
      } catch (error) {
        toast.error("Failed to save voice note");
      }
    }
    
    setVoiceTitle("");
    setRecordingTime(0);
  };
  
  const cancelRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    setRecordingTime(0);
    setVoiceTitle("");
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getStageIndex = (stage: string) => DEAL_STAGES.indexOf(stage);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-lg">
        {DEAL_STAGES.map((stage, index) => {
          const isCurrentStage = dealStage === stage;
          const isPastStage = getStageIndex(dealStage) > index;
          const isActive = activeStageTab === stage;
          return (
            <Button
              key={stage}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex-1 text-xs relative",
                isActive && "bg-primary text-primary-foreground",
                !isActive && isCurrentStage && "ring-1 ring-primary/50",
                !isActive && isPastStage && "text-muted-foreground"
              )}
              onClick={() => setActiveStageTab(stage)}
            >
              {stage}
              {isCurrentStage && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </Button>
          );
        })}
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Viewing stage: <span className="font-medium text-foreground">{activeStageTab}</span>
        {activeStageTab === dealStage && <span className="ml-1 text-green-500">(Current)</span>}
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-secondary/20">
          <CardContent className="p-3 text-center">
            <FileText className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <div className="text-lg font-bold">{stageDocuments.length}</div>
            <div className="text-xs text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/20">
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-green-400" />
            <div className="text-lg font-bold">{stagePodMembers.length}</div>
            <div className="text-xs text-muted-foreground">Team</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/20">
          <CardContent className="p-3 text-center">
            <Mic className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <div className="text-lg font-bold">{stageVoiceNotes.length}</div>
            <div className="text-xs text-muted-foreground">Notes</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> Stage Documents
          </h5>
          <Button size="sm" variant="ghost" onClick={() => setShowAddDocument(!showAddDocument)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {showAddDocument && (
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <Input
              placeholder="Document title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="h-8 text-sm"
            />
            <Select value={documentCategory} onValueChange={setDocumentCategory}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Financial">Financial</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
                <SelectItem value="Technical">Technical</SelectItem>
                <SelectItem value="Presentation">Presentation</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddDocument} className="flex-1">Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddDocument(false)}>Cancel</Button>
            </div>
          </div>
        )}
        
        <ScrollArea className="h-[100px]">
          {stageDocuments.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No documents for this stage
            </div>
          ) : (
            <div className="space-y-1">
              {stageDocuments.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded text-sm group">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-blue-400" />
                    <span className="truncate">{doc.title}</span>
                    <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteStageDocument.mutate({ dealId, documentId: doc.id })}
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" /> Stage Team
          </h5>
          <Button size="sm" variant="ghost" onClick={() => setShowAddMember(!showAddMember)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {showAddMember && (
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-8 text-sm">
                  {selectedMember ? selectedMember.name : "Search team member..."}
                  <ChevronsUpDown className="ml-2 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput 
                    placeholder="Type name..." 
                    value={memberSearch}
                    onValueChange={setMemberSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No users found</CommandEmpty>
                    <CommandGroup>
                      {filteredMembers.map((user: any) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => {
                            setSelectedMember(user);
                            setMemberRole(user.jobTitle || user.role || '');
                            setMemberOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedMember?.id === user.id ? "opacity-100" : "opacity-0")} />
                          <div>
                            <div>{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              placeholder="Role for this stage"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddMember} className="flex-1">Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddMember(false)}>Cancel</Button>
            </div>
          </div>
        )}
        
        <ScrollArea className="h-[80px]">
          {stagePodMembers.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No team members for this stage
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stagePodMembers.map((member: any) => (
                <div key={member.id} className="flex items-center gap-1 px-2 py-1 bg-secondary/30 rounded-full text-xs group">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs">
                    {member.userName?.charAt(0) || '?'}
                  </div>
                  <span>{member.userName || 'Unknown'}</span>
                  <span className="text-muted-foreground">({member.role})</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteStagePodMember.mutate({ dealId, memberId: member.id })}
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <Mic className="w-4 h-4 text-purple-400" /> Voice Notes
          </h5>
        </div>
        
        {isRecording ? (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
            <div className="flex items-center justify-center gap-2 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording: {formatDuration(recordingTime)}
            </div>
            <Input
              placeholder="Voice note title (optional)"
              value={voiceTitle}
              onChange={(e) => setVoiceTitle(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={stopRecording} className="flex-1 bg-red-500 hover:bg-red-600">
                <Square className="w-3 h-3 mr-1" /> Stop & Save
              </Button>
              <Button size="sm" variant="outline" onClick={cancelRecording}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full" 
            onClick={startRecording}
          >
            <Mic className="w-4 h-4 mr-2 text-purple-400" /> Start Recording
          </Button>
        )}
        
        <ScrollArea className="h-[80px]">
          {stageVoiceNotes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No voice notes for this stage
            </div>
          ) : (
            <div className="space-y-1">
              {stageVoiceNotes.map((note: any) => (
                <div key={note.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded text-sm group">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Play className="w-3 h-3 text-purple-400" />
                    </Button>
                    <div>
                      <span className="truncate">{note.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">{formatDuration(note.duration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{note.authorName}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteStageVoiceNote.mutate({ dealId, voiceNoteId: note.id })}
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-400" /> Deal Tasks
          </h5>
          <Badge variant="secondary" className="text-xs">{stageTasks.length} tasks</Badge>
        </div>
        
        <ScrollArea className="h-[150px]">
          {stageTasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No tasks for this deal
            </div>
          ) : (
            <div className="space-y-2">
              {stageTasks.map((task: any) => (
                <div key={task.id} className="bg-secondary/20 rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-secondary/30"
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        task.status === 'Completed' ? "bg-green-500" :
                        task.status === 'In Progress' ? "bg-blue-500" :
                        "bg-yellow-500"
                      )} />
                      <span className="text-sm truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {task.priority}
                      </Badge>
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-transform",
                        expandedTask === task.id && "rotate-90"
                      )} />
                    </div>
                  </div>
                  
                  {expandedTask === task.id && (
                    <TaskComments 
                      taskId={task.id}
                      currentUser={currentUser}
                      createTaskComment={createTaskComment}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function TaskComments({ 
  taskId,
  currentUser,
  createTaskComment
}: { 
  taskId: string;
  currentUser: any;
  createTaskComment: any;
}) {
  const { data: comments = [] } = useTaskComments(taskId);
  const [newComment, setNewComment] = useState("");
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await createTaskComment.mutateAsync({
        taskId,
        comment: {
          content: newComment.trim(),
          authorId: currentUser?.id || '',
          authorName: currentUser?.name || 'Unknown'
        }
      });
      toast.success("Comment added");
      setNewComment("");
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };
  
  return (
    <div className="p-2 border-t border-border/50 space-y-2">
      <div className="text-xs text-muted-foreground">Comments ({comments.length})</div>
      
      {comments.length > 0 && (
        <div className="space-y-1 max-h-[100px] overflow-y-auto">
          {comments.map((comment: any) => (
            <div key={comment.id} className="p-2 bg-secondary/30 rounded text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{comment.authorName}</span>
                <span className="text-muted-foreground">
                  {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <p>{comment.content}</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex gap-2">
        <Input
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <Button 
          size="sm" 
          className="h-7 px-2"
          onClick={handleAddComment}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

type AssetManagementProps = {
  role?: 'CEO' | 'Employee';
};

export default function AssetManagement({ role = 'Employee' }: AssetManagementProps) {
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const userRole = role || currentUser?.role || 'Employee';
  const { data: allDeals = [], isLoading } = useDeals();
  const { data: allUsers = [] } = useUsers();
  const { data: allTasks = [] } = useTasks();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const createTask = useCreateTask();
  const createDealFee = useCreateDealFee();
  
  const createStageDocument = useCreateStageDocument();
  const deleteStageDocument = useDeleteStageDocument();
  const createStagePodMember = useCreateStagePodMember();
  const deleteStagePodMember = useDeleteStagePodMember();
  const createStageVoiceNote = useCreateStageVoiceNote();
  const deleteStageVoiceNote = useDeleteStageVoiceNote();
  const createTaskComment = useCreateTaskComment();
  
  // Filter for Asset Management deals only
  const deals = useMemo(() => {
    return allDeals.filter((deal: Deal) => (deal as any).dealType === 'Asset Management');
  }, [allDeals]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: selectedDealFees = [] } = useDealFees(selectedDeal?.id || '');
  const [activeStageTab, setActiveStageTab] = useState("Reception");
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  const [showDeleteDealDialog, setShowDeleteDealDialog] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Real Estate',
    value: '',
    stage: 'Reception',
    lead: '',
    status: 'Active',
    progress: 0,
    description: '',
  });
  
  const [newDealFees, setNewDealFees] = useState({
    engagement: '',
    monthly: '',
    success: '',
    transaction: '',
    spread: '',
  });
  
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
    type: "Analysis",
  });
  
  const [newTeamMember, setNewTeamMember] = useState<PodTeamMember>({
    name: '',
    role: '',
    email: '',
    phone: '',
    slack: '',
  });
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [teamMemberOpen, setTeamMemberOpen] = useState(false);
  
  const filteredUsers = useMemo(() => {
    if (!teamMemberSearch || teamMemberSearch.length < 2) return [];
    const query = teamMemberSearch.toLowerCase();
    return allUsers.filter(user => 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [allUsers, teamMemberSearch]);

  useEffect(() => {
    if (searchString && deals.length > 0) {
      const params = new URLSearchParams(searchString);
      const dealId = params.get('id');
      if (dealId) {
        const deal = deals.find(d => d.id === dealId);
        if (deal) {
          setSelectedDeal(deal);
        }
      }
    }
  }, [searchString, deals]);

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch = !searchQuery || 
        deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.sector.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = !stageFilter || deal.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, searchQuery, stageFilter]);
  
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    DEAL_STAGES.forEach(stage => {
      grouped[stage] = filteredDeals.filter((deal: Deal) => deal.stage === stage);
    });
    return grouped;
  }, [filteredDeals]);

  const stats = useMemo(() => {
    const totalValue = deals.reduce((sum, deal: Deal) => sum + deal.value, 0);
    const activeDeals = deals.filter((deal: Deal) => deal.status === 'Active').length;
    const investedDeals = deals.filter((deal: Deal) => deal.stage === 'Invested').length;
    return { totalValue, activeDeals, investedDeals, totalDeals: deals.length };
  }, [deals]);

  const getStageIndex = (stage: string) => DEAL_STAGES.indexOf(stage);
  const getStageProgress = (stage: string) => Math.round(((getStageIndex(stage) + 1) / DEAL_STAGES.length) * 100);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Reception': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Initial Review': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Hard Diligence': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      'Structure': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      'Negotiation': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      'Closing': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      'Invested': 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return colors[stage] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

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
      const createdDeal = await createDeal.mutateAsync({
        name: newDeal.name,
        client: newDeal.client,
        sector: newDeal.sector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: getStageProgress(newDeal.stage),
        dealType: 'Asset Management',
        description: newDeal.description || null,
        attachments: [],
        podTeam: [],
        taggedInvestors: [],
        auditTrail: [{
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: 'Deal Created',
          user: currentUser?.name || 'System',
          details: `Deal "${newDeal.name}" created with initial stage: ${newDeal.stage}`,
        }],
      });
      
      const feePromises = [];
      if (newDealFees.engagement && parseFloat(newDealFees.engagement) > 0) {
        feePromises.push(createDealFee.mutateAsync({
          dealId: createdDeal.id,
          fee: { feeType: 'engagement', amount: parseFloat(newDealFees.engagement), percentage: null, currency: 'USD', description: 'Engagement fee', billingFrequency: 'one-time' }
        }));
      }
      if (newDealFees.monthly && parseFloat(newDealFees.monthly) > 0) {
        feePromises.push(createDealFee.mutateAsync({
          dealId: createdDeal.id,
          fee: { feeType: 'monthly', amount: parseFloat(newDealFees.monthly), percentage: null, currency: 'USD', description: 'Monthly retainer', billingFrequency: 'monthly' }
        }));
      }
      if (newDealFees.success && parseFloat(newDealFees.success) > 0) {
        feePromises.push(createDealFee.mutateAsync({
          dealId: createdDeal.id,
          fee: { feeType: 'success', amount: null, percentage: parseFloat(newDealFees.success), currency: 'USD', description: 'Success fee', billingFrequency: 'on-close' }
        }));
      }
      if (newDealFees.transaction && parseFloat(newDealFees.transaction) > 0) {
        feePromises.push(createDealFee.mutateAsync({
          dealId: createdDeal.id,
          fee: { feeType: 'transaction', amount: null, percentage: parseFloat(newDealFees.transaction), currency: 'USD', description: 'Transaction fee', billingFrequency: 'on-close' }
        }));
      }
      if (newDealFees.spread && parseFloat(newDealFees.spread) > 0) {
        feePromises.push(createDealFee.mutateAsync({
          dealId: createdDeal.id,
          fee: { feeType: 'spread', amount: null, percentage: parseFloat(newDealFees.spread), currency: 'USD', description: 'Spread', billingFrequency: 'on-close' }
        }));
      }
      
      if (feePromises.length > 0) {
        await Promise.all(feePromises);
      }
      
      toast.success("Asset Management deal created!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Real Estate', value: '', stage: 'Reception', lead: '', status: 'Active', progress: 0, description: '' });
      setNewDealFees({ engagement: '', monthly: '', success: '', transaction: '', spread: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to create deal");
    }
  };

  const handleStageChange = async (deal: Deal, newStage: string) => {
    const newProgress = getStageProgress(newStage);
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Stage Changed',
      user: currentUser?.name || 'System',
      details: `Stage changed from "${deal.stage}" to "${newStage}"`,
    };
    
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        stage: newStage,
        progress: newProgress,
        auditTrail: [...(deal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      toast.success(`Deal moved to ${newStage}`);
      if (selectedDeal?.id === deal.id) {
        setSelectedDeal({ ...deal, stage: newStage, progress: newProgress, auditTrail: [...(deal.auditTrail as AuditEntry[] || []), auditEntry] });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update stage");
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

  const handleAddTeamMember = async () => {
    if (!selectedDeal || !newTeamMember.name || !newTeamMember.role) {
      toast.error("Please fill in name and role");
      return;
    }
    
    const matchingUser = allUsers.find(user => 
      (newTeamMember.email && user.email === newTeamMember.email) ||
      user.name === newTeamMember.name
    );
    
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Team Member Added',
      user: currentUser?.name || 'System',
      details: `Added ${newTeamMember.name} (${newTeamMember.role}) to pod team`,
    };

    const userId = matchingUser?.id || crypto.randomUUID();
    const updatedPodTeam = [...(selectedDeal.podTeam as PodTeamMember[] || []), { ...newTeamMember, userId }];
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        podTeam: updatedPodTeam,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      toast.success("Team member added");
      setNewTeamMember({ name: '', role: '', email: '', phone: '', slack: '' });
      setTeamMemberSearch('');
      setSelectedDeal({ ...selectedDeal, podTeam: updatedPodTeam });
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member");
    }
  };

  const handleRemoveTeamMember = async (memberIndex: number) => {
    if (!selectedDeal) return;
    
    const member = (selectedDeal.podTeam as PodTeamMember[])[memberIndex];
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Team Member Removed',
      user: currentUser?.name || 'System',
      details: `Removed ${member.name} from pod team`,
    };

    const updatedPodTeam = (selectedDeal.podTeam as PodTeamMember[]).filter((_, idx) => idx !== memberIndex);
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        podTeam: updatedPodTeam,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      toast.success("Team member removed");
      setSelectedDeal({ ...selectedDeal, podTeam: updatedPodTeam });
    } catch (error: any) {
      toast.error(error.message || "Failed to remove team member");
    }
  };

  const handleDeleteDeal = async () => {
    if (!dealToDelete) return;
    try {
      await deleteDeal.mutateAsync(dealToDelete);
      toast.success("Deal deleted successfully");
      setShowDeleteDealDialog(false);
      setDealToDelete(null);
      if (selectedDeal?.id === dealToDelete) {
        setSelectedDeal(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete deal");
    }
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
                  <p className="text-sm text-muted-foreground">Invested</p>
                  <p className="text-2xl font-bold">{stats.investedDeals}</p>
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
            <Select value={stageFilter || "all"} onValueChange={(v) => setStageFilter(v === "all" ? null : v)}>
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
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-none"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="rounded-none"
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => setShowNewDealModal(true)} data-testid="button-new-am-deal">
              <Plus className="w-4 h-4 mr-2" />
              New AM Deal
            </Button>
          </div>
        </div>
        
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-3 gap-4">
            {filteredDeals.length > 0 ? (
              filteredDeals.map((deal: Deal) => (
                <Card 
                  key={deal.id} 
                  className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => { setSelectedDeal(deal); setActiveStageTab(deal.stage); }}
                  data-testid={`card-am-deal-${deal.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-base truncate flex-1">{deal.name}</h4>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); setActiveStageTab(deal.stage); }}>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingDeal(deal); setShowEditModal(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit Deal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-500" 
                            onClick={(e) => { e.stopPropagation(); setDealToDelete(deal.id); setShowDeleteDealDialog(true); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{deal.client}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">{deal.sector}</Badge>
                      <Badge variant="outline" className={cn("text-xs", getStageColor(deal.stage))}>{deal.stage}</Badge>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-lg font-bold text-primary">${deal.value}M</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{deal.progress}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                No Asset Management deals to display
              </div>
            )}
          </div>
        )}
        
        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Deal Timeline</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    if (calendarView === 'day') setCalendarDate(subDays(calendarDate, 1));
                    else if (calendarView === 'week') setCalendarDate(subWeeks(calendarDate, 1));
                    else setCalendarDate(subMonths(calendarDate, 1));
                  }}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[140px] text-center">
                    {calendarView === 'month' ? format(calendarDate, 'MMMM yyyy') :
                     calendarView === 'week' ? `Week of ${format(startOfWeek(calendarDate), 'MMM d')}` :
                     format(calendarDate, 'EEEE, MMM d')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (calendarView === 'day') setCalendarDate(addDays(calendarDate, 1));
                    else if (calendarView === 'week') setCalendarDate(addWeeks(calendarDate, 1));
                    else setCalendarDate(addMonths(calendarDate, 1));
                  }}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
                  {(['day', 'week', 'month'] as const).map(view => (
                    <Button
                      key={view}
                      variant={calendarView === view ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCalendarView(view)}
                      className="rounded-none capitalize"
                    >
                      {view}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deals.map(deal => {
                  const dealTasks = allTasks.filter(t => t.dealId === deal.id);
                  return (
                    <div key={deal.id} className="p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="font-medium">{deal.name}</span>
                          <Badge variant="outline" className={cn("text-xs", getStageColor(deal.stage))}>{deal.stage}</Badge>
                        </div>
                        <span className="text-sm font-medium text-primary">${deal.value}M</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {eachDayOfInterval({
                          start: startOfWeek(calendarDate),
                          end: endOfWeek(calendarDate)
                        }).map(day => {
                          const dayTasks = dealTasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));
                          return (
                            <div 
                              key={day.toISOString()} 
                              className={cn(
                                "p-2 rounded text-center",
                                isToday(day) ? "bg-primary/20 font-bold" : "bg-secondary/30",
                                dayTasks.length > 0 && "ring-1 ring-primary/50"
                              )}
                            >
                              <div className="text-muted-foreground">{format(day, 'EEE')}</div>
                              <div>{format(day, 'd')}</div>
                              {dayTasks.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {dayTasks.slice(0, 2).map(task => (
                                    <div key={task.id} className="text-[10px] bg-primary/20 rounded px-1 truncate">
                                      {task.title}
                                    </div>
                                  ))}
                                  {dayTasks.length > 2 && (
                                    <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 2} more</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {deals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No Asset Management deals to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Empty State */}
        {deals.length === 0 && !isLoading && viewMode === 'grid' && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Asset Management Deals Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first AM deal to get started</p>
              <Button onClick={() => setShowNewDealModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create AM Deal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* New Deal Modal */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Asset Management Deal</DialogTitle>
            <DialogDescription>Create a new deal for the AM division</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Deal Details</TabsTrigger>
              <TabsTrigger value="fees">Fee Structure</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid grid-cols-3 gap-4">
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
                  <Label>Value ($M) *</Label>
                  <Input
                    type="number"
                    value={newDeal.value}
                    placeholder="0"
                    onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                    data-testid="input-am-deal-value"
                  />
                </div>
                <div>
                  <Label>Initial Stage</Label>
                  <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </TabsContent>
            <TabsContent value="fees" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Engagement Fee ($)</Label>
                  <Input
                    type="number"
                    value={newDealFees.engagement}
                    placeholder="0"
                    onChange={(e) => setNewDealFees({ ...newDealFees, engagement: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Monthly Retainer ($)</Label>
                  <Input
                    type="number"
                    value={newDealFees.monthly}
                    placeholder="0"
                    onChange={(e) => setNewDealFees({ ...newDealFees, monthly: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Success Fee (%)</Label>
                  <Input
                    type="number"
                    value={newDealFees.success}
                    placeholder="0"
                    onChange={(e) => setNewDealFees({ ...newDealFees, success: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Transaction Fee (%)</Label>
                  <Input
                    type="number"
                    value={newDealFees.transaction}
                    placeholder="0"
                    onChange={(e) => setNewDealFees({ ...newDealFees, transaction: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Spread (%)</Label>
                  <Input
                    type="number"
                    value={newDealFees.spread}
                    placeholder="0"
                    onChange={(e) => setNewDealFees({ ...newDealFees, spread: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending} data-testid="button-create-am-deal">
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="bg-card border-border w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {selectedDeal?.name}
            </SheetTitle>
            <SheetDescription>{selectedDeal?.client}</SheetDescription>
          </SheetHeader>
          
          {selectedDeal && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="workspace">Workspace</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
              <ScrollArea className="h-[calc(100vh-280px)] mt-4">
                <TabsContent value="overview" className="space-y-4 pr-4">
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
                  
                  {/* Stage Progression */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Stage Progression</Label>
                    <div className="flex items-center gap-1 mt-2">
                      {DEAL_STAGES.map((stage, idx) => {
                        const isCompleted = getStageIndex(selectedDeal.stage) >= idx;
                        const isCurrent = selectedDeal.stage === stage;
                        return (
                          <div key={stage} className="flex-1">
                            <div 
                              className={cn(
                                "h-2 rounded-full transition-colors cursor-pointer",
                                isCompleted ? "bg-primary" : "bg-secondary",
                                isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              )}
                              onClick={() => handleStageChange(selectedDeal, stage)}
                            />
                            <p className={cn(
                              "text-[10px] text-center mt-1",
                              isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                            )}>{stage}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Fee Summary */}
                  {selectedDealFees.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Fee Structure</Label>
                      <div className="mt-2 space-y-2">
                        {selectedDealFees.map((fee: any) => (
                          <div key={fee.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                            <span className="text-sm capitalize">{fee.feeType}</span>
                            <span className="text-sm font-medium">
                              {fee.amount ? `$${fee.amount.toLocaleString()}` : `${fee.percentage}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Deal Tasks</Label>
                      <Button size="sm" variant="outline" onClick={() => setShowTaskDialog(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Assign Task
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {allTasks.filter(t => t.dealId === selectedDeal.id).map((task: any) => {
                        const assignee = allUsers.find(u => u.id === task.assignedTo);
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
                      {allTasks.filter(t => t.dealId === selectedDeal.id).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="workspace" className="pr-4">
                  <StageWorkSection
                    dealId={selectedDeal.id}
                    dealStage={selectedDeal.stage}
                    allUsers={allUsers}
                    currentUser={currentUser}
                    allTasks={allTasks}
                    activeStageTab={activeStageTab}
                    setActiveStageTab={setActiveStageTab}
                    createStageDocument={createStageDocument}
                    deleteStageDocument={deleteStageDocument}
                    createStagePodMember={createStagePodMember}
                    deleteStagePodMember={deleteStagePodMember}
                    createStageVoiceNote={createStageVoiceNote}
                    deleteStageVoiceNote={deleteStageVoiceNote}
                    createTaskComment={createTaskComment}
                  />
                </TabsContent>
                
                <TabsContent value="team" className="space-y-4 pr-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Add Team Member</Label>
                    <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
                      <Popover open={teamMemberOpen} onOpenChange={setTeamMemberOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {newTeamMember.name || "Search or enter name..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput 
                              placeholder="Type to search..." 
                              value={teamMemberSearch}
                              onValueChange={(value) => {
                                setTeamMemberSearch(value);
                                setNewTeamMember({ ...newTeamMember, name: value });
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="p-2 text-sm">
                                  Press enter to add "{teamMemberSearch}" as external contact
                                </div>
                              </CommandEmpty>
                              <CommandGroup heading="Team Members">
                                {filteredUsers.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    onSelect={() => {
                                      setNewTeamMember({
                                        ...newTeamMember,
                                        name: user.name,
                                        email: user.email,
                                        role: user.jobTitle || user.role || '',
                                        userId: user.id,
                                      });
                                      setTeamMemberOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", newTeamMember.name === user.name ? "opacity-100" : "opacity-0")} />
                                    <div>
                                      <div>{user.name}</div>
                                      <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input 
                        placeholder="Role" 
                        value={newTeamMember.role}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input 
                          placeholder="Email" 
                          value={newTeamMember.email}
                          onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                        />
                        <Input 
                          placeholder="Phone" 
                          value={newTeamMember.phone}
                          onChange={(e) => setNewTeamMember({ ...newTeamMember, phone: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddTeamMember} className="w-full">
                        <UserPlus className="w-4 h-4 mr-2" /> Add to Team
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Current Team ({(selectedDeal.podTeam as PodTeamMember[] || []).length})</Label>
                    <div className="space-y-2">
                      {(selectedDeal.podTeam as PodTeamMember[] || []).map((member, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="font-medium">{member.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.email && (
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Mail className="w-4 h-4" />
                              </Button>
                            )}
                            {member.phone && (
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Phone className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => handleRemoveTeamMember(idx)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(selectedDeal.podTeam as PodTeamMember[] || []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No team members yet</p>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="history" className="space-y-4 pr-4">
                  <Label className="text-xs text-muted-foreground">Audit Trail</Label>
                  <div className="space-y-3">
                    {(selectedDeal.auditTrail as AuditEntry[] || []).slice().reverse().map((entry) => (
                      <div key={entry.id} className="flex gap-3 p-3 bg-secondary/20 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <History className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{entry.action}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                          <p className="text-xs text-muted-foreground">by {entry.user}</p>
                        </div>
                      </div>
                    ))}
                    {(selectedDeal.auditTrail as AuditEntry[] || []).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
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
                  {allUsers.filter((u: any) => u.status === 'active').map((user: any) => (
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
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDealDialog} onOpenChange={setShowDeleteDealDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteDealDialog(false); setDealToDelete(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDeal} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
