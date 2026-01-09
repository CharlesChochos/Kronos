import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Archive, RotateCcw, Calendar, DollarSign, Briefcase, 
  Building2, FileText, Users, Eye, Clock, MessageSquare, Filter
} from "lucide-react";
import { 
  useCurrentUser, useArchivedDeals, useRestoreDeal, useDeal, useUsers,
  useStageDocuments, useDealNotes, useStagePodMembers, type DealNoteType
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import type { Deal, PodTeamMember } from "@shared/schema";

const DEAL_TYPE_COLORS: Record<string, string> = {
  'M&A': 'bg-blue-500/20 text-blue-400',
  'Capital Raising': 'bg-purple-500/20 text-purple-400',
  'Asset Management': 'bg-green-500/20 text-green-400',
  'Opportunity': 'bg-orange-500/20 text-orange-400',
};

export default function ArchivedDeals() {
  const { data: currentUser } = useCurrentUser();
  const { data: archivedDeals = [], isLoading } = useArchivedDeals();
  const { data: allUsers = [] } = useUsers();
  const restoreDeal = useRestoreDeal();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [dealToRestore, setDealToRestore] = useState<Deal | null>(null);
  
  const { data: selectedDealFull } = useDeal(selectedDealId || '');
  const { data: dealNotes = [] } = useDealNotes(selectedDealId || '');
  const { data: stageDocs = [] } = useStageDocuments(selectedDealId || '', selectedDealFull?.stage || 'Origination');
  const { data: podMembers = [] } = useStagePodMembers(selectedDealId || '', selectedDealFull?.stage || 'Origination');
  
  const filteredDeals = useMemo(() => {
    return archivedDeals.filter((deal: Deal) => {
      const matchesSearch = !searchQuery || 
        deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.sector?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !typeFilter || deal.dealType === typeFilter;
      const matchesReason = !reasonFilter || deal.archivedReason === reasonFilter;
      return matchesSearch && matchesType && matchesReason;
    });
  }, [archivedDeals, searchQuery, typeFilter, reasonFilter]);
  
  const uniqueReasons = useMemo(() => {
    const reasons = new Set<string>();
    archivedDeals.forEach((deal: Deal) => {
      if (deal.archivedReason) reasons.add(deal.archivedReason);
    });
    return Array.from(reasons);
  }, [archivedDeals]);
  
  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unknown';
    const user = allUsers.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };
  
  const handleRestore = async () => {
    if (!dealToRestore) return;
    try {
      await restoreDeal.mutateAsync(dealToRestore.id);
      toast.success(`"${dealToRestore.name}" has been restored and is now active again.`);
      setShowRestoreDialog(false);
      setDealToRestore(null);
      if (selectedDealId === dealToRestore.id) {
        setSelectedDealId(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to restore deal");
    }
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Archive className="w-8 h-8 text-amber-500" />
          Archived Deals
        </h1>
        <p className="text-muted-foreground mt-2">
          View and manage archived deals. These deals are preserved with all their documents and notes for future reference.
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search archived deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
            data-testid="input-search-archived"
          />
        </div>
        <Select value={typeFilter || ''} onValueChange={(v) => setTypeFilter(v || null)}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="All Deal Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Deal Types</SelectItem>
            <SelectItem value="M&A">M&A</SelectItem>
            <SelectItem value="Capital Raising">Capital Raising</SelectItem>
            <SelectItem value="Asset Management">Asset Management</SelectItem>
            <SelectItem value="Opportunity">Opportunity</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reasonFilter || ''} onValueChange={(v) => setReasonFilter(v || null)}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="All Reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Reasons</SelectItem>
            {uniqueReasons.map(reason => (
              <SelectItem key={reason} value={reason}>{reason}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="text-sm text-muted-foreground mb-4">
        {filteredDeals.length} archived deal{filteredDeals.length !== 1 ? 's' : ''}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredDeals.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Archive className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Archived Deals</h3>
            <p className="text-muted-foreground">
              {searchQuery || typeFilter || reasonFilter 
                ? "No deals match your search criteria." 
                : "Archived deals will appear here. Archive deals from Deal Management, Opportunities, or Asset Management."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredDeals.map((deal: Deal) => (
              <Card 
                key={deal.id} 
                className={cn(
                  "bg-card border-border cursor-pointer transition-all duration-200",
                  selectedDealId === deal.id ? "ring-2 ring-primary" : "hover:shadow-lg hover:shadow-primary/5"
                )}
                onClick={() => setSelectedDealId(deal.id)}
                data-testid={`card-archived-deal-${deal.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-[10px]", DEAL_TYPE_COLORS[deal.dealType] || 'bg-gray-500/20 text-gray-400')}>
                          {deal.dealType}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">
                          {deal.archivedReason || 'Archived'}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{deal.name}</CardTitle>
                      <CardDescription>{deal.client} • {deal.sector}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDealToRestore(deal);
                        setShowRestoreDialog(true);
                      }}
                      data-testid={`button-restore-${deal.id}`}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Restore
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      ${deal.value}M
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {deal.stage}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Archived {deal.archivedAt ? formatDistanceToNow(new Date(deal.archivedAt), { addSuffix: true }) : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      By {getUserName(deal.archivedBy)}
                    </div>
                  </div>
                  {deal.archivedNotes && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md">
                      <p className="text-sm text-muted-foreground italic">"{deal.archivedNotes}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="lg:col-span-1">
            {selectedDealId && selectedDealFull ? (
              <Card className="bg-card border-border sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Deal Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="documents">Documents</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="overview" className="mt-4 space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Deal Name</Label>
                        <p className="font-medium">{selectedDealFull.name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Client</Label>
                        <p className="font-medium">{selectedDealFull.client}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Value</Label>
                          <p className="font-medium">${selectedDealFull.value}M</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Sector</Label>
                          <p className="font-medium">{selectedDealFull.sector}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Stage</Label>
                          <p className="font-medium">{selectedDealFull.stage}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Lead</Label>
                          <p className="font-medium">{selectedDealFull.lead}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <p className="text-sm">{selectedDealFull.description || 'No description'}</p>
                      </div>
                      <div className="pt-4 border-t border-border">
                        <Label className="text-xs text-muted-foreground mb-2 block">Archive Information</Label>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Reason:</span>
                            <span className="text-sm font-medium">{selectedDealFull.archivedReason || 'Not specified'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Archived By:</span>
                            <span className="text-sm font-medium">{getUserName(selectedDealFull.archivedBy)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Date:</span>
                            <span className="text-sm font-medium">
                              {selectedDealFull.archivedAt ? format(new Date(selectedDealFull.archivedAt), 'PPP') : 'N/A'}
                            </span>
                          </div>
                          {selectedDealFull.archivedNotes && (
                            <div className="pt-2">
                              <span className="text-sm text-muted-foreground block mb-1">Notes:</span>
                              <p className="text-sm italic">{selectedDealFull.archivedNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground mb-2 block">Team Members</Label>
                        <div className="flex flex-wrap gap-2">
                          {podMembers.length > 0 ? podMembers.map((member: any) => (
                            <Badge key={member.id} variant="outline" className="text-xs">
                              {member.userName || member.name}
                            </Badge>
                          )) : (
                            <span className="text-sm text-muted-foreground">No team members</span>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="documents" className="mt-4">
                      <ScrollArea className="h-[300px]">
                        {(selectedDealFull.attachments as any[])?.length > 0 || stageDocs.length > 0 ? (
                          <div className="space-y-2">
                            {(selectedDealFull.attachments as any[])?.map((att: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm truncate">{att.filename || att.name}</span>
                              </div>
                            ))}
                            {stageDocs.map((doc: any) => (
                              <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm truncate">{doc.filename}</span>
                                <Badge variant="outline" className="text-[10px] ml-auto">{doc.stage}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No documents attached</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="notes" className="mt-4">
                      <ScrollArea className="h-[300px]">
                        {dealNotes.length > 0 ? (
                          <div className="space-y-3">
                            {dealNotes.map((note: DealNoteType) => (
                              <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium">{note.authorName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(note.createdAt), 'PP')}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No notes added</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-16 text-center">
                  <Eye className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Select a deal to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-500" />
              Restore Deal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore "{dealToRestore?.name}"? The deal will become active again and appear in the appropriate section based on its type.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {dealToRestore && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Deal Type:</span>
                  <Badge className={cn("text-xs", DEAL_TYPE_COLORS[dealToRestore.dealType] || 'bg-gray-500/20 text-gray-400')}>
                    {dealToRestore.dealType}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <span className="text-sm font-medium">{dealToRestore.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Value:</span>
                  <span className="text-sm font-medium">${dealToRestore.value}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Stage:</span>
                  <span className="text-sm font-medium">{dealToRestore.stage}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRestoreDialog(false);
              setDealToRestore(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleRestore}
              disabled={restoreDeal.isPending}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {restoreDeal.isPending ? "Restoring..." : "Restore Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
