import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  Search, Filter, MoreVertical, ArrowRight, Calendar, DollarSign, Briefcase, 
  Pencil, Trash2, Eye, Users, Phone, Mail, MessageSquare, Plus, X, 
  Building2, TrendingUp, FileText, Clock, CheckCircle2, ChevronRight,
  UserPlus, History
} from "lucide-react";
import { useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember, TaggedInvestor, AuditEntry } from "@shared/schema";

const DEAL_STAGES = ['Origination', 'Execution', 'Negotiation', 'Due Diligence', 'Signing', 'Closed'];
const INVESTOR_TYPES = ['PE', 'VC', 'Strategic', 'Family Office', 'Hedge Fund', 'Sovereign Wealth'];
const INVESTOR_STATUSES = ['Contacted', 'Interested', 'In DD', 'Term Sheet', 'Passed', 'Closed'];

export default function DealManagement() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [], isLoading } = useDeals();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Technology',
    value: '',
    stage: 'Origination',
    lead: '',
    status: 'Active',
    progress: 0,
  });

  const [newTeamMember, setNewTeamMember] = useState<PodTeamMember>({
    name: '',
    role: '',
    email: '',
    phone: '',
    slack: '',
  });

  const [newInvestor, setNewInvestor] = useState<Omit<TaggedInvestor, 'id'>>({
    name: '',
    firm: '',
    type: 'PE',
    status: 'Contacted',
    notes: '',
  });

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

  const getStageIndex = (stage: string) => DEAL_STAGES.indexOf(stage);
  const getStageProgress = (stage: string) => ((getStageIndex(stage) + 1) / DEAL_STAGES.length) * 100;

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
      await createDeal.mutateAsync({
        name: newDeal.name,
        client: newDeal.client,
        sector: newDeal.sector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: getStageProgress(newDeal.stage),
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
      });
      toast.success("Deal created successfully!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Technology', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0 });
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

  const handleAddTeamMember = async () => {
    if (!selectedDeal || !newTeamMember.name || !newTeamMember.role) {
      toast.error("Please fill in name and role");
      return;
    }
    
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'Team Member Added',
      user: currentUser?.name || 'System',
      details: `Added ${newTeamMember.name} (${newTeamMember.role}) to pod team`,
    };

    const updatedPodTeam = [...(selectedDeal.podTeam as PodTeamMember[] || []), { ...newTeamMember, userId: crypto.randomUUID() }];
    
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
      setNewInvestor({ name: '', firm: '', type: 'PE', status: 'Contacted', notes: '' });
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
    try {
      await updateDeal.mutateAsync({
        id: editingDeal.id,
        name: editingDeal.name,
        client: editingDeal.client,
        sector: editingDeal.sector,
        value: editingDeal.value,
        stage: editingDeal.stage,
        lead: editingDeal.lead,
        status: editingDeal.status,
        progress: editingDeal.progress,
      });
      toast.success("Deal updated successfully!");
      setShowEditModal(false);
      setEditingDeal(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update deal");
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;
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

  const openEditModal = (deal: Deal) => {
    setEditingDeal(deal);
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <Layout role="CEO" pageTitle="Deal Management" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading deals...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="CEO" pageTitle="Deal Management" userName={currentUser?.name || ""}>
      <div className="space-y-6">
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

        {/* Deals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal) => (
            <Card 
              key={deal.id} 
              className="bg-card border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group cursor-pointer" 
              data-testid={`card-deal-${deal.id}`}
              onClick={() => { setSelectedDeal(deal); setActiveTab("overview"); }}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); setActiveTab("overview"); }}>
                        <Eye className="w-4 h-4 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditModal(deal); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit Deal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteDeal(deal.id); }}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-xl mt-2 group-hover:text-primary transition-colors">{deal.name}</CardTitle>
                <CardDescription>{deal.client}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Stage Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    {DEAL_STAGES.map((stage, index) => {
                      const isActive = getStageIndex(deal.stage) >= index;
                      const isCurrent = deal.stage === stage;
                      return (
                        <div key={stage} className="flex flex-col items-center flex-1">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                            isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                            isActive ? "bg-primary/60 text-primary-foreground" :
                            "bg-secondary text-muted-foreground"
                          )}>
                            {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                          </div>
                          <span className={cn(
                            "text-[8px] mt-1 truncate max-w-full",
                            isCurrent ? "text-primary font-bold" :
                            isActive ? "text-foreground" : "text-muted-foreground"
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
                    <div className="font-medium">{(deal.podTeam as PodTeamMember[] || []).length} members</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {deal.lead.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs text-muted-foreground">Lead: {deal.lead}</span>
                </div>
              </CardContent>
              
              <CardFooter className="pt-2">
                <Button 
                  className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground transition-colors gap-2"
                  onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); setActiveTab("overview"); }}
                  data-testid={`button-view-deal-${deal.id}`}
                >
                  View Deal Room <ArrowRight className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredDeals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery || stageFilter ? "No deals match your search criteria" : "No deals yet. Create your first deal!"}
          </div>
        )}
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
                  <Badge className={cn(
                    "px-3 py-1",
                    selectedDeal.status === 'Active' ? "bg-green-500/20 text-green-400" :
                    selectedDeal.status === 'On Hold' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
                  )}>
                    {selectedDeal.status}
                  </Badge>
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
                <TabsList className="grid grid-cols-4 bg-secondary/50">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="team">Pod Team</TabsTrigger>
                  <TabsTrigger value="investors">Investors</TabsTrigger>
                  <TabsTrigger value="audit">Audit Trail</TabsTrigger>
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
                        <div className="text-2xl font-bold text-primary">{(selectedDeal.podTeam as PodTeamMember[] || []).length}</div>
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
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-muted-foreground">Lead:</span>
                      <span className="ml-2 font-medium">{selectedDeal.lead}</span>
                    </div>
                  </div>

                  {selectedDeal.description && (
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-muted-foreground text-sm">Description:</span>
                      <p className="mt-1 text-sm">{selectedDeal.description}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Pod Team Tab */}
                <TabsContent value="team" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Pod Team Members</h4>
                    <Badge variant="secondary">{(selectedDeal.podTeam as PodTeamMember[] || []).length} members</Badge>
                  </div>

                  {/* Team Members List */}
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {(selectedDeal.podTeam as PodTeamMember[] || []).map((member, index) => (
                        <div key={index} className="p-3 bg-secondary/30 rounded-lg flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-medium">{member.name}</div>
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
                            {member.slack && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <a href={`slack://user?team=&id=${member.slack}`}><MessageSquare className="w-4 h-4 text-purple-500" /></a>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveTeamMember(index)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(selectedDeal.podTeam as PodTeamMember[] || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No team members assigned yet
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
                      <Input 
                        placeholder="Name *" 
                        value={newTeamMember.name}
                        onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                      />
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
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Tagged Investors</h4>
                    <Badge variant="secondary">{(selectedDeal.taggedInvestors as TaggedInvestor[] || []).length} investors</Badge>
                  </div>

                  {/* Investors List */}
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {(selectedDeal.taggedInvestors as TaggedInvestor[] || []).map((investor) => (
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
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveInvestor(investor.id)}
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
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
                <Select value={newDeal.sector} onValueChange={(v) => setNewDeal({ ...newDeal, sector: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="Consumer">Consumer</SelectItem>
                    <SelectItem value="Industrials">Industrials</SelectItem>
                    <SelectItem value="Financial">Financial</SelectItem>
                  </SelectContent>
                </Select>
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
                <Input 
                  placeholder="Deal Lead Name" 
                  value={newDeal.lead}
                  onChange={(e) => setNewDeal({ ...newDeal, lead: e.target.value })}
                />
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
                  <Select value={editingDeal.sector} onValueChange={(v) => setEditingDeal({ ...editingDeal, sector: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Energy">Energy</SelectItem>
                      <SelectItem value="Consumer">Consumer</SelectItem>
                      <SelectItem value="Industrials">Industrials</SelectItem>
                      <SelectItem value="Financial">Financial</SelectItem>
                    </SelectContent>
                  </Select>
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
    </Layout>
  );
}
