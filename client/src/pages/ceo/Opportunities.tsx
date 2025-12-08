import { useState, useMemo } from "react";
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
  Building2, Users, ArrowRight, Briefcase, TrendingUp, AlertTriangle
} from "lucide-react";
import { 
  useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Deal, PodTeamMember } from "@shared/schema";

const DEAL_TYPES = ['M&A', 'Capital Raising', 'Asset Management'];
const SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Real Estate', 'Other'];

export default function Opportunities() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [], isLoading } = useDeals();
  const { data: users = [] } = useUsers();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOpportunityDialog, setShowNewOpportunityDialog] = useState(false);
  const [showOpportunityDetail, setShowOpportunityDetail] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Deal | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalDealType, setApprovalDealType] = useState<string>('M&A');
  
  const [newOpportunity, setNewOpportunity] = useState({
    name: "",
    client: "",
    sector: "Technology",
    value: 0,
    description: "",
    lead: "",
  });
  
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
  
  const handleCreateOpportunity = async () => {
    if (!newOpportunity.name || !newOpportunity.client) {
      toast.error("Please fill in required fields");
      return;
    }
    try {
      await createDeal.mutateAsync({
        ...newOpportunity,
        dealType: 'Opportunity',
        stage: 'Origination',
        status: 'Active',
        progress: 0,
        podTeam: [],
      } as any);
      toast.success("Opportunity created");
      setShowNewOpportunityDialog(false);
      setNewOpportunity({ name: "", client: "", sector: "Technology", value: 0, description: "", lead: "" });
    } catch (error) {
      toast.error("Failed to create opportunity");
    }
  };
  
  const handleApprove = async () => {
    if (!selectedOpportunity) return;
    try {
      await updateDeal.mutateAsync({
        id: selectedOpportunity.id,
        dealType: approvalDealType,
        status: 'Active',
      } as any);
      toast.success(`Opportunity approved and moved to ${approvalDealType}`);
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
                onClick={() => { setSelectedOpportunity(opportunity); setShowOpportunityDetail(true); }}
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
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button size="sm" variant="outline" className="flex-1 text-green-500 hover:bg-green-500/10"
                        onClick={(e) => { e.stopPropagation(); setSelectedOpportunity(opportunity); setShowApproveDialog(true); }}
                        data-testid={`button-approve-${opportunity.id}`}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-red-500 hover:bg-red-500/10"
                        onClick={(e) => { e.stopPropagation(); setSelectedOpportunity(opportunity); setShowRejectDialog(true); }}
                        data-testid={`button-reject-${opportunity.id}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
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
      
      {/* New Opportunity Dialog */}
      <Dialog open={showNewOpportunityDialog} onOpenChange={setShowNewOpportunityDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>New Opportunity</DialogTitle>
            <DialogDescription>Add a potential deal for review</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
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
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, value: parseInt(e.target.value) || 0 })}
                  data-testid="input-opportunity-value"
                />
              </div>
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
            <div>
              <Label>Description</Label>
              <Textarea
                value={newOpportunity.description}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, description: e.target.value })}
                placeholder="Brief description of the opportunity..."
                rows={3}
                data-testid="textarea-opportunity-description"
              />
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
      
      {/* Opportunity Detail Sheet */}
      <Sheet open={showOpportunityDetail} onOpenChange={setShowOpportunityDetail}>
        <SheetContent className="bg-card border-border w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {selectedOpportunity?.name}
            </SheetTitle>
            <SheetDescription>{selectedOpportunity?.client}</SheetDescription>
          </SheetHeader>
          
          {selectedOpportunity && (
            <ScrollArea className="h-[calc(100vh-250px)] mt-6">
              <div className="space-y-6 pr-4">
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
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1">{selectedOpportunity.description}</p>
                  </div>
                )}
                
                <div className="pt-4 border-t border-border space-y-3">
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
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
      
      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which division this deal should be assigned to. It will be moved to Deal Management.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Assign to Division</Label>
            <Select value={approvalDealType} onValueChange={setApprovalDealType}>
              <SelectTrigger className="mt-2" data-testid="select-approval-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
