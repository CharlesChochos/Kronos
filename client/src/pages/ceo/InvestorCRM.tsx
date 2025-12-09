import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Clock,
  DollarSign,
  TrendingUp,
  Star,
  MessageSquare,
  Users,
  Briefcase,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  X
} from "lucide-react";
import { useCurrentUser, useInvestors, useInvestor, useCreateInvestor, useCreateInvestorInteraction, useDeleteInvestor } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  'Active': 'bg-green-500',
  'Warm': 'bg-yellow-500',
  'Cold': 'bg-blue-500',
  'Inactive': 'bg-gray-500',
};

export default function InvestorCRM() {
  const { data: currentUser } = useCurrentUser();
  const { data: investors = [], isLoading } = useInvestors();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
  const [showAddInvestor, setShowAddInvestor] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  const { data: selectedInvestorData } = useInvestor(selectedInvestorId || '');
  const createInvestor = useCreateInvestor();
  const createInteraction = useCreateInvestorInteraction();
  const deleteInvestor = useDeleteInvestor();

  const [newInvestor, setNewInvestor] = useState({
    name: '',
    firm: '',
    type: 'PE' as string,
    email: '',
    phone: '',
    location: '',
    sectors: '',
    minDealSize: '',
    maxDealSize: '',
    status: 'Active' as string,
    notes: '',
  });

  const [newInteraction, setNewInteraction] = useState({ type: 'Call', notes: '' });

  const filteredInvestors = useMemo(() => {
    return investors.filter(inv => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!inv.name.toLowerCase().includes(query) && 
            !inv.firm.toLowerCase().includes(query) &&
            !(inv.sectors || []).some((s: string) => s.toLowerCase().includes(query))) {
          return false;
        }
      }
      if (filterType !== 'all' && inv.type !== filterType) return false;
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      return true;
    });
  }, [investors, searchQuery, filterType, filterStatus]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: investors.length,
      active: investors.filter(i => i.status === 'Active').length,
      avgScore: investors.length > 0 
        ? Math.round(investors.reduce((sum, i) => sum + (i.relationshipScore || 0), 0) / investors.length)
        : 0,
      recentContacts: investors.filter(i => {
        if (!i.lastContactDate) return false;
        const daysSince = differenceInDays(now, parseISO(i.lastContactDate));
        return daysSince <= 7;
      }).length,
    };
  }, [investors]);

  const handleAddInvestor = async () => {
    if (!newInvestor.name || !newInvestor.firm) {
      toast.error('Please enter name and firm');
      return;
    }
    
    try {
      await createInvestor.mutateAsync({
        name: newInvestor.name,
        firm: newInvestor.firm,
        type: newInvestor.type,
        email: newInvestor.email || undefined,
        phone: newInvestor.phone || undefined,
        location: newInvestor.location || undefined,
        sectors: newInvestor.sectors ? newInvestor.sectors.split(',').map(s => s.trim()) : undefined,
        minDealSize: newInvestor.minDealSize ? parseInt(newInvestor.minDealSize) : undefined,
        maxDealSize: newInvestor.maxDealSize ? parseInt(newInvestor.maxDealSize) : undefined,
        status: newInvestor.status,
        notes: newInvestor.notes || undefined,
      });
      toast.success('Investor added');
      setShowAddInvestor(false);
      setNewInvestor({
        name: '', firm: '', type: 'PE', email: '', phone: '', location: '',
        sectors: '', minDealSize: '', maxDealSize: '', status: 'Active', notes: '',
      });
    } catch (error) {
      toast.error('Failed to add investor');
    }
  };

  const handleAddInteraction = async () => {
    if (!selectedInvestorId || !newInteraction.notes) {
      toast.error('Please enter interaction details');
      return;
    }
    
    try {
      await createInteraction.mutateAsync({
        investorId: selectedInvestorId,
        interaction: {
          type: newInteraction.type,
          date: format(new Date(), 'yyyy-MM-dd'),
          notes: newInteraction.notes,
        },
      });
      toast.success('Interaction logged');
      setShowAddInteraction(false);
      setNewInteraction({ type: 'Call', notes: '' });
    } catch (error) {
      toast.error('Failed to log interaction');
    }
  };

  const handleDeleteInvestor = async () => {
    if (!selectedInvestorId) return;
    
    try {
      await deleteInvestor.mutateAsync(selectedInvestorId);
      toast.success('Investor deleted');
      setSelectedInvestorId(null);
    } catch (error) {
      toast.error('Failed to delete investor');
    }
  };

  const toggleInvestorSelection = (investorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedInvestorIds);
    if (newSet.has(investorId)) {
      newSet.delete(investorId);
    } else {
      newSet.add(investorId);
    }
    setSelectedInvestorIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedInvestorIds.size === filteredInvestors.length) {
      setSelectedInvestorIds(new Set());
    } else {
      setSelectedInvestorIds(new Set(filteredInvestors.map(i => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvestorIds.size === 0) return;
    
    const idsToDelete = Array.from(selectedInvestorIds);
    const results = await Promise.allSettled(
      idsToDelete.map(id => deleteInvestor.mutateAsync(id))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (failed === 0) {
      toast.success(`${successful} investor(s) deleted`);
    } else if (successful > 0) {
      toast.warning(`${successful} deleted, ${failed} failed`);
    } else {
      toast.error('Failed to delete investors');
    }
    
    // Force refresh the investors list
    await queryClient.invalidateQueries({ queryKey: ["investors"] });
    
    setSelectedInvestorIds(new Set());
    setShowBulkDeleteDialog(false);
    if (selectedInvestorId && idsToDelete.includes(selectedInvestorId)) {
      setSelectedInvestorId(null);
    }
  };

  const handleBulkEmail = () => {
    const selectedEmails = investors
      .filter(i => selectedInvestorIds.has(i.id) && i.email)
      .map(i => i.email)
      .join(',');
    if (selectedEmails) {
      window.location.href = `mailto:${selectedEmails}`;
    } else {
      toast.error('No email addresses found for selected investors');
    }
  };

  const selectedInvestor = selectedInvestorData || investors.find(i => i.id === selectedInvestorId);

  return (
    <Layout role="CEO" pageTitle="Investor CRM" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Investor CRM
            </h1>
            <p className="text-muted-foreground">Manage investor relationships and interactions</p>
          </div>
          <Button onClick={() => setShowAddInvestor(true)} data-testid="button-add-investor">
            <Plus className="w-4 h-4 mr-2" />
            Add Investor
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Investors</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Relationships</p>
                  <p className="text-2xl font-bold text-green-500">{stats.active}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Relationship Score</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.avgScore}</p>
                </div>
                <Star className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recent Contacts (7d)</p>
                  <p className="text-2xl font-bold text-purple-500">{stats.recentContacts}</p>
                </div>
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search investors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-investors"
                  />
                </div>
              </div>
              
              {/* Bulk Actions Bar */}
              {selectedInvestorIds.size > 0 && (
                <div className="flex items-center justify-between p-2 mt-2 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedInvestorIds(new Set())} className="h-7 px-2">
                      <X className="w-3 h-3" />
                    </Button>
                    <span className="text-sm font-medium">{selectedInvestorIds.size} selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={handleBulkEmail} className="h-7 text-xs" data-testid="button-bulk-email">
                      <Mail className="w-3 h-3 mr-1" /> Email
                    </Button>
                    <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" data-testid="button-bulk-delete">
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedInvestorIds.size} investor(s)?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the selected investors. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600">
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 mt-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="flex-1" data-testid="select-filter-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="PE">PE</SelectItem>
                    <SelectItem value="VC">VC</SelectItem>
                    <SelectItem value="Strategic">Strategic</SelectItem>
                    <SelectItem value="Family Office">Family Office</SelectItem>
                    <SelectItem value="Hedge Fund">Hedge Fund</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1" data-testid="select-filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Warm">Warm</SelectItem>
                    <SelectItem value="Cold">Cold</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="p-2 space-y-2">
                    {filteredInvestors.length > 0 && (
                      <button
                        onClick={toggleSelectAll}
                        className="w-full p-2 rounded-lg border border-dashed border-border hover:bg-secondary/50 flex items-center gap-2 text-sm text-muted-foreground"
                        data-testid="button-select-all"
                      >
                        {selectedInvestorIds.size === filteredInvestors.length ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                        {selectedInvestorIds.size === filteredInvestors.length ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                    {filteredInvestors.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No investors found</p>
                        <p className="text-sm mt-1">Add your first investor to get started</p>
                      </div>
                    ) : (
                      filteredInvestors.map(investor => (
                        <div
                          key={investor.id}
                          className={cn(
                            "w-full p-3 rounded-lg border text-left transition-colors flex items-start gap-2",
                            selectedInvestorId === investor.id 
                              ? "border-primary bg-primary/10" 
                              : "border-border hover:bg-secondary/50",
                            selectedInvestorIds.has(investor.id) && "bg-primary/5 border-primary/50"
                          )}
                          data-testid={`investor-card-${investor.id}`}
                        >
                          <button
                            onClick={(e) => toggleInvestorSelection(investor.id, e)}
                            className="mt-1 flex-shrink-0"
                            data-testid={`checkbox-investor-${investor.id}`}
                          >
                            {selectedInvestorIds.has(investor.id) ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground hover:text-primary" />
                            )}
                          </button>
                          <button 
                            onClick={() => setSelectedInvestorId(investor.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-primary/20 text-primary">
                                  {investor.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{investor.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{investor.firm}</p>
                              </div>
                              <div className={cn("w-2 h-2 rounded-full", statusColors[investor.status] || 'bg-gray-500')} />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">{investor.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Score: {investor.relationshipScore || 0}
                              </span>
                            </div>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-card border-border">
            {selectedInvestor ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarFallback className="text-xl bg-primary/20 text-primary">
                          {selectedInvestor.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-xl font-bold">{selectedInvestor.name}</h2>
                        <p className="text-muted-foreground">{selectedInvestor.firm}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{selectedInvestor.type}</Badge>
                          <Badge className={cn("text-white", statusColors[selectedInvestor.status] || 'bg-gray-500')}>
                            {selectedInvestor.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAddInteraction(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Log Interaction
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={deleteInvestor.isPending}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            data-testid="button-delete-investor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete {selectedInvestor.name} from {selectedInvestor.firm} and all their interaction history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteInvestor}>
                              Delete Investor
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="interactions">Interactions</TabsTrigger>
                      <TabsTrigger value="deals">Deals</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="overview" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          {selectedInvestor.email && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Email
                              </p>
                              <p className="font-medium">{selectedInvestor.email}</p>
                            </div>
                          )}
                          {selectedInvestor.phone && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Phone
                              </p>
                              <p className="font-medium">{selectedInvestor.phone}</p>
                            </div>
                          )}
                          {selectedInvestor.location && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> Location
                              </p>
                              <p className="font-medium">{selectedInvestor.location}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          {(selectedInvestor.minDealSize || selectedInvestor.maxDealSize) && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Deal Size Range
                              </p>
                              <p className="font-medium">
                                ${selectedInvestor.minDealSize || 0}M - ${selectedInvestor.maxDealSize || '∞'}M
                              </p>
                            </div>
                          )}
                          {selectedInvestor.sectors && selectedInvestor.sectors.length > 0 && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Building className="w-4 h-4" /> Sectors
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedInvestor.sectors.map((sector: string) => (
                                  <Badge key={sector} variant="outline" className="text-xs">{sector}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedInvestor.lastContactDate && (
                            <div className="p-3 rounded-lg bg-secondary/30">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Last Contact
                              </p>
                              <p className="font-medium">
                                {format(parseISO(selectedInvestor.lastContactDate), 'MMM d, yyyy')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {selectedInvestor.notes && (
                        <div className="mt-4 p-4 rounded-lg bg-secondary/30">
                          <p className="text-sm text-muted-foreground mb-2">Notes</p>
                          <p>{selectedInvestor.notes}</p>
                        </div>
                      )}
                      
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-primary" />
                            <span className="text-sm text-muted-foreground">Relationship Score</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedInvestor.relationshipScore || 0}/100</p>
                        </div>
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-green-500" />
                            <span className="text-sm text-muted-foreground">Deals Participated</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedInvestor.dealsParticipated || 0}</p>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="interactions" className="mt-4">
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {selectedInvestorData?.interactions?.map((interaction: any) => (
                            <div key={interaction.id} className="p-3 rounded-lg border border-border">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary">{interaction.type}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(parseISO(interaction.date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <p className="mt-2 text-sm">{interaction.notes}</p>
                              {interaction.userName && (
                                <p className="mt-1 text-xs text-muted-foreground">By: {interaction.userName}</p>
                              )}
                            </div>
                          ))}
                          {(!selectedInvestorData?.interactions || selectedInvestorData.interactions.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>No interactions logged yet</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="deals" className="mt-4">
                      <div className="text-center py-8 text-muted-foreground">
                        <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Deal history coming soon</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-16 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">Select an Investor</h3>
                <p className="text-muted-foreground mt-1">
                  Choose an investor from the list to view their details
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={showAddInvestor} onOpenChange={setShowAddInvestor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Investor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newInvestor.name}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  data-testid="input-investor-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Firm *</Label>
                <Input
                  value={newInvestor.firm}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, firm: e.target.value }))}
                  placeholder="Blackstone"
                  data-testid="input-investor-firm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newInvestor.type} onValueChange={(v) => setNewInvestor(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger data-testid="select-investor-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PE">Private Equity</SelectItem>
                    <SelectItem value="VC">Venture Capital</SelectItem>
                    <SelectItem value="Strategic">Strategic</SelectItem>
                    <SelectItem value="Family Office">Family Office</SelectItem>
                    <SelectItem value="Hedge Fund">Hedge Fund</SelectItem>
                    <SelectItem value="Sovereign Wealth">Sovereign Wealth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newInvestor.status} onValueChange={(v) => setNewInvestor(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger data-testid="select-investor-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Warm">Warm</SelectItem>
                    <SelectItem value="Cold">Cold</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newInvestor.email}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@firm.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newInvestor.phone}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={newInvestor.location}
                onChange={(e) => setNewInvestor(prev => ({ ...prev, location: e.target.value }))}
                placeholder="New York, NY"
              />
            </div>
            <div className="space-y-2">
              <Label>Sectors (comma-separated)</Label>
              <Input
                value={newInvestor.sectors}
                onChange={(e) => setNewInvestor(prev => ({ ...prev, sectors: e.target.value }))}
                placeholder="Technology, Healthcare, Financial Services"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Deal Size ($M)</Label>
                <Input
                  type="number"
                  value={newInvestor.minDealSize}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, minDealSize: e.target.value }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Deal Size ($M)</Label>
                <Input
                  type="number"
                  value={newInvestor.maxDealSize}
                  onChange={(e) => setNewInvestor(prev => ({ ...prev, maxDealSize: e.target.value }))}
                  placeholder="500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newInvestor.notes}
                onChange={(e) => setNewInvestor(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any relevant notes about this investor..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInvestor(false)}>Cancel</Button>
            <Button 
              onClick={handleAddInvestor}
              disabled={createInvestor.isPending}
              data-testid="button-save-investor"
            >
              {createInvestor.isPending ? 'Saving...' : 'Add Investor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddInteraction} onOpenChange={setShowAddInteraction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newInteraction.type} onValueChange={(v) => setNewInteraction(prev => ({ ...prev, type: v }))}>
                <SelectTrigger data-testid="select-interaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call">Call</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Describe the interaction..."
                value={newInteraction.notes}
                onChange={(e) => setNewInteraction(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="input-interaction-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInteraction(false)}>Cancel</Button>
            <Button 
              onClick={handleAddInteraction}
              disabled={createInteraction.isPending}
              data-testid="button-save-interaction"
            >
              {createInteraction.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
