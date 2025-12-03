import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Plus, 
  Search, 
  Building,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Briefcase,
  Star,
  StarOff,
  Pencil,
  Trash2,
  ExternalLink,
  Calendar
} from "lucide-react";
import { useDeals } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SHARED_INVESTORS } from "@/lib/investors";

type Stakeholder = {
  id: string;
  name: string;
  title: string;
  company: string;
  type: 'investor' | 'advisor' | 'legal' | 'banker' | 'consultant' | 'client' | 'other';
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  notes?: string;
  deals: string[];
  isFavorite: boolean;
  lastContact?: string;
  createdAt: string;
};

const DEFAULT_CUSTOM_STAKEHOLDERS: Stakeholder[] = [
  {
    id: "2",
    name: "Jennifer Wu",
    title: "Partner",
    company: "Kirkland & Ellis",
    type: "legal",
    email: "jwu@kirkland.com",
    phone: "+1 212-555-0456",
    linkedin: "https://linkedin.com/in/jenniferwu",
    location: "New York, NY",
    notes: "Specializes in M&A transactions. Excellent track record on cross-border deals.",
    deals: ["deal-1"],
    isFavorite: true,
    lastContact: "2024-12-01T14:30:00Z",
    createdAt: "2024-03-20T00:00:00Z"
  },
  {
    id: "3",
    name: "David Thompson",
    title: "Senior Advisor",
    company: "McKinsey & Company",
    type: "consultant",
    email: "david_thompson@mckinsey.com",
    phone: "+1 415-555-0789",
    location: "San Francisco, CA",
    notes: "Healthcare sector specialist. Previously led operational DD for multiple portfolio companies.",
    deals: ["deal-3"],
    isFavorite: false,
    lastContact: "2024-11-15T09:00:00Z",
    createdAt: "2024-08-10T00:00:00Z"
  },
  {
    id: "4",
    name: "Sarah Goldstein",
    title: "Managing Director",
    company: "Goldman Sachs",
    type: "banker",
    email: "sarah.goldstein@gs.com",
    phone: "+1 212-555-0321",
    linkedin: "https://linkedin.com/in/sarahgoldstein",
    website: "https://goldmansachs.com",
    location: "New York, NY",
    notes: "Technology M&A coverage. Has done multiple deals in our sector.",
    deals: ["deal-2", "deal-3"],
    isFavorite: false,
    lastContact: "2024-11-20T16:00:00Z",
    createdAt: "2024-05-01T00:00:00Z"
  },
  {
    id: "5",
    name: "Michael Chen",
    title: "CEO",
    company: "TechCorp Industries",
    type: "client",
    email: "mchen@techcorp.com",
    phone: "+1 408-555-0654",
    linkedin: "https://linkedin.com/in/michaelchen",
    location: "San Jose, CA",
    notes: "Primary contact for TechCorp acquisition. Very hands-on and detail-oriented.",
    deals: ["deal-1"],
    isFavorite: true,
    lastContact: "2024-12-02T11:00:00Z",
    createdAt: "2024-09-01T00:00:00Z"
  },
  {
    id: "6",
    name: "Lisa Park",
    title: "Board Advisor",
    company: "Independent",
    type: "advisor",
    email: "lisa@lisapark.com",
    linkedin: "https://linkedin.com/in/lisapark",
    location: "Boston, MA",
    notes: "Former CFO of multiple tech companies. Great for financial diligence guidance.",
    deals: [],
    isFavorite: false,
    createdAt: "2024-07-15T00:00:00Z"
  }
];

export default function StakeholderDirectory({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: deals = [] } = useDeals();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const investorStakeholders: Stakeholder[] = useMemo(() => SHARED_INVESTORS.map((inv) => ({
    id: `inv-${inv.id}`,
    name: inv.name,
    title: inv.type,
    company: inv.name,
    type: 'investor' as const,
    email: inv.email,
    phone: inv.phone,
    website: inv.website,
    location: inv.focus,
    notes: `${inv.type} | Check size: ${inv.checkSize} | Focus: ${inv.focus} | Tags: ${inv.tags.join(', ')}`,
    deals: [],
    isFavorite: inv.matchScore >= 90,
    createdAt: "2024-01-01T00:00:00Z"
  })), []);

  const [customStakeholders, setCustomStakeholders] = useState<Stakeholder[]>(() => {
    const saved = localStorage.getItem('osreaper_stakeholders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CUSTOM_STAKEHOLDERS;
      }
    }
    return DEFAULT_CUSTOM_STAKEHOLDERS;
  });

  useEffect(() => {
    localStorage.setItem('osreaper_stakeholders', JSON.stringify(customStakeholders));
  }, [customStakeholders]);

  const stakeholders = useMemo(() => [...investorStakeholders, ...customStakeholders], [investorStakeholders, customStakeholders]);
  
  const setStakeholders = (newStakeholders: Stakeholder[] | ((prev: Stakeholder[]) => Stakeholder[])) => {
    if (typeof newStakeholders === 'function') {
      setCustomStakeholders((prev) => {
        const allStakeholders = [...investorStakeholders, ...prev];
        const updated = newStakeholders(allStakeholders);
        return updated.filter(s => !s.id.startsWith('inv-'));
      });
    } else {
      setCustomStakeholders(newStakeholders.filter(s => !s.id.startsWith('inv-')));
    }
  };

  const [newStakeholder, setNewStakeholder] = useState({
    name: "",
    title: "",
    company: "",
    type: "investor" as Stakeholder['type'],
    email: "",
    phone: "",
    linkedin: "",
    website: "",
    location: "",
    notes: ""
  });

  const typeColors: Record<string, string> = {
    investor: "bg-green-500",
    advisor: "bg-blue-500",
    legal: "bg-purple-500",
    banker: "bg-yellow-500",
    consultant: "bg-orange-500",
    client: "bg-red-500",
    other: "bg-gray-500"
  };

  const filteredStakeholders = stakeholders.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "favorites") return matchesSearch && s.isFavorite;
    return matchesSearch && s.type === activeTab;
  });

  const handleCreateStakeholder = () => {
    if (!newStakeholder.name || !newStakeholder.company) {
      toast.error("Please fill in required fields");
      return;
    }

    const stakeholder: Stakeholder = {
      id: Date.now().toString(),
      ...newStakeholder,
      deals: [],
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    setStakeholders([stakeholder, ...stakeholders]);
    setShowCreateModal(false);
    setNewStakeholder({
      name: "", title: "", company: "", type: "investor",
      email: "", phone: "", linkedin: "", website: "", location: "", notes: ""
    });
    toast.success("Stakeholder added to directory");
  };

  const toggleFavorite = (id: string) => {
    setStakeholders(stakeholders.map(s =>
      s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
    ));
  };

  const deleteStakeholder = (id: string) => {
    setStakeholders(stakeholders.filter(s => s.id !== id));
    toast.success("Stakeholder removed");
  };

  const getTypeCounts = () => {
    const counts: Record<string, number> = {};
    stakeholders.forEach(s => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });
    return counts;
  };

  const typeCounts = getTypeCounts();

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">External Stakeholder Directory</h1>
            <p className="text-muted-foreground">Manage contacts for investors, advisors, legal counsel, and more</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-add-stakeholder">
            <Plus className="w-4 h-4 mr-2" /> Add Stakeholder
          </Button>
        </div>

        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stakeholders.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(typeColors).slice(0, 5).map(([type, color]) => (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", color.replace("bg-", "bg-") + "/10")}>
                    <Building className={cn("w-5 h-5", color.replace("bg-", "text-"))} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{typeCounts[type] || 0}</p>
                    <p className="text-xs text-muted-foreground capitalize">{type}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Directory</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search stakeholders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-stakeholders"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="all">All ({stakeholders.length})</TabsTrigger>
                <TabsTrigger value="favorites">
                  <Star className="w-3 h-3 mr-1" /> Favorites ({stakeholders.filter(s => s.isFavorite).length})
                </TabsTrigger>
                <TabsTrigger value="investor">Investors</TabsTrigger>
                <TabsTrigger value="legal">Legal</TabsTrigger>
                <TabsTrigger value="banker">Bankers</TabsTrigger>
                <TabsTrigger value="advisor">Advisors</TabsTrigger>
                <TabsTrigger value="client">Clients</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-[450px]">
                  <div className="grid grid-cols-2 gap-4">
                    {filteredStakeholders.map((stakeholder) => (
                      <Card key={stakeholder.id} className="hover:border-primary/50 transition-colors" data-testid={`stakeholder-${stakeholder.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                <AvatarFallback className={cn("text-white", typeColors[stakeholder.type])}>
                                  {stakeholder.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{stakeholder.name}</h3>
                                  <button onClick={() => toggleFavorite(stakeholder.id)} className="hover:opacity-80">
                                    {stakeholder.isFavorite ? (
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    ) : (
                                      <StarOff className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-muted-foreground">{stakeholder.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    <Building className="w-3 h-3 mr-1" /> {stakeholder.company}
                                  </Badge>
                                  <Badge className={cn("text-white text-xs", typeColors[stakeholder.type])}>
                                    {stakeholder.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 text-sm mb-3">
                            {stakeholder.email && (
                              <a href={`mailto:${stakeholder.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                                <Mail className="w-3 h-3" /> {stakeholder.email}
                              </a>
                            )}
                            {stakeholder.phone && (
                              <a href={`tel:${stakeholder.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                                <Phone className="w-3 h-3" /> {stakeholder.phone}
                              </a>
                            )}
                            {stakeholder.location && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-3 h-3" /> {stakeholder.location}
                              </p>
                            )}
                          </div>

                          {stakeholder.notes && (
                            <p className="text-xs text-muted-foreground p-2 bg-secondary/30 rounded mb-3 line-clamp-2">
                              {stakeholder.notes}
                            </p>
                          )}

                          {stakeholder.deals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {stakeholder.deals.map(dealId => {
                                const deal = deals.find(d => d.id === dealId);
                                return deal ? (
                                  <Badge key={dealId} variant="outline" className="text-[10px]">
                                    <Briefcase className="w-2 h-2 mr-1" /> {deal.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex gap-1">
                              {stakeholder.linkedin && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={stakeholder.linkedin} target="_blank" rel="noopener noreferrer">
                                    <Linkedin className="w-3 h-3" />
                                  </a>
                                </Button>
                              )}
                              {stakeholder.website && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={stakeholder.website} target="_blank" rel="noopener noreferrer">
                                    <Globe className="w-3 h-3" />
                                  </a>
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedStakeholder(stakeholder); setShowEditModal(true); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteStakeholder(stakeholder.id)} className="text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {stakeholder.lastContact && (
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Last contact: {format(new Date(stakeholder.lastContact), 'MMM d, yyyy')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {filteredStakeholders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No stakeholders found
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Stakeholder</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={selectedStakeholder?.name || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Full name"
                    data-testid="input-edit-stakeholder-name"
                  />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={selectedStakeholder?.title || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder="Job title"
                    data-testid="input-edit-stakeholder-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company *</Label>
                  <Input
                    value={selectedStakeholder?.company || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, company: e.target.value } : null)}
                    placeholder="Company name"
                    data-testid="input-edit-stakeholder-company"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={selectedStakeholder?.type || 'investor'} onValueChange={(v: any) => setSelectedStakeholder(prev => prev ? { ...prev, type: v } : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="legal">Legal Counsel</SelectItem>
                      <SelectItem value="banker">Banker</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={selectedStakeholder?.email || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="email@example.com"
                    data-testid="input-edit-stakeholder-email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={selectedStakeholder?.phone || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    placeholder="+1 555-000-0000"
                    data-testid="input-edit-stakeholder-phone"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={selectedStakeholder?.location || ''}
                  onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, location: e.target.value } : null)}
                  placeholder="City, State"
                  data-testid="input-edit-stakeholder-location"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={selectedStakeholder?.linkedin || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, linkedin: e.target.value } : null)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={selectedStakeholder?.website || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, website: e.target.value } : null)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={selectedStakeholder?.notes || ''}
                  onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                  data-testid="input-edit-stakeholder-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={() => {
              if (selectedStakeholder) {
                setStakeholders(stakeholders.map(s => s.id === selectedStakeholder.id ? selectedStakeholder : s));
                toast.success("Stakeholder updated");
                setShowEditModal(false);
              }
            }} data-testid="button-save-stakeholder">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Stakeholder</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newStakeholder.name}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                    placeholder="Full name"
                    data-testid="input-stakeholder-name"
                  />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newStakeholder.title}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, title: e.target.value })}
                    placeholder="Job title"
                    data-testid="input-stakeholder-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company *</Label>
                  <Input
                    value={newStakeholder.company}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, company: e.target.value })}
                    placeholder="Company name"
                    data-testid="input-stakeholder-company"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newStakeholder.type} onValueChange={(v: any) => setNewStakeholder({ ...newStakeholder, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="legal">Legal Counsel</SelectItem>
                      <SelectItem value="banker">Banker</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newStakeholder.email}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-stakeholder-email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newStakeholder.phone}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, phone: e.target.value })}
                    placeholder="+1 555-000-0000"
                    data-testid="input-stakeholder-phone"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={newStakeholder.location}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, location: e.target.value })}
                  placeholder="City, State"
                  data-testid="input-stakeholder-location"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={newStakeholder.linkedin}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={newStakeholder.website}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newStakeholder.notes}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                  data-testid="input-stakeholder-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateStakeholder} data-testid="button-submit-stakeholder">Add Stakeholder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
