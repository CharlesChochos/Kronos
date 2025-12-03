import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  Plus, 
  Search, 
  Link2, 
  Mail, 
  Eye, 
  EyeOff,
  FileText,
  Clock,
  CheckCircle,
  Shield,
  ExternalLink,
  Copy,
  Settings,
  Bell,
  Download,
  Upload
} from "lucide-react";
import { useDeals } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

type ClientPortalAccess = {
  id: string;
  clientName: string;
  clientEmail: string;
  dealId: string;
  dealName: string;
  accessLevel: 'view' | 'upload' | 'full';
  portalUrl: string;
  expiresAt: string;
  isActive: boolean;
  lastAccessed: string | null;
  documentsShared: number;
  createdAt: string;
};

const DEFAULT_CLIENT_ACCESS: ClientPortalAccess[] = [
  {
    id: "1",
    clientName: "TechVentures LLC",
    clientEmail: "john@techventures.com",
    dealId: "deal-1",
    dealName: "TechCorp Acquisition",
    accessLevel: "view",
    portalUrl: "https://portal.osreaper.com/c/abc123",
    expiresAt: "2025-01-15",
    isActive: true,
    lastAccessed: "2024-12-01T14:30:00Z",
    documentsShared: 12,
    createdAt: "2024-11-15T10:00:00Z"
  },
  {
    id: "2",
    clientName: "Growth Partners",
    clientEmail: "sarah@growthpartners.co",
    dealId: "deal-2",
    dealName: "FinServ Merger",
    accessLevel: "upload",
    portalUrl: "https://portal.osreaper.com/c/def456",
    expiresAt: "2025-02-01",
    isActive: true,
    lastAccessed: "2024-12-02T09:15:00Z",
    documentsShared: 8,
    createdAt: "2024-11-20T14:00:00Z"
  },
  {
    id: "3",
    clientName: "Alpha Holdings",
    clientEmail: "mike@alphaholdings.com",
    dealId: "deal-3",
    dealName: "Healthcare Divestiture",
    accessLevel: "full",
    portalUrl: "https://portal.osreaper.com/c/ghi789",
    expiresAt: "2024-11-30",
    isActive: false,
    lastAccessed: "2024-11-28T16:45:00Z",
    documentsShared: 24,
    createdAt: "2024-10-01T08:00:00Z"
  }
];

export default function ClientPortal({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: deals = [] } = useDeals();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const [clientAccess, setClientAccess] = useState<ClientPortalAccess[]>(() => {
    const saved = localStorage.getItem('osreaper_client_access');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CLIENT_ACCESS;
      }
    }
    return DEFAULT_CLIENT_ACCESS;
  });

  useEffect(() => {
    localStorage.setItem('osreaper_client_access', JSON.stringify(clientAccess));
  }, [clientAccess]);

  const [newAccess, setNewAccess] = useState({
    clientName: "",
    clientEmail: "",
    dealId: "",
    accessLevel: "view" as 'view' | 'upload' | 'full',
    expiresAt: "",
    notifyClient: true
  });

  const filteredAccess = clientAccess.filter(access => {
    const matchesSearch = access.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      access.dealName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      access.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "active") return matchesSearch && access.isActive;
    if (activeTab === "expired") return matchesSearch && !access.isActive;
    return matchesSearch;
  });

  const handleCreateAccess = () => {
    if (!newAccess.clientName || !newAccess.clientEmail || !newAccess.dealId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const deal = deals.find(d => d.id === newAccess.dealId);
    const newPortalAccess: ClientPortalAccess = {
      id: Date.now().toString(),
      clientName: newAccess.clientName,
      clientEmail: newAccess.clientEmail,
      dealId: newAccess.dealId,
      dealName: deal?.name || "Unknown Deal",
      accessLevel: newAccess.accessLevel,
      portalUrl: `https://portal.osreaper.com/c/${Math.random().toString(36).substring(7)}`,
      expiresAt: newAccess.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      lastAccessed: null,
      documentsShared: 0,
      createdAt: new Date().toISOString()
    };

    setClientAccess([newPortalAccess, ...clientAccess]);
    setShowCreateModal(false);
    setNewAccess({ clientName: "", clientEmail: "", dealId: "", accessLevel: "view", expiresAt: "", notifyClient: true });
    
    if (newAccess.notifyClient) {
      toast.success(`Portal access created and invitation sent to ${newAccess.clientEmail}`);
    } else {
      toast.success("Portal access created successfully");
    }
  };

  const toggleAccess = (id: string) => {
    setClientAccess(clientAccess.map(access => 
      access.id === id ? { ...access, isActive: !access.isActive } : access
    ));
    toast.success("Access status updated");
  };

  const copyPortalLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied to clipboard");
  };

  const getAccessBadge = (level: string) => {
    switch (level) {
      case 'view':
        return <Badge variant="secondary"><Eye className="w-3 h-3 mr-1" /> View Only</Badge>;
      case 'upload':
        return <Badge variant="default"><Upload className="w-3 h-3 mr-1" /> Upload</Badge>;
      case 'full':
        return <Badge className="bg-green-500"><Shield className="w-3 h-3 mr-1" /> Full Access</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Client Portal</h1>
            <p className="text-muted-foreground">Manage secure client access to deal documents and communications</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-portal-access">
            <Plus className="w-4 h-4 mr-2" /> Create Portal Access
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientAccess.filter(a => a.isActive).length}</p>
                  <p className="text-xs text-muted-foreground">Active Portals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientAccess.reduce((sum, a) => sum + a.documentsShared, 0)}</p>
                  <p className="text-xs text-muted-foreground">Documents Shared</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientAccess.filter(a => a.lastAccessed && new Date(a.lastAccessed) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}</p>
                  <p className="text-xs text-muted-foreground">Accessed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <EyeOff className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientAccess.filter(a => !a.isActive).length}</p>
                  <p className="text-xs text-muted-foreground">Expired/Disabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Portal Access Management</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients or deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-portals"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active ({clientAccess.filter(a => a.isActive).length})</TabsTrigger>
                <TabsTrigger value="expired">Expired ({clientAccess.filter(a => !a.isActive).length})</TabsTrigger>
                <TabsTrigger value="all">All ({clientAccess.length})</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {filteredAccess.map((access) => (
                      <div
                        key={access.id}
                        className="p-4 border rounded-lg hover:bg-secondary/30 transition-colors"
                        data-testid={`portal-access-${access.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{access.clientName}</h3>
                              {getAccessBadge(access.accessLevel)}
                              {!access.isActive && <Badge variant="destructive">Disabled</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{access.clientEmail}</p>
                            <p className="text-sm">
                              <span className="text-muted-foreground">Deal:</span> {access.dealName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyPortalLink(access.portalUrl)}
                              data-testid={`copy-link-${access.id}`}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copy Link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(access.portalUrl, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={access.isActive}
                              onCheckedChange={() => toggleAccess(access.id)}
                              data-testid={`toggle-access-${access.id}`}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {access.documentsShared} documents
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Expires: {format(new Date(access.expiresAt), 'MMM d, yyyy')}
                          </span>
                          {access.lastAccessed && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Last access: {format(new Date(access.lastAccessed), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredAccess.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No portal access found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portal Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client Name *</Label>
              <Input
                value={newAccess.clientName}
                onChange={(e) => setNewAccess({ ...newAccess, clientName: e.target.value })}
                placeholder="Enter client name"
                data-testid="input-client-name"
              />
            </div>
            <div>
              <Label>Client Email *</Label>
              <Input
                type="email"
                value={newAccess.clientEmail}
                onChange={(e) => setNewAccess({ ...newAccess, clientEmail: e.target.value })}
                placeholder="client@example.com"
                data-testid="input-client-email"
              />
            </div>
            <div>
              <Label>Deal *</Label>
              <Select value={newAccess.dealId} onValueChange={(v) => setNewAccess({ ...newAccess, dealId: v })}>
                <SelectTrigger data-testid="select-deal">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access Level</Label>
              <Select value={newAccess.accessLevel} onValueChange={(v: any) => setNewAccess({ ...newAccess, accessLevel: v })}>
                <SelectTrigger data-testid="select-access-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only - Can view shared documents</SelectItem>
                  <SelectItem value="upload">Upload - Can view and upload documents</SelectItem>
                  <SelectItem value="full">Full Access - Can view, upload, and comment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expires On</Label>
              <Input
                type="date"
                value={newAccess.expiresAt}
                onChange={(e) => setNewAccess({ ...newAccess, expiresAt: e.target.value })}
                data-testid="input-expires-at"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newAccess.notifyClient}
                onCheckedChange={(checked) => setNewAccess({ ...newAccess, notifyClient: checked })}
              />
              <Label>Send invitation email to client</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateAccess} data-testid="button-submit-portal-access">Create Access</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
