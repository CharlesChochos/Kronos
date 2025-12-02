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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  ExternalLink,
  Edit2,
  Users,
  Briefcase
} from "lucide-react";
import { useCurrentUser, useDeals } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

type Investor = {
  id: string;
  name: string;
  firm: string;
  type: 'PE' | 'VC' | 'Strategic' | 'Family Office' | 'Hedge Fund' | 'Sovereign Wealth';
  email: string;
  phone: string;
  location: string;
  sectors: string[];
  minDealSize: number;
  maxDealSize: number;
  status: 'Active' | 'Warm' | 'Cold' | 'Inactive';
  lastContact: Date;
  dealsParticipated: number;
  relationshipScore: number;
  notes: string;
  interactions: { date: Date; type: string; summary: string }[];
};

const demoInvestors: Investor[] = [
  {
    id: '1',
    name: 'Michael Roberts',
    firm: 'Blackstone',
    type: 'PE',
    email: 'mroberts@blackstone.com',
    phone: '+1 (212) 555-0101',
    location: 'New York, NY',
    sectors: ['Technology', 'Healthcare', 'Financial Services'],
    minDealSize: 100,
    maxDealSize: 500,
    status: 'Active',
    lastContact: subDays(new Date(), 3),
    dealsParticipated: 4,
    relationshipScore: 95,
    notes: 'Key relationship, very responsive',
    interactions: [
      { date: subDays(new Date(), 3), type: 'Meeting', summary: 'Discussed TechCorp opportunity' },
      { date: subDays(new Date(), 14), type: 'Call', summary: 'Quarterly check-in' },
    ]
  },
  {
    id: '2',
    name: 'Sarah Chen',
    firm: 'Sequoia Capital',
    type: 'VC',
    email: 'schen@sequoia.com',
    phone: '+1 (650) 555-0102',
    location: 'Menlo Park, CA',
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    minDealSize: 20,
    maxDealSize: 100,
    status: 'Active',
    lastContact: subDays(new Date(), 7),
    dealsParticipated: 2,
    relationshipScore: 88,
    notes: 'Focus on early-stage tech',
    interactions: [
      { date: subDays(new Date(), 7), type: 'Email', summary: 'Sent FinServe pitch deck' },
    ]
  },
  {
    id: '3',
    name: 'James Wilson',
    firm: 'KKR',
    type: 'PE',
    email: 'jwilson@kkr.com',
    phone: '+1 (212) 555-0103',
    location: 'New York, NY',
    sectors: ['Consumer', 'Retail', 'Manufacturing'],
    minDealSize: 50,
    maxDealSize: 300,
    status: 'Warm',
    lastContact: subDays(new Date(), 21),
    dealsParticipated: 1,
    relationshipScore: 72,
    notes: 'Prefers operational turnarounds',
    interactions: []
  },
  {
    id: '4',
    name: 'Emily Thompson',
    firm: 'First Round Capital',
    type: 'VC',
    email: 'ethompson@firstround.com',
    phone: '+1 (415) 555-0104',
    location: 'San Francisco, CA',
    sectors: ['Technology', 'Consumer Tech'],
    minDealSize: 5,
    maxDealSize: 25,
    status: 'Active',
    lastContact: subDays(new Date(), 5),
    dealsParticipated: 3,
    relationshipScore: 90,
    notes: 'Strong network, quick decisions',
    interactions: [
      { date: subDays(new Date(), 5), type: 'Meeting', summary: 'Portfolio company intro' },
    ]
  },
  {
    id: '5',
    name: 'David Park',
    firm: 'Andreessen Horowitz',
    type: 'VC',
    email: 'dpark@a16z.com',
    phone: '+1 (650) 555-0105',
    location: 'Menlo Park, CA',
    sectors: ['Technology', 'Fintech', 'Crypto'],
    minDealSize: 10,
    maxDealSize: 150,
    status: 'Warm',
    lastContact: subDays(new Date(), 14),
    dealsParticipated: 0,
    relationshipScore: 65,
    notes: 'Looking to expand PE investments',
    interactions: []
  },
];

const statusColors: Record<string, string> = {
  'Active': 'bg-green-500',
  'Warm': 'bg-yellow-500',
  'Cold': 'bg-blue-500',
  'Inactive': 'bg-gray-500',
};

export default function InvestorCRM() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  
  const [investors, setInvestors] = useState<Investor[]>(demoInvestors);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'Call', summary: '' });

  const filteredInvestors = useMemo(() => {
    return investors.filter(inv => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!inv.name.toLowerCase().includes(query) && 
            !inv.firm.toLowerCase().includes(query) &&
            !inv.sectors.some(s => s.toLowerCase().includes(query))) {
          return false;
        }
      }
      if (filterType !== 'all' && inv.type !== filterType) return false;
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      return true;
    });
  }, [investors, searchQuery, filterType, filterStatus]);

  const stats = useMemo(() => ({
    total: investors.length,
    active: investors.filter(i => i.status === 'Active').length,
    avgScore: Math.round(investors.reduce((sum, i) => sum + i.relationshipScore, 0) / investors.length),
    recentContacts: investors.filter(i => {
      const daysSince = Math.floor((new Date().getTime() - i.lastContact.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince <= 7;
    }).length,
  }), [investors]);

  const handleAddInteraction = () => {
    if (!selectedInvestor || !newInteraction.summary) return;
    
    const updatedInvestors = investors.map(inv => {
      if (inv.id === selectedInvestor.id) {
        return {
          ...inv,
          lastContact: new Date(),
          interactions: [
            { date: new Date(), type: newInteraction.type, summary: newInteraction.summary },
            ...inv.interactions,
          ],
        };
      }
      return inv;
    });
    
    setInvestors(updatedInvestors);
    setSelectedInvestor({
      ...selectedInvestor,
      lastContact: new Date(),
      interactions: [
        { date: new Date(), type: newInteraction.type, summary: newInteraction.summary },
        ...selectedInvestor.interactions,
      ],
    });
    setShowAddInteraction(false);
    setNewInteraction({ type: 'Call', summary: '' });
  };

  return (
    <Layout role="CEO" pageTitle="Investor CRM" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Investor CRM
            </h1>
            <p className="text-muted-foreground">Manage investor relationships and interactions</p>
          </div>
          <Button data-testid="button-add-investor">
            <Plus className="w-4 h-4 mr-2" />
            Add Investor
          </Button>
        </div>

        {/* Stats */}
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
          {/* Investor List */}
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
              <ScrollArea className="h-[600px]">
                <div className="p-2 space-y-2">
                  {filteredInvestors.map(investor => (
                    <button
                      key={investor.id}
                      onClick={() => setSelectedInvestor(investor)}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-colors",
                        selectedInvestor?.id === investor.id 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:bg-secondary/50"
                      )}
                      data-testid={`investor-card-${investor.id}`}
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
                        <div className={cn("w-2 h-2 rounded-full", statusColors[investor.status])} />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">{investor.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Score: {investor.relationshipScore}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Investor Details */}
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
                          <Badge className={cn("text-white", statusColors[selectedInvestor.status])}>
                            {selectedInvestor.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowAddInteraction(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Log Interaction
                    </Button>
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
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="w-4 h-4" /> Email
                            </p>
                            <p className="font-medium">{selectedInvestor.email}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Phone className="w-4 h-4" /> Phone
                            </p>
                            <p className="font-medium">{selectedInvestor.phone}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <MapPin className="w-4 h-4" /> Location
                            </p>
                            <p className="font-medium">{selectedInvestor.location}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <DollarSign className="w-4 h-4" /> Deal Size Range
                            </p>
                            <p className="font-medium">${selectedInvestor.minDealSize}M - ${selectedInvestor.maxDealSize}M</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Building className="w-4 h-4" /> Sectors
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedInvestor.sectors.map(sector => (
                                <Badge key={sector} variant="outline" className="text-xs">{sector}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Clock className="w-4 h-4" /> Last Contact
                            </p>
                            <p className="font-medium">{format(selectedInvestor.lastContact, 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-4 rounded-lg bg-secondary/30">
                        <p className="text-sm text-muted-foreground mb-2">Notes</p>
                        <p>{selectedInvestor.notes}</p>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-primary" />
                            <span className="text-sm text-muted-foreground">Relationship Score</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedInvestor.relationshipScore}/100</p>
                        </div>
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-green-500" />
                            <span className="text-sm text-muted-foreground">Deals Participated</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedInvestor.dealsParticipated}</p>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="interactions" className="mt-4">
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {selectedInvestor.interactions.map((interaction, idx) => (
                            <div key={idx} className="p-3 rounded-lg border border-border">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary">{interaction.type}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(interaction.date, 'MMM d, yyyy')}
                                </span>
                              </div>
                              <p className="mt-2 text-sm">{interaction.summary}</p>
                            </div>
                          ))}
                          {selectedInvestor.interactions.length === 0 && (
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

      {/* Add Interaction Dialog */}
      <Dialog open={showAddInteraction} onOpenChange={setShowAddInteraction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newInteraction.type} onValueChange={(v) => setNewInteraction(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
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
              <Label>Summary</Label>
              <Textarea
                placeholder="Describe the interaction..."
                value={newInteraction.summary}
                onChange={(e) => setNewInteraction(prev => ({ ...prev, summary: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInteraction(false)}>Cancel</Button>
            <Button onClick={handleAddInteraction}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
