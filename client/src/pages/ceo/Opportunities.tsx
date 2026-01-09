import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
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
  Pencil, Save, MessageSquare, Archive
} from "lucide-react";
import { 
  useCurrentUser, useDealsListing, useDeal, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers,
  useCustomSectors, useCreateCustomSector, useTagDealMember, useRemoveDealMember,
  useDealNotes, useCreateDealNote, useApproveOpportunity, useBulkDeleteDeals, useArchiveDeal, type DealNoteType
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember } from "@shared/schema";
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
  const [selectedOpportunity, setSelectedOpportunity] = useState<Deal | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
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
  
  // Archive dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [dealToArchive, setDealToArchive] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('');
  const [archiveNotes, setArchiveNotes] = useState<string>('');
  
  // Filter for Opportunity deals only (excluding archived)
  const opportunities = useMemo(() => {
    return deals.filter((deal: Deal) => {
      const isOpportunity = (deal as any).dealType === 'Opportunity';
      const isArchived = deal.status === 'Archived' || (deal as any).archivedAt;
      return isOpportunity && !isArchived;
    });
  }, [deals]);

  // Handle URL query parameter for selecting a specific opportunity
  useEffect(() => {
    if (searchString && opportunities.length > 0) {
      const params = new URLSearchParams(searchString);
      const opportunityId = params.get('id');
      if (opportunityId) {
        const opportunity = opportunities.find((d: Deal) => d.id === opportunityId);
        if (opportunity) {
          setSelectedOpportunity(opportunity);
          setShowOpportunityDetail(true);
        }
      }
    }
  }, [searchString, opportunities]);
  
  // Apply search filter
  const filteredOpportunities = useMemo(() => {
    if (!searchQuery) return opportunities;
    const query = searchQuery.toLowerCase();
    return opportunities.filter((deal: Deal) => 
      deal.name.toLowerCase().includes(query) ||
      deal.client.toLowerCase().includes(query) ||
      deal.sector.toLowerCase().includes(query)
    );
  }, [opportunities, searchQuery]);
  
  // Stats
  const stats = useMemo(() => {
    const totalValue = opportunities.reduce((sum, deal: Deal) => sum + deal.value, 0);
    const pending = opportunities.filter((d: Deal) => d.status === 'Active').length;
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
      setSelectedOpportunities(filteredOpportunities.map((o: Deal) => o.id));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteDeals.mutateAsync(selectedOpportunities);
      toast.success(`${selectedOpportunities.length} opportunities deleted`);
      setSelectedOpportunities([]);
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error("Failed to delete opportunities");
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
  
  const removeAttachment = (id: string, isDetail: boolean = false) => {
    if (isDetail) {
      setOpportunityAttachments(prev => prev.filter(a => a.id !== id));
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
    } catch (error) {
      toast.error("Failed to create opportunity");
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
      await deleteDeal.mutateAsync(selectedOpportunity.id);
      toast.success("Opportunity rejected and removed");
      setShowRejectDialog(false);
      setShowOpportunityDetail(false);
      setSelectedOpportunity(null);
    } catch (error) {
      toast.error("Failed to reject opportunity");
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
  
  const openOpportunityDetail = (opportunity: Deal) => {
    setSelectedOpportunity(opportunity);
    setDetailTab('overview');
    setIsEditMode(false);
    // Load any existing attachments/notes from the opportunity
    const opp = opportunity as any;
    setOpportunityAttachments(opp.attachments || []);
    setOpportunityNotes(opp.opportunityNotes || []);
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
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} data-testid="button-bulk-delete-opportunities">
                <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
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
            {filteredOpportunities.map((opportunity: Deal) => (
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
                    {((opportunity as any).attachments?.length > 0) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        {(opportunity as any).attachments.length} attachment(s)
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
                  maxNumberOfFiles={10}
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
        <SheetContent className="bg-card border-border w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {selectedOpportunity?.name}
            </SheetTitle>
            <SheetDescription>{selectedOpportunity?.client}</SheetDescription>
          </SheetHeader>
          
          {selectedOpportunity && (
            <div className="mt-6">
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
                    {opportunityAttachments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{opportunityAttachments.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    Notes
                    {opportunityNotes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{opportunityNotes.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <ScrollArea className="h-[calc(100vh-350px)] mt-4">
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
                                <Badge variant="secondary" className="text-xs shrink-0">{user.role}</Badge>
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
                    <input
                      ref={detailFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, true)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                    />
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => detailFileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Attachments
                    </Button>
                    
                    {opportunityAttachments.length > 0 ? (
                      <div className="space-y-2">
                        {opportunityAttachments.map((file) => (
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
                                onClick={() => import('@/lib/utils').then(m => m.openUrlInNewTab(file.url))}
                                title="View"
                                data-testid={`view-attachment-${file.id}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = file.url;
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
              
              {/* Action Buttons */}
              <div className="pt-4 border-t border-border space-y-3 mt-4">
                <h4 className="font-medium text-sm">Take Action</h4>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" 
                    onClick={() => setShowApproveDialog(true)}
                    data-testid="button-detail-approve"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Deal
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
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
                  <Button variant="destructive" className="flex-1"
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
      
      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reject Opportunity
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this opportunity? This action will remove it permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-reject">
              Reject & Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOpportunities.length} Opportunities</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOpportunities.length} opportunities? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Delete All
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
    </Layout>
  );
}
