import { useState, useEffect, useRef, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  Trash2,
  Upload,
  Download,
  Pencil,
  FileEdit,
  Mail,
  ListChecks
} from "lucide-react";
import { useCurrentUser, useTasks, useDealsListing, useUpdateTask, useCreateTask, useDeleteTask, useUsers, apiRequest, useUserPreferences, useSaveUserPreferences, useCreateTaskAttachment, useStakeholders, useCreateStakeholder } from "@/lib/api";
import type { Stakeholder } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO, isToday, isBefore, addDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import type { Task, Deal } from "@shared/schema";

type SwipeDirection = 'left' | 'right' | 'up' | null;

// Helper to open data URLs in a new tab (converts to blob URL to avoid security restrictions)
const openDataUrlInNewTab = (dataUrl: string, filename?: string) => {
  try {
    if (dataUrl.startsWith('data:')) {
      // Parse the data URL
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          toast.error("Unable to open file. Please allow popups.");
          URL.revokeObjectURL(blobUrl);
        }
        return;
      }
    }
    // Not a data URL, open directly
    window.open(dataUrl, '_blank');
  } catch (error) {
    console.error('Failed to open file:', error);
    toast.error("Failed to open file");
  }
};

// Helper to format due date with optional time
const formatDueDateTime = (dueDate: string) => {
  if (!dueDate) return '';
  try {
    if (dueDate.includes('T')) {
      // Has time component
      const date = new Date(dueDate);
      return format(date, 'MMM d, yyyy h:mm a');
    } else {
      // Date only
      const date = parseISO(dueDate);
      return format(date, 'MMM d, yyyy');
    }
  } catch {
    return dueDate;
  }
};

// Check if task is overdue - properly handles datetime comparison in LOCAL timezone
const isTaskOverdue = (dueDate: string, status: string) => {
  if (!dueDate || status === 'Completed' || status === 'Overdue') return false;
  try {
    const now = new Date();
    let dueDateTime: Date;
    
    if (dueDate.includes('T')) {
      // Has time component - ALWAYS parse as local time to avoid UTC confusion
      const [datePart, timePart] = dueDate.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const timeParts = timePart.replace('Z', '').split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      const seconds = parseInt(timeParts[2]) || 0;
      dueDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
    } else {
      // Date only - treat as end of day (23:59:59) in local timezone
      const [year, month, day] = dueDate.split('-').map(Number);
      dueDateTime = new Date(year, month - 1, day, 23, 59, 59);
    }
    
    return dueDateTime < now;
  } catch (e) {
    console.error('isTaskOverdue error:', e);
    return false;
  }
};

type UploadedFile = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
};

// Helper to render text with clickable links
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

type AppSuggestion = {
  name: string;
  icon: string;
  description: string;
  url?: string;
  localProtocol?: string;
  macFallback?: string;
  winFallback?: string;
  action: 'open' | 'create' | 'edit';
};

// Detect user's operating system
const getOS = (): 'mac' | 'windows' | 'other' => {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  if (platform.includes('mac') || userAgent.includes('mac')) return 'mac';
  if (platform.includes('win') || userAgent.includes('win')) return 'windows';
  return 'other';
};


const APP_CATALOG: Record<string, AppSuggestion> = {
  'excel': { 
    name: 'Spreadsheet', 
    icon: '📊', 
    description: 'Create or edit spreadsheets', 
    localProtocol: 'ms-excel:', 
    macFallback: 'https://www.icloud.com/numbers',
    url: 'https://www.office.com/launch/excel', 
    action: 'create' 
  },
  'word': { 
    name: 'Word Processor', 
    icon: '📄', 
    description: 'Create or edit documents', 
    localProtocol: 'ms-word:', 
    macFallback: 'https://www.icloud.com/pages',
    url: 'https://www.office.com/launch/word', 
    action: 'create' 
  },
  'powerpoint': { 
    name: 'Presentations', 
    icon: '📽️', 
    description: 'Create presentations', 
    localProtocol: 'ms-powerpoint:', 
    macFallback: 'https://www.icloud.com/keynote',
    url: 'https://www.office.com/launch/powerpoint', 
    action: 'create' 
  },
  'google_docs': { name: 'Google Docs', icon: '📝', description: 'Create or edit documents', url: 'https://docs.google.com/document/create', action: 'create' },
  'google_sheets': { name: 'Google Sheets', icon: '📈', description: 'Create or edit spreadsheets', url: 'https://docs.google.com/spreadsheets/create', action: 'create' },
  'google_slides': { name: 'Google Slides', icon: '🎞️', description: 'Create presentations', url: 'https://docs.google.com/presentation/create', action: 'create' },
  'email': { name: 'Email Client', icon: '✉️', description: 'Send emails', url: 'mailto:', action: 'open' },
  'calendar': { name: 'Calendar', icon: '📅', description: 'Schedule meetings', localProtocol: 'webcal:', url: 'https://calendar.google.com', action: 'open' },
  'pdf_editor': { name: 'PDF Editor', icon: '📕', description: 'Edit PDF documents', url: 'https://www.adobe.com/acrobat/online/pdf-editor.html', action: 'edit' },
  'bloomberg': { name: 'Bloomberg', icon: '💹', description: 'Financial data & analysis', url: 'https://www.bloomberg.com', action: 'open' },
  'pitchbook': { name: 'PitchBook', icon: '📊', description: 'Deal & investor data', url: 'https://pitchbook.com', action: 'open' },
  'capital_iq': { name: 'Capital IQ', icon: '📈', description: 'Financial research', url: 'https://www.capitaliq.com', action: 'open' },
  'factset': { name: 'FactSet', icon: '📉', description: 'Financial data platform', url: 'https://www.factset.com', action: 'open' },
  'docusign': { name: 'DocuSign', icon: '✍️', description: 'Electronic signatures', url: 'https://www.docusign.com', action: 'open' },
  'zoom': { name: 'Zoom', icon: '🎥', description: 'Video meetings', localProtocol: 'zoommtg:', url: 'https://zoom.us', action: 'open' },
  'teams': { name: 'Microsoft Teams', icon: '💬', description: 'Team collaboration', localProtocol: 'msteams:', url: 'https://teams.microsoft.com', action: 'open' },
  'slack': { name: 'Slack', icon: '💼', description: 'Team messaging', localProtocol: 'slack:', url: 'https://slack.com', action: 'open' },
  'notion': { name: 'Notion', icon: '📓', description: 'Notes & documentation', localProtocol: 'notion:', url: 'https://www.notion.so', action: 'open' },
};

type MyTasksProps = {
  role?: 'CEO' | 'Employee';
};

export default function MyTasks({ role = 'Employee' }: MyTasksProps) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: deals = [] } = useDealsListing();
  const { data: users = [] } = useUsers();
  const { data: stakeholdersData } = useStakeholders({ pageSize: 1000 });
  const stakeholders = stakeholdersData?.stakeholders || [];
  const createStakeholder = useCreateStakeholder();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const createTaskAttachment = useCreateTaskAttachment();
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
    dueTime: '',
    dealId: '',
    type: 'General' as 'General' | 'Document Review' | 'Due Diligence' | 'Client Communication' | 'Financial Analysis' | 'Legal' | 'Compliance'
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editTaskForm, setEditTaskForm] = useState({
    id: '',
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    dueDate: '',
    dueTime: '',
    dealId: '',
    type: 'General' as 'General' | 'Document Review' | 'Due Diligence' | 'Client Communication' | 'Financial Analysis' | 'Legal' | 'Compliance',
    status: 'Pending' as string
  });
  const [editAttachments, setEditAttachments] = useState<UploadedFile[]>([]);
  const [forwardToUser, setForwardToUser] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{action: string, reasoning: string, tools: string[], apps?: AppSuggestion[]} | null>(null);
  const [deferredTasks, setDeferredTasks] = useState<string[]>([]);
  const [workingTask, setWorkingTask] = useState<Task | null>(null);
  const [showSendWorkModal, setShowSendWorkModal] = useState(false);
  const [completedWorkNotes, setCompletedWorkNotes] = useState("");
  const [sendWorkAttachments, setSendWorkAttachments] = useState<UploadedFile[]>([]);
  
  // Enhanced Send Work modal state
  const [sendWorkTab, setSendWorkTab] = useState<'internal' | 'external'>('internal');
  const [selectedInternalUsers, setSelectedInternalUsers] = useState<string[]>([]);
  const [internalUserSearch, setInternalUserSearch] = useState("");
  const [externalRecipientId, setExternalRecipientId] = useState<string>("");
  const [externalRecipientEmail, setExternalRecipientEmail] = useState("");
  const [externalRecipientName, setExternalRecipientName] = useState("");
  const [externalRecipientCompany, setExternalRecipientCompany] = useState("");
  const [externalEmailMessage, setExternalEmailMessage] = useState("");
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [showAddNewContact, setShowAddNewContact] = useState(false);
  const [isSendingExternal, setIsSendingExternal] = useState(false);
  
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
    if (t.status === 'Completed' || t.status === 'Draft') return false;
    if (!t.dueDate) return false;
    const dueDate = parseISO(t.dueDate);
    return !isToday(dueDate) && !isDateWithinThisWeek(t.dueDate);
  });
  
  const draftTasks = myTasks.filter(t => 
    t.status !== 'Completed' && (t.status === 'Draft' || !t.dueDate)
  );
  
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
      // Always use the enhanced Send Work modal for consistency
      setShowSendWorkModal(true);
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success("Task deleted successfully!");
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
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

  const openEditModal = (task: Task) => {
    // Parse existing due date/time
    let dueDate = '';
    let dueTime = '';
    if (task.dueDate) {
      if (task.dueDate.includes('T')) {
        const parts = task.dueDate.split('T');
        dueDate = parts[0];
        dueTime = parts[1]?.substring(0, 5) || '';
      } else {
        dueDate = task.dueDate;
      }
    }
    
    setEditTaskForm({
      id: task.id,
      title: task.title,
      description: task.description || '',
      priority: task.priority as any,
      dueDate,
      dueTime,
      dealId: task.dealId || '',
      type: (task.type as any) || 'General',
      status: task.status
    });
    // Load existing attachments for editing
    const existingAttachments = (task.attachments as any[]) || [];
    setEditAttachments(existingAttachments.map(a => ({
      id: a.id || crypto.randomUUID(),
      filename: a.filename,
      url: a.url,
      size: a.size || 0,
      type: a.type || 'application/octet-stream',
      uploadedAt: a.uploadedAt || new Date().toISOString(),
    })));
    setShowEditTaskModal(true);
  };

  const handleEditTask = async () => {
    if (!editTaskForm.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    
    try {
      // Combine date and time for full datetime (both optional)
      let fullDueDate: string | null = null;
      if (editTaskForm.dueDate) {
        fullDueDate = editTaskForm.dueTime 
          ? `${editTaskForm.dueDate}T${editTaskForm.dueTime}` 
          : editTaskForm.dueDate;
      }
      
      // If task has no date, set status to Draft; otherwise preserve or set to Pending
      let newStatus = editTaskForm.status;
      if (!fullDueDate && newStatus !== 'Completed') {
        newStatus = 'Draft';
      } else if (fullDueDate && newStatus === 'Draft') {
        newStatus = 'Pending';
      }
      
      await updateTask.mutateAsync({
        id: editTaskForm.id,
        title: editTaskForm.title.trim(),
        description: editTaskForm.description.trim() || null,
        priority: editTaskForm.priority,
        status: newStatus,
        type: editTaskForm.type,
        dueDate: fullDueDate,
        dealId: editTaskForm.dealId || null,
        attachments: editAttachments.map(f => ({
          id: f.id,
          filename: f.filename,
          url: f.url,
          size: f.size,
          uploadedAt: f.uploadedAt,
        })),
      });
      
      toast.success("Task updated successfully!");
      setShowEditTaskModal(false);
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  const analyzeTaskWithAI = async (task: Task) => {
    setIsAnalyzing(true);
    setAiSuggestion(null);
    
    try {
      const deal = getDeal(task.dealId);
      const attachmentCount = (task.attachments as any[])?.length || 0;
      const hasAttachments = attachmentCount > 0;
      
      const response = await fetch('/api/ai/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: {
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            hasAttachments,
            attachmentCount,
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
      
      // Map suggested tools to app catalog
      const suggestedApps = mapToolsToApps(data.tools || [], task);
      setAiSuggestion({ ...data, apps: suggestedApps });
    } catch (error: any) {
      toast.error("Failed to analyze task with AI");
      const fallbackApps = mapToolsToApps(["Document Editor", "Email Client", "Calendar"], task);
      setAiSuggestion({
        action: "Manual Analysis Required",
        reasoning: "Unable to get AI suggestions at this time. Please analyze the task manually.",
        tools: ["Document Editor", "Email Client", "Calendar"],
        apps: fallbackApps
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const mapToolsToApps = (tools: string[], task: Task): AppSuggestion[] => {
    const apps: AppSuggestion[] = [];
    const taskType = task.type?.toLowerCase() || '';
    const title = task.title?.toLowerCase() || '';
    const desc = task.description?.toLowerCase() || '';
    
    // Add context-aware apps based on task type
    if (taskType.includes('financial') || title.includes('model') || title.includes('valuation') || desc.includes('excel')) {
      apps.push(APP_CATALOG['excel'] || APP_CATALOG['google_sheets']);
    }
    if (taskType.includes('document') || title.includes('memo') || title.includes('report') || desc.includes('document')) {
      apps.push(APP_CATALOG['word'] || APP_CATALOG['google_docs']);
    }
    if (title.includes('presentation') || title.includes('deck') || title.includes('pitch')) {
      apps.push(APP_CATALOG['powerpoint'] || APP_CATALOG['google_slides']);
    }
    if (taskType.includes('communication') || title.includes('email') || title.includes('client')) {
      apps.push(APP_CATALOG['email']);
    }
    if (title.includes('meeting') || title.includes('call') || title.includes('schedule')) {
      apps.push(APP_CATALOG['calendar']);
      apps.push(APP_CATALOG['zoom']);
    }
    if (title.includes('sign') || title.includes('signature') || desc.includes('signature')) {
      apps.push(APP_CATALOG['docusign']);
    }
    if (taskType.includes('due diligence') || title.includes('research') || desc.includes('research')) {
      apps.push(APP_CATALOG['capital_iq']);
      apps.push(APP_CATALOG['pitchbook']);
    }
    
    // Map any remaining tools from AI response
    tools.forEach(tool => {
      const toolLower = tool.toLowerCase();
      if (toolLower.includes('excel') || toolLower.includes('spreadsheet')) {
        if (!apps.find(a => a.name.includes('Excel') || a.name.includes('Sheets'))) {
          apps.push(APP_CATALOG['excel']);
        }
      }
      if (toolLower.includes('word') || toolLower.includes('document')) {
        if (!apps.find(a => a.name.includes('Word') || a.name.includes('Docs'))) {
          apps.push(APP_CATALOG['word']);
        }
      }
      if (toolLower.includes('powerpoint') || toolLower.includes('presentation') || toolLower.includes('slides')) {
        if (!apps.find(a => a.name.includes('PowerPoint') || a.name.includes('Slides'))) {
          apps.push(APP_CATALOG['powerpoint']);
        }
      }
      if (toolLower.includes('email') || toolLower.includes('mail')) {
        if (!apps.find(a => a.name.includes('Email'))) {
          apps.push(APP_CATALOG['email']);
        }
      }
      if (toolLower.includes('calendar')) {
        if (!apps.find(a => a.name.includes('Calendar'))) {
          apps.push(APP_CATALOG['calendar']);
        }
      }
      if (toolLower.includes('pdf')) {
        if (!apps.find(a => a.name.includes('PDF'))) {
          apps.push(APP_CATALOG['pdf_editor']);
        }
      }
    });
    
    // Ensure at least some apps are suggested
    if (apps.length === 0) {
      apps.push(APP_CATALOG['word'], APP_CATALOG['email'], APP_CATALOG['calendar']);
    }
    
    // Remove duplicates and filter undefined
    const uniqueApps = apps.filter((app, index, self) => 
      app && self.findIndex(a => a?.name === app.name) === index
    );
    
    return uniqueApps.slice(0, 3); // Max 3 best apps
  };
  
  const openAppForTask = (app: AppSuggestion, task: Task) => {
    const os = getOS();
    
    // Set this task as the working task
    setWorkingTask(task);
    setShowAIModal(false);
    
    // Try local protocol handler first for specific apps
    if (app.localProtocol) {
      // For protocol handlers, we use window.location.href and catch errors
      // Show a toast with instructions
      toast.info(`Opening ${app.name}...`, { 
        description: 'If the app doesn\'t open, it may not be installed. Falling back to web version.',
        duration: 3000
      });
      
      // Try protocol handler with timeout fallback
      const protocolUrl = app.localProtocol;
      const startTime = Date.now();
      
      // Use an iframe to test protocol handler (doesn't navigate away)
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.location.href = protocolUrl;
        }
      } catch {
        // Protocol failed, continue to fallback
      }
      
      // After short delay, open web fallback
      setTimeout(() => {
        document.body.removeChild(iframe);
        // If on Mac and there's a Mac fallback, use it
        if (os === 'mac' && app.macFallback) {
          window.open(app.macFallback, '_blank');
        } else if (app.url) {
          window.open(app.url, '_blank');
        }
      }, 500);
    } else {
      // No protocol handler, use OS-specific fallback or default URL
      if (os === 'mac' && app.macFallback) {
        window.open(app.macFallback, '_blank');
      } else if (os === 'windows' && app.winFallback) {
        window.open(app.winFallback, '_blank');
      } else if (app.url) {
        window.open(app.url, '_blank');
      } else {
        toast.error(`Unable to open ${app.name}`);
        return;
      }
    }
    
    toast.success(`Working on task. Swipe left on the task when ready to send your work.`, {
      duration: 5000,
    });
  };
  
  const handleBringBackWork = () => {
    if (!workingTask) return;
    setSelectedTask(workingTask);
    setShowSendWorkModal(true);
  };
  
  const handleSendWork = async () => {
    if (!selectedTask) {
      toast.error("No task selected");
      return;
    }
    
    if (sendWorkTab === 'internal') {
      // Internal: send to selected platform users
      if (selectedInternalUsers.length === 0) {
        toast.error("Please select at least one team member");
        return;
      }
      
      try {
        const currentDescription = selectedTask.description || '';
        const workNote = completedWorkNotes ? `\n\n--- Work Completed ---\n${completedWorkNotes}` : '';
        
        const existingAttachments = (selectedTask.attachments as any[]) || [];
        const newAttachments = sendWorkAttachments.map(f => ({
          id: f.id,
          filename: f.filename,
          url: f.url,
          size: f.size,
          uploadedAt: f.uploadedAt,
        }));
        const allAttachments = [...existingAttachments, ...newAttachments];
        
        // If one user selected, update the existing task
        if (selectedInternalUsers.length === 1) {
          await updateTask.mutateAsync({ 
            id: selectedTask.id, 
            assignedTo: selectedInternalUsers[0],
            description: currentDescription + workNote,
            attachments: allAttachments,
            status: 'Pending'
          });
        } else {
          // Multiple users: create copies of the task for each
          for (const userId of selectedInternalUsers) {
            await createTask.mutateAsync({
              title: selectedTask.title,
              description: currentDescription + workNote,
              priority: selectedTask.priority as any,
              status: 'Pending',
              type: selectedTask.type as any,
              dueDate: selectedTask.dueDate || null,
              dealId: selectedTask.dealId || null,
              assignedTo: userId,
              assignedBy: currentUser?.id || '',
              attachments: allAttachments,
            });
          }
          // Mark original as completed
          await updateTask.mutateAsync({
            id: selectedTask.id,
            status: 'Completed',
            description: currentDescription + workNote + `\n\n[Forwarded to ${selectedInternalUsers.length} team members]`,
          });
        }
        
        toast.success(`Work sent to ${selectedInternalUsers.length} team member(s)!`);
        resetSendWorkModal();
      } catch (error: any) {
        toast.error(error.message || "Failed to send work");
      }
    } else {
      // External: send email to external stakeholder
      const recipientEmail = externalRecipientEmail || stakeholders.find(s => s.id === externalRecipientId)?.email;
      const recipientName = externalRecipientName || stakeholders.find(s => s.id === externalRecipientId)?.name;
      
      if (!recipientEmail) {
        toast.error("Please provide a valid email address");
        return;
      }
      
      setIsSendingExternal(true);
      try {
        // If adding new contact, save it first
        if (showAddNewContact && externalRecipientName && externalRecipientEmail) {
          await createStakeholder.mutateAsync({
            name: externalRecipientName,
            email: externalRecipientEmail,
            company: externalRecipientCompany || 'Unknown',
            title: 'Contact',
            type: 'other',
          });
        }
        
        // Send email with attachments
        const response = await fetch('/api/send-external-work', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail,
            recipientName: recipientName || 'Recipient',
            senderName: currentUser?.name || 'Team Member',
            taskTitle: selectedTask.title,
            message: externalEmailMessage || completedWorkNotes,
            attachments: sendWorkAttachments.map(f => ({
              filename: f.filename,
              url: f.url,
            })),
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send email');
        }
        
        // Mark task as completed with note about external send
        const currentDescription = selectedTask.description || '';
        const workNote = `\n\n--- Sent Externally ---\nTo: ${recipientName} <${recipientEmail}>\nDate: ${new Date().toLocaleString()}\n${externalEmailMessage || completedWorkNotes}`;
        
        await updateTask.mutateAsync({
          id: selectedTask.id,
          status: 'Completed',
          description: currentDescription + workNote,
        });
        
        toast.success(`Work sent to ${recipientName} via email!`);
        resetSendWorkModal();
      } catch (error: any) {
        toast.error(error.message || "Failed to send email");
      } finally {
        setIsSendingExternal(false);
      }
    }
  };
  
  const resetSendWorkModal = () => {
    setShowSendWorkModal(false);
    setWorkingTask(null);
    setSelectedTask(null);
    setForwardToUser("");
    setCompletedWorkNotes("");
    setSendWorkAttachments([]);
    setSendWorkTab('internal');
    setSelectedInternalUsers([]);
    setInternalUserSearch("");
    setExternalRecipientId("");
    setExternalRecipientEmail("");
    setExternalRecipientName("");
    setExternalRecipientCompany("");
    setExternalEmailMessage("");
    setStakeholderSearch("");
    setShowAddNewContact(false);
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
    if (file && file.url && !file.url.startsWith('data:')) {
      try {
        const filename = file.url.replace('/uploads/', '');
        await fetch(`/api/upload/${filename}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Time options for dropdown
  const timeOptions = [
    { value: '', label: 'No specific time' },
    { value: '09:00', label: '9:00 AM' },
    { value: '09:30', label: '9:30 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '10:30', label: '10:30 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '11:30', label: '11:30 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '12:30', label: '12:30 PM' },
    { value: '13:00', label: '1:00 PM' },
    { value: '13:30', label: '1:30 PM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '14:30', label: '2:30 PM' },
    { value: '15:00', label: '3:00 PM' },
    { value: '15:30', label: '3:30 PM' },
    { value: '16:00', label: '4:00 PM' },
    { value: '16:30', label: '4:30 PM' },
    { value: '17:00', label: '5:00 PM' },
    { value: '17:30', label: '5:30 PM' },
    { value: '18:00', label: '6:00 PM' },
    { value: '18:30', label: '6:30 PM' },
    { value: '19:00', label: '7:00 PM' },
    { value: '20:00', label: '8:00 PM' },
    { value: '21:00', label: '9:00 PM' },
  ];

  const handleCreateTask = async () => {
    if (!newTaskForm.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    
    try {
      // Combine date and time for full datetime (both optional)
      let fullDueDate: string | null = null;
      if (newTaskForm.dueDate) {
        fullDueDate = newTaskForm.dueTime 
          ? `${newTaskForm.dueDate}T${newTaskForm.dueTime}` 
          : newTaskForm.dueDate;
      }
      
      const taskData: any = {
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim() || null,
        priority: newTaskForm.priority,
        status: fullDueDate ? 'Pending' : 'Draft',
        type: newTaskForm.type,
        assignedTo: currentUser?.id || '',
        dueDate: fullDueDate,
      };
      if (newTaskForm.dealId && newTaskForm.dealId !== 'none') {
        taskData.dealId = newTaskForm.dealId;
        const selectedDeal = deals.find(d => d.id === newTaskForm.dealId);
        if (selectedDeal) {
          taskData.dealStage = selectedDeal.stage;
        }
      }
      const attachmentObjects = uploadedFiles.map(file => ({
        id: file.id,
        filename: file.filename,
        url: file.url,
        size: file.size,
        uploadedAt: file.uploadedAt,
      }));

      if (attachmentObjects.length > 0) {
        taskData.attachments = attachmentObjects;
      }

      const createdTask = await createTask.mutateAsync(taskData);
      
      for (const file of uploadedFiles) {
        await createTaskAttachment.mutateAsync({
          taskId: createdTask.id,
          filename: file.url.split('/').pop() || file.filename,
          originalName: file.filename,
          mimeType: file.type || null,
          size: file.size,
        });
      }
      
      toast.success("Task created successfully!");
      setShowCreateTaskModal(false);
      setNewTaskForm({
        title: '',
        description: '',
        priority: 'Medium',
        dueDate: '',
        dueTime: '',
        dealId: '',
        type: 'General'
      });
      setUploadedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    }
  };

  if (isLoading) {
    return (
      <Layout role={role} pageTitle="My Tasks" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading tasks...</div>
        </div>
      </Layout>
    );
  }

  const currentTask = swipeableTasks[currentSwipeIndex];

  return (
    <Layout role={role} pageTitle="My Tasks" userName={currentUser?.name || ""}>
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
              <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center text-gray-500">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-drafts">{draftTasks.length}</div>
                <div className="text-xs text-muted-foreground">Drafts</div>
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

        {/* Work in Progress Indicator - placed under main task widget */}
        {workingTask && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4"
          >
            <Card className="bg-primary/90 text-primary-foreground shadow-lg border-0 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Working on: {workingTask.title}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-7 text-xs"
                    onClick={handleBringBackWork}
                    data-testid="button-send-work"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Send Work
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 text-xs text-primary-foreground hover:text-primary-foreground hover:bg-white/20"
                    onClick={() => setWorkingTask(null)}
                    data-testid="button-clear-working"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Task Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* Drafts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-gray-500" />
                Drafts
              </h3>
              <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">{draftTasks.length}</Badge>
            </div>
            <ScrollArea className="h-[400px] pr-2">
              {draftTasks.length === 0 ? (
                <Card className="bg-card/50 border-border border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    No draft tasks - create a task without a deadline to save as draft
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {draftTasks.map((task) => (
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
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {selectedTask.description ? renderTextWithLinks(selectedTask.description) : 'No description provided'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Deal</Label>
                  <p className="text-sm mt-1">{getDealName(selectedTask.dealId)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date & Time</Label>
                  <p className={cn(
                    "text-sm mt-1 flex items-center gap-1",
                    (selectedTask.status === 'Overdue' || isTaskOverdue(selectedTask.dueDate, selectedTask.status)) && "text-red-500 font-medium"
                  )}>
                    {selectedTask.dueDate ? (
                      <>
                        {selectedTask.status === 'Overdue' || isTaskOverdue(selectedTask.dueDate, selectedTask.status) ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : selectedTask.dueDate.includes('T') ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                        {formatDueDateTime(selectedTask.dueDate)}
                      </>
                    ) : 'No due date'}
                  </p>
                </div>
              </div>
              
              {selectedTask.attachments && Array.isArray(selectedTask.attachments) && selectedTask.attachments.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </Label>
                  <div className="mt-2 space-y-2">
                    {(selectedTask.attachments as any[]).map((attachment: any, i: number) => {
                      const filename = typeof attachment === 'string' ? attachment : attachment?.filename || attachment?.name || 'Attachment';
                      const url = typeof attachment === 'string' ? attachment : attachment?.url;
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">{filename}</span>
                          <div className="flex items-center gap-1">
                            {url && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => openDataUrlInNewTab(url, filename)}
                                title="View"
                                data-testid={`view-attachment-${i}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                            {url && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = filename;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                title="Download"
                                data-testid={`download-attachment-${i}`}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button 
              variant="destructive" 
              onClick={() => selectedTask && handleDeleteTask(selectedTask.id)}
              data-testid="button-delete-task"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={() => selectedTask && openEditModal(selectedTask)} data-testid="button-edit-task">
              Edit
            </Button>
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
                        <span className="text-muted-foreground">({user.jobTitle || user.role})</span>
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
        <DialogContent className="bg-card border-border max-w-xl max-h-[85vh] overflow-y-auto">
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
                <p className="text-xs text-muted-foreground mt-1">Considering deal stage and IB best practices</p>
              </div>
            ) : aiSuggestion ? (
              <>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Recommended Action</h4>
                    {aiSuggestion.estimatedTime && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {aiSuggestion.estimatedTime}
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-semibold">{aiSuggestion.action}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-2">Reasoning</h4>
                  <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
                </div>
                
                {aiSuggestion.keySteps && aiSuggestion.keySteps.length > 0 && (
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" />
                      Key Steps
                    </h4>
                    <ol className="space-y-1.5 text-sm text-muted-foreground">
                      {aiSuggestion.keySteps.map((step: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                
                <Separator />
                
                <div>
                  <h4 className="font-medium text-sm mb-3">Choose an App to Start Working</h4>
                  <p className="text-xs text-muted-foreground mb-3">Click an app below to open it. When finished, swipe left on the task to send your work.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(aiSuggestion.apps || []).map((app, i) => (
                      <Button 
                        key={i} 
                        variant="outline" 
                        className="h-auto py-3 px-4 flex flex-col items-start gap-1 hover:bg-primary/10 hover:border-primary/30 transition-all"
                        onClick={() => selectedTask && openAppForTask(app, selectedTask)}
                        data-testid={`button-open-app-${i}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xl">{app.icon}</span>
                          <span className="font-medium text-sm">{app.name}</span>
                          <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground text-left">{app.description}</span>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Send Work Modal */}
      <Dialog open={showSendWorkModal} onOpenChange={(open) => { if (!open) resetSendWorkModal(); else setShowSendWorkModal(true); }}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Completed Work
            </DialogTitle>
            <DialogDescription>
              Send your completed work for "{selectedTask?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={sendWorkTab} onValueChange={(v) => {
            setSendWorkTab(v as 'internal' | 'external');
            // Reset tab-specific selections when switching tabs
            setSelectedInternalUsers([]);
            setInternalUserSearch("");
            setExternalRecipientId("");
            setExternalRecipientEmail("");
            setExternalRecipientName("");
            setExternalRecipientCompany("");
            setStakeholderSearch("");
            setShowAddNewContact(false);
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internal" className="flex items-center gap-2">
                <User className="w-4 h-4" /> Internal Team
              </TabsTrigger>
              <TabsTrigger value="external" className="flex items-center gap-2">
                <Send className="w-4 h-4" /> External (Email)
              </TabsTrigger>
            </TabsList>
            
            {/* Shared: Work Notes & Attachments */}
            <div className="space-y-4 py-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">
                  <strong>Tip:</strong> Upload your completed files below. {sendWorkTab === 'internal' 
                    ? 'Recipients will see the task in their MyTasks page.' 
                    : 'Recipients will receive an email with your message and file links.'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>{sendWorkTab === 'external' ? 'Message' : 'Work Notes'} (Optional)</Label>
                <Textarea
                  placeholder={sendWorkTab === 'external' 
                    ? "Write a message to include in the email..." 
                    : "Describe what you completed, any notes for the recipient..."}
                  value={sendWorkTab === 'external' ? externalEmailMessage : completedWorkNotes}
                  onChange={(e) => sendWorkTab === 'external' ? setExternalEmailMessage(e.target.value) : setCompletedWorkNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid="textarea-work-notes"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Attach Completed Files</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (!files) return;
                        for (const file of Array.from(files)) {
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch('/api/upload', { method: 'POST', body: formData });
                            if (response.ok) {
                              const uploaded = await response.json();
                              setSendWorkAttachments(prev => [...prev, uploaded]);
                              toast.success(`Attached: ${file.name}`);
                            }
                          } catch {
                            toast.error(`Failed to upload ${file.name}`);
                          }
                        }
                      };
                      input.click();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload Files
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {sendWorkAttachments.length > 0 ? `${sendWorkAttachments.length} file(s)` : 'No files'}
                  </span>
                </div>
                {sendWorkAttachments.length > 0 && (
                  <div className="space-y-1 mt-2 max-h-24 overflow-y-auto">
                    {sendWorkAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-secondary/30 rounded text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{file.filename}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSendWorkAttachments(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <TabsContent value="internal" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Send To (select one or more team members) *</Label>
                <Input
                  placeholder="Search team members..."
                  value={internalUserSearch}
                  onChange={(e) => setInternalUserSearch(e.target.value)}
                  className="mb-2"
                  data-testid="input-search-internal-users"
                />
                <ScrollArea className="h-40 border rounded-md p-2">
                  {users
                    .filter(u => u.id !== currentUser?.id)
                    .filter(u => internalUserSearch === '' || u.name.toLowerCase().includes(internalUserSearch.toLowerCase()))
                    .map(user => (
                      <div 
                        key={user.id} 
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-secondary/50",
                          selectedInternalUsers.includes(user.id) && "bg-primary/10 border border-primary/30"
                        )}
                        onClick={() => {
                          setSelectedInternalUsers(prev => 
                            prev.includes(user.id) 
                              ? prev.filter(id => id !== user.id) 
                              : [...prev, user.id]
                          );
                        }}
                      >
                        <Checkbox 
                          checked={selectedInternalUsers.includes(user.id)} 
                          onCheckedChange={() => {
                            setSelectedInternalUsers(prev => 
                              prev.includes(user.id) 
                                ? prev.filter(id => id !== user.id) 
                                : [...prev, user.id]
                            );
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">({user.jobTitle || user.role})</span>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
                {selectedInternalUsers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedInternalUsers.length} user(s) selected
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="external" className="space-y-4 mt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipient</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddNewContact(!showAddNewContact);
                      setExternalRecipientId("");
                    }}
                    className="text-xs"
                  >
                    {showAddNewContact ? 'Select from Directory' : '+ Add New Contact'}
                  </Button>
                </div>
                
                {showAddNewContact ? (
                  <div className="space-y-3 p-3 border rounded-lg bg-secondary/20">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        placeholder="Contact name"
                        value={externalRecipientName}
                        onChange={(e) => setExternalRecipientName(e.target.value)}
                        data-testid="input-external-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email *</Label>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={externalRecipientEmail}
                        onChange={(e) => setExternalRecipientEmail(e.target.value)}
                        data-testid="input-external-email"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Input
                        placeholder="Company name (optional)"
                        value={externalRecipientCompany}
                        onChange={(e) => setExternalRecipientCompany(e.target.value)}
                        data-testid="input-external-company"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This contact will be saved to your directory for future use.
                    </p>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Search stakeholders..."
                      value={stakeholderSearch}
                      onChange={(e) => setStakeholderSearch(e.target.value)}
                      className="mb-2"
                      data-testid="input-search-stakeholders"
                    />
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {stakeholders
                        .filter(s => s.email)
                        .filter(s => stakeholderSearch === '' || 
                          s.name.toLowerCase().includes(stakeholderSearch.toLowerCase()) ||
                          s.company?.toLowerCase().includes(stakeholderSearch.toLowerCase()) ||
                          s.email?.toLowerCase().includes(stakeholderSearch.toLowerCase())
                        )
                        .map(stakeholder => (
                          <div 
                            key={stakeholder.id} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-secondary/50",
                              externalRecipientId === stakeholder.id && "bg-primary/10 border border-primary/30"
                            )}
                            onClick={() => setExternalRecipientId(stakeholder.id)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{stakeholder.name}</span>
                              <span className="text-xs text-muted-foreground">{stakeholder.email}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">{stakeholder.type}</Badge>
                          </div>
                        ))}
                      {stakeholders.filter(s => s.email).length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No stakeholders with email found. Click "Add New Contact" above.
                        </div>
                      )}
                    </ScrollArea>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={resetSendWorkModal}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendWork} 
              disabled={
                (sendWorkTab === 'internal' && selectedInternalUsers.length === 0) ||
                (sendWorkTab === 'external' && !externalRecipientId && !externalRecipientEmail) ||
                isSendingExternal
              }
            >
              {isSendingExternal ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> {sendWorkTab === 'internal' ? 'Send Work' : 'Send Email'}</>
              )}
            </Button>
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
              <Label>Due Date & Time (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newTaskForm.dueDate}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                  className="flex-1"
                  data-testid="input-new-task-due-date"
                />
                <Select 
                  value={newTaskForm.dueTime || 'none'} 
                  onValueChange={(value) => setNewTaskForm({ ...newTaskForm, dueTime: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="w-36" data-testid="select-new-task-due-time">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(opt => (
                      <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to save as a draft without deadline</p>
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
                  <SelectItem value="none">No deal</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
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
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-task-attachment"
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
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate flex-1">{file.filename}</span>
                      <span className="text-xs text-muted-foreground">
                        {file.size >= 1024 * 1024 
                          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                          : `${(file.size / 1024).toFixed(1)} KB`
                        }
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(file.url, '_blank');
                        }}
                        title="View"
                        data-testid={`view-upload-${index}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = file.url;
                          link.download = file.filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        title="Download"
                        data-testid={`download-upload-${index}`}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(index);
                        }}
                        title="Remove"
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

      {/* Edit Task Dialog */}
      <Dialog open={showEditTaskModal} onOpenChange={setShowEditTaskModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Task
            </DialogTitle>
            <DialogDescription>
              Update task details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                placeholder="Enter task title..."
                value={editTaskForm.title}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                data-testid="input-edit-task-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Add details about this task..."
                value={editTaskForm.description}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                rows={3}
                className="resize-none"
                data-testid="textarea-edit-task-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={editTaskForm.priority} 
                  onValueChange={(value: 'Low' | 'Medium' | 'High' | 'Urgent') => setEditTaskForm({ ...editTaskForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-edit-task-priority">
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
                  value={editTaskForm.type} 
                  onValueChange={(value: typeof editTaskForm.type) => setEditTaskForm({ ...editTaskForm, type: value })}
                >
                  <SelectTrigger data-testid="select-edit-task-type">
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
              <Label>Due Date & Time (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={editTaskForm.dueDate}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                  className="flex-1"
                  data-testid="input-edit-task-due-date"
                />
                <Select 
                  value={editTaskForm.dueTime || 'none'} 
                  onValueChange={(value) => setEditTaskForm({ ...editTaskForm, dueTime: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="w-36" data-testid="select-edit-task-due-time">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(opt => (
                      <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to save as a draft without deadline</p>
            </div>
            
            <div className="space-y-2">
              <Label>Related Deal (Optional)</Label>
              <Select 
                value={editTaskForm.dealId || 'none'} 
                onValueChange={(value) => setEditTaskForm({ ...editTaskForm, dealId: value === 'none' ? '' : value })}
              >
                <SelectTrigger data-testid="select-edit-task-deal">
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No deal</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.onchange = async (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (!files) return;
                      for (const file of Array.from(files)) {
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const response = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                          });
                          if (response.ok) {
                            const uploaded = await response.json();
                            setEditAttachments(prev => [...prev, uploaded]);
                            toast.success(`Added: ${file.name}`);
                          }
                        } catch {
                          toast.error(`Failed to upload ${file.name}`);
                        }
                      }
                    };
                    input.click();
                  }}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Add Files
                </Button>
                <span className="text-xs text-muted-foreground">
                  {editAttachments.length > 0 ? `${editAttachments.length} file(s)` : 'No files attached'}
                </span>
              </div>
              {editAttachments.length > 0 && (
                <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                  {editAttachments.map((file, idx) => (
                    <div key={file.id || idx} className="flex items-center justify-between p-2 bg-secondary/30 rounded text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{file.filename}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}
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
            <Button variant="outline" onClick={() => setShowEditTaskModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditTask} 
              disabled={updateTask.isPending}
              data-testid="button-edit-task-submit"
            >
              {updateTask.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
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
              <div className={cn(
                "flex items-center gap-1",
                (task.status === 'Overdue' || isTaskOverdue(task.dueDate, task.status)) && "text-red-500 font-medium"
              )}>
                {task.status === 'Overdue' || isTaskOverdue(task.dueDate, task.status) ? (
                  <AlertCircle className="w-4 h-4" />
                ) : task.dueDate.includes('T') ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                <span>{formatDueDateTime(task.dueDate)}</span>
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
          <div className={cn(
            "flex items-center gap-1 text-xs",
            task.status === 'Overdue' || isTaskOverdue(task.dueDate, task.status) 
              ? "text-red-500 font-medium" 
              : "text-muted-foreground"
          )}>
            {task.status === 'Overdue' || isTaskOverdue(task.dueDate, task.status) ? (
              <AlertCircle className="w-3 h-3" />
            ) : task.dueDate.includes('T') ? (
              <Clock className="w-3 h-3" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            <span>
              {task.status === 'Overdue' && 'OVERDUE: '}
              {formatDueDateTime(task.dueDate)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
