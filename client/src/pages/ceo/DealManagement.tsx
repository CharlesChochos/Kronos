import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Search, Filter, MoreVertical, ArrowRight, Calendar, DollarSign, Briefcase, 
  Pencil, Trash2, Eye, Users, Phone, Mail, MessageSquare, Plus, X, 
  Building2, TrendingUp, FileText, Clock, CheckCircle2, ChevronRight,
  UserPlus, History, LayoutGrid, CalendarDays, ChevronLeft, Upload, GitCompare, ArrowUpDown, BarChart3,
  Mic, MicOff, Play, Pause, Square, Volume2, Download, UserCircle, ExternalLink, ArrowLeftCircle, Archive
} from "lucide-react";
import { 
  useCurrentUser, useDealsListing, useDeal, useCreateDeal, useUpdateDeal, useDeleteDeal, useMoveDealToOpportunity, useUsers, useTasks, useCreateDealFee,
  useStageDocuments, useCreateStageDocument, useDeleteStageDocument,
  useStagePodMembers, useCreateStagePodMember, useDeleteStagePodMember,
  useStageVoiceNotes, useCreateStageVoiceNote, useDeleteStageVoiceNote,
  useTaskComments, useCreateTaskComment, useCreateTask, useDeleteTask,
  useCustomSectors, useCreateCustomSector,
  useDealFees, type DealFeeType,
  useCreateDocument,
  useAllInvestors,
  useDealNotes, useCreateDealNote, type DealNoteType,
  useOnboardingStatus, type OnboardingStatus,
  useBulkDeleteDeals, useBulkMoveToOpportunity, useTransitionStage,
  useStartAiDocumentAnalysis, useAiDocumentAnalysis, useSaveAiSummaryAsNote,
  useArchiveDeal
} from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isToday, isBefore, isAfter, parseISO } from "date-fns";
import type { Deal, PodTeamMember, TaggedInvestor, AuditEntry } from "@shared/schema";
import { isDealEligibleUser } from "@shared/schema";
import { ObjectUploader, type UploadedFile } from "@/components/ObjectUploader";
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

const COMPARISON_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DEAL_STAGES = ['Origination', 'Structuring', 'Diligence', 'Legal', 'Close'];

function DealStageTeamCount({ dealId, stage }: { dealId: string; stage: string }) {
  const { data: stagePodMembers = [] } = useStagePodMembers(dealId, stage);
  const [showPopover, setShowPopover] = useState(false);
  
  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setShowPopover(true); }}>
          <span className="font-medium">{stagePodMembers.length} members</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              {stage} Stage Team
            </h4>
            <Badge variant="secondary" className="text-xs">{stagePodMembers.length}</Badge>
          </div>
          {stagePodMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team members assigned to this stage yet</p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {stagePodMembers.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-medium">
                      {member.userName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{member.userName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground truncate">{member.jobTitle || member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DealTotalTeamCount({ dealId, stage, podTeam = [] }: { dealId: string; stage: string; podTeam?: PodTeamMember[] }) {
  // Only fetch members for the current stage
  const { data: stagePodMembers = [] } = useStagePodMembers(dealId, stage);
  const [showPopover, setShowPopover] = useState(false);
  
  const distinctMembers = useMemo(() => {
    const seen = new Map<string, any>();
    // Add only current stage pod members
    stagePodMembers.forEach((member: any) => {
      if (member.userId && !seen.has(member.userId)) {
        seen.set(member.userId, { ...member, source: 'stage' });
      }
    });
    return Array.from(seen.values());
  }, [stagePodMembers]);
  
  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setShowPopover(true); }}>
          <span className="font-medium">{distinctMembers.length} members</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Deal Team
            </h4>
            <Badge variant="secondary" className="text-xs">{distinctMembers.length}</Badge>
          </div>
          {distinctMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team members assigned yet</p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {distinctMembers.map((member: any) => (
                  <div key={member.userId} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-medium">
                      {member.userName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{member.userName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground truncate">{member.jobTitle || member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DealTotalTeamCountNumber({ dealId, stage }: { dealId: string; stage: string }) {
  // Only fetch members for the current stage
  const { data: stagePodMembers = [] } = useStagePodMembers(dealId, stage);
  
  return <>{stagePodMembers.length}</>;
}

function DealNotesSection({ dealId, allUsers, dealAttachments = [] }: { dealId: string; allUsers: any[]; dealAttachments?: any[] }) {
  const { data: notes = [], isLoading } = useDealNotes(dealId);
  const createDealNote = useCreateDealNote();
  const [newNote, setNewNote] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // AI Document Analysis state
  const [showAiAnalysisDialog, setShowAiAnalysisDialog] = useState(false);
  const [selectedDocsForAnalysis, setSelectedDocsForAnalysis] = useState<{source: 'stage' | 'attachment'; id: string}[]>([]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const { data: stageDocuments = [] } = useStageDocuments(dealId);
  const startAnalysis = useStartAiDocumentAnalysis();
  const { data: analysisStatus } = useAiDocumentAnalysis(dealId, currentAnalysisId);
  const saveAsNote = useSaveAiSummaryAsNote();

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return allUsers.slice(0, 5);
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5);
  }, [allUsers, mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setNewNote(value);
    setCursorPosition(position);

    const textBeforeCursor = value.slice(0, position);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  };

  const insertMention = (userName: string) => {
    const textBeforeCursor = newNote.slice(0, cursorPosition);
    const textAfterCursor = newNote.slice(cursorPosition);
    const beforeAt = textBeforeCursor.replace(/@\w*$/, '');
    const mentionName = userName.replace(/\s+/g, '');
    const newText = `${beforeAt}@${mentionName} ${textAfterCursor}`;
    setNewNote(newText);
    setShowMentions(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    try {
      await createDealNote.mutateAsync({ dealId, content: newNote.trim() });
      setNewNote("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  const renderContentWithMentions = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-primary font-medium">{part}</span>;
      }
      return part;
    });
  };

  // Combine stage documents and deal attachments for AI analysis
  const allDocuments = useMemo(() => {
    const stageDocs = stageDocuments.map((doc: any) => ({
      source: 'stage' as const,
      id: doc.id,
      url: doc.url,
      filename: doc.fileName || doc.filename || 'Document',
      mimeType: doc.mimeType,
      category: doc.stage ? `${doc.stage} Stage` : 'Stage Document'
    }));
    
    const attachmentDocs = dealAttachments.map((att: any) => ({
      source: 'attachment' as const,
      id: att.id,
      url: att.objectPath || att.url,
      filename: att.filename || 'Attachment',
      mimeType: att.type,
      category: 'Deal Attachment'
    }));
    
    return [...stageDocs, ...attachmentDocs];
  }, [stageDocuments, dealAttachments]);

  const handleStartAnalysis = async () => {
    if (selectedDocsForAnalysis.length === 0) {
      toast.error("Please select at least one document");
      return;
    }
    
    try {
      const result = await startAnalysis.mutateAsync({ dealId, documents: selectedDocsForAnalysis });
      setCurrentAnalysisId(result.analysisId);
      toast.success("AI analysis started - this may take a minute");
    } catch (err: any) {
      toast.error(err.message || "Failed to start analysis");
    }
  };

  const handleSaveAsNote = async () => {
    if (!currentAnalysisId || analysisStatus?.status !== 'completed') return;
    
    try {
      await saveAsNote.mutateAsync({ dealId, analysisId: currentAnalysisId });
      toast.success("Summary saved as deal note");
      setShowAiAnalysisDialog(false);
      setCurrentAnalysisId(null);
      setSelectedDocsForAnalysis([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to save as note");
    }
  };

  const isDocSelected = (source: 'stage' | 'attachment', id: string) => {
    return selectedDocsForAnalysis.some(d => d.source === source && d.id === id);
  };

  const toggleDocSelection = (source: 'stage' | 'attachment', id: string) => {
    setSelectedDocsForAnalysis(prev => {
      const exists = prev.some(d => d.source === source && d.id === id);
      if (exists) {
        return prev.filter(d => !(d.source === source && d.id === id));
      }
      return [...prev, { source, id }];
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Deal Notes
        </h4>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAiAnalysisDialog(true)}
            disabled={allDocuments.length === 0}
            data-testid="button-ai-analyze-docs"
          >
            <FileText className="w-4 h-4 mr-1" />
            AI Analyze Docs
          </Button>
          <Badge variant="secondary">{notes.length} notes</Badge>
        </div>
      </div>

      {/* AI Document Analysis Dialog */}
      <Dialog open={showAiAnalysisDialog} onOpenChange={(open) => {
        setShowAiAnalysisDialog(open);
        if (!open) {
          setCurrentAnalysisId(null);
          setSelectedDocsForAnalysis([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              AI Document Analysis
            </DialogTitle>
            <DialogDescription>
              Select documents to analyze. AI will generate a comprehensive summary that you can save as a deal note.
            </DialogDescription>
          </DialogHeader>
          
          {!currentAnalysisId ? (
            <>
              <div className="space-y-3 py-4">
                <Label>Select documents to analyze:</Label>
                {allDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm bg-secondary/20 rounded-lg">
                    No documents uploaded yet. Add documents in the Stage Work sections first.
                  </div>
                ) : (
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {allDocuments.map((doc: any) => (
                        <div
                          key={`${doc.source}-${doc.id}`}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                            isDocSelected(doc.source, doc.id) 
                              ? "bg-primary/20 border border-primary/50" 
                              : "bg-secondary/30 hover:bg-secondary/50"
                          )}
                          onClick={() => toggleDocSelection(doc.source, doc.id)}
                        >
                          <Checkbox 
                            checked={isDocSelected(doc.source, doc.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleDocSelection(doc.source, doc.id)}
                          />
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{doc.filename}</div>
                            <div className="text-xs text-muted-foreground">{doc.category}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAiAnalysisDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleStartAnalysis}
                  disabled={selectedDocsForAnalysis.length === 0 || startAnalysis.isPending}
                >
                  {startAnalysis.isPending ? "Starting..." : "Start Analysis"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4">
                {analysisStatus?.status === 'pending' || analysisStatus?.status === 'processing' ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {analysisStatus?.status === 'pending' ? 'Preparing analysis...' : 'Analyzing documents...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">This may take a minute for large documents</p>
                  </div>
                ) : analysisStatus?.status === 'completed' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Analysis Complete</span>
                    </div>
                    <ScrollArea className="h-[300px] border rounded-lg p-4 bg-secondary/10">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {analysisStatus.summary}
                      </div>
                    </ScrollArea>
                  </div>
                ) : analysisStatus?.status === 'failed' ? (
                  <div className="text-center py-8 text-red-500">
                    <X className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-medium">Analysis Failed</p>
                    <p className="text-sm text-muted-foreground mt-2">{analysisStatus.error || 'Unknown error occurred'}</p>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCurrentAnalysisId(null);
                    setSelectedDocsForAnalysis([]);
                  }}
                >
                  {analysisStatus?.status === 'completed' ? 'Discard' : 'Cancel'}
                </Button>
                {analysisStatus?.status === 'completed' && (
                  <Button onClick={handleSaveAsNote} disabled={saveAsNote.isPending}>
                    {saveAsNote.isPending ? "Saving..." : "Save as Note"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Add a note... Use @ to mention team members"
          value={newNote}
          onChange={handleInputChange}
          className="min-h-[80px]"
          data-testid="input-deal-note"
        />
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                onClick={() => insertMention(user.name)}
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                  {user.name.charAt(0)}
                </div>
                <span className="text-sm">{user.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Button 
            size="sm" 
            onClick={handleSubmit}
            disabled={!newNote.trim() || createDealNote.isPending}
            data-testid="button-submit-deal-note"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Note
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {notes.map((note: DealNoteType) => (
            <div key={note.id} className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {note.userName?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{note.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {renderContentWithMentions(note.content)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No notes yet. Add the first note above.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const INVESTOR_TYPES = ['PE', 'VC', 'Strategic', 'Family Office', 'Hedge Fund', 'Sovereign Wealth'];
const INVESTOR_STATUSES = ['Contacted', 'Interested', 'In DD', 'Term Sheet', 'Passed', 'Closed'];

type StageWorkSectionProps = {
  dealId: string;
  dealName: string;
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
  createTask: any;
  createDocument: any;
  deleteTask: any;
  onAuditEntry?: (action: string, details: string) => Promise<void>;
  totalTeamCount?: number;
  onboardingStatus?: OnboardingStatus;
  onShowOnboardingWarning?: (userName: string, missingResume: boolean, missingPersonality: boolean, onConfirm?: () => void) => void;
};

function StageWorkSection({
  dealId,
  dealName,
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
  createTaskComment,
  createTask,
  createDocument,
  deleteTask,
  onAuditEntry,
  totalTeamCount,
  onboardingStatus = {},
  onShowOnboardingWarning
}: StageWorkSectionProps) {
  const { data: stageDocuments = [] } = useStageDocuments(dealId, activeStageTab);
  const { data: stagePodMembers = [] } = useStagePodMembers(dealId, activeStageTab);
  const { data: stageVoiceNotes = [] } = useStageVoiceNotes(dealId, activeStageTab);
  
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTeamPopover, setShowTeamPopover] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentCategory, setDocumentCategory] = useState("General");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberRole, setMemberRole] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    return allUsers
      .filter((user: any) => isDealEligibleUser(user)) // Only show deal-eligible users
      .filter((user: any) => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      ).slice(0, 5);
  }, [allUsers, memberSearch]);
  
  const handleAddDocument = async () => {
    if (documentFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }
    
    const categoryMap: Record<string, string> = {
      'General': 'Other',
      'Financial': 'Financial Documents',
      'Legal': 'Legal',
      'Technical': 'Reports',
      'Presentation': 'Presentations'
    };
    
    let uploadedCount = 0;
    let failedCount = 0;
    
    try {
      for (const file of documentFiles) {
        try {
          const title = file.name;
          
          // First upload the file to get a URL
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
          }
          
          const uploadResult = await uploadResponse.json();
          const fileUrl = uploadResult.url;
          
          // Save to stage documents with the URL
          await createStageDocument.mutateAsync({
            dealId,
            doc: {
              stage: activeStageTab,
              title: title,
              filename: file.name,
              url: fileUrl,
              mimeType: file.type,
              size: file.size,
            }
          });
          
          // Also read file as base64 for document library archive
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });
          
          try {
            await createDocument.mutateAsync({
              title: title,
              filename: `[${dealName}] ${title}`,
              content: base64Data,
              category: categoryMap[documentCategory] || 'Other',
              dealId: dealId,
              tags: [activeStageTab, 'Stage Work'],
              type: 'stage_document',
              uploadedBy: currentUser?.id,
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
            });
          } catch (archiveError) {
            console.error('Failed to archive document (non-critical):', archiveError);
          }
          
          uploadedCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failedCount++;
        }
      }
      
      if (onAuditEntry && uploadedCount > 0) {
        await onAuditEntry('Documents Uploaded', `${uploadedCount} document(s) uploaded to ${activeStageTab} stage`);
      }
      
      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} document(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
      } else {
        toast.error("Failed to upload documents");
      }
      
      setDocumentTitle("");
      setDocumentCategory("General");
      setDocumentFiles([]);
      setShowAddDocument(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error("Failed to upload documents");
    }
  };
  
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await createTask.mutateAsync({
        title: newTaskTitle.trim(),
        description: '',
        status: 'Pending',
        priority: newTaskPriority,
        dealId: dealId,
        dealStage: activeStageTab,
        assignedTo: currentUser?.id || undefined,
        type: 'Deal Task',
        dueDate: nextWeek.toISOString().split('T')[0]
      });
      if (onAuditEntry) {
        await onAuditEntry('Task Created', `${newTaskTitle.trim()} created in ${activeStageTab} stage`);
      }
      toast.success("Task created");
      setNewTaskTitle("");
      setNewTaskPriority("Medium");
      setShowAddTask(false);
    } catch (error) {
      toast.error("Failed to create task");
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
        member: {
          stage: activeStageTab,
          userId: selectedMember.id,
          userName: selectedMember.name,
          role: memberRole || selectedMember.role || 'Team Member',
          email: selectedMember.email || '',
          phone: selectedMember.phone || '',
        }
      });
      if (onAuditEntry) {
        await onAuditEntry('Team Member Added', `${selectedMember.name} added to ${activeStageTab} stage`);
      }
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
          note: {
            stage: activeStageTab,
            title: voiceTitle || `Note ${format(new Date(), 'MMM d, h:mm a')}`,
            filename: `voice_note_${Date.now()}.webm`,
            duration: recordingTime,
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
        <Popover open={showTeamPopover} onOpenChange={setShowTeamPopover}>
          <PopoverTrigger asChild>
            <Card 
              className="bg-secondary/20 cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowTeamPopover(true); }}
            >
              <CardContent className="p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                <div className="text-lg font-bold">{stagePodMembers.length}</div>
                <div className="text-xs text-muted-foreground">Team</div>
              </CardContent>
            </Card>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  {activeStageTab} Stage Team
                </h4>
                <Badge variant="secondary" className="text-xs">{stagePodMembers.length}</Badge>
              </div>
              {stagePodMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No team members assigned to this stage yet</p>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {stagePodMembers.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-medium">
                          {member.userName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{member.userName || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground truncate">{member.jobTitle || member.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  setDocumentFiles(Array.from(files));
                }
              }}
              className="w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              data-testid="input-file-upload"
            />
            {documentFiles.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Selected: {documentFiles.length} file(s) - {documentFiles.map(f => f.name).join(', ')}
              </div>
            )}
            <Select value={documentCategory} onValueChange={setDocumentCategory}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-document-category">
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
              <Button size="sm" onClick={handleAddDocument} className="flex-1" disabled={documentFiles.length === 0} data-testid="button-upload-document">
                Upload
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddDocument(false); setDocumentFiles([]); setDocumentTitle(''); }}>Cancel</Button>
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
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {(doc.url || doc.fileData) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          const viewUrl = doc.url || doc.fileData;
                          if (viewUrl) import('@/lib/utils').then(m => m.openUrlInNewTab(viewUrl));
                        }}
                        title="View"
                        data-testid={`view-doc-${doc.id}`}
                      >
                        <ExternalLink className="w-3 h-3 text-green-400" />
                      </Button>
                    )}
                    {(doc.url || doc.fileData) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          const downloadUrl = doc.url || doc.fileData;
                          if (downloadUrl) {
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = doc.filename || doc.title || 'document';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        title="Download"
                        data-testid={`download-doc-${doc.id}`}
                      >
                        <Download className="w-3 h-3 text-blue-400" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => deleteStageDocument.mutate({ id: doc.id, dealId, stage: activeStageTab })}
                      title="Delete"
                      data-testid={`delete-doc-${doc.id}`}
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
            <Users className="w-4 h-4 text-green-400" /> Stage Team
          </h5>
          <Button size="sm" variant="ghost" onClick={() => setShowAddMember(!showAddMember)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {showAddMember && (
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="h-8 text-sm pl-7"
                data-testid="input-team-search"
              />
            </div>
            {memberSearch.length >= 2 && (
              <div className="max-h-[120px] overflow-y-auto border rounded-md bg-background">
                {filteredMembers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">No users found</div>
                ) : (
                  filteredMembers.map((user: any) => {
                    const userOnboarding = onboardingStatus[user.id];
                    const isOnboardingComplete = userOnboarding?.isComplete ?? false;
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          if (!isOnboardingComplete && onShowOnboardingWarning) {
                            onShowOnboardingWarning(user.name, !userOnboarding?.hasResume, !userOnboarding?.hasPersonality, () => {
                              setSelectedMember(user);
                              setMemberRole(user.jobTitle || user.role || 'Team Member');
                            });
                            setMemberSearch('');
                            return;
                          }
                          setSelectedMember(user);
                          setMemberRole(user.jobTitle || user.role || 'Team Member');
                          setMemberSearch('');
                        }}
                        className={cn(
                          "w-full p-2 text-left hover:bg-secondary/50 flex items-center gap-2 text-sm",
                          selectedMember?.id === user.id && "bg-primary/10"
                        )}
                        data-testid={`team-member-${user.id}`}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                          isOnboardingComplete ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                        )}>
                          {user.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {user.name}
                            {!isOnboardingComplete && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded">Incomplete</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedMember && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded text-sm">
                <Check className="w-4 h-4 text-primary" />
                <span>Selected: {selectedMember.name}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setSelectedMember(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            <Input
              placeholder="Role for this stage"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-member-role"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddMember} className="flex-1" disabled={!selectedMember} data-testid="button-add-member">Add Member</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddMember(false); setSelectedMember(null); setMemberSearch(''); }}>Cancel</Button>
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
                    onClick={() => deleteStagePodMember.mutate(member.id)}
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <span className="text-xs text-muted-foreground mr-1">{note.recorderName || note.authorName}</span>
                    {note.url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => import('@/lib/utils').then(m => m.openUrlInNewTab(note.url))}
                        data-testid={`download-note-${note.id}`}
                      >
                        <Download className="w-3 h-3 text-purple-400" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => deleteStageVoiceNote.mutate(note.id)}
                      data-testid={`delete-note-${note.id}`}
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
      
      {/* Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-400" /> Deal Tasks
          </h5>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{stageTasks.length} tasks</Badge>
            <Button size="sm" variant="ghost" onClick={() => setShowAddTask(!showAddTask)} data-testid="button-add-task-toggle">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {showAddTask && (
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <Input
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-task-title"
            />
            <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-task-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low Priority</SelectItem>
                <SelectItem value="Medium">Medium Priority</SelectItem>
                <SelectItem value="High">High Priority</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddTask} className="flex-1" disabled={!newTaskTitle.trim()} data-testid="button-create-task">
                Create Task
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }}>Cancel</Button>
            </div>
          </div>
        )}
        
        <ScrollArea className="h-[150px]">
          {stageTasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No tasks for this deal
            </div>
          ) : (
            <div className="space-y-2">
              {stageTasks.map((task: any) => (
                <div key={task.id} className="bg-secondary/20 rounded-lg overflow-hidden group">
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`delete-task-${task.id}`}
                          >
                            <X className="w-3 h-3 text-red-400" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Task</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{task.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteTask.mutate(task.id);
                                toast.success("Task deleted");
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                      users={allUsers}
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
  createTaskComment,
  users = []
}: { 
  taskId: string;
  currentUser: any;
  createTaskComment: any;
  users?: any[];
}) {
  const { data: comments = [] } = useTaskComments(taskId);
  const [newComment, setNewComment] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const mentionableUsers = useMemo(() => {
    const activeUsers = users.filter(u => u.status === 'active' && isDealEligibleUser(u));
    if (!mentionQuery) return activeUsers.slice(0, 5);
    return activeUsers.filter(u => 
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5);
  }, [users, mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewComment(value);
    
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      if (charBeforeAt === ' ' || atIndex === 0) {
        const query = textBeforeCursor.substring(atIndex + 1);
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setShowMentionDropdown(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(null);
  };

  const insertMention = (user: any) => {
    if (mentionStartIndex === null) return;
    const beforeMention = newComment.substring(0, mentionStartIndex);
    const afterMention = newComment.substring(mentionStartIndex + mentionQuery.length + 1);
    const newMessage = `${beforeMention}@${user.name} ${afterMention}`;
    setNewComment(newMessage);
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(null);
    setSelectedMentionIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionDropdown) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddComment();
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < mentionableUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (mentionableUsers[selectedMentionIndex]) {
        insertMention(mentionableUsers[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  };
  
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

  const renderContentWithMentions = (content: string) => {
    const parts = content.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-primary font-medium">{part}</span>;
      }
      return part;
    });
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
              <p>{renderContentWithMentions(comment.content)}</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Add a comment... (use @ to mention)"
            value={newComment}
            onChange={handleInputChange}
            className="h-7 text-xs"
            onKeyDown={handleKeyDown}
          />
          <Button 
            size="sm" 
            className="h-7 px-2"
            onClick={handleAddComment}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {showMentionDropdown && mentionableUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-popover border border-border rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
            {mentionableUsers.map((user, index) => (
              <div
                key={user.id}
                className={cn(
                  "px-2 py-1.5 text-xs cursor-pointer flex items-center gap-2",
                  index === selectedMentionIndex ? "bg-accent" : "hover:bg-accent"
                )}
                onClick={() => insertMention(user)}
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary">
                  {(user.name || "?").split(' ').map((n: string) => n[0]).join('')}
                </div>
                <span>{user.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type DealManagementProps = {
  role?: 'CEO' | 'Employee';
};

export default function DealManagement({ role = 'CEO' }: DealManagementProps) {
  const searchString = useSearch();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: allDeals = [], isLoading } = useDealsListing();
  const { data: allUsers = [] } = useUsers();
  const { data: allTasks = [] } = useTasks();
  const { data: stakeholders = [] } = useAllInvestors();
  const { data: onboardingStatus = {} } = useOnboardingStatus();
  
  // Filter deals based on access level - non-admin users only see deals they're assigned to
  // Filter out Opportunities, Asset Management deals, and archived deals - those appear in their own respective pages
  const deals = useMemo(() => {
    // Filter out opportunities, asset management deals, and archived deals - they have their own pages
    const investmentBankingDeals = allDeals.filter(deal => {
      const dealType = (deal as any).dealType;
      const isArchived = deal.status === 'Archived' || (deal as any).archivedAt;
      return dealType !== 'Opportunity' && dealType !== 'Asset Management' && !isArchived;
    });
    
    if (currentUser?.accessLevel === 'admin') {
      return investmentBankingDeals;
    }
    // For employees, filter to only show deals where they are in the pod team
    // If user data is not yet available, show no deals until we can verify access
    if (!currentUser?.id && !currentUser?.email && !currentUser?.name) {
      return [];
    }
    return investmentBankingDeals.filter(deal => {
      const podTeam = deal.podTeam || [];
      return podTeam.some((member: PodTeamMember) => 
        (currentUser.id && member.userId === currentUser.id) || 
        (currentUser.email && member.email === currentUser.email) ||
        (currentUser.name && member.name === currentUser.name)
      );
    });
  }, [allDeals, role, currentUser]);
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const archiveDeal = useArchiveDeal();
  const moveDealToOpportunity = useMoveDealToOpportunity();
  const bulkDeleteDeals = useBulkDeleteDeals();
  const bulkMoveToOpportunity = useBulkMoveToOpportunity();
  const createDealFee = useCreateDealFee();
  const createDocument = useCreateDocument();
  
  // Custom sectors
  const { data: customSectors = [] } = useCustomSectors();
  const createCustomSector = useCreateCustomSector();
  
  // Stage-based mutations
  const createStageDocument = useCreateStageDocument();
  const deleteStageDocument = useDeleteStageDocument();
  const createStagePodMember = useCreateStagePodMember();
  const deleteStagePodMember = useDeleteStagePodMember();
  const createStageVoiceNote = useCreateStageVoiceNote();
  const deleteStageVoiceNote = useDeleteStageVoiceNote();
  const createTaskComment = useCreateTaskComment();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingLeadDealId, setEditingLeadDealId] = useState<string | null>(null);
  const [editingLeadValue, setEditingLeadValue] = useState("");
  
  // Client contact editing state
  const [editingClientContact, setEditingClientContact] = useState(false);
  const [clientContactForm, setClientContactForm] = useState({ name: '', email: '', phone: '', role: '' });
  
  // Fetch the FULL deal data (with attachments) when a deal is selected
  const { data: fullDealData } = useDeal(selectedDeal?.id || '');
  
  // Use fullDealData for attachments display (includes large fields excluded from listing)
  const selectedDealWithAttachments = fullDealData || selectedDeal;
  
  // Fetch fees for the selected deal
  const { data: selectedDealFees = [] } = useDealFees(selectedDeal?.id || '');
  // Use the fresh deal data for stage (after updates) rather than stale selectedDeal state
  const currentDealStage = fullDealData?.stage || selectedDeal?.stage || 'Origination';
  // Fetch pod members for the CURRENT stage of the selected deal only
  const { data: currentStagePodMembers = [], refetch: refetchPodMembers } = useStagePodMembers(selectedDeal?.id || '', currentDealStage);
  // Count is just the current stage team size
  const currentTeamCount = currentStagePodMembers.length;
  
  // When deal stage changes, poll for pod members until they appear (async pod formation takes 10-20s)
  const [isPodPolling, setIsPodPolling] = useState(false);
  useEffect(() => {
    if (!selectedDeal?.id || !currentDealStage) return;
    
    // Start polling when stage changes
    setIsPodPolling(true);
    let pollCount = 0;
    const maxPolls = 10; // Poll up to 10 times (30 seconds total)
    
    const pollForPod = () => {
      refetchPodMembers().then((result) => {
        pollCount++;
        // Stop if we found members or hit max polls
        if ((result.data && result.data.length > 0) || pollCount >= maxPolls) {
          setIsPodPolling(false);
          return;
        }
        // Continue polling every 3 seconds
        setTimeout(pollForPod, 3000);
      });
    };
    
    // Start polling
    pollForPod();
    
    return () => setIsPodPolling(false);
  }, [selectedDeal?.id, currentDealStage]);
  const [activeStageTab, setActiveStageTab] = useState("Origination");
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'compare'>('grid');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDeal, setSelectedCalendarDeal] = useState<Deal | null>(null);
  const [calendarDealSearch, setCalendarDealSearch] = useState("");
  
  const [selectedCompareDeals, setSelectedCompareDeals] = useState<string[]>([]);
  const [compareSortBy, setCompareSortBy] = useState<string>("value");
  
  // Task detail modal for calendar view
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedCalendarTask, setSelectedCalendarTask] = useState<any>(null);
  
  // Delete deal confirmation dialog
  const [showDeleteDealDialog, setShowDeleteDealDialog] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);
  
  // Archive deal dialog
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [dealToArchive, setDealToArchive] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('');
  const [archiveNotes, setArchiveNotes] = useState<string>('');
  
  // Onboarding warning dialog
  const [showOnboardingWarning, setShowOnboardingWarning] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ userId: string; userName: string; missingResume: boolean; missingPersonality: boolean; onConfirm?: () => void } | null>(null);
  
  const openTaskDetail = (task: any, deal: Deal) => {
    setSelectedCalendarTask({ ...task, deal });
    setShowTaskDetailModal(true);
  };

  // Voice Notes State
  type DealVoiceNote = {
    id: string;
    title: string;
    duration: number;
    authorName: string;
    createdAt: string;
  };
  const [dealVoiceNotes, setDealVoiceNotes] = useState<Record<string, DealVoiceNote[]>>({});
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const [voiceNoteTitle, setVoiceNoteTitle] = useState("");
  const voiceRecordingInterval = useRef<NodeJS.Timeout | null>(null);
  const voicePlaybackInterval = useRef<NodeJS.Timeout | null>(null);
  const [playingVoiceNoteId, setPlayingVoiceNoteId] = useState<string | null>(null);
  const [voicePlayProgress, setVoicePlayProgress] = useState(0);

  // Reset voice recording state when deal changes or component unmounts
  useEffect(() => {
    if (isRecordingVoice) {
      if (voiceRecordingInterval.current) {
        clearInterval(voiceRecordingInterval.current);
      }
      setIsRecordingVoice(false);
      setVoiceRecordingTime(0);
      setVoiceNoteTitle("");
    }
    if (playingVoiceNoteId) {
      if (voicePlaybackInterval.current) {
        clearInterval(voicePlaybackInterval.current);
      }
      setPlayingVoiceNoteId(null);
      setVoicePlayProgress(0);
    }
  }, [selectedDeal?.id]);
  
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Technology',
    customSector: '',
    value: '',
    stage: 'Origination',
    lead: '',
    status: 'Active',
    progress: 0,
    skipPodFormation: false,
  });
  
  const [newDealFees, setNewDealFees] = useState<{
    engagement: string;
    monthly: string;
    success: string;
    transaction: string;
    spread: string;
  }>({
    engagement: '',
    monthly: '',
    success: '',
    transaction: '',
    spread: '',
  });
  
  const BASE_SECTORS = ['Technology', 'Healthcare', 'Energy', 'Consumer', 'Industrials', 'Financial'];
  const SECTORS = useMemo(() => {
    const customNames = customSectors.map(s => s.name);
    // Combine base sectors with custom sectors, avoiding duplicates
    const allSectors = [...BASE_SECTORS, ...customNames.filter(name => !BASE_SECTORS.includes(name))];
    return [...allSectors, 'Other'];
  }, [customSectors]);
  const [sectorOpen, setSectorOpen] = useState(false);
  const [editSectorOpen, setEditSectorOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [editCustomSector, setEditCustomSector] = useState('');

  const [newTeamMember, setNewTeamMember] = useState<PodTeamMember>({
    name: '',
    role: '',
    email: '',
    phone: '',
    slack: '',
  });
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [teamMemberOpen, setTeamMemberOpen] = useState(false);
  
  // Stage change confirmation dialog state
  const [showStageChangeDialog, setShowStageChangeDialog] = useState(false);
  const [stageChangeDeal, setStageChangeDeal] = useState<Deal | null>(null);
  const [stageChangeTarget, setStageChangeTarget] = useState<string>('');
  const [skipStageChangePodFormation, setSkipStageChangePodFormation] = useState(false);
  const transitionStage = useTransitionStage();
  
  const filteredUsers = useMemo(() => {
    if (!teamMemberSearch || teamMemberSearch.length < 2) return [];
    const query = teamMemberSearch.toLowerCase();
    return allUsers
      .filter(user => isDealEligibleUser(user)) // Only show deal-eligible users
      .filter(user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      ).slice(0, 5);
  }, [allUsers, teamMemberSearch]);

  const [newInvestor, setNewInvestor] = useState<Omit<TaggedInvestor, 'id'>>({
    name: '',
    firm: '',
    type: 'PE',
    status: 'Contacted',
    notes: '',
    email: '',
    phone: '',
    website: '',
  });
  const [investorSearchOpen, setInvestorSearchOpen] = useState(false);
  const [investorSearchQuery, setInvestorSearchQuery] = useState('');

  const crmInvestors = useMemo(() => {
    return stakeholders.map(s => ({
        id: s.id,
        name: s.name,
        firm: s.title || s.company || s.name,
        type: (s.notes?.match(/Type: ([^|,]+)/)?.[1]) || 'PE',
        email: s.email || '',
        phone: s.phone || '',
        website: s.website || '',
        focus: s.focus || '',
      }));
  }, [stakeholders]);

  const filteredCrmInvestors = useMemo(() => {
    if (!investorSearchQuery) return crmInvestors;
    const query = investorSearchQuery.toLowerCase();
    return crmInvestors.filter(inv => 
      inv.name.toLowerCase().includes(query) || 
      inv.firm.toLowerCase().includes(query)
    );
  }, [crmInvestors, investorSearchQuery]);

  const handleSelectCrmInvestor = (investor: typeof crmInvestors[0]) => {
    setNewInvestor({
      name: investor.name,
      firm: investor.firm,
      type: investor.type,
      status: 'Contacted',
      notes: investor.focus ? `Focus: ${investor.focus}` : '',
      email: investor.email,
      phone: investor.phone,
      website: investor.website,
    });
    setInvestorSearchOpen(false);
    setInvestorSearchQuery('');
  };

  // Handle URL query parameter for selecting a specific deal
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

  // Keep selectedDeal in sync with fresh data from deals query
  useEffect(() => {
    if (selectedDeal && deals.length > 0) {
      const freshDeal = deals.find(d => d.id === selectedDeal.id);
      if (freshDeal) {
        setSelectedDeal(freshDeal);
      }
    }
  }, [deals]);

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch = !debouncedSearchQuery || 
        deal.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        deal.client.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        deal.sector.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesStage = !stageFilter || deal.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, debouncedSearchQuery, stageFilter]);

  const getStageIndex = (stage: string) => DEAL_STAGES.indexOf(stage);
  const getStageProgress = (stage: string) => Math.round(((getStageIndex(stage) + 1) / DEAL_STAGES.length) * 100);

  // Voice Note Functions
  const formatVoiceDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startVoiceRecording = () => {
    setIsRecordingVoice(true);
    setVoiceRecordingTime(0);
    voiceRecordingInterval.current = setInterval(() => {
      setVoiceRecordingTime(prev => prev + 1);
    }, 1000);
    toast.info("Recording started");
  };

  const stopVoiceRecording = () => {
    setIsRecordingVoice(false);
    if (voiceRecordingInterval.current) {
      clearInterval(voiceRecordingInterval.current);
    }

    if (selectedDeal && voiceRecordingTime > 0) {
      const newNote = {
        id: Date.now().toString(),
        title: voiceNoteTitle || `Note ${format(new Date(), 'MMM d, h:mm a')}`,
        duration: voiceRecordingTime,
        authorName: currentUser?.name || "Unknown",
        createdAt: new Date().toISOString()
      };

      setDealVoiceNotes(prev => ({
        ...prev,
        [selectedDeal.id]: [...(prev[selectedDeal.id] || []), newNote]
      }));
      
      setVoiceNoteTitle("");
      setVoiceRecordingTime(0);
      toast.success("Voice note saved!");
    }
  };

  const cancelVoiceRecording = () => {
    setIsRecordingVoice(false);
    if (voiceRecordingInterval.current) {
      clearInterval(voiceRecordingInterval.current);
    }
    setVoiceRecordingTime(0);
    setVoiceNoteTitle("");
  };

  const toggleVoiceNotePlay = (noteId: string, duration: number) => {
    // Always clear any existing playback interval first
    if (voicePlaybackInterval.current) {
      clearInterval(voicePlaybackInterval.current);
      voicePlaybackInterval.current = null;
    }

    if (playingVoiceNoteId === noteId) {
      // Stop playing current note
      setPlayingVoiceNoteId(null);
      setVoicePlayProgress(0);
    } else {
      // Start playing new note
      setPlayingVoiceNoteId(noteId);
      setVoicePlayProgress(0);
      voicePlaybackInterval.current = setInterval(() => {
        setVoicePlayProgress(prev => {
          if (prev >= 100) {
            if (voicePlaybackInterval.current) {
              clearInterval(voicePlaybackInterval.current);
              voicePlaybackInterval.current = null;
            }
            setPlayingVoiceNoteId(null);
            return 0;
          }
          return prev + (100 / duration);
        });
      }, 1000);
    }
  };

  const deleteVoiceNote = (dealId: string, noteId: string) => {
    setDealVoiceNotes(prev => ({
      ...prev,
      [dealId]: (prev[dealId] || []).filter(n => n.id !== noteId)
    }));
    toast.success("Voice note deleted");
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
    
    const finalSector = newDeal.sector === 'Other' && newDeal.customSector ? newDeal.customSector : newDeal.sector;
    
    // Save custom sector if it's a new one not in the existing list
    const isCustomSector = newDeal.sector === 'Other' && newDeal.customSector;
    const existingCustomSectorNames = customSectors.map(s => s.name.toLowerCase());
    const isNewCustomSector = isCustomSector && !existingCustomSectorNames.includes(newDeal.customSector.toLowerCase()) && !BASE_SECTORS.includes(newDeal.customSector);
    
    try {
      // Save the custom sector first if it's new
      if (isNewCustomSector) {
        try {
          await createCustomSector.mutateAsync(newDeal.customSector);
        } catch (e) {
          // Ignore if sector already exists (duplicate)
          console.log("Custom sector may already exist:", e);
        }
      }
      
      const createdDeal = await createDeal.mutateAsync({
        name: newDeal.name,
        client: newDeal.client,
        clientContactName: null,
        clientContactEmail: null,
        clientContactPhone: null,
        clientContactRole: null,
        sector: finalSector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: getStageProgress(newDeal.stage),
        dealType: 'M&A',
        description: null,
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
        skipPodFormation: newDeal.skipPodFormation,
      } as any);
      
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
      
      toast.success("Deal created successfully!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Technology', customSector: '', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0, skipPodFormation: false });
      setNewDealFees({ engagement: '', monthly: '', success: '', transaction: '', spread: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to create deal");
    }
  };

  const handleStageChange = async (deal: Deal, newStage: string) => {
    // Show confirmation dialog instead of directly changing stage
    setStageChangeDeal(deal);
    setStageChangeTarget(newStage);
    setSkipStageChangePodFormation(false);
    setShowStageChangeDialog(true);
  };
  
  const confirmStageChange = async () => {
    if (!stageChangeDeal || !stageChangeTarget) return;
    
    const newProgress = getStageProgress(stageChangeTarget);
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Stage Changed',
      user: currentUser?.name || 'System',
      details: `Stage changed from "${stageChangeDeal.stage}" to "${stageChangeTarget}"${skipStageChangePodFormation ? ' (team auto-assignment skipped)' : ''}`,
    };
    
    try {
      if (skipStageChangePodFormation) {
        toast.loading("Changing stage...", { id: "stage-change" });
      } else {
        toast.loading("Changing stage and updating team...", { id: "stage-change" });
      }
      
      // Use the transition stage API which handles pod formation
      await transitionStage.mutateAsync({
        dealId: stageChangeDeal.id,
        newStage: stageChangeTarget,
        skipPodFormation: skipStageChangePodFormation,
      });
      
      // Also update the local deal audit trail
      await updateDeal.mutateAsync({
        id: stageChangeDeal.id,
        progress: newProgress,
        auditTrail: [...(stageChangeDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      
      if (skipStageChangePodFormation) {
        toast.success(`Deal moved to ${stageChangeTarget}. You can manually assign team members.`, { id: "stage-change" });
      } else {
        toast.success(`Deal moved to ${stageChangeTarget}. Team updated.`, { id: "stage-change" });
      }
      
      if (selectedDeal?.id === stageChangeDeal.id) {
        setSelectedDeal({ ...stageChangeDeal, stage: stageChangeTarget, progress: newProgress, auditTrail: [...(stageChangeDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      }
      
      setShowStageChangeDialog(false);
      setStageChangeDeal(null);
      setStageChangeTarget('');
      setSkipStageChangePodFormation(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update stage", { id: "stage-change" });
    }
  };

  const handleAddTeamMember = async () => {
    if (!selectedDeal || !newTeamMember.name || !newTeamMember.role) {
      toast.error("Please fill in name and role");
      return;
    }
    
    // Look up the real user ID based on email or name
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

    // Use the real user ID if found, otherwise generate a random one for external contacts
    const userId = matchingUser?.id || crypto.randomUUID();
    const updatedPodTeam = [...(selectedDeal.podTeam as PodTeamMember[] || []), { ...newTeamMember, userId }];
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        podTeam: updatedPodTeam,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      setSelectedDeal({ ...selectedDeal, podTeam: updatedPodTeam, auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      setNewTeamMember({ name: '', role: '', email: '', phone: '', slack: '' });
      toast.success("Team member added!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member");
    }
  };

  const handleRemoveTeamMember = async (memberIndex: number) => {
    if (!selectedDeal) return;
    const member = (selectedDeal.podTeam as PodTeamMember[])?.[memberIndex];
    
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Team Member Removed',
      user: currentUser?.name || 'System',
      details: `Removed ${member?.name} from pod team`,
    };

    const updatedPodTeam = (selectedDeal.podTeam as PodTeamMember[] || []).filter((_, i) => i !== memberIndex);
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        podTeam: updatedPodTeam,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      setSelectedDeal({ ...selectedDeal, podTeam: updatedPodTeam, auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      toast.success("Team member removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove team member");
    }
  };

  const handleAddInvestor = async () => {
    if (!selectedDeal || !newInvestor.name || !newInvestor.firm) {
      toast.error("Please fill in investor name and firm");
      return;
    }
    
    const investor: TaggedInvestor = {
      ...newInvestor,
      id: crypto.randomUUID(),
    };

    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Investor Tagged',
      user: currentUser?.name || 'System',
      details: `Tagged ${newInvestor.name} from ${newInvestor.firm} (${newInvestor.type})`,
    };

    const updatedInvestors = [...(selectedDeal.taggedInvestors as TaggedInvestor[] || []), investor];
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        taggedInvestors: updatedInvestors,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      setSelectedDeal({ ...selectedDeal, taggedInvestors: updatedInvestors, auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      setNewInvestor({ name: '', firm: '', type: 'PE', status: 'Contacted', notes: '', email: '', phone: '', website: '' });
      toast.success("Investor tagged!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add investor");
    }
  };

  const handleUpdateInvestorStatus = async (investorId: string, newStatus: string) => {
    if (!selectedDeal) return;
    
    const investor = (selectedDeal.taggedInvestors as TaggedInvestor[])?.find(i => i.id === investorId);
    
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Investor Status Updated',
      user: currentUser?.name || 'System',
      details: `${investor?.name} status changed to "${newStatus}"`,
    };

    const updatedInvestors = (selectedDeal.taggedInvestors as TaggedInvestor[] || []).map(i => 
      i.id === investorId ? { ...i, status: newStatus } : i
    );
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        taggedInvestors: updatedInvestors,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      setSelectedDeal({ ...selectedDeal, taggedInvestors: updatedInvestors, auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      toast.success("Investor status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update investor status");
    }
  };

  const handleRemoveInvestor = async (investorId: string) => {
    if (!selectedDeal) return;
    const investor = (selectedDeal.taggedInvestors as TaggedInvestor[])?.find(i => i.id === investorId);
    
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Investor Removed',
      user: currentUser?.name || 'System',
      details: `Removed ${investor?.name} from ${investor?.firm}`,
    };

    const updatedInvestors = (selectedDeal.taggedInvestors as TaggedInvestor[] || []).filter(i => i.id !== investorId);
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal.id,
        taggedInvestors: updatedInvestors,
        auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry],
      });
      setSelectedDeal({ ...selectedDeal, taggedInvestors: updatedInvestors, auditTrail: [...(selectedDeal.auditTrail as AuditEntry[] || []), auditEntry] });
      toast.success("Investor removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove investor");
    }
  };

  const handleEditDeal = async () => {
    if (!editingDeal) return;
    
    // Handle custom sector
    const finalSector = editingDeal.sector === 'Other' && editCustomSector ? editCustomSector : editingDeal.sector;
    
    // Save custom sector if it's a new one
    const isCustomSector = editingDeal.sector === 'Other' && editCustomSector;
    const existingCustomSectorNames = customSectors.map(s => s.name.toLowerCase());
    const isNewCustomSector = isCustomSector && !existingCustomSectorNames.includes(editCustomSector.toLowerCase()) && !BASE_SECTORS.includes(editCustomSector);
    
    try {
      // Save the custom sector first if it's new
      if (isNewCustomSector) {
        try {
          await createCustomSector.mutateAsync(editCustomSector);
        } catch (e) {
          console.log("Custom sector may already exist:", e);
        }
      }
      
      await updateDeal.mutateAsync({
        id: editingDeal.id,
        name: editingDeal.name,
        client: editingDeal.client,
        sector: finalSector,
        value: editingDeal.value,
        stage: editingDeal.stage,
        lead: editingDeal.lead,
        status: editingDeal.status,
        progress: editingDeal.progress,
      });
      toast.success("Deal updated successfully!");
      setShowEditModal(false);
      setEditingDeal(null);
      setEditCustomSector('');
    } catch (error: any) {
      toast.error(error.message || "Failed to update deal");
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      await deleteDeal.mutateAsync(dealId);
      toast.success("Deal deleted successfully!");
      if (selectedDeal?.id === dealId) {
        setSelectedDeal(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete deal");
    }
  };

  const handleArchiveDeal = async () => {
    if (!dealToArchive) return;
    try {
      await archiveDeal.mutateAsync({
        id: dealToArchive,
        reason: archiveReason || 'Archived',
        notes: archiveNotes || undefined
      });
      toast.success("Deal archived successfully! You can find it in the Archived Deals section.");
      if (selectedDeal?.id === dealToArchive) {
        setSelectedDeal(null);
      }
      setShowArchiveDialog(false);
      setDealToArchive(null);
      setArchiveReason('');
      setArchiveNotes('');
    } catch (error: any) {
      toast.error(error.message || "Failed to archive deal");
    }
  };

  const openEditModal = (deal: Deal) => {
    setEditingDeal(deal);
    // If the current sector is not in the SECTORS list, it's a custom sector
    const isCustom = !BASE_SECTORS.includes(deal.sector) && deal.sector !== 'Other';
    if (isCustom) {
      setEditCustomSector(deal.sector);
      setEditingDeal({ ...deal, sector: 'Other' });
    } else {
      setEditCustomSector('');
    }
    setShowEditModal(true);
  };

  const toggleDealSelection = (id: string) => {
    setSelectedDeals(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllDeals = () => {
    if (selectedDeals.length === filteredDeals.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(filteredDeals.map((d: Deal) => d.id));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteDeals.mutateAsync(selectedDeals);
      toast.success(`${selectedDeals.length} deals deleted`);
      setSelectedDeals([]);
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error("Failed to delete deals");
    }
  };

  const handleBulkMoveToOpportunity = async () => {
    try {
      await bulkMoveToOpportunity.mutateAsync(selectedDeals);
      toast.success(`${selectedDeals.length} deals moved to opportunities`);
      setSelectedDeals([]);
      setShowBulkMoveDialog(false);
    } catch (error) {
      toast.error("Failed to move deals");
    }
  };

  if (isLoading) {
    return (
      <Layout role={role} pageTitle="Deal Management" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading deals...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role={role} pageTitle="Deal Management" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Bulk Actions Bar */}
        {selectedDeals.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg mb-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedDeals.length === filteredDeals.length}
                onCheckedChange={selectAllDeals}
                data-testid="checkbox-select-all-deals"
              />
              <span className="text-sm font-medium">{selectedDeals.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBulkMoveDialog(true)} data-testid="button-bulk-move-deals">
                <ArrowLeftCircle className="w-4 h-4 mr-1" /> Move to Opportunities
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} data-testid="button-bulk-delete-deals">
                <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDeals([])} data-testid="button-clear-deal-selection">
                Clear
              </Button>
            </div>
          </div>
        )}
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search deals by name, client, or sector..." 
              className="pl-9 bg-card border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-deals"
            />
          </div>
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-card border border-border rounded-md overflow-hidden">
              <Button 
                variant="ghost" 
                size="sm"
                className={cn("rounded-none border-r border-border", viewMode === 'grid' && "bg-primary/10 text-primary")}
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className={cn("rounded-none border-r border-border", viewMode === 'calendar' && "bg-primary/10 text-primary")}
                onClick={() => setViewMode('calendar')}
                data-testid="button-view-calendar"
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className={cn("rounded-none", viewMode === 'compare' && "bg-primary/10 text-primary")}
                onClick={() => setViewMode('compare')}
                data-testid="button-view-compare"
              >
                <GitCompare className="w-4 h-4" />
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-card border-border gap-2">
                  <Filter className="w-4 h-4" /> {stageFilter || 'All Stages'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStageFilter(null)}>All Stages</DropdownMenuItem>
                <DropdownMenuSeparator />
                {DEAL_STAGES.map(stage => (
                  <DropdownMenuItem key={stage} onClick={() => setStageFilter(stage)}>{stage}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowNewDealModal(true)}
              data-testid="button-new-deal"
            >
              <Plus className="w-4 h-4 mr-1" /> New Deal
            </Button>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && (() => {
          const getCalendarDays = () => {
            if (calendarView === 'day') {
              return [calendarDate];
            } else if (calendarView === 'week') {
              const start = startOfWeek(calendarDate, { weekStartsOn: 0 });
              const end = endOfWeek(calendarDate, { weekStartsOn: 0 });
              return eachDayOfInterval({ start, end });
            } else {
              const monthStart = startOfMonth(calendarDate);
              const monthEnd = endOfMonth(calendarDate);
              const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
              const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
              return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
            }
          };

          const navigatePrev = () => {
            if (calendarView === 'day') setCalendarDate(subDays(calendarDate, 1));
            else if (calendarView === 'week') setCalendarDate(subWeeks(calendarDate, 1));
            else setCalendarDate(subMonths(calendarDate, 1));
          };

          const navigateNext = () => {
            if (calendarView === 'day') setCalendarDate(addDays(calendarDate, 1));
            else if (calendarView === 'week') setCalendarDate(addWeeks(calendarDate, 1));
            else setCalendarDate(addMonths(calendarDate, 1));
          };

          const getEventsForDay = (day: Date) => {
            const events: { type: 'task' | 'milestone' | 'stage_change'; deal: Deal; item?: any; date: Date }[] = [];
            
            if (!selectedCalendarDeal) return events;
            
            const deal = selectedCalendarDeal;
            const dealTasks = allTasks.filter((t: any) => t.dealId === deal.id);
            dealTasks.forEach((task: any) => {
              if (task.dueDate && isSameDay(parseISO(task.dueDate), day)) {
                events.push({ type: 'task', deal, item: task, date: day });
              }
            });
            
            const auditTrail = deal.auditTrail as AuditEntry[] || [];
            auditTrail.forEach(entry => {
              if (entry.timestamp && isSameDay(parseISO(entry.timestamp), day)) {
                if (entry.action === 'Stage Changed' || entry.action === 'Deal Created') {
                  events.push({ type: 'milestone', deal, item: entry, date: day });
                }
              }
            });
            
            return events;
          };

          const filteredCalendarDeals = deals.filter(deal =>
            deal.name.toLowerCase().includes(calendarDealSearch.toLowerCase()) ||
            deal.client.toLowerCase().includes(calendarDealSearch.toLowerCase())
          );

          const calendarDays = getCalendarDays();

          return (
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Deal Calendar</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex bg-secondary rounded-lg p-0.5">
                          <Button 
                            variant={calendarView === 'day' ? 'default' : 'ghost'} 
                            size="sm" 
                            className="h-7 px-3 text-xs"
                            onClick={() => setCalendarView('day')}
                            data-testid="calendar-view-day"
                          >
                            Day
                          </Button>
                          <Button 
                            variant={calendarView === 'week' ? 'default' : 'ghost'} 
                            size="sm" 
                            className="h-7 px-3 text-xs"
                            onClick={() => setCalendarView('week')}
                            data-testid="calendar-view-week"
                          >
                            Week
                          </Button>
                          <Button 
                            variant={calendarView === 'month' ? 'default' : 'ghost'} 
                            size="sm" 
                            className="h-7 px-3 text-xs"
                            onClick={() => setCalendarView('month')}
                            data-testid="calendar-view-month"
                          >
                            Month
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Deal Selector */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search and select a deal..."
                          value={calendarDealSearch}
                          onChange={(e) => setCalendarDealSearch(e.target.value)}
                          className="pl-9 bg-secondary/50 border-border"
                          data-testid="calendar-deal-search"
                        />
                        {calendarDealSearch && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-[200px] overflow-y-auto">
                            {filteredCalendarDeals.length === 0 ? (
                              <div className="p-3 text-sm text-muted-foreground text-center">No deals found</div>
                            ) : (
                              filteredCalendarDeals.map(deal => (
                                <div
                                  key={deal.id}
                                  className="p-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-b-0"
                                  onClick={() => {
                                    setSelectedCalendarDeal(deal);
                                    setCalendarDealSearch("");
                                  }}
                                  data-testid={`calendar-deal-option-${deal.id}`}
                                >
                                  <div className="font-medium text-sm">{deal.name}</div>
                                  <div className="text-xs text-muted-foreground">{deal.client}{deal.sector ? ` • ${deal.sector}` : ''} • {deal.stage}</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {selectedCalendarDeal && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                          <Briefcase className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{selectedCalendarDeal.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-1"
                            onClick={() => setSelectedCalendarDeal(null)}
                            data-testid="calendar-clear-deal"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="outline" size="sm" onClick={navigatePrev}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="text-lg font-semibold">
                      {calendarView === 'day' && format(calendarDate, 'EEEE, MMMM d, yyyy')}
                      {calendarView === 'week' && `${format(startOfWeek(calendarDate, { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(calendarDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`}
                      {calendarView === 'month' && format(calendarDate, 'MMMM yyyy')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={navigateNext}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {!selectedCalendarDeal && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-lg font-medium mb-2">Select a Deal</h3>
                      <p className="text-sm">Use the search box above to select a deal and view its calendar events</p>
                    </div>
                  )}

                  {selectedCalendarDeal && calendarView === 'month' && (
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-secondary p-2 text-center text-xs font-medium text-muted-foreground">
                          {day}
                        </div>
                      ))}
                      {calendarDays.map((day, index) => {
                        const events = getEventsForDay(day);
                        const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                        return (
                          <div 
                            key={index} 
                            className={cn(
                              "bg-card min-h-[100px] p-2 transition-colors",
                              !isCurrentMonth && "opacity-40",
                              isToday(day) && "ring-2 ring-primary ring-inset"
                            )}
                          >
                            <div className={cn(
                              "text-sm font-medium mb-1",
                              isToday(day) ? "text-primary" : "text-foreground"
                            )}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-1">
                              {events.slice(0, 3).map((event, i) => (
                                <div 
                                  key={i}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80",
                                    event.type === 'task' && (event.item?.status === 'Completed' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"),
                                    event.type === 'milestone' && "bg-purple-500/20 text-purple-400"
                                  )}
                                  onClick={() => { setSelectedDeal(event.deal); setActiveTab("overview"); }}
                                >
                                  {event.type === 'task' ? event.item?.title : event.item?.action}
                                </div>
                              ))}
                              {events.length > 3 && (
                                <div className="text-[10px] text-muted-foreground pl-1">
                                  +{events.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedCalendarDeal && calendarView === 'week' && (
                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((day, index) => {
                        const events = getEventsForDay(day);
                        return (
                          <div 
                            key={index} 
                            className={cn(
                              "bg-secondary/30 rounded-lg p-3 min-h-[200px] transition-colors",
                              isToday(day) && "ring-2 ring-primary"
                            )}
                          >
                            <div className={cn(
                              "text-center mb-2 pb-2 border-b border-border",
                              isToday(day) ? "text-primary" : ""
                            )}>
                              <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                              <div className="text-lg font-bold">{format(day, 'd')}</div>
                            </div>
                            <ScrollArea className="h-[150px]">
                              <div className="space-y-1.5">
                                {events.map((event, i) => (
                                  <div 
                                    key={i}
                                    className={cn(
                                      "text-xs p-2 rounded cursor-pointer hover:opacity-80 transition-opacity",
                                      event.type === 'task' && (event.item?.status === 'Completed' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"),
                                      event.type === 'milestone' && "bg-purple-500/20 text-purple-400"
                                    )}
                                    onClick={() => {
                                      if (event.type === 'task') {
                                        openTaskDetail(event.item, event.deal);
                                      } else {
                                        setSelectedDeal(event.deal); 
                                        setActiveTab("overview");
                                      }
                                    }}
                                  >
                                    <div className="font-medium truncate">{event.type === 'task' ? event.item?.title : event.item?.action}</div>
                                    <div className="text-[10px] opacity-70 truncate">{event.deal.name}</div>
                                  </div>
                                ))}
                                {events.length === 0 && (
                                  <div className="text-xs text-muted-foreground text-center py-4">No events</div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedCalendarDeal && calendarView === 'day' && (
                    <div className="space-y-4">
                      {(() => {
                        const events = getEventsForDay(calendarDate);
                        const deal = selectedCalendarDeal;

                        if (events.length === 0) {
                          return (
                            <div className="text-center py-12 text-muted-foreground">
                              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No events scheduled for this day</p>
                            </div>
                          );
                        }

                        return (
                          <Card className="bg-secondary/30 border-border">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base">{deal.name}</CardTitle>
                                  <CardDescription>{deal.client}{deal.sector ? ` • ${deal.sector}` : ''}</CardDescription>
                                </div>
                                <Badge variant="outline">{deal.stage}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {events.map((event, i) => (
                                <div 
                                  key={i}
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors",
                                    event.type === 'task' && (event.item?.status === 'Completed' ? "bg-green-500/10" : "bg-blue-500/10"),
                                    event.type === 'milestone' && "bg-purple-500/10"
                                  )}
                                  onClick={() => {
                                    if (event.type === 'task') {
                                      openTaskDetail(event.item, deal);
                                    } else {
                                      setSelectedDeal(deal); 
                                      setActiveTab("overview");
                                    }
                                  }}
                                >
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    event.type === 'task' && (event.item?.status === 'Completed' ? "bg-green-500/20" : "bg-blue-500/20"),
                                    event.type === 'milestone' && "bg-purple-500/20"
                                  )}>
                                    {event.type === 'task' ? (
                                      event.item?.status === 'Completed' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Clock className="w-4 h-4 text-blue-400" />
                                    ) : (
                                      <TrendingUp className="w-4 h-4 text-purple-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">
                                      {event.type === 'task' ? event.item?.title : event.item?.action}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {event.type === 'task' ? `Priority: ${event.item?.priority}` : event.item?.details}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {event.type === 'task' ? event.item?.status : 'Milestone'}
                                  </Badge>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Legend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500/50"></div>
                      <span className="text-sm text-muted-foreground">Pending Task</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500/50"></div>
                      <span className="text-sm text-muted-foreground">Completed Task</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-purple-500/50"></div>
                      <span className="text-sm text-muted-foreground">Milestone / Stage Change</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Deals Grid */}
        {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal) => (
            <Card 
              key={deal.id} 
              className="bg-card border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group" 
              data-testid={`card-deal-${deal.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedDeals.includes(deal.id)}
                      onCheckedChange={() => toggleDealSelection(deal.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                      data-testid={`checkbox-deal-${deal.id}`}
                    />
                    <Badge variant="outline" className={cn(
                      "border-0 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                      deal.stage === 'Origination' ? "bg-blue-500/20 text-blue-400" :
                      deal.stage === 'Structuring' ? "bg-indigo-500/20 text-indigo-400" :
                      deal.stage === 'Diligence' ? "bg-orange-500/20 text-orange-400" :
                      deal.stage === 'Legal' ? "bg-purple-500/20 text-purple-400" :
                      "bg-green-500/20 text-green-400"
                    )}>
                      {deal.stage}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelectedDeal(deal); setActiveTab("overview"); }}>
                        <Eye className="w-4 h-4 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(deal)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit Deal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-amber-500" 
                        onClick={() => {
                          setDealToArchive(deal.id);
                          setShowArchiveDialog(true);
                        }}
                      >
                        <Archive className="w-4 h-4 mr-2" /> Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-500" 
                        onClick={() => {
                          setDealToDelete(deal.id);
                          setShowDeleteDealDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-xl mt-2 group-hover:text-primary transition-colors">{deal.name}</CardTitle>
                <CardDescription>{deal.client}{deal.sector ? <> • <span className="font-medium">{deal.sector}</span></> : ''}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Stage Progress Bar - Click icons to change stage */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    {DEAL_STAGES.map((stage, index) => {
                      const isActive = getStageIndex(deal.stage) >= index;
                      const isCurrent = deal.stage === stage;
                      return (
                        <div 
                          key={stage} 
                          className="flex flex-col items-center flex-1 cursor-pointer group/stage"
                          onClick={() => handleStageChange(deal, stage)}
                          data-testid={`stage-icon-${deal.id}-${stage.toLowerCase().replace(' ', '-')}`}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                            isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                            isActive ? "bg-primary/60 text-primary-foreground" :
                            "bg-secondary text-muted-foreground",
                            "group-hover/stage:ring-2 group-hover/stage:ring-primary/50 group-hover/stage:scale-110"
                          )}>
                            {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                          </div>
                          <span className={cn(
                            "text-[8px] mt-1 truncate max-w-full transition-colors",
                            isCurrent ? "text-primary font-bold" :
                            isActive ? "text-foreground" : "text-muted-foreground",
                            "group-hover/stage:text-primary"
                          )}>{stage.slice(0, 4)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${getStageProgress(deal.stage)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground text-center">Click any stage to update</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Value
                    </div>
                    <div className="font-mono font-bold text-lg">${deal.value}M</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3" /> Team
                    </div>
                    <DealTotalTeamCount dealId={deal.id} stage={deal.stage} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {(deal.lead || "?").split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs text-muted-foreground">Lead: {deal.lead}</span>
                </div>
              </CardContent>
              
              <CardFooter className="pt-2">
                <Button 
                  className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground transition-colors gap-2"
                  onClick={() => { setSelectedDeal(deal); setActiveTab("overview"); }}
                  data-testid={`button-view-deal-${deal.id}`}
                >
                  View Deal Room <ArrowRight className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        )}

        {filteredDeals.length === 0 && viewMode !== 'compare' && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery || stageFilter ? "No deals match your search criteria" : "No deals yet. Create your first deal!"}
          </div>
        )}

        {/* Comparison View */}
        {viewMode === 'compare' && (() => {
          const selectedDealsData = deals.filter(d => selectedCompareDeals.includes(d.id));
          
          const getStageValue = (stage: string) => {
            const stageIndex = DEAL_STAGES.indexOf(stage);
            return ((stageIndex + 1) / DEAL_STAGES.length) * 100;
          };
          
          const getTeamScore = (deal: Deal) => {
            const podTeam = (deal.podTeam as PodTeamMember[]) || [];
            return Math.min(podTeam.length * 20, 100);
          };
          
          const getInvestorScore = (deal: Deal) => {
            const investors = (deal.taggedInvestors as TaggedInvestor[]) || [];
            return Math.min(investors.length * 15, 100);
          };
          
          const getDocumentScore = (deal: Deal) => {
            const attachments = (deal.attachments as any[]) || [];
            return Math.min(attachments.length * 10, 100);
          };
          
          const maxValue = Math.max(...deals.map(d => d.value || 0), 1);
          
          const radarData = [
            { metric: 'Deal Value', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, ((d.value || 0) / maxValue) * 100])) },
            { metric: 'Stage Progress', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, getStageValue(d.stage)])) },
            { metric: 'Team Size', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, getTeamScore(d)])) },
            { metric: 'Investors', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, getInvestorScore(d)])) },
            { metric: 'Documents', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, getDocumentScore(d)])) },
            { metric: 'Progress', fullMark: 100, ...Object.fromEntries(selectedDealsData.map(d => [d.name, d.progress || 0])) },
          ];
          
          const toggleDealSelection = (dealId: string) => {
            if (selectedCompareDeals.includes(dealId)) {
              setSelectedCompareDeals(selectedCompareDeals.filter(id => id !== dealId));
            } else if (selectedCompareDeals.length < 5) {
              setSelectedCompareDeals([...selectedCompareDeals, dealId]);
            } else {
              toast.error("You can compare up to 5 deals at a time");
            }
          };
          
          const sortedDeals = [...deals].sort((a, b) => {
            switch (compareSortBy) {
              case 'value': return (b.value || 0) - (a.value || 0);
              case 'stage': return getStageValue(b.stage) - getStageValue(a.stage);
              case 'name': return a.name.localeCompare(b.name);
              default: return 0;
            }
          });
          
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deal Selection Panel */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Select Deals
                      </CardTitle>
                      <Badge variant="secondary">{selectedCompareDeals.length}/5</Badge>
                    </div>
                    <CardDescription>Choose up to 5 deals to compare</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Select value={compareSortBy} onValueChange={setCompareSortBy}>
                        <SelectTrigger className="w-full">
                          <ArrowUpDown className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">Sort by Value</SelectItem>
                          <SelectItem value="stage">Sort by Stage</SelectItem>
                          <SelectItem value="name">Sort by Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2 pr-4">
                        {sortedDeals.map((deal) => (
                          <div
                            key={deal.id}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-all",
                              selectedCompareDeals.includes(deal.id)
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => toggleDealSelection(deal.id)}
                            data-testid={`compare-deal-${deal.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedCompareDeals.includes(deal.id)}
                                    onCheckedChange={() => toggleDealSelection(deal.id)}
                                  />
                                  <span className="font-medium truncate">{deal.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{deal.client}</div>
                              </div>
                              <Badge variant="outline" className="shrink-0">${deal.value}M</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="text-xs" variant="secondary">{deal.stage}</Badge>
                              <Badge className={cn(
                                "text-xs",
                                deal.status === 'Active' ? "bg-green-500/20 text-green-400" :
                                deal.status === 'On Hold' ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-gray-500/20 text-gray-400"
                              )}>{deal.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {selectedCompareDeals.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedCompareDeals([])}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Comparison Charts */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" /> Deal Comparison
                    </CardTitle>
                    <CardDescription>
                      {selectedCompareDeals.length === 0 
                        ? "Select deals from the left panel to compare them"
                        : `Comparing ${selectedCompareDeals.length} deal${selectedCompareDeals.length > 1 ? 's' : ''}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedCompareDeals.length === 0 ? (
                      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Select at least one deal to see comparison</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis 
                              dataKey="metric" 
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            />
                            <PolarRadiusAxis 
                              angle={30} 
                              domain={[0, 100]} 
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            />
                            {selectedDealsData.map((deal, index) => (
                              <Radar
                                key={deal.id}
                                name={deal.name}
                                dataKey={deal.name}
                                stroke={COMPARISON_COLORS[index % COMPARISON_COLORS.length]}
                                fill={COMPARISON_COLORS[index % COMPARISON_COLORS.length]}
                                fillOpacity={0.2}
                              />
                            ))}
                            <Legend />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Comparison Table */}
              {selectedCompareDeals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Metric</th>
                            {selectedDealsData.map((deal, index) => (
                              <th 
                                key={deal.id} 
                                className="text-left py-3 px-4 text-sm font-medium"
                                style={{ color: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}
                              >
                                {deal.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Deal Value</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4 font-mono font-semibold">${deal.value}M</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Client</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">{deal.client}</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Sector</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">{deal.sector}</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Stage</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                <Badge variant="secondary">{deal.stage}</Badge>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Status</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                <Badge className={cn(
                                  deal.status === 'Active' ? "bg-green-500/20 text-green-400" :
                                  deal.status === 'On Hold' ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-gray-500/20 text-gray-400"
                                )}>{deal.status}</Badge>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Progress</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary" 
                                      style={{ width: `${deal.progress || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-sm">{deal.progress || 0}%</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Lead</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">{deal.lead}</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Team Size</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                {((deal.podTeam as PodTeamMember[]) || []).length} members
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Tagged Investors</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                {((deal.taggedInvestors as TaggedInvestor[]) || []).length} investors
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm text-muted-foreground">Documents</td>
                            {selectedDealsData.map(deal => (
                              <td key={deal.id} className="py-3 px-4">
                                {((deal.attachments as any[]) || []).length} files
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })()}
      </div>

      {/* Deal Room Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <SheetContent className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto">
          {selectedDeal && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-2xl">{selectedDeal.name}</SheetTitle>
                    <SheetDescription>{selectedDeal.client} • {selectedDeal.sector}</SheetDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-move-to-opportunities">
                          <ArrowLeftCircle className="w-4 h-4 mr-2" />
                          Move to Opportunities
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Move to Opportunities?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will move "{selectedDeal.name}" back to the Opportunities page. The deal stage will be reset to "Origination".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              moveDealToOpportunity.mutate(selectedDeal.id, {
                                onSuccess: () => {
                                  toast.success('Deal moved to Opportunities');
                                  setSelectedDeal(null);
                                },
                                onError: (error) => {
                                  toast.error(error.message || 'Failed to move deal');
                                },
                              });
                            }}
                          >
                            Move to Opportunities
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Badge className={cn(
                      "px-3 py-1",
                      selectedDeal.status === 'Active' ? "bg-green-500/20 text-green-400" :
                      selectedDeal.status === 'On Hold' ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-gray-500/20 text-gray-400"
                    )}>
                      {selectedDeal.status}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              {/* Stage Progress */}
              <div className="py-6 border-b border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">DEAL STAGE</h4>
                <div className="flex items-center gap-2">
                  {DEAL_STAGES.map((stage, index) => {
                    const isActive = getStageIndex(selectedDeal.stage) >= index;
                    const isCurrent = selectedDeal.stage === stage;
                    return (
                      <Button
                        key={stage}
                        variant={isCurrent ? "default" : isActive ? "secondary" : "outline"}
                        size="sm"
                        className={cn(
                          "flex-1 text-xs",
                          isCurrent && "ring-2 ring-primary/30",
                          !isActive && "opacity-50"
                        )}
                        onClick={() => handleStageChange(selectedDeal, stage)}
                        data-testid={`button-stage-${stage.toLowerCase()}`}
                      >
                        {stage}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${getStageProgress(selectedDeal.stage)}%` }}
                  />
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                <TabsList className="grid grid-cols-8 bg-secondary/50">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="stages">Stage Work</TabsTrigger>
                  <TabsTrigger value="team">Pod Team</TabsTrigger>
                  <TabsTrigger value="investors">Investors</TabsTrigger>
                  <TabsTrigger value="documents">Docs</TabsTrigger>
                  <TabsTrigger value="voice">Voice</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-secondary/30">
                      <CardContent className="p-4 text-center">
                        <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <div className="text-2xl font-bold text-primary">${selectedDeal.value}M</div>
                        <div className="text-xs text-muted-foreground">Deal Value</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary/30">
                      <CardContent className="p-4 text-center">
                        <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <div className="text-2xl font-bold text-primary"><DealTotalTeamCountNumber dealId={selectedDeal.id} stage={selectedDeal.stage} /></div>
                        <div className="text-xs text-muted-foreground">Team Members</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary/30">
                      <CardContent className="p-4 text-center">
                        <Building2 className="w-5 h-5 mx-auto mb-1 text-primary" />
                        <div className="text-2xl font-bold text-primary">{(selectedDeal.taggedInvestors as TaggedInvestor[] || []).length}</div>
                        <div className="text-xs text-muted-foreground">Investors</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-muted-foreground">Sector:</span>
                      <span className="ml-2 font-medium">{selectedDeal.sector}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg group relative">
                      <span className="text-muted-foreground">Lead:</span>
                      {editingLeadDealId === selectedDeal.id ? (
                        <div className="mt-1">
                          <Select 
                            value={editingLeadValue} 
                            onValueChange={(value) => setEditingLeadValue(value)}
                          >
                            <SelectTrigger className="h-8 text-sm" data-testid="select-edit-lead">
                              <SelectValue placeholder="Select lead" />
                            </SelectTrigger>
                            <SelectContent>
                              {allUsers.filter(user => isDealEligibleUser(user)).map(user => (
                                <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1 mt-1">
                            <Button 
                              size="sm" 
                              className="h-6 text-xs px-2"
                              onClick={async () => {
                                try {
                                  await updateDeal.mutateAsync({ id: selectedDeal.id, lead: editingLeadValue });
                                  toast.success("Lead updated");
                                  setEditingLeadDealId(null);
                                } catch {
                                  toast.error("Failed to update lead");
                                }
                              }}
                              data-testid="button-save-lead"
                            >
                              Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 text-xs px-2"
                              onClick={() => setEditingLeadDealId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="ml-2 font-medium">{selectedDeal.lead}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              setEditingLeadDealId(selectedDeal.id);
                              setEditingLeadValue(selectedDeal.lead);
                            }}
                            data-testid="button-edit-lead"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedDeal.description && (
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-muted-foreground text-sm">Description:</span>
                      <p className="mt-1 text-sm">{selectedDeal.description}</p>
                    </div>
                  )}

                  {/* Client Contact Section */}
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Client Contact</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => {
                          setEditingClientContact(true);
                          setClientContactForm({
                            name: selectedDeal.clientContactName || '',
                            email: selectedDeal.clientContactEmail || '',
                            phone: selectedDeal.clientContactPhone || '',
                            role: selectedDeal.clientContactRole || '',
                          });
                        }}
                        data-testid="button-edit-client-contact"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </div>
                    {editingClientContact ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Contact Name</Label>
                            <Input 
                              value={clientContactForm.name}
                              onChange={(e) => setClientContactForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Contact person name"
                              className="h-8 text-sm"
                              data-testid="input-client-contact-name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Role/Title</Label>
                            <Input 
                              value={clientContactForm.role}
                              onChange={(e) => setClientContactForm(prev => ({ ...prev, role: e.target.value }))}
                              placeholder="e.g., CFO, CEO"
                              className="h-8 text-sm"
                              data-testid="input-client-contact-role"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Email</Label>
                            <Input 
                              type="email"
                              value={clientContactForm.email}
                              onChange={(e) => setClientContactForm(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="email@company.com"
                              className="h-8 text-sm"
                              data-testid="input-client-contact-email"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Phone</Label>
                            <Input 
                              value={clientContactForm.phone}
                              onChange={(e) => setClientContactForm(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="+1 (555) 123-4567"
                              className="h-8 text-sm"
                              data-testid="input-client-contact-phone"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={async () => {
                              try {
                                await updateDeal.mutateAsync({
                                  id: selectedDeal.id,
                                  clientContactName: clientContactForm.name || null,
                                  clientContactEmail: clientContactForm.email || null,
                                  clientContactPhone: clientContactForm.phone || null,
                                  clientContactRole: clientContactForm.role || null,
                                });
                                setSelectedDeal({
                                  ...selectedDeal,
                                  clientContactName: clientContactForm.name || null,
                                  clientContactEmail: clientContactForm.email || null,
                                  clientContactPhone: clientContactForm.phone || null,
                                  clientContactRole: clientContactForm.role || null,
                                });
                                setEditingClientContact(false);
                                toast.success("Client contact updated");
                              } catch {
                                toast.error("Failed to update client contact");
                              }
                            }}
                            data-testid="button-save-client-contact"
                          >
                            Save
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setEditingClientContact(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeal.clientContactName || selectedDeal.clientContactEmail || selectedDeal.clientContactPhone ? (
                          <>
                            {selectedDeal.clientContactName && (
                              <div className="flex items-center gap-2 text-sm">
                                <UserCircle className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{selectedDeal.clientContactName}</span>
                                {selectedDeal.clientContactRole && (
                                  <Badge variant="secondary" className="text-[10px]">{selectedDeal.clientContactRole}</Badge>
                                )}
                              </div>
                            )}
                            {selectedDeal.clientContactEmail && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <a href={`mailto:${selectedDeal.clientContactEmail}`} className="text-primary hover:underline">
                                  {selectedDeal.clientContactEmail}
                                </a>
                              </div>
                            )}
                            {selectedDeal.clientContactPhone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <a href={`tel:${selectedDeal.clientContactPhone}`} className="text-primary hover:underline">
                                  {selectedDeal.clientContactPhone}
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">No client contact added yet</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Deal Fees Section */}
                  {selectedDealFees.length > 0 && (
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Fee Structure</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedDealFees.map((fee: DealFeeType) => {
                          const hasAmount = fee.amount !== null && fee.amount !== undefined && !isNaN(Number(fee.amount));
                          const hasPercentage = fee.percentage !== null && fee.percentage !== undefined && !isNaN(Number(fee.percentage));
                          return (
                            <div key={fee.id} className="p-2 bg-background/50 rounded-md border border-border/50">
                              <div className="text-xs text-muted-foreground capitalize">{fee.feeType.replace('-', ' ').replace('_', ' ')}</div>
                              <div className="font-semibold text-primary">
                                {hasAmount 
                                  ? `$${Number(fee.amount).toLocaleString()}` 
                                  : hasPercentage 
                                    ? `${Number(fee.percentage)}%` 
                                    : '-'}
                              </div>
                              {fee.description && (
                                <div className="text-xs text-muted-foreground mt-1">{fee.description}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Stage Work Tab */}
                <TabsContent value="stages" className="mt-4 space-y-4">
                  <StageWorkSection 
                    dealId={selectedDeal.id}
                    dealName={selectedDeal.name}
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
                    createTask={createTask}
                    createDocument={createDocument}
                    deleteTask={deleteTask}
                    totalTeamCount={currentTeamCount}
                    onboardingStatus={onboardingStatus}
                    onShowOnboardingWarning={(userName, missingResume, missingPersonality, onConfirm) => {
                      setPendingAssignment({ userId: '', userName, missingResume, missingPersonality, onConfirm });
                      setShowOnboardingWarning(true);
                    }}
                    onAuditEntry={async (action, details) => {
                      try {
                        const auditEntry: AuditEntry = {
                          id: crypto.randomUUID(),
                          timestamp: new Date().toISOString(),
                          action,
                          user: currentUser?.name || 'System',
                          details,
                        };
                        
                        // Fetch fresh deal data from server to get authoritative auditTrail
                        const freshDeal = await queryClient.fetchQuery<Deal>({
                          queryKey: ['deals', selectedDeal.id],
                          queryFn: async () => {
                            const res = await fetch(`/api/deals/${selectedDeal.id}`);
                            if (!res.ok) throw new Error('Failed to fetch deal');
                            return res.json();
                          },
                          staleTime: 0, // Force fresh fetch
                        });
                        
                        const currentAuditTrail = Array.isArray(freshDeal?.auditTrail) 
                          ? [...(freshDeal.auditTrail as AuditEntry[])]
                          : [];
                        const newAuditTrail = [...currentAuditTrail, auditEntry];
                        
                        await updateDeal.mutateAsync({
                          id: selectedDeal.id,
                          auditTrail: newAuditTrail,
                        });
                        
                        // Only update state after successful mutation
                        const updatedDeal = { ...selectedDeal, auditTrail: newAuditTrail };
                        setSelectedDeal(updatedDeal);
                        
                        // Also update the cache with a new array (immutable)
                        queryClient.setQueryData<Deal[]>(['deals'], (old) => 
                          old ? old.map(d => d.id === selectedDeal.id ? { ...d, auditTrail: newAuditTrail } : d) : []
                        );
                      } catch (error: any) {
                        toast.error("Failed to log audit entry");
                      }
                    }}
                  />
                </TabsContent>

                {/* Pod Team Tab */}
                <TabsContent value="team" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Pod Team - {currentDealStage}</h4>
                      <p className="text-xs text-muted-foreground">Team assigned to this stage</p>
                    </div>
                    <Badge variant="secondary">{currentTeamCount} members</Badge>
                  </div>

                  {/* Team Members List - Current Stage Only */}
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2">
                      {isPodPolling && currentStagePodMembers.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                          <p className="text-sm text-muted-foreground">Forming team for {currentDealStage}...</p>
                        </div>
                      ) : currentStagePodMembers.length > 0 ? (
                        currentStagePodMembers.map((member: any, index: number) => {
                          const memberName = member.userName || 'Unknown';
                          const initials = (memberName || "?").split(' ').map((n: string) => n[0] || '').join('').slice(0, 2);
                          return (
                            <div key={member.id || `member-${index}`} className="p-3 bg-secondary/30 rounded-lg flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {memberName}
                                    {member.isLead && <Badge variant="secondary" className="text-xs">Lead</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{member.role}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {member.phone && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a href={`tel:${member.phone}`}><Phone className="w-4 h-4 text-green-500" /></a>
                                  </Button>
                                )}
                                {member.email && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a href={`mailto:${member.email}`}><Mail className="w-4 h-4 text-blue-500" /></a>
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will remove {memberName} from the {currentDealStage} pod team. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteStagePodMember.mutate(member.id)}>
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No team members assigned to {currentDealStage} stage yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Add Team Member Form */}
                  <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UserPlus className="w-4 h-4" /> Add Team Member
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Popover open={teamMemberOpen} onOpenChange={setTeamMemberOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-start font-normal">
                            {newTeamMember.name || "Search team member..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Type name or email..." 
                              value={teamMemberSearch}
                              onValueChange={setTeamMemberSearch}
                            />
                            <CommandList>
                              {teamMemberSearch.length >= 2 && filteredUsers.length === 0 && (
                                <CommandEmpty>
                                  <div className="p-2 text-sm">
                                    <p className="text-muted-foreground mb-2">No users found. Add manually:</p>
                                    <Input 
                                      placeholder="Enter name"
                                      value={newTeamMember.name}
                                      onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newTeamMember.name) {
                                          setTeamMemberOpen(false);
                                        }
                                      }}
                                    />
                                  </div>
                                </CommandEmpty>
                              )}
                              <CommandGroup>
                                {filteredUsers.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.name}
                                    onSelect={() => {
                                      setNewTeamMember({
                                        ...newTeamMember,
                                        name: user.name,
                                        email: user.email || '',
                                        phone: user.phone || '',
                                        role: user.jobTitle || user.role || '',
                                        userId: user.id,
                                      });
                                      setTeamMemberSearch('');
                                      setTeamMemberOpen(false);
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                                      {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium">{user.name}</div>
                                      <div className="text-xs text-muted-foreground">{user.email} • {user.jobTitle || user.role}</div>
                                    </div>
                                    {newTeamMember.name === user.name && (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input 
                        placeholder="Role *" 
                        value={newTeamMember.role}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input 
                        placeholder="Email" 
                        type="email"
                        value={newTeamMember.email}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                      />
                      <Input 
                        placeholder="Phone" 
                        value={newTeamMember.phone}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, phone: e.target.value })}
                      />
                      <Input 
                        placeholder="Slack ID" 
                        value={newTeamMember.slack}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, slack: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddTeamMember} className="w-full">
                      <Plus className="w-4 h-4 mr-1" /> Add Member
                    </Button>
                  </div>
                </TabsContent>

                {/* Investors Tab */}
                <TabsContent value="investors" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-medium">Tagged Investors</h4>
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input 
                          placeholder="Search investors..."
                          value={investorSearchQuery}
                          onChange={(e) => setInvestorSearchQuery(e.target.value)}
                          className="h-8 pl-8 text-sm"
                          data-testid="input-investor-search"
                        />
                      </div>
                      <Badge variant="secondary">{(selectedDeal.taggedInvestors as TaggedInvestor[] || []).length}</Badge>
                    </div>
                  </div>

                  {/* Investors List */}
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {(selectedDeal.taggedInvestors as TaggedInvestor[] || [])
                        .filter((investor) => {
                          if (!investorSearchQuery) return true;
                          const query = investorSearchQuery.toLowerCase();
                          return (
                            investor.name.toLowerCase().includes(query) ||
                            investor.firm.toLowerCase().includes(query) ||
                            investor.type.toLowerCase().includes(query) ||
                            investor.status.toLowerCase().includes(query)
                          );
                        })
                        .map((investor) => (
                        <div key={investor.id} className="p-3 bg-secondary/30 rounded-lg group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{investor.name}</div>
                                <div className="text-xs text-muted-foreground">{investor.firm} • {investor.type}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {investor.email && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild data-testid={`investor-email-${investor.id}`}>
                                  <a href={`mailto:${investor.email}`}><Mail className="w-4 h-4 text-blue-500" /></a>
                                </Button>
                              )}
                              <Select 
                                value={investor.status} 
                                onValueChange={(v) => handleUpdateInvestorStatus(investor.id, v)}
                              >
                                <SelectTrigger className="h-8 w-28 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVESTOR_STATUSES.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-4 h-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove {investor.name} from {investor.firm} from this deal. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveInvestor(investor.id)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          {investor.notes && (
                            <p className="text-xs text-muted-foreground mt-2 pl-13">{investor.notes}</p>
                          )}
                        </div>
                      ))}
                      {(selectedDeal.taggedInvestors as TaggedInvestor[] || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No investors tagged yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Add Investor Form */}
                  <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="w-4 h-4" /> Tag Investor
                    </div>
                    
                    {/* CRM Investor Search */}
                    <Popover open={investorSearchOpen} onOpenChange={setInvestorSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={investorSearchOpen}
                          className="w-full justify-between text-muted-foreground font-normal"
                          data-testid="investor-search-trigger"
                        >
                          {newInvestor.name ? `${newInvestor.name} - ${newInvestor.firm}` : "Search CRM investors..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search investors by name or firm..." 
                            value={investorSearchQuery}
                            onValueChange={setInvestorSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No investors found. Enter manually below.</CommandEmpty>
                            <CommandGroup heading="CRM Investors">
                              {filteredCrmInvestors.slice(0, 10).map((investor) => (
                                <CommandItem
                                  key={investor.id}
                                  value={`${investor.name} ${investor.firm}`}
                                  onSelect={() => handleSelectCrmInvestor(investor)}
                                  data-testid={`investor-option-${investor.id}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newInvestor.name === investor.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{investor.name}</span>
                                    <span className="text-xs text-muted-foreground">{investor.firm}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    <div className="text-xs text-muted-foreground text-center">- or enter manually -</div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="Contact Name *" 
                        value={newInvestor.name}
                        onChange={(e) => setNewInvestor({ ...newInvestor, name: e.target.value })}
                      />
                      <Input 
                        placeholder="Firm Name *" 
                        value={newInvestor.firm}
                        onChange={(e) => setNewInvestor({ ...newInvestor, firm: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newInvestor.type} onValueChange={(v) => setNewInvestor({ ...newInvestor, type: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {INVESTOR_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newInvestor.status} onValueChange={(v) => setNewInvestor({ ...newInvestor, status: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {INVESTOR_STATUSES.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea 
                      placeholder="Notes (optional)" 
                      value={newInvestor.notes}
                      onChange={(e) => setNewInvestor({ ...newInvestor, notes: e.target.value })}
                      className="resize-none"
                      rows={2}
                    />
                    <Button onClick={handleAddInvestor} className="w-full">
                      <Plus className="w-4 h-4 mr-1" /> Tag Investor
                    </Button>
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Deal Documents</h4>
                    <Badge variant="secondary">
                      {((selectedDealWithAttachments?.attachments as any[] || [])).length} files
                    </Badge>
                  </div>

                  <ObjectUploader
                    maxNumberOfFiles={100}
                    maxFileSize={500 * 1024 * 1024}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.mp4,.mov,.avi,.mp3,.wav,image/*,video/*,audio/*"
                    onComplete={(files: UploadedFile[]) => {
                      const existingAttachments = (selectedDealWithAttachments?.attachments as any[] || []);
                      const newAttachments = files.map(f => ({
                        id: f.id,
                        filename: f.filename,
                        url: f.objectPath,
                        objectPath: f.objectPath,
                        size: f.size,
                        type: f.type,
                        uploadedAt: new Date().toISOString(),
                      }));
                      
                      updateDeal.mutate({
                        id: selectedDeal.id,
                        attachments: [...existingAttachments, ...newAttachments],
                      });
                      
                      newAttachments.forEach(doc => {
                        createDocument.mutate({
                          title: doc.filename,
                          type: doc.type || 'application/octet-stream',
                          category: 'Other',
                          filename: doc.filename,
                          originalName: doc.filename,
                          mimeType: doc.type,
                          size: doc.size,
                          content: doc.objectPath,
                          dealId: selectedDeal.id,
                          dealName: selectedDeal.name,
                          tags: ['Deal Document'],
                        });
                      });
                    }}
                    buttonVariant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files (up to 500MB)
                  </ObjectUploader>
                  <p className="text-xs text-muted-foreground">
                    Supports documents, images, videos, and audio files
                  </p>

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {((selectedDealWithAttachments?.attachments as any[] || [])).map((doc: any) => (
                        <div key={doc.id} className="p-3 bg-secondary/30 rounded-lg flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{doc.filename}</div>
                              <div className="text-xs text-muted-foreground">
                                {(doc.size / 1024).toFixed(1)} KB • {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                const fileUrl = doc.objectPath || doc.url;
                                if (doc.contentUnavailable || (!fileUrl?.startsWith('/objects/') && !fileUrl?.startsWith('data:'))) {
                                  toast.error("This file was stored in temporary storage and is no longer available. Please re-upload the document.");
                                  return;
                                }
                                import('@/lib/utils').then(m => m.openUrlInNewTab(fileUrl));
                              }}
                              title="View"
                              data-testid={`button-view-doc-${doc.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                const fileUrl = doc.objectPath || doc.url;
                                if (doc.contentUnavailable || (!fileUrl?.startsWith('/objects/') && !fileUrl?.startsWith('data:'))) {
                                  toast.error("This file was stored in temporary storage and is no longer available. Please re-upload the document.");
                                  return;
                                }
                                const link = document.createElement('a');
                                link.href = fileUrl;
                                link.download = doc.filename || 'document';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              title="Download"
                              data-testid={`button-download-doc-${doc.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                              onClick={() => {
                                const updatedAttachments = (selectedDealWithAttachments?.attachments as any[] || [])
                                  .filter((a: any) => a.id !== doc.id);
                                updateDeal.mutate({
                                  id: selectedDeal.id,
                                  attachments: updatedAttachments,
                                });
                              }}
                              title="Delete"
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {((selectedDealWithAttachments?.attachments as any[] || [])).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No documents uploaded yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Voice Notes Tab */}
                <TabsContent value="voice" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Voice Notes</h4>
                    <Badge variant="secondary">{(dealVoiceNotes[selectedDeal.id] || []).length} notes</Badge>
                  </div>

                  {/* Recording Section */}
                  <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                    {isRecordingVoice ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                            <Mic className="w-6 h-6 text-red-500" />
                          </div>
                          <div className="text-2xl font-bold text-red-500">{formatVoiceDuration(voiceRecordingTime)}</div>
                        </div>
                        <Input
                          placeholder="Add a title for this recording..."
                          value={voiceNoteTitle}
                          onChange={(e) => setVoiceNoteTitle(e.target.value)}
                          className="text-center"
                        />
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" onClick={cancelVoiceRecording}>
                            <X className="w-4 h-4 mr-2" /> Cancel
                          </Button>
                          <Button variant="destructive" onClick={stopVoiceRecording}>
                            <Square className="w-4 h-4 mr-2" /> Stop & Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <Button onClick={startVoiceRecording} className="gap-2">
                          <Mic className="w-4 h-4" /> Start Recording
                        </Button>
                        <p className="text-xs text-muted-foreground">Record quick audio updates for this deal</p>
                      </div>
                    )}
                  </div>

                  {/* Voice Notes List */}
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {(dealVoiceNotes[selectedDeal.id] || []).map((note) => (
                        <div key={note.id} className="p-3 bg-secondary/30 rounded-lg flex items-center justify-between group">
                          <div className="flex items-center gap-3 flex-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-full bg-primary/20"
                              onClick={() => toggleVoiceNotePlay(note.id, note.duration)}
                            >
                              {playingVoiceNoteId === note.id ? (
                                <Pause className="w-4 h-4 text-primary" />
                              ) : (
                                <Play className="w-4 h-4 text-primary" />
                              )}
                            </Button>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{note.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {note.authorName} • {formatVoiceDuration(note.duration)} • {format(parseISO(note.createdAt), 'MMM d, h:mm a')}
                              </div>
                              {playingVoiceNoteId === note.id && (
                                <div className="h-1 bg-secondary rounded-full mt-2 overflow-hidden">
                                  <div 
                                    className="h-full bg-primary transition-all" 
                                    style={{ width: `${voicePlayProgress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteVoiceNote(selectedDeal.id, note.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      {(dealVoiceNotes[selectedDeal.id] || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No voice notes recorded yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Deal Notes Tab */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <DealNotesSection dealId={selectedDeal.id} allUsers={allUsers} dealAttachments={selectedDealWithAttachments?.attachments as any[] || []} />
                </TabsContent>

                {/* Audit Trail Tab */}
                <TabsContent value="audit" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Institutional Audit Trail</h4>
                    <Badge variant="secondary">{(selectedDeal.auditTrail as AuditEntry[] || []).length} entries</Badge>
                  </div>

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {(selectedDeal.auditTrail as AuditEntry[] || []).slice().reverse().map((entry) => (
                        <div key={entry.id} className="flex gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <History className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{entry.action}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">by {entry.user}</p>
                          </div>
                        </div>
                      ))}
                      {(selectedDeal.auditTrail as AuditEntry[] || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No audit entries yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New Deal Modal */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>Enter the details for the new deal below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deal Name *</Label>
              <Input 
                placeholder="Project Codename" 
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Input 
                placeholder="Client Company Name" 
                value={newDeal.client}
                onChange={(e) => setNewDeal({ ...newDeal, client: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value (in millions) *</Label>
                <Input 
                  type="number" 
                  placeholder="100" 
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Popover open={sectorOpen} onOpenChange={setSectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={sectorOpen} className="w-full justify-between">
                      {newDeal.sector === 'Other' && newDeal.customSector ? newDeal.customSector : newDeal.sector}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search sector or type custom..." />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2">
                            <p className="text-sm text-muted-foreground mb-2">No sector found. Add custom:</p>
                            <Input 
                              placeholder="Enter custom sector"
                              value={newDeal.customSector}
                              onChange={(e) => setNewDeal({ ...newDeal, customSector: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newDeal.customSector) {
                                  setNewDeal({ ...newDeal, sector: 'Other' });
                                  setSectorOpen(false);
                                }
                              }}
                            />
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {SECTORS.map((sector) => (
                            <CommandItem
                              key={sector}
                              value={sector}
                              onSelect={() => {
                                setNewDeal({ ...newDeal, sector, customSector: sector === 'Other' ? newDeal.customSector : '' });
                                setSectorOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", newDeal.sector === sector ? "opacity-100" : "opacity-0")} />
                              {sector}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {newDeal.sector === 'Other' && (
                  <Input 
                    placeholder="Enter custom sector name"
                    value={newDeal.customSector}
                    onChange={(e) => setNewDeal({ ...newDeal, customSector: e.target.value })}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map(stage => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead</Label>
                <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={leadOpen} className="w-full justify-between">
                      {newDeal.lead || "Select deal lead..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search team members..." />
                      <CommandList>
                        <CommandEmpty>No team member found.</CommandEmpty>
                        <CommandGroup>
                          {allUsers.filter(user => isDealEligibleUser(user)).map(user => {
                            const userOnboarding = onboardingStatus[user.id];
                            const isOnboardingComplete = userOnboarding?.isComplete ?? false;
                            return (
                              <CommandItem
                                key={user.id}
                                value={user.name}
                                onSelect={() => {
                                  if (!isOnboardingComplete) {
                                    setPendingAssignment({
                                      userId: user.id,
                                      userName: user.name,
                                      missingResume: !userOnboarding?.hasResume,
                                      missingPersonality: !userOnboarding?.hasPersonality,
                                      onConfirm: () => {
                                        setNewDeal({ ...newDeal, lead: user.name });
                                      }
                                    });
                                    setShowOnboardingWarning(true);
                                    setLeadOpen(false);
                                    return;
                                  }
                                  setNewDeal({ ...newDeal, lead: user.name });
                                  setLeadOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", newDeal.lead === user.name ? "opacity-100" : "opacity-0")} />
                                <span className={cn(!isOnboardingComplete && "text-muted-foreground")}>{user.name}</span>
                                {!isOnboardingComplete && (
                                  <Badge variant="outline" className="ml-2 text-xs text-amber-500 border-amber-500">Incomplete Onboarding</Badge>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex-1">
                <Label className="font-medium text-sm">Skip Automatic Team Assignment</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, no pod team will be auto-assigned. You can manually assign team members later.
                </p>
              </div>
              <Switch
                checked={newDeal.skipPodFormation}
                onCheckedChange={(checked) => setNewDeal({ ...newDeal, skipPodFormation: checked })}
                data-testid="switch-skip-pod-formation"
              />
            </div>
            
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fee Structure (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Engagement Fee ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={newDealFees.engagement}
                    onChange={(e) => setNewDealFees({ ...newDealFees, engagement: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Retainer ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={newDealFees.monthly}
                    onChange={(e) => setNewDealFees({ ...newDealFees, monthly: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Success Fee (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    step="0.1"
                    value={newDealFees.success}
                    onChange={(e) => setNewDealFees({ ...newDealFees, success: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Transaction Fee (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    step="0.1"
                    value={newDealFees.transaction}
                    onChange={(e) => setNewDealFees({ ...newDealFees, transaction: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Spread (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    step="0.1"
                    value={newDealFees.spread}
                    onChange={(e) => setNewDealFees({ ...newDealFees, spread: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending}>
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          {editingDeal && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Deal Name</Label>
                <Input 
                  value={editingDeal.name}
                  onChange={(e) => setEditingDeal({ ...editingDeal, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Input 
                  value={editingDeal.client}
                  onChange={(e) => setEditingDeal({ ...editingDeal, client: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Value (in millions)</Label>
                  <Input 
                    type="number" 
                    value={editingDeal.value}
                    onChange={(e) => setEditingDeal({ ...editingDeal, value: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={editingDeal.stage} onValueChange={(v) => setEditingDeal({ ...editingDeal, stage: v, progress: getStageProgress(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map(stage => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Popover open={editSectorOpen} onOpenChange={setEditSectorOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={editSectorOpen} className="w-full justify-between">
                        {editingDeal.sector === 'Other' && editCustomSector ? editCustomSector : editingDeal.sector}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search sector or type custom..." />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2">
                              <p className="text-sm text-muted-foreground mb-2">No sector found. Add custom:</p>
                              <Input 
                                placeholder="Enter custom sector"
                                value={editCustomSector}
                                onChange={(e) => setEditCustomSector(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editCustomSector) {
                                    setEditingDeal({ ...editingDeal, sector: 'Other' });
                                    setEditSectorOpen(false);
                                  }
                                }}
                              />
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {SECTORS.map((sector) => (
                              <CommandItem
                                key={sector}
                                value={sector}
                                onSelect={() => {
                                  setEditingDeal({ ...editingDeal, sector });
                                  if (sector !== 'Other') setEditCustomSector('');
                                  setEditSectorOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", editingDeal.sector === sector ? "opacity-100" : "opacity-0")} />
                                {sector}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {editingDeal.sector === 'Other' && (
                    <Input 
                      placeholder="Enter custom sector name"
                      value={editCustomSector}
                      onChange={(e) => setEditCustomSector(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editingDeal.status} onValueChange={(v) => setEditingDeal({ ...editingDeal, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleEditDeal} disabled={updateDeal.isPending}>
              {updateDeal.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal for Calendar View */}
      <Dialog open={showTaskDetailModal} onOpenChange={setShowTaskDetailModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Task Details
            </DialogTitle>
            <DialogDescription>
              {selectedCalendarTask?.deal?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCalendarTask && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedCalendarTask.title}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge variant={selectedCalendarTask.priority === 'High' ? 'destructive' : 'secondary'} className="mt-1">
                    {selectedCalendarTask.priority}
                  </Badge>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedCalendarTask.status === 'Completed' ? 'default' : 'secondary'} className="mt-1">
                    {selectedCalendarTask.status}
                  </Badge>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium mt-1">
                    {selectedCalendarTask.dueDate ? format(parseISO(selectedCalendarTask.dueDate), 'MMM d, yyyy') : 'Not set'}
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Assigned To</p>
                  <p className="text-sm font-medium mt-1">
                    {allUsers.find((u: any) => u.id === selectedCalendarTask.assignedTo)?.name || 'Unassigned'}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Related Deal</p>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="font-medium">{selectedCalendarTask.deal?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCalendarTask.deal?.client} • {selectedCalendarTask.deal?.sector}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedDeal(selectedCalendarTask.deal);
                    setActiveTab("overview");
                    setShowTaskDetailModal(false);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Deal
                </Button>
                <Button variant="outline" onClick={() => setShowTaskDetailModal(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stage Change Confirmation Dialog */}
      <AlertDialog open={showStageChangeDialog} onOpenChange={setShowStageChangeDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Deal Stage</AlertDialogTitle>
            <AlertDialogDescription>
              {stageChangeDeal && (
                <>Move <span className="font-medium text-foreground">{stageChangeDeal.name}</span> from <span className="font-medium text-foreground">{stageChangeDeal.stage}</span> to <span className="font-medium text-foreground">{stageChangeTarget}</span>?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex-1">
                <Label className="font-medium text-sm">Skip Automatic Team Assignment</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, no team members will be auto-assigned for this stage. You can manually assign team members later.
                </p>
              </div>
              <Switch
                checked={skipStageChangePodFormation}
                onCheckedChange={setSkipStageChangePodFormation}
                data-testid="switch-skip-pod-formation-stage-change"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setStageChangeDeal(null);
              setStageChangeTarget('');
              setSkipStageChangePodFormation(false);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStageChange}
              disabled={transitionStage.isPending}
              data-testid="button-confirm-stage-change"
            >
              {transitionStage.isPending ? "Changing..." : "Change Stage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Deal Confirmation Dialog - Offers Archive Option First */}
      <AlertDialog open={showDeleteDealDialog} onOpenChange={setShowDeleteDealDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Delete or Archive Deal?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>We recommend <strong>archiving</strong> instead of deleting. Archived deals preserve all documents, notes, and data for future reference and can be restored at any time.</p>
              <p className="text-red-400"><strong>Permanent deletion</strong> cannot be undone and will remove all associated data including team members, investors, and documents.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setDealToDelete(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
              onClick={() => {
                if (dealToDelete) {
                  const deal = deals.find((d: Deal) => d.id === dealToDelete);
                  if (deal) {
                    setDealToArchive(deal);
                    setShowArchiveDialog(true);
                  }
                  setDealToDelete(null);
                  setShowDeleteDealDialog(false);
                }
              }}
              data-testid="button-archive-instead"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive Instead (Recommended)
            </Button>
            <AlertDialogAction 
              onClick={() => {
                if (dealToDelete) {
                  handleDeleteDeal(dealToDelete);
                  setDealToDelete(null);
                  setShowDeleteDealDialog(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-permanent-delete"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Deal Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={(open) => {
        setShowArchiveDialog(open);
        if (!open) {
          setDealToArchive(null);
          setArchiveReason('');
          setArchiveNotes('');
        }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Archive Deal
            </DialogTitle>
            <DialogDescription>
              Archived deals are preserved with all their documents and data for future reference. You can restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Archiving</Label>
              <Select value={archiveReason} onValueChange={setArchiveReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deal Rejected">Deal Rejected</SelectItem>
                  <SelectItem value="Client Declined">Client Declined</SelectItem>
                  <SelectItem value="Deal Fell Through">Deal Fell Through</SelectItem>
                  <SelectItem value="Market Conditions">Market Conditions</SelectItem>
                  <SelectItem value="Completed">Completed / Closed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about why this deal is being archived, lessons learned, or future reference information..."
                value={archiveNotes}
                onChange={(e) => setArchiveNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowArchiveDialog(false);
              setDealToArchive(null);
              setArchiveReason('');
              setArchiveNotes('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleArchiveDeal}
              disabled={archiveDeal.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {archiveDeal.isPending ? "Archiving..." : "Archive Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog - Offers Archive Option First */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Delete or Archive {selectedDeals.length} Deals?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>We recommend <strong>archiving</strong> instead of deleting. Archived deals preserve all documents, notes, and data for future reference and can be restored at any time.</p>
              <p className="text-red-400"><strong>Permanent deletion</strong> cannot be undone and will remove all associated data.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isBulkArchiving || bulkDeleteDeals.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
              disabled={isBulkArchiving || bulkDeleteDeals.isPending}
              onClick={async () => {
                setIsBulkArchiving(true);
                let successCount = 0;
                const errors: string[] = [];
                const successfulIds: string[] = [];
                
                for (const dealId of selectedDeals) {
                  try {
                    await archiveDeal.mutateAsync({
                      id: dealId,
                      reason: 'Bulk Archive',
                      notes: undefined
                    });
                    successCount++;
                    successfulIds.push(dealId);
                  } catch (error: any) {
                    const deal = deals.find((d: Deal) => d.id === dealId);
                    errors.push(deal?.name || dealId);
                  }
                }
                
                setIsBulkArchiving(false);
                
                if (errors.length === 0) {
                  toast.success(`${successCount} deals archived. You can find them in the Archived Deals section.`);
                  setSelectedDeals([]);
                  setShowBulkDeleteDialog(false);
                } else if (successCount > 0) {
                  toast.warning(`${successCount} deals archived, ${errors.length} failed: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
                  setSelectedDeals(selectedDeals.filter(id => !successfulIds.includes(id)));
                } else {
                  toast.error(`Failed to archive deals: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
                }
              }}
              data-testid="button-bulk-archive-instead"
            >
              {isBulkArchiving ? (
                <>Archiving...</>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive All (Recommended)
                </>
              )}
            </Button>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              disabled={isBulkArchiving || bulkDeleteDeals.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteDeals.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Move to Opportunities Dialog */}
      <AlertDialog open={showBulkMoveDialog} onOpenChange={setShowBulkMoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedDeals.length} Deals to Opportunities</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {selectedDeals.length} deals back to the opportunities queue for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMoveToOpportunity}>
              Move to Opportunities
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Onboarding Incomplete Warning Dialog */}
      <AlertDialog open={showOnboardingWarning} onOpenChange={setShowOnboardingWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <UserCircle className="w-5 h-5" />
              Onboarding Not Complete
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                <strong>{pendingAssignment?.userName}</strong> has not completed the required onboarding steps.
              </p>
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Missing steps:</p>
                <ul className="text-sm space-y-1">
                  {pendingAssignment?.missingResume && (
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive" />
                      Resume Onboarding (upload and analysis)
                    </li>
                  )}
                  {pendingAssignment?.missingPersonality && (
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive" />
                      Personality Assessment
                    </li>
                  )}
                </ul>
              </div>
              <p className="text-sm">
                We recommend having this team member complete their onboarding for optimal team assignment. You can still proceed with the assignment if needed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowOnboardingWarning(false);
              setPendingAssignment(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingAssignment?.onConfirm) {
                pendingAssignment.onConfirm();
              }
              setShowOnboardingWarning(false);
              setPendingAssignment(null);
            }}>
              Assign Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
