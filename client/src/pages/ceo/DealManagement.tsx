import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Filter, MoreVertical, ArrowRight, Calendar, DollarSign, Briefcase, Pencil, Trash2, Eye } from "lucide-react";
import { useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Deal } from "@shared/schema";

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
  const [showDealRoom, setShowDealRoom] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
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
        progress: newDeal.progress || 0,
      });
      toast.success("Deal created successfully!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Technology', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0 });
    } catch (error: any) {
      toast.error(error.message || "Failed to create deal");
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
                        <Filter className="w-4 h-4" /> {stageFilter || 'Filter'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setStageFilter(null)}>All Stages</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStageFilter('Origination')}>Origination</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStageFilter('Structuring')}>Structuring</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStageFilter('Diligence')}>Diligence</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStageFilter('Legal')}>Legal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStageFilter('Close')}>Close</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowNewDealModal(true)}
                  data-testid="button-new-deal"
                >
                    + New Deal
                </Button>
            </div>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => (
                <Card key={deal.id} className="bg-card border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group" data-testid={`card-deal-${deal.id}`}>
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
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setShowDealRoom(deal.id)}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditModal(deal)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Edit Deal
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-500" onClick={() => handleDeleteDeal(deal.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <CardTitle className="text-xl mt-2 group-hover:text-primary transition-colors">{deal.name}</CardTitle>
                        <CardDescription>{deal.client}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Value
                                </div>
                                <div className="font-mono font-bold text-lg">${deal.value}M</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" /> Sector
                                </div>
                                <div className="font-medium">{deal.sector}</div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-bold text-primary">{deal.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-500 ease-out" 
                                    style={{ width: `${deal.progress}%` }}
                                ></div>
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
                          onClick={() => setShowDealRoom(deal.id)}
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

      {/* New Deal Modal */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
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
                    <SelectItem value="Origination">Origination</SelectItem>
                    <SelectItem value="Structuring">Structuring</SelectItem>
                    <SelectItem value="Diligence">Diligence</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Close">Close</SelectItem>
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
                  <Label>Progress (%)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    max="100"
                    value={editingDeal.progress || 0}
                    onChange={(e) => setEditingDeal({ ...editingDeal, progress: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={editingDeal.stage} onValueChange={(v) => setEditingDeal({ ...editingDeal, stage: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Origination">Origination</SelectItem>
                      <SelectItem value="Structuring">Structuring</SelectItem>
                      <SelectItem value="Diligence">Diligence</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                      <SelectItem value="Close">Close</SelectItem>
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

      {/* Deal Room Modal */}
      <Dialog open={!!showDealRoom} onOpenChange={() => setShowDealRoom(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deal Room</DialogTitle>
          </DialogHeader>
          {showDealRoom && (() => {
            const deal = deals.find(d => d.id === showDealRoom);
            if (!deal) return null;
            return (
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{deal.name}</h2>
                    <p className="text-muted-foreground">{deal.client}</p>
                  </div>
                  <Badge className={cn(
                    "px-3 py-1",
                    deal.status === 'Active' ? "bg-green-500/20 text-green-400" :
                    deal.status === 'On Hold' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
                  )}>
                    {deal.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-secondary/30">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">${deal.value}M</div>
                      <div className="text-xs text-muted-foreground">Deal Value</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/30">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{deal.progress}%</div>
                      <div className="text-xs text-muted-foreground">Progress</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/30">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{deal.stage}</div>
                      <div className="text-xs text-muted-foreground">Current Stage</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Deal Progress</span>
                    <span className="font-bold">{deal.progress}%</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${deal.progress}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sector:</span>
                    <span className="ml-2 font-medium">{deal.sector}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lead:</span>
                    <span className="ml-2 font-medium">{deal.lead}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDealRoom(null)}>Close</Button>
            <Button onClick={() => { setShowDealRoom(null); const deal = deals.find(d => d.id === showDealRoom); if (deal) openEditModal(deal); }}>
              Edit Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
