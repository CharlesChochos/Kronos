import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
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
  UserPlus, History, LayoutGrid, CalendarDays, ChevronLeft, Upload
} from "lucide-react";
import { useCurrentUser, useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useUsers, useTasks } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isToday, isBefore, isAfter, parseISO } from "date-fns";
import type { Deal, PodTeamMember, TaggedInvestor, AuditEntry } from "@shared/schema";

const DEAL_STAGES = ['Origination', 'Execution', 'Negotiation', 'Due Diligence', 'Signing', 'Closed'];
const INVESTOR_TYPES = ['PE', 'VC', 'Strategic', 'Family Office', 'Hedge Fund', 'Sovereign Wealth'];
const INVESTOR_STATUSES = ['Contacted', 'Interested', 'In DD', 'Term Sheet', 'Passed', 'Closed'];

type DealManagementProps = {
  role?: 'CEO' | 'Employee';
};

export default function DealManagement({ role = 'CEO' }: DealManagementProps) {
  const searchString = useSearch();
  const { data: currentUser } = useCurrentUser();
  const { data: allDeals = [], isLoading } = useDeals();
  const { data: allUsers = [] } = useUsers();
  const { data: allTasks = [] } = useTasks();
  
  // Filter deals based on role - employees only see deals they're assigned to
  const deals = useMemo(() => {
    if (role === 'CEO') {
      return allDeals;
    }
    // For employees, filter to only show deals where they are in the pod team
    // If user data is not yet available, show no deals until we can verify access
    if (!currentUser?.id && !currentUser?.email && !currentUser?.name) {
      return [];
    }
    return allDeals.filter(deal => {
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

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDeal, setSelectedCalendarDeal] = useState<Deal | null>(null);
  const [calendarDealSearch, setCalendarDealSearch] = useState("");
  
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
  const getStageProgress = (stage: string) => Math.round(((getStageIndex(stage) + 1) / DEAL_STAGES.length) * 100);

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
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className={cn("rounded-none", viewMode === 'calendar' && "bg-primary/10 text-primary")}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays className="w-4 h-4" />
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
            {role === 'CEO' && (
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowNewDealModal(true)}
                data-testid="button-new-deal"
              >
                <Plus className="w-4 h-4 mr-1" /> New Deal
              </Button>
            )}
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
                                  <div className="text-xs text-muted-foreground">{deal.client} • {deal.sector} • {deal.stage}</div>
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
                                    onClick={() => { setSelectedDeal(event.deal); setActiveTab("overview"); }}
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
                                  <CardDescription>{deal.client} • {deal.sector}</CardDescription>
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
                                  onClick={() => { setSelectedDeal(deal); setActiveTab("overview"); }}
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
                      <DropdownMenuItem onClick={() => { setSelectedDeal(deal); setActiveTab("overview"); }}>
                        <Eye className="w-4 h-4 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(deal)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit Deal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
                <TabsList className="grid grid-cols-5 bg-secondary/50">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="team">Pod Team</TabsTrigger>
                  <TabsTrigger value="investors">Investors</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
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

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Deal Documents</h4>
                    <Badge variant="secondary">
                      {((selectedDeal.attachments as any[] || [])).length} files
                    </Badge>
                  </div>

                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('deal-document-upload')?.click()}
                  >
                    <input 
                      type="file" 
                      id="deal-document-upload" 
                      className="hidden" 
                      multiple 
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        
                        const existingAttachments = (selectedDeal.attachments as any[] || []);
                        const uploadedAttachments: any[] = [];
                        
                        // Upload each file to the server using FormData
                        for (const file of files) {
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            const response = await fetch('/api/upload', {
                              method: 'POST',
                              credentials: 'include',
                              body: formData,
                            });
                            
                            if (response.ok) {
                              const uploadedFile = await response.json();
                              uploadedAttachments.push(uploadedFile);
                            } else {
                              const error = await response.json();
                              throw new Error(error.error || 'Upload failed');
                            }
                          } catch (error: any) {
                            console.error('Error uploading file:', error);
                            toast.error(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
                          }
                        }
                        
                        if (uploadedAttachments.length > 0) {
                          try {
                            await updateDeal.mutateAsync({
                              id: selectedDeal.id,
                              attachments: [...existingAttachments, ...uploadedAttachments],
                            });
                            toast.success(`${uploadedAttachments.length} file(s) uploaded successfully`);
                          } catch (error) {
                            toast.error("Failed to save files to deal");
                          }
                        }
                        
                        // Reset the input
                        e.target.value = '';
                      }}
                      data-testid="input-document-upload"
                    />
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload documents
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, PowerPoint, CSV, TXT
                    </p>
                  </div>

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {((selectedDeal.attachments as any[] || [])).map((doc: any) => (
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
                              onClick={() => window.open(doc.url, '_blank')}
                              data-testid={`button-view-doc-${doc.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                              onClick={async () => {
                                const updatedAttachments = (selectedDeal.attachments as any[] || [])
                                  .filter((a: any) => a.id !== doc.id);
                                try {
                                  await updateDeal.mutateAsync({
                                    id: selectedDeal.id,
                                    attachments: updatedAttachments,
                                  });
                                  toast.success("Document removed");
                                } catch (error) {
                                  toast.error("Failed to remove document");
                                }
                              }}
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {((selectedDeal.attachments as any[] || [])).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No documents uploaded yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>
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
