import { useState, useMemo, useRef } from "react";
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
  Upload, FileText, Paperclip, StickyNote, X, Download, Trash2
} from "lucide-react";
import { 
  useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember } from "@shared/schema";

const DIVISIONS = ['Investment Banking', 'Asset Management'];
const SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Real Estate', 'Other'];

type OpportunityAttachment = {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
};

type OpportunityNote = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
};

export default function Opportunities() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [], isLoading } = useDeals();
  const { data: users = [] } = useUsers();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOpportunityDialog, setShowNewOpportunityDialog] = useState(false);
  const [showOpportunityDetail, setShowOpportunityDetail] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Deal | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalDivision, setApprovalDivision] = useState<string>('Investment Banking');
  const [detailTab, setDetailTab] = useState<'overview' | 'attachments' | 'notes'>('overview');
  const [newNote, setNewNote] = useState("");
  
  const [newOpportunity, setNewOpportunity] = useState({
    name: "",
    client: "",
    sector: "Technology",
    value: "" as string,
    description: "",
    lead: "",
    notes: "" as string,
    attachments: [] as OpportunityAttachment[],
  });
  
  // Local state for opportunity details (notes and attachments)
  const [opportunityNotes, setOpportunityNotes] = useState<OpportunityNote[]>([]);
  const [opportunityAttachments, setOpportunityAttachments] = useState<OpportunityAttachment[]>([]);
  
  // Filter for Opportunity deals only
  const opportunities = useMemo(() => {
    return deals.filter((deal: Deal) => (deal as any).dealType === 'Opportunity');
  }, [deals]);
  
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
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDetail: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
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
        toast.success(`File "${file.name}" attached`);
      } else {
        setNewOpportunity(prev => ({
          ...prev,
          attachments: [...prev.attachments, attachment]
        }));
        toast.success(`File "${file.name}" attached`);
      }
    };
    
    reader.readAsDataURL(file);
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
      await createDeal.mutateAsync({
        ...newOpportunity,
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
        name: "", client: "", sector: "Technology", value: "", 
        description: "", lead: "", notes: "", attachments: [] 
      });
    } catch (error) {
      toast.error("Failed to create opportunity");
    }
  };
  
  const handleApprove = async () => {
    if (!selectedOpportunity) return;
    try {
      // Map division to dealType for database storage
      // Investment Banking uses M&A as dealType, Asset Management stays as Asset Management
      const dealType = approvalDivision === 'Investment Banking' ? 'M&A' : 'Asset Management';
      
      await updateDeal.mutateAsync({
        id: selectedOpportunity.id,
        dealType: dealType,
        status: 'Active',
      } as any);
      
      const destinationPage = approvalDivision === 'Asset Management' ? 'Asset Management' : 'Deal Management';
      toast.success(`Opportunity approved and moved to ${destinationPage}`);
      setShowApproveDialog(false);
      setShowOpportunityDetail(false);
      setSelectedOpportunity(null);
    } catch (error) {
      toast.error("Failed to approve opportunity");
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
  
  const openOpportunityDetail = (opportunity: Deal) => {
    setSelectedOpportunity(opportunity);
    setDetailTab('overview');
    // Load any existing attachments/notes from the opportunity
    const opp = opportunity as any;
    setOpportunityAttachments(opp.attachments || []);
    setOpportunityNotes(opp.opportunityNotes || []);
    setShowOpportunityDetail(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout role="CEO" pageTitle="Potential Opportunities">
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
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{opportunity.name}</CardTitle>
                      <CardDescription className="truncate">{opportunity.client}</CardDescription>
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
                <Select value={newOpportunity.sector} onValueChange={(v) => setNewOpportunity({ ...newOpportunity, sector: v })}>
                  <SelectTrigger data-testid="select-opportunity-sector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="mt-2 border border-dashed border-border rounded-lg p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, false)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                />
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF, Word, Excel, PowerPoint, or images
                  </p>
                </div>
                
                {newOpportunity.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
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
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="attachments" className="flex-1">
                    Attachments
                    {opportunityAttachments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{opportunityAttachments.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1">
                    Notes
                    {opportunityNotes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{opportunityNotes.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <ScrollArea className="h-[calc(100vh-350px)] mt-4">
                  <TabsContent value="overview" className="space-y-4 pr-4 mt-0">
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
                  </TabsContent>
                  
                  <TabsContent value="attachments" className="space-y-4 pr-4 mt-0">
                    <input
                      ref={detailFileInputRef}
                      type="file"
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
                      Upload Attachment
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
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = file.url;
                                  link.download = file.filename;
                                  link.click();
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                onClick={() => removeAttachment(file.id, true)}
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
                    <div className="flex gap-2">
                      <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        className="flex-1"
                      />
                      <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                        Add
                      </Button>
                    </div>
                    
                    {opportunityNotes.length > 0 ? (
                      <div className="space-y-3">
                        {opportunityNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{note.author}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.createdAt), 'PP p')}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notes yet</p>
                      </div>
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
          <div className="py-4">
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
    </Layout>
  );
}
