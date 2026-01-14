import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { 
  Search, Plus, Lightbulb, CheckCircle, XCircle, Eye, Clock, DollarSign,
  Building2, Users, ArrowRight, Briefcase, TrendingUp, AlertTriangle,
  Upload, FileText, Paperclip, StickyNote, X, Download, Trash2, ExternalLink,
  Pencil, Save, MessageSquare, Archive, Loader2, UsersRound, Calendar, Vote,
  ThumbsUp, ThumbsDown, Minus, Send
} from "lucide-react";
import { 
  useCurrentUser, useDealsListing, useDeal, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers,
  useCustomSectors, useCreateCustomSector, useTagDealMember, useRemoveDealMember,
  useDealNotes, useCreateDealNote, useApproveOpportunity, useBulkDeleteDeals, useArchiveDeal, type DealNoteType,
  type DealListing
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember, DealAttachment } from "@shared/schema";
import { ObjectUploader, type UploadedFile } from "@/components/ObjectUploader";

const DIVISIONS = ['Investment Banking', 'Asset Management'];
const BASE_SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Real Estate', 'Other'];

type OpportunityAttachment = {
  id: string;
  filename: string;
  url: string;
  objectPath?: string;
  size: number;
  type?: string;
  uploadedAt: string;
};

type OpportunityNote = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
};

type OpportunitiesProps = {
  role?: 'CEO' | 'Employee';
};

function DealNotesSection({ dealId, allUsers }: { dealId: string; allUsers: any[] }) {
  const { data: notes = [], isLoading } = useDealNotes(dealId);
  const createDealNote = useCreateDealNote();
  const [newNote, setNewNote] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        return <span key={i} className="text-amber-500 font-medium">{part}</span>;
      }
      return part;
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
          Opportunity Notes
        </h4>
        <Badge variant="secondary">{notes.length} notes</Badge>
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Add a note... Use @ to mention team members"
          value={newNote}
          onChange={handleInputChange}
          className="min-h-[80px]"
          data-testid="input-opportunity-note"
        />
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                onClick={() => insertMention(user.name)}
              >
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">
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
            data-testid="button-submit-opportunity-note"
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
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-sm font-medium text-amber-500 flex-shrink-0">
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

export default function Opportunities({ role = 'CEO' }: OpportunitiesProps) {
  const [location] = useLocation();
  const searchString = typeof window !== 'undefined' ? window.location.search : '';
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [], isLoading } = useDealsListing();
  const { data: users = [] } = useUsers();
  const { data: customSectors = [] } = useCustomSectors();
  const createCustomSector = useCreateCustomSector();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const approveOpportunity = useApproveOpportunity();
  const bulkDeleteDeals = useBulkDeleteDeals();
  const archiveDeal = useArchiveDeal();
  const tagMember = useTagDealMember();
  const removeMember = useRemoveDealMember();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  
  // Sector selector state
  const [sectorOpen, setSectorOpen] = useState(false);
  
  // Dynamic sectors list combining base + custom
  const SECTORS = useMemo(() => {
    const customNames = customSectors.map((s: any) => s.name);
    const allSectors = [...BASE_SECTORS, ...customNames.filter((name: string) => !BASE_SECTORS.includes(name))];
    return allSectors;
  }, [customSectors]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOpportunityDialog, setShowNewOpportunityDialog] = useState(false);
  const [showOpportunityDetail, setShowOpportunityDetail] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<DealListing | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [approvalDivision, setApprovalDivision] = useState<string>('Investment Banking');
  const [skipPodFormation, setSkipPodFormation] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'attachments' | 'notes'>('overview');
  const [newNote, setNewNote] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    client: "",
    sector: "",
    customSector: "",
    value: "" as string,
    description: "",
    lead: "",
  });
  const [editSectorOpen, setEditSectorOpen] = useState(false);
  
  const [newOpportunity, setNewOpportunity] = useState({
    name: "",
    client: "",
    sector: "Technology",
    customSector: "",
    value: "" as string,
    description: "",
    lead: "",
    notes: "" as string,
    attachments: [] as OpportunityAttachment[],
  });
  
  // Local state for opportunity details (notes and attachments)
  const [opportunityNotes, setOpportunityNotes] = useState<OpportunityNote[]>([]);
  const [opportunityAttachments, setOpportunityAttachments] = useState<OpportunityAttachment[]>([]);
  
  // Member tagging state
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  
  // Bulk selection state
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkPermanentDeleteDialog, setShowBulkPermanentDeleteDialog] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Archive dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [dealToArchive, setDealToArchive] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('');
  const [archiveNotes, setArchiveNotes] = useState<string>('');
  
  // Committee review state
  const [showCommitteeDialog, setShowCommitteeDialog] = useState(false);
  const [selectedCommitteeMembers, setSelectedCommitteeMembers] = useState<string[]>([]);
  const [committeeDeadline, setCommitteeDeadline] = useState<string>('');
  const [committeeMeetingDate, setCommitteeMeetingDate] = useState<string>('');
  const [committeeMeetingLink, setCommitteeMeetingLink] = useState<string>('');
  const [isCreatingCommittee, setIsCreatingCommittee] = useState(false);
  const [committeeReview, setCommitteeReview] = useState<any>(null);
  const [loadingCommitteeReview, setLoadingCommitteeReview] = useState(false);
  const [newCommitteeComment, setNewCommitteeComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  
  // Filter for Opportunity deals only (excluding archived)
  const opportunities = useMemo(() => {
    return deals.filter((deal) => {
      const isOpportunity = deal.dealType === 'Opportunity';
      const isArchived = deal.status === 'Archived' || deal.archivedAt;
      return isOpportunity && !isArchived;
    });
  }, [deals]);
  
  // Filter attachments to only show valid/available files
  const validAttachments = useMemo(() => {
    return opportunityAttachments.filter(attachment => {
      const url = attachment.objectPath || attachment.url;
      return url && (url.startsWith('/objects/') || url.startsWith('/uploads/') || url.startsWith('data:'));
    });
  }, [opportunityAttachments]);

  // Handle URL query parameter for selecting a specific opportunity
  useEffect(() => {
    if (searchString && opportunities.length > 0) {
      const params = new URLSearchParams(searchString);
      const opportunityId = params.get('id');
      if (opportunityId) {
        const opportunity = opportunities.find((d) => d.id === opportunityId);
        if (opportunity) {
          setSelectedOpportunity(opportunity as DealListing);
          setShowOpportunityDetail(true);
        }
      }
    }
  }, [searchString, opportunities]);
  
  // Apply search filter
  const filteredOpportunities = useMemo(() => {
    if (!searchQuery) return opportunities;
    const query = searchQuery.toLowerCase();
    return opportunities.filter((deal) => 
      deal.name.toLowerCase().includes(query) ||
      deal.client.toLowerCase().includes(query) ||
      deal.sector.toLowerCase().includes(query)
    );
  }, [opportunities, searchQuery]);
  
  // Stats
  const stats = useMemo(() => {
    const totalValue = opportunities.reduce((sum, deal) => sum + deal.value, 0);
    const pending = opportunities.filter((d) => d.status === 'Active').length;
    return { total: opportunities.length, totalValue, pending };
  }, [opportunities]);
  
  const toggleOpportunitySelection = (id: string) => {
    setSelectedOpportunities(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllOpportunities = () => {
    if (selectedOpportunities.length === filteredOpportunities.length) {
      setSelectedOpportunities([]);
    } else {
      setSelectedOpportunities(filteredOpportunities.map((o) => o.id));
    }
  };

  const handleBulkArchive = async () => {
    setIsBulkArchiving(true);
    let successCount = 0;
    const errors: string[] = [];
    const successfulIds: string[] = [];
    
    for (const opportunityId of selectedOpportunities) {
      try {
        await archiveDeal.mutateAsync({
          id: opportunityId,
          reason: 'Bulk Archive',
          notes: undefined
        });
        successCount++;
        successfulIds.push(opportunityId);
      } catch (error: any) {
        const opp = filteredOpportunities.find((o) => o.id === opportunityId);
        errors.push(opp?.name || opportunityId);
      }
    }
    
    setIsBulkArchiving(false);
    
    if (errors.length === 0) {
      toast.success(`${successCount} opportunities archived. You can find them in the Archived Deals section.`);
      setSelectedOpportunities([]);
      setShowBulkDeleteDialog(false);
    } else if (successCount > 0) {
      toast.warning(`${successCount} opportunities archived, ${errors.length} failed: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      setSelectedOpportunities(selectedOpportunities.filter(id => !successfulIds.includes(id)));
    } else {
      toast.error(`Failed to archive opportunities: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
    }
  };

  const handleBulkPermanentDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await bulkDeleteDeals.mutateAsync(selectedOpportunities);
      toast.success(`${selectedOpportunities.length} opportunities permanently deleted.`);
      setSelectedOpportunities([]);
      setShowBulkPermanentDeleteDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete opportunities");
    } finally {
      setIsBulkDeleting(false);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDetail: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Handle multiple files
    const fileArray = Array.from(files);
    let uploadedCount = 0;
    
    for (const file of fileArray) {
      const reader = new FileReader();
      
      reader.onload = () => {
        const attachment: OpportunityAttachment = {
          id: crypto.randomUUID(),
          filename: file.name,
          url: reader.result as string,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
        
        if (isDetail) {
          setOpportunityAttachments(prev => [...prev, attachment]);
        } else {
          setNewOpportunity(prev => ({
            ...prev,
            attachments: [...prev.attachments, attachment]
          }));
        }
        
        uploadedCount++;
        if (uploadedCount === fileArray.length) {
          toast.success(`${fileArray.length} file(s) attached`);
        }
      };
      
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };
  
  const removeAttachment = async (id: string, isDetail: boolean = false) => {
    if (isDetail) {
      const filteredAttachments = opportunityAttachments.filter(a => a.id !== id);
      setOpportunityAttachments(filteredAttachments);
      
      if (selectedOpportunity) {
        try {
          await updateDeal.mutateAsync({
            id: selectedOpportunity.id,
            attachments: filteredAttachments,
          } as any);
          toast.success("Attachment removed");
        } catch (error) {
          console.error("Failed to persist attachment removal:", error);
          toast.error("Failed to save changes");
        }
      }
    } else {
      setNewOpportunity(prev => ({
        ...prev,
        attachments: prev.attachments.filter(a => a.id !== id)
      }));
    }
  };
  
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const note: OpportunityNote = {
      id: crypto.randomUUID(),
      content: newNote,
      author: currentUser?.name || 'Unknown',
      createdAt: new Date().toISOString(),
    };
    
    setOpportunityNotes(prev => [note, ...prev]);
    setNewNote("");
    toast.success("Note added");
  };
  
  const handleCreateOpportunity = async () => {
    if (!newOpportunity.name || !newOpportunity.client) {
      toast.error("Please fill in required fields");
      return;
    }
    try {
      // Determine final sector value
      const finalSector = newOpportunity.sector === 'Other' && newOpportunity.customSector ? newOpportunity.customSector : newOpportunity.sector;
      
      // Save custom sector if it's a new one
      const isCustomSector = newOpportunity.sector === 'Other' && newOpportunity.customSector;
      const existingCustomSectorNames = customSectors.map((s: any) => s.name.toLowerCase());
      const isNewCustomSector = isCustomSector && !existingCustomSectorNames.includes(newOpportunity.customSector.toLowerCase()) && !BASE_SECTORS.includes(newOpportunity.customSector);
      
      if (isNewCustomSector) {
        try {
          await createCustomSector.mutateAsync(newOpportunity.customSector);
        } catch (e) {
          console.log("Custom sector may already exist:", e);
        }
      }
      
      await createDeal.mutateAsync({
        ...newOpportunity,
        sector: finalSector,
        value: parseFloat(newOpportunity.value) || 0,
        dealType: 'Opportunity',
        stage: 'Origination',
        status: 'Active',
        progress: 0,
        podTeam: [],
      } as any);
      toast.success("Opportunity created");
      setShowNewOpportunityDialog(false);
      setNewOpportunity({ 
        name: "", client: "", sector: "Technology", customSector: "", value: "", 
        description: "", lead: "", notes: "", attachments: [] 
      });
    } catch (error: any) {
      console.error("Failed to create opportunity:", error);
      const errorMessage = error?.message || "Failed to create opportunity. Please check all required fields.";
      toast.error(errorMessage);
    }
  };
  
  const handleApprove = async () => {
    if (!selectedOpportunity) return;
    try {
      if (approvalDivision === 'Investment Banking') {
        if (skipPodFormation) {
          toast.loading("Approving opportunity...", { id: "approve-opportunity" });
        } else {
          toast.loading("Approving opportunity and forming pod team...", { id: "approve-opportunity" });
        }
        await approveOpportunity.mutateAsync({ opportunityId: selectedOpportunity.id, skipPodFormation });
        if (skipPodFormation) {
          toast.success("Opportunity approved! You can manually assign team members.", { id: "approve-opportunity" });
        } else {
          toast.success("Opportunity approved! Pod team formed and tasks created.", { id: "approve-opportunity" });
        }
      } else {
        await updateDeal.mutateAsync({
          id: selectedOpportunity.id,
          dealType: 'Asset Management',
          status: 'Active',
        } as any);
        toast.success("Opportunity approved and moved to Asset Management");
      }
      
      setShowApproveDialog(false);
      setShowOpportunityDetail(false);
      setSelectedOpportunity(null);
      setSkipPodFormation(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve opportunity", { id: "approve-opportunity" });
    }
  };
  
  const handleReject = async () => {
    if (!selectedOpportunity) return;
    try {
      await archiveDeal.mutateAsync({
        id: selectedOpportunity.id,
        reason: rejectReason || 'Opportunity Rejected',
        notes: rejectNotes || undefined
      });
      toast.success("Opportunity rejected and archived. You can find it in the Archived Deals section and restore it if needed.");
      setShowRejectDialog(false);
      setShowOpportunityDetail(false);
      setSelectedOpportunity(null);
      setRejectReason('');
      setRejectNotes('');
    } catch (error: any) {
      toast.error(error.message || "Failed to reject opportunity");
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
      toast.success("Opportunity archived successfully! You can find it in the Archived Deals section.");
      if (selectedOpportunity?.id === dealToArchive) {
        setSelectedOpportunity(null);
        setShowOpportunityDetail(false);
      }
      setShowArchiveDialog(false);
      setDealToArchive(null);
      setArchiveReason('');
      setArchiveNotes('');
    } catch (error: any) {
      toast.error(error.message || "Failed to archive opportunity");
    }
  };

  // Committee review functions
  const fetchCommitteeReview = async (dealId: string) => {
    setLoadingCommitteeReview(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/committee-review`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCommitteeReview(data.review);
      }
    } catch (error) {
      console.error("Failed to fetch committee review:", error);
    } finally {
      setLoadingCommitteeReview(false);
    }
  };

  const handleCreateCommitteeReview = async () => {
    if (!selectedOpportunity || selectedCommitteeMembers.length === 0) {
      toast.error("Please select at least one committee member");
      return;
    }
    setIsCreatingCommittee(true);
    try {
      const res = await fetch(`/api/deals/${selectedOpportunity.id}/committee-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          memberIds: selectedCommitteeMembers,
          deadline: committeeDeadline || null,
          meetingDate: committeeMeetingDate || null,
          meetingLink: committeeMeetingLink || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create committee review");
      }
      toast.success("Committee review initiated! Members have been notified.");
      setShowCommitteeDialog(false);
      resetCommitteeForm();
      fetchCommitteeReview(selectedOpportunity.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create committee review");
    } finally {
      setIsCreatingCommittee(false);
    }
  };

  const handleVote = async (vote: 'approve' | 'reject' | 'abstain') => {
    if (!committeeReview) return;
    setIsVoting(true);
    try {
      const res = await fetch(`/api/committee-reviews/${committeeReview.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vote }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cast vote");
      }
      toast.success(`Your vote "${vote}" has been recorded!`);
      if (selectedOpportunity) {
        fetchCommitteeReview(selectedOpportunity.id);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to cast vote");
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddComment = async () => {
    if (!committeeReview || !newCommitteeComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/committee-reviews/${committeeReview.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newCommitteeComment.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add comment");
      }
      toast.success("Comment added successfully!");
      setNewCommitteeComment('');
      if (selectedOpportunity) {
        fetchCommitteeReview(selectedOpportunity.id);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const resetCommitteeForm = () => {
    setSelectedCommitteeMembers([]);
    setCommitteeDeadline('');
    setCommitteeMeetingDate('');
    setCommitteeMeetingLink('');
  };

  const toggleCommitteeMember = (userId: string) => {
    setSelectedCommitteeMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  
  const openOpportunityDetail = async (opportunity: DealListing) => {
    setSelectedOpportunity(opportunity);
    setDetailTab('overview');
    setIsEditMode(false);
    setLoadingAttachments(true);
    setCommitteeReview(null);
    
    // Initialize with empty state while loading
    setOpportunityAttachments([]);
    setOpportunityNotes([]);
    
    // Fetch full deal data to get attachments (listing doesn't include full attachment data)
    try {
      const res = await fetch(`/api/deals/${opportunity.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const fullDeal = await res.json();
        setOpportunityAttachments(fullDeal.attachments || []);
      }
    } catch (error) {
      console.error("Failed to fetch opportunity attachments:", error);
      toast.error("Failed to load attachments");
    } finally {
      setLoadingAttachments(false);
    }
    
    // Fetch committee review if any
    fetchCommitteeReview(opportunity.id);
    
    // Initialize edit form with opportunity data
    setEditForm({
      name: opportunity.name,
      client: opportunity.client,
      sector: SECTORS.includes(opportunity.sector) ? opportunity.sector : 'Other',
      customSector: SECTORS.includes(opportunity.sector) ? '' : opportunity.sector,
      value: opportunity.value.toString(),
      description: opportunity.description || '',
      lead: opportunity.lead || '',
    });
    setShowOpportunityDetail(true);
  };
  
  const handleSaveEdit = async () => {
    if (!selectedOpportunity) return;
    if (!editForm.name || !editForm.client) {
      toast.error("Name and client are required");
      return;
    }
    try {
      const finalSector = editForm.sector === 'Other' && editForm.customSector 
        ? editForm.customSector 
        : editForm.sector;
      
      // Save custom sector if new
      if (editForm.sector === 'Other' && editForm.customSector) {
        const existingNames = customSectors.map((s: any) => s.name.toLowerCase());
        if (!existingNames.includes(editForm.customSector.toLowerCase()) && !BASE_SECTORS.includes(editForm.customSector)) {
          try {
            await createCustomSector.mutateAsync(editForm.customSector);
          } catch (e) {
            console.log("Custom sector may already exist:", e);
          }
        }
      }
      
      await updateDeal.mutateAsync({
        id: selectedOpportunity.id,
        name: editForm.name,
        client: editForm.client,
        sector: finalSector,
        value: parseFloat(editForm.value) || 0,
        description: editForm.description,
        lead: editForm.lead,
      } as any);
      
      // Update the selectedOpportunity with the new values so the UI reflects changes immediately
      setSelectedOpportunity({
        ...selectedOpportunity,
        name: editForm.name,
        client: editForm.client,
        sector: finalSector,
        value: parseFloat(editForm.value) || 0,
        description: editForm.description,
        lead: editForm.lead,
      });
      
      toast.success("Opportunity updated");
      setIsEditMode(false);
    } catch (error) {
      toast.error("Failed to update opportunity");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout role={role} pageTitle="Potential Opportunities">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Opportunities</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-sm text-muted-foreground">Potential Value</p>
                  <p className="text-2xl font-bold">${stats.totalValue}M</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Bulk Actions Bar */}
        {selectedOpportunities.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg mb-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedOpportunities.length === filteredOpportunities.length}
                onCheckedChange={selectAllOpportunities}
                data-testid="checkbox-select-all-opportunities"
              />
              <span className="text-sm font-medium">{selectedOpportunities.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10" onClick={() => setShowBulkDeleteDialog(true)} data-testid="button-bulk-archive-opportunities">
                <Archive className="w-4 h-4 mr-1" /> Archive Selected
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkPermanentDeleteDialog(true)} data-testid="button-bulk-delete-opportunities">
                <Trash2 className="w-4 h-4 mr-1" /> Delete Permanently
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedOpportunities([])} data-testid="button-clear-selection">
                Clear Selection
              </Button>
            </div>
          </div>
        )}
        
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary/50"
              data-testid="input-opportunities-search"
            />
          </div>
          <Button onClick={() => setShowNewOpportunityDialog(true)} data-testid="button-new-opportunity">
            <Plus className="w-4 h-4 mr-2" />
            New Opportunity
          </Button>
        </div>
        
        {/* Opportunities Grid */}
        {filteredOpportunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.map((opportunity) => (
              <Card 
                key={opportunity.id} 
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => openOpportunityDetail(opportunity)}
                data-testid={`card-opportunity-${opportunity.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedOpportunities.includes(opportunity.id)}
                        onCheckedChange={() => toggleOpportunitySelection(opportunity.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                        data-testid={`checkbox-opportunity-${opportunity.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{opportunity.name}</CardTitle>
                        <CardDescription className="truncate">{opportunity.client}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 shrink-0">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Value</span>
                      <span className="font-semibold text-primary">${opportunity.value}M</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sector</span>
                      <Badge variant="secondary" className="text-xs">{opportunity.sector}</Badge>
                    </div>
                    {opportunity.lead && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Lead</span>
                        <span className="font-medium">{opportunity.lead}</span>
                      </div>
                    )}
                    {(opportunity.attachmentCount > 0) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        {opportunity.attachmentCount} attachment(s)
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <Button size="sm" variant="outline" className="w-full"
                        onClick={(e) => { e.stopPropagation(); openOpportunityDetail(opportunity); }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Opportunities Yet</h3>
              <p className="text-muted-foreground mb-4">Add new potential deals for review and approval</p>
              <Button onClick={() => setShowNewOpportunityDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Opportunity
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* New Opportunity Dialog - Enhanced */}
      <Dialog open={showNewOpportunityDialog} onOpenChange={setShowNewOpportunityDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Opportunity</DialogTitle>
            <DialogDescription>Add a potential deal for review and approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deal Name *</Label>
                <Input
                  value={newOpportunity.name}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, name: e.target.value })}
                  placeholder="e.g., Acme Corp Acquisition"
                  data-testid="input-opportunity-name"
                />
              </div>
              <div>
                <Label>Client/Company *</Label>
                <Input
                  value={newOpportunity.client}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, client: e.target.value })}
                  placeholder="Company name"
                  data-testid="input-opportunity-client"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Sector</Label>
                <Popover open={sectorOpen} onOpenChange={setSectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={sectorOpen} className="w-full justify-between" data-testid="select-opportunity-sector">
                      {newOpportunity.sector === 'Other' && newOpportunity.customSector ? newOpportunity.customSector : newOpportunity.sector}
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
                              value={newOpportunity.customSector}
                              onChange={(e) => setNewOpportunity({ ...newOpportunity, customSector: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newOpportunity.customSector) {
                                  setNewOpportunity({ ...newOpportunity, sector: 'Other' });
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
                                setNewOpportunity({ ...newOpportunity, sector, customSector: sector === 'Other' ? newOpportunity.customSector : '' });
                                setSectorOpen(false);
                              }}
                            >
                              <CheckIcon className={cn("mr-2 h-4 w-4", newOpportunity.sector === sector ? "opacity-100" : "opacity-0")} />
                              {sector}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {newOpportunity.sector === 'Other' && (
                  <Input 
                    placeholder="Enter custom sector name"
                    value={newOpportunity.customSector}
                    onChange={(e) => setNewOpportunity({ ...newOpportunity, customSector: e.target.value })}
                    className="mt-2"
                    data-testid="input-custom-sector"
                  />
                )}
              </div>
              <div>
                <Label>Est. Value ($M)</Label>
                <Input
                  type="number"
                  value={newOpportunity.value}
                  placeholder="0"
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, value: e.target.value })}
                  data-testid="input-opportunity-value"
                />
              </div>
              <div>
                <Label>Lead Contact</Label>
                <Input
                  value={newOpportunity.lead}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, lead: e.target.value })}
                  placeholder="Who brought this in?"
                  data-testid="input-opportunity-lead"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newOpportunity.description}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, description: e.target.value })}
                placeholder="Brief description of the opportunity, including key details, strategic rationale, and potential value drivers..."
                rows={4}
                data-testid="textarea-opportunity-description"
              />
            </div>
            <div>
              <Label>Initial Notes</Label>
              <Textarea
                value={newOpportunity.notes}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, notes: e.target.value })}
                placeholder="Any additional notes, context, or considerations..."
                rows={2}
              />
            </div>
            
            {/* File Attachments */}
            <div>
              <Label className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
              </Label>
              <div className="mt-2 space-y-3">
                <ObjectUploader
                  maxNumberOfFiles={100}
                  maxFileSize={500 * 1024 * 1024}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.mp4,.mov,.avi,.mp3,.wav,image/*,video/*,audio/*"
                  onComplete={(files: UploadedFile[]) => {
                    const newAttachments: OpportunityAttachment[] = files.map(f => ({
                      id: f.id,
                      filename: f.filename,
                      url: f.objectPath,
                      objectPath: f.objectPath,
                      size: f.size,
                      type: f.type,
                      uploadedAt: new Date().toISOString(),
                    }));
                    setNewOpportunity(prev => ({
                      ...prev,
                      attachments: [...prev.attachments, ...newAttachments]
                    }));
                  }}
                  buttonVariant="outline"
                  buttonSize="sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files (up to 500MB)
                </ObjectUploader>
                <p className="text-xs text-muted-foreground">
                  Supports documents, images, videos, and audio files
                </p>
                
                {newOpportunity.attachments.length > 0 && (
                  <div className="space-y-2">
                    {newOpportunity.attachments.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm truncate">{file.filename}</span>
                          <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeAttachment(file.id, false)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewOpportunityDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateOpportunity} disabled={createDeal.isPending} data-testid="button-create-opportunity">
              {createDeal.isPending ? "Creating..." : "Add Opportunity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Opportunity Detail Sheet - Enhanced with Tabs */}
      <Sheet open={showOpportunityDetail} onOpenChange={setShowOpportunityDetail}>
        <SheetContent className="bg-card border-border w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {selectedOpportunity?.name}
            </SheetTitle>
            <SheetDescription>{selectedOpportunity?.client}</SheetDescription>
          </SheetHeader>
          
          {selectedOpportunity && (
            <div className="mt-6 flex-1 overflow-y-auto pr-2">
              {/* Committee Review Banner - Prominent at top */}
              {committeeReview && (
                <div className={cn(
                  "mb-4 rounded-lg p-4 border-2",
                  committeeReview.status === 'approved' && "bg-green-500/10 border-green-500/50",
                  committeeReview.status === 'rejected' && "bg-red-500/10 border-red-500/50",
                  committeeReview.status === 'pending' && "bg-blue-500/10 border-blue-500/50"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        committeeReview.status === 'approved' && "bg-green-500/20",
                        committeeReview.status === 'rejected' && "bg-red-500/20",
                        committeeReview.status === 'pending' && "bg-blue-500/20"
                      )}>
                        {committeeReview.status === 'approved' && <ThumbsUp className="w-5 h-5 text-green-500" />}
                        {committeeReview.status === 'rejected' && <ThumbsDown className="w-5 h-5 text-red-500" />}
                        {committeeReview.status === 'pending' && <Vote className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div>
                        <h3 className={cn(
                          "font-semibold text-lg",
                          committeeReview.status === 'approved' && "text-green-500",
                          committeeReview.status === 'rejected' && "text-red-500",
                          committeeReview.status === 'pending' && "text-blue-500"
                        )}>
                          {committeeReview.status === 'approved' && "Committee Approved"}
                          {committeeReview.status === 'rejected' && "Committee Rejected"}
                          {committeeReview.status === 'pending' && "Committee Review In Progress"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {committeeReview.voteSummary 
                            ? (committeeReview.voteSummary.pending === 0 
                                ? `All ${committeeReview.voteSummary.total} members voted`
                                : `${(committeeReview.voteSummary.total || 0) - (committeeReview.voteSummary.pending || 0)} of ${committeeReview.voteSummary.total || 0} members voted`)
                            : 'Loading vote summary...'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-500">
                        <ThumbsUp className="w-4 h-4" /> {committeeReview.voteSummary?.approved || 0}
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <ThumbsDown className="w-4 h-4" /> {committeeReview.voteSummary?.rejected || 0}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Minus className="w-4 h-4" /> {committeeReview.voteSummary?.abstained || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Show user's vote status if they are a member */}
                  {currentUser && (() => {
                    const userMember = committeeReview.members?.find((m: any) => String(m.userId) === String(currentUser.id));
                    if (!userMember) return null;
                    
                    return (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        {userMember.vote ? (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Your vote: </span>
                            <span className={cn(
                              "font-medium",
                              userMember.vote === 'approve' && "text-green-500",
                              userMember.vote === 'reject' && "text-red-500",
                              userMember.vote === 'abstain' && "text-muted-foreground"
                            )}>
                              {userMember.vote.charAt(0).toUpperCase() + userMember.vote.slice(1)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-amber-500 font-medium">
                            Your vote is pending - scroll down to cast your vote
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="team">
                    Team
                    {((selectedOpportunity as any)?.podTeam?.length > 0) && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{(selectedOpportunity as any).podTeam.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="attachments">
                    Attach.
                    {validAttachments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{validAttachments.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    Notes
                    {opportunityNotes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{opportunityNotes.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <ScrollArea className="h-auto max-h-[400px] mt-4">
                  <TabsContent value="overview" className="space-y-4 pr-4 mt-0">
                    {isEditMode ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Opportunity Name *</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Enter opportunity name"
                            data-testid="input-edit-opportunity-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Client *</Label>
                          <Input
                            value={editForm.client}
                            onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                            placeholder="Enter client name"
                            data-testid="input-edit-client"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sector</Label>
                          <Popover open={editSectorOpen} onOpenChange={setEditSectorOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={editSectorOpen}
                                className="w-full justify-between"
                                data-testid="select-edit-sector"
                              >
                                {editForm.sector === 'Other' && editForm.customSector 
                                  ? editForm.customSector 
                                  : editForm.sector || "Select sector..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search or add sector..." />
                                <CommandList>
                                  <CommandEmpty>
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start"
                                      onClick={() => {
                                        const searchValue = (document.querySelector('[cmdk-input]') as HTMLInputElement)?.value || '';
                                        if (searchValue) {
                                          setEditForm({ ...editForm, sector: 'Other', customSector: searchValue });
                                          setEditSectorOpen(false);
                                        }
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add new sector
                                    </Button>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {SECTORS.map((sector) => (
                                      <CommandItem
                                        key={sector}
                                        value={sector}
                                        onSelect={(value) => {
                                          setEditForm({ ...editForm, sector: value, customSector: '' });
                                          setEditSectorOpen(false);
                                        }}
                                      >
                                        <CheckIcon
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            editForm.sector === sector ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {sector}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {editForm.sector === 'Other' && (
                            <Input
                              value={editForm.customSector}
                              onChange={(e) => setEditForm({ ...editForm, customSector: e.target.value })}
                              placeholder="Enter custom sector"
                              className="mt-2"
                              data-testid="input-edit-custom-sector"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Estimated Value ($M)</Label>
                          <Input
                            type="number"
                            value={editForm.value}
                            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                            placeholder="0"
                            data-testid="input-edit-value"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lead Contact</Label>
                          <Input
                            value={editForm.lead}
                            onChange={(e) => setEditForm({ ...editForm, lead: e.target.value })}
                            placeholder="Enter lead contact name"
                            data-testid="input-edit-lead"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Enter opportunity details..."
                            rows={4}
                            data-testid="textarea-edit-description"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setIsEditMode(false)}
                            data-testid="button-cancel-edit"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={handleSaveEdit}
                            disabled={updateDeal.isPending}
                            data-testid="button-save-edit"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {updateDeal.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-xs text-muted-foreground">Estimated Value</p>
                            <p className="text-lg font-bold text-primary">${selectedOpportunity.value}M</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-xs text-muted-foreground">Sector</p>
                            <p className="font-medium">{selectedOpportunity.sector}</p>
                          </div>
                        </div>
                        
                        {selectedOpportunity.lead && (
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-xs text-muted-foreground">Lead Contact</p>
                            <p className="font-medium">{selectedOpportunity.lead}</p>
                          </div>
                        )}
                        
                        {selectedOpportunity.description && (
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-xs text-muted-foreground mb-1">Description</p>
                            <p className="text-sm whitespace-pre-wrap">{selectedOpportunity.description}</p>
                          </div>
                        )}
                        
                        <div className="p-3 rounded-lg bg-secondary/30">
                          <p className="text-xs text-muted-foreground mb-1">Stage</p>
                          <Badge>{selectedOpportunity.stage}</Badge>
                        </div>
                        
                        {(selectedOpportunity as any).createdAt && (
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-xs text-muted-foreground">Created</p>
                            <p className="text-sm">{format(new Date((selectedOpportunity as any).createdAt), 'PPp')}</p>
                          </div>
                        )}
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsEditMode(true)}
                          data-testid="button-edit-opportunity"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Opportunity
                        </Button>
                      </>
                    )}
                  </TabsContent>
                  
                  {/* Team Tagging Tab */}
                  <TabsContent value="team" className="space-y-4 pr-4 mt-0">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search team members..."
                        value={teamSearchQuery}
                        onChange={(e) => {
                          setTeamSearchQuery(e.target.value);
                          setShowTeamDropdown(true);
                        }}
                        onFocus={() => setShowTeamDropdown(true)}
                        className="pl-9"
                        data-testid="input-search-team-members"
                      />
                      {showTeamDropdown && teamSearchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                          {users
                            .filter(user => {
                              const searchLower = teamSearchQuery.toLowerCase();
                              const alreadyTagged = ((selectedOpportunity as any)?.podTeam || []).some(
                                (m: any) => m.userId === user.id
                              );
                              if (alreadyTagged) return false;
                              return (
                                user.name.toLowerCase().includes(searchLower) ||
                                (user.email?.toLowerCase() || '').includes(searchLower) ||
                                (user.role?.toLowerCase() || '').includes(searchLower) ||
                                (user.jobTitle?.toLowerCase() || '').includes(searchLower)
                              );
                            })
                            .slice(0, 8)
                            .map(user => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-3 hover:bg-secondary/50 cursor-pointer transition-colors"
                                onClick={async () => {
                                  if (!selectedOpportunity) return;
                                  try {
                                    await tagMember.mutateAsync({
                                      dealId: selectedOpportunity.id,
                                      memberId: user.id,
                                      memberName: user.name,
                                      memberRole: user.jobTitle || user.role || 'Team Member',
                                    });
                                    toast.success(`${user.name} tagged and notified`);
                                    setTeamSearchQuery("");
                                    setShowTeamDropdown(false);
                                  } catch (error: any) {
                                    toast.error(error.message || "Failed to tag team member");
                                  }
                                }}
                                data-testid={`tag-member-${user.id}`}
                              >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                  {(user.name || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{user.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{user.jobTitle || user.role}</div>
                                </div>
                                <Badge variant="secondary" className="text-xs shrink-0">{user.jobTitle || user.role}</Badge>
                              </div>
                            ))}
                          {users.filter(user => {
                            const searchLower = teamSearchQuery.toLowerCase();
                            const alreadyTagged = ((selectedOpportunity as any)?.podTeam || []).some(
                              (m: any) => m.userId === user.id
                            );
                            return !alreadyTagged && (
                              user.name.toLowerCase().includes(searchLower) ||
                              (user.email?.toLowerCase() || '').includes(searchLower)
                            );
                          }).length === 0 && (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                              No matching team members found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Tagged Members List */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Tagged Team Members</p>
                      {((selectedOpportunity as any)?.podTeam && (selectedOpportunity as any).podTeam.length > 0) ? (
                        <div className="space-y-2">
                          {((selectedOpportunity as any).podTeam as PodTeamMember[]).map((member, index) => (
                            <div key={member.userId || index} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                  {(member.name || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">{member.jobTitle || member.role}</p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={async () => {
                                  if (!selectedOpportunity || !member.userId) return;
                                  try {
                                    await removeMember.mutateAsync({
                                      dealId: selectedOpportunity.id,
                                      memberId: member.userId,
                                    });
                                    toast.success(`${member.name} removed from opportunity`);
                                  } catch (error: any) {
                                    toast.error(error.message || "Failed to remove team member");
                                  }
                                }}
                                data-testid={`remove-member-${member.userId}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No team members tagged yet</p>
                          <p className="text-xs mt-1">Search above to add team members</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="attachments" className="space-y-4 pr-4 mt-0">
                    <ObjectUploader
                      maxNumberOfFiles={100}
                      maxFileSize={500 * 1024 * 1024}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.mp4,.mov,.avi,.mp3,.wav,image/*,video/*,audio/*"
                      onComplete={async (files: UploadedFile[]) => {
                        if (!selectedOpportunity) return;
                        const newAttachments: DealAttachment[] = files.map(f => ({
                          id: f.id,
                          filename: f.filename,
                          url: f.objectPath,
                          objectPath: f.objectPath,
                          size: f.size,
                          type: f.type,
                          relativePath: f.relativePath,
                          uploadedAt: new Date().toISOString(),
                        }));
                        
                        try {
                          // Use atomic server-side append endpoint to prevent race conditions
                          const res = await fetch(`/api/deals/${selectedOpportunity.id}/attachments`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ attachments: newAttachments }),
                          });
                          
                          if (!res.ok) throw new Error("Failed to save attachments");
                          
                          // Get the authoritative attachment list from server response
                          const updatedDeal = await res.json();
                          setOpportunityAttachments(updatedDeal.attachments || []);
                          
                          // Invalidate React Query cache so other components see the update
                          await queryClient.invalidateQueries({ queryKey: ["deals"] });
                          await queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
                          await queryClient.invalidateQueries({ queryKey: ["deals", selectedOpportunity.id] });
                          
                          toast.success(`${files.length} file(s) uploaded and saved`);
                        } catch (error) {
                          console.error("Failed to persist attachments:", error);
                          toast.error("Files uploaded but failed to save. Please try again.");
                          // Refetch to sync with server state
                          try {
                            const syncRes = await fetch(`/api/deals/${selectedOpportunity.id}`, { credentials: 'include' });
                            if (syncRes.ok) {
                              const deal = await syncRes.json();
                              setOpportunityAttachments(deal.attachments || []);
                            }
                          } catch (e) {
                            console.error("Failed to refresh attachments:", e);
                          }
                        }
                      }}
                      buttonVariant="outline"
                      buttonSize="default"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Attachments
                    </ObjectUploader>
                    
                    {validAttachments.length > 0 ? (
                      <div className="space-y-2">
                        {validAttachments.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{file.filename}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)} • {format(new Date(file.uploadedAt), 'PP')}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => import('@/lib/utils').then(m => m.openUrlInNewTab(file.objectPath || file.url))}
                                title="View"
                                data-testid={`view-attachment-${file.id}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = file.objectPath || file.url;
                                  link.download = file.filename;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                title="Download"
                                data-testid={`download-attachment-${file.id}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                onClick={() => removeAttachment(file.id, true)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : loadingAttachments ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                        <p className="text-sm">Loading attachments...</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No attachments yet</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="notes" className="space-y-4 pr-4 mt-0">
                    {selectedOpportunity && (
                      <DealNotesSection dealId={selectedOpportunity.id} allUsers={users} />
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
              
              {/* Committee Review Status */}
              {loadingCommitteeReview && (
                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading committee review...</span>
                  </div>
                </div>
              )}
              {!loadingCommitteeReview && committeeReview && (
                <div className="pt-4 border-t border-border space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <UsersRound className="w-4 h-4" />
                      Committee Review
                    </h4>
                    <Badge variant={
                      committeeReview.status === 'pending' ? 'secondary' :
                      committeeReview.status === 'approved' ? 'default' : 'destructive'
                    }>
                      {committeeReview.status === 'pending' ? 'In Progress' : committeeReview.status}
                    </Badge>
                  </div>
                  
                  {/* Vote Summary */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Votes: {committeeReview.voteSummary?.total - committeeReview.voteSummary?.pending} / {committeeReview.voteSummary?.total}</span>
                      {committeeReview.voteSummary?.majorityReached && (
                        <Badge variant={committeeReview.voteSummary.majorityDecision === 'approve' ? 'default' : 'destructive'}>
                          Majority: {committeeReview.voteSummary.majorityDecision}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-500 flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" /> {committeeReview.voteSummary?.approved || 0}
                      </span>
                      <span className="text-red-500 flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3" /> {committeeReview.voteSummary?.rejected || 0}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Minus className="w-3 h-3" /> {committeeReview.voteSummary?.abstained || 0}
                      </span>
                    </div>
                  </div>

                  {/* Committee Members */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Members:</p>
                    <div className="flex flex-wrap gap-2">
                      {committeeReview.members?.map((member: any) => (
                        <Badge 
                          key={member.id} 
                          variant="outline"
                          className={cn(
                            member.vote === 'approve' && 'border-green-500 text-green-500',
                            member.vote === 'reject' && 'border-red-500 text-red-500',
                            member.vote === 'abstain' && 'border-muted-foreground',
                            !member.vote && 'border-muted'
                          )}
                        >
                          {member.user?.name || 'Unknown'}{member.vote ? ` (${member.vote})` : ' (pending)'}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Cast Vote - show only if current user is a member who hasn't voted */}
                  {currentUser && (() => {
                    const userMember = committeeReview.members?.find((m: any) => String(m.userId) === String(currentUser.id));
                    const hasVoted = userMember?.vote;
                    const isMember = !!userMember;
                    
                    if (!isMember) return null;
                    
                    if (hasVoted) {
                      // Show confirmation of their vote
                      return (
                        <div className="space-y-2 pt-2">
                          <div className={cn(
                            "rounded-lg p-3 text-sm flex items-center gap-2",
                            userMember.vote === 'approve' && "bg-green-500/10 border border-green-500/30 text-green-500",
                            userMember.vote === 'reject' && "bg-red-500/10 border border-red-500/30 text-red-500",
                            userMember.vote === 'abstain' && "bg-muted border border-border text-muted-foreground"
                          )}>
                            {userMember.vote === 'approve' && <ThumbsUp className="w-4 h-4" />}
                            {userMember.vote === 'reject' && <ThumbsDown className="w-4 h-4" />}
                            {userMember.vote === 'abstain' && <Minus className="w-4 h-4" />}
                            <span className="font-medium">
                              You voted: {userMember.vote.charAt(0).toUpperCase() + userMember.vote.slice(1)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
                    // Show vote buttons
                    return (
                      <div className="space-y-2 pt-2">
                        <p className="text-sm font-medium">Cast Your Vote:</p>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleVote('approve')} disabled={isVoting}>
                            {isVoting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-1" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleVote('reject')} disabled={isVoting}>
                            {isVoting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ThumbsDown className="w-4 h-4 mr-1" />}
                            Reject
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleVote('abstain')} disabled={isVoting}>
                            {isVoting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Minus className="w-4 h-4 mr-1" />}
                            Abstain
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Overall Result - shown when voting is complete */}
                  {committeeReview.voteSummary?.pending === 0 && committeeReview.voteSummary?.total > 0 && (
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      committeeReview.voteSummary?.majorityDecision === 'approve' && "bg-green-500/20 border border-green-500/50",
                      committeeReview.voteSummary?.majorityDecision === 'reject' && "bg-red-500/20 border border-red-500/50",
                      !committeeReview.voteSummary?.majorityReached && "bg-amber-500/20 border border-amber-500/50"
                    )}>
                      <p className="font-medium text-sm">
                        {committeeReview.voteSummary?.majorityReached 
                          ? `Committee Decision: ${committeeReview.voteSummary.majorityDecision?.charAt(0).toUpperCase()}${committeeReview.voteSummary.majorityDecision?.slice(1)}`
                          : 'No Majority Reached'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        All {committeeReview.voteSummary?.total} members have voted
                      </p>
                    </div>
                  )}

                  {/* Comments Section - always show */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">Discussion ({committeeReview.comments?.length || 0} comments):</p>
                    {committeeReview.comments?.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto bg-muted/20 rounded-lg p-2">
                        {committeeReview.comments.map((comment: any) => (
                          <div key={comment.id} className="bg-background rounded p-2 text-xs border border-border/50">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-foreground">{comment.user?.name || 'Unknown'}</span>
                              {comment.createdAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-muted-foreground">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic py-2">No comments yet. Be the first to start the discussion.</p>
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add a comment..." 
                      value={newCommitteeComment}
                      onChange={(e) => setNewCommitteeComment(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && newCommitteeComment.trim()) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleAddComment} disabled={isSubmittingComment || !newCommitteeComment.trim()}>
                      {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="pt-4 border-t border-border space-y-3 mt-4">
                <h4 className="font-medium text-sm">Take Action</h4>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 min-w-[120px] border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                    onClick={() => setShowCommitteeDialog(true)}
                    disabled={!!committeeReview}
                    data-testid="button-detail-committee"
                  >
                    <UsersRound className="w-4 h-4 mr-2" />
                    {committeeReview ? 'Review Active' : 'Deal Committee'}
                  </Button>
                  <Button className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700" 
                    onClick={() => setShowApproveDialog(true)}
                    data-testid="button-detail-approve"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 min-w-[100px] border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => {
                      if (selectedOpportunity) {
                        setDealToArchive(selectedOpportunity.id);
                        setShowArchiveDialog(true);
                      }
                    }}
                    data-testid="button-detail-archive"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </Button>
                  <Button variant="destructive" className="flex-1 min-w-[100px]"
                    onClick={() => setShowRejectDialog(true)}
                    data-testid="button-detail-reject"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      
      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which division this deal should be assigned to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Assign to Division</Label>
              <Select value={approvalDivision} onValueChange={setApprovalDivision}>
                <SelectTrigger className="mt-2" data-testid="select-approval-division">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {approvalDivision === 'Investment Banking' 
                  ? 'Deal will appear in Deal Management page' 
                  : 'Deal will appear in Asset Management page'}
              </p>
            </div>
            
            {approvalDivision === 'Investment Banking' && (
              <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Skip Automatic Team Assignment</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, no pod team will be auto-assigned. You can manually assign team members later.
                  </p>
                </div>
                <Switch
                  checked={skipPodFormation}
                  onCheckedChange={setSkipPodFormation}
                  data-testid="switch-skip-pod-formation-approval"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-approve">
              Approve & Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reject Dialog - Archives instead of permanently deleting */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open);
        if (!open) {
          setRejectReason('');
          setRejectNotes('');
        }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Reject & Archive Opportunity
            </DialogTitle>
            <DialogDescription>
              This opportunity will be archived with all its documents and data preserved. You can restore it from the Archived Deals section at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger data-testid="select-reject-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Opportunity Rejected">Opportunity Rejected</SelectItem>
                  <SelectItem value="Client Declined">Client Declined</SelectItem>
                  <SelectItem value="Not a Fit">Not a Fit</SelectItem>
                  <SelectItem value="Market Conditions">Market Conditions</SelectItem>
                  <SelectItem value="Insufficient Information">Insufficient Information</SelectItem>
                  <SelectItem value="Duplicate Entry">Duplicate Entry</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about why this opportunity is being rejected..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
                data-testid="textarea-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={archiveDeal.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={archiveDeal.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-reject"
            >
              {archiveDeal.isPending ? "Rejecting..." : "Reject & Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Archive Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Archive {selectedOpportunities.length} Opportunities
            </AlertDialogTitle>
            <AlertDialogDescription>
              These opportunities will be archived with all their documents and data preserved. You can restore them from the Archived Deals section at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkArchive} 
              disabled={isBulkArchiving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isBulkArchiving ? "Archiving..." : "Archive All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Permanent Delete Dialog */}
      <AlertDialog open={showBulkPermanentDeleteDialog} onOpenChange={setShowBulkPermanentDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Permanently Delete {selectedOpportunities.length} Opportunities
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action <strong>cannot be undone</strong>. These opportunities and all their associated data will be permanently removed.</p>
              <p className="text-amber-500">If you want to keep the data for future reference, use "Archive Selected" instead.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkPermanentDelete} 
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : "Delete Permanently"}
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
              Archive Opportunity
            </DialogTitle>
            <DialogDescription>
              Archived opportunities are preserved with all their documents and data for future reference. You can restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Archiving</Label>
              <Select value={archiveReason} onValueChange={setArchiveReason}>
                <SelectTrigger data-testid="select-archive-reason">
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
                placeholder="Add any notes about why this opportunity is being archived, lessons learned, or future reference information..."
                value={archiveNotes}
                onChange={(e) => setArchiveNotes(e.target.value)}
                rows={4}
                data-testid="textarea-archive-notes"
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
              data-testid="button-confirm-archive"
            >
              {archiveDeal.isPending ? "Archiving..." : "Archive Opportunity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Committee Review Dialog */}
      <Dialog open={showCommitteeDialog} onOpenChange={(open) => {
        setShowCommitteeDialog(open);
        if (!open) {
          resetCommitteeForm();
        }
      }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-blue-500" />
              Create Deal Committee Review
            </DialogTitle>
            <DialogDescription>
              Select committee members to review this opportunity. They will vote and the decision will be based on majority.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Committee Members Selection */}
            <div className="space-y-2">
              <Label>Select Committee Members *</Label>
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                {users.filter(u => u.accessLevel === 'admin' || u.role === 'CEO').map((user) => (
                  <div 
                    key={user.id} 
                    className={cn(
                      "flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0",
                      selectedCommitteeMembers.includes(user.id) && "bg-blue-500/10"
                    )}
                    onClick={() => toggleCommitteeMember(user.id)}
                  >
                    <Checkbox 
                      checked={selectedCommitteeMembers.includes(user.id)}
                      onCheckedChange={() => toggleCommitteeMember(user.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.jobTitle || user.role}</p>
                    </div>
                  </div>
                ))}
                {users.filter(u => u.accessLevel !== 'admin' && u.role !== 'CEO').slice(0, 10).map((user) => (
                  <div 
                    key={user.id} 
                    className={cn(
                      "flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0",
                      selectedCommitteeMembers.includes(user.id) && "bg-blue-500/10"
                    )}
                    onClick={() => toggleCommitteeMember(user.id)}
                  >
                    <Checkbox 
                      checked={selectedCommitteeMembers.includes(user.id)}
                      onCheckedChange={() => toggleCommitteeMember(user.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.jobTitle || user.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedCommitteeMembers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCommitteeMembers.length} member(s) selected - majority: {Math.floor(selectedCommitteeMembers.length / 2) + 1} votes needed
                </p>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label>Voting Deadline (Optional)</Label>
              <Input 
                type="datetime-local"
                value={committeeDeadline}
                onChange={(e) => setCommitteeDeadline(e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Meeting Date */}
            <div className="space-y-2">
              <Label>Committee Meeting Date (Optional)</Label>
              <Input 
                type="datetime-local"
                value={committeeMeetingDate}
                onChange={(e) => setCommitteeMeetingDate(e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Meeting Link */}
            <div className="space-y-2">
              <Label>Meeting Link (Optional)</Label>
              <Input 
                type="url"
                placeholder="https://meet.google.com/..."
                value={committeeMeetingLink}
                onChange={(e) => setCommitteeMeetingLink(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitteeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCommitteeReview}
              disabled={isCreatingCommittee || selectedCommitteeMembers.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-committee"
            >
              {isCreatingCommittee ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UsersRound className="w-4 h-4 mr-2" />
                  Create Committee Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
