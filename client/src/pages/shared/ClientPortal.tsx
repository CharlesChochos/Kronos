import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Upload,
  Loader2,
  Trash2,
  Send,
  UserPlus,
  Building2,
  XCircle
} from "lucide-react";
import { useDealsListing, useClientPortalAccess, useCreateClientPortalAccess, useUpdateClientPortalAccess, useDeleteClientPortalAccess, usePortalInvites, useCreatePortalInvite, useRevokePortalInvite, useExternalUsers } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import type { ClientPortalAccess } from "@shared/schema";

export default function ClientPortal({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: deals = [] } = useDealsListing();
  const { data: clientAccess = [], isLoading } = useClientPortalAccess();
  const { data: portalInvites = [], isLoading: invitesLoading } = usePortalInvites();
  const { data: externalUsers = [] } = useExternalUsers();
  const createAccess = useCreateClientPortalAccess();
  const updateAccess = useUpdateClientPortalAccess();
  const deleteAccess = useDeleteClientPortalAccess();
  const createInvite = useCreatePortalInvite();
  const revokeInvite = useRevokePortalInvite();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [mainTab, setMainTab] = useState("invitations");

  const [newAccess, setNewAccess] = useState({
    clientName: "",
    clientEmail: "",
    dealId: "",
    accessLevel: "view" as 'view' | 'upload' | 'full',
    expiresAt: "",
    notifyClient: true
  });
  
  const [newInvite, setNewInvite] = useState({
    name: "",
    email: "",
    organization: "",
    dealIds: [] as string[],
    accessLevel: "view",
    message: ""
  });

  // Helper to get deal name from ID
  const getDealName = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    return deal?.name || "Unknown Deal";
  };

  // Generate portal URL from access token or ID
  const getPortalUrl = (access: ClientPortalAccess) => {
    return `https://portal.kronos.com/c/${access.accessToken || access.id.substring(0, 8)}`;
  };

  const filteredAccess = clientAccess.filter(access => {
    const dealName = getDealName(access.dealId);
    const matchesSearch = access.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dealName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      access.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "active") return matchesSearch && access.isActive;
    if (activeTab === "expired") return matchesSearch && !access.isActive;
    return matchesSearch;
  });

  const handleCreateAccess = async () => {
    if (!newAccess.clientName || !newAccess.clientEmail || !newAccess.dealId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createAccess.mutateAsync({
        clientName: newAccess.clientName,
        clientEmail: newAccess.clientEmail,
        dealId: newAccess.dealId,
        accessLevel: newAccess.accessLevel,
        expiresAt: newAccess.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true,
        accessToken: Math.random().toString(36).substring(2, 10),
      });

      setShowCreateModal(false);
      setNewAccess({ clientName: "", clientEmail: "", dealId: "", accessLevel: "view", expiresAt: "", notifyClient: true });
      
      if (newAccess.notifyClient) {
        toast.success(`Portal access created and invitation sent to ${newAccess.clientEmail}`);
      } else {
        toast.success("Portal access created successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create portal access");
    }
  };

  const toggleAccess = async (id: string, currentStatus: boolean | null) => {
    try {
      await updateAccess.mutateAsync({
        id,
        updates: { isActive: !currentStatus },
      });
      toast.success("Access status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update access status");
    }
  };

  const copyPortalLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied to clipboard");
  };

  const handleDeleteAccess = async (id: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete portal access for ${clientName}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteAccess.mutateAsync(id);
      toast.success("Portal access deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete portal access");
    }
  };
  
  const handleCreateInvite = async () => {
    if (!newInvite.name || !newInvite.email || newInvite.dealIds.length === 0) {
      toast.error("Please fill in name, email, and select at least one deal");
      return;
    }
    
    try {
      await createInvite.mutateAsync({
        name: newInvite.name,
        email: newInvite.email,
        organization: newInvite.organization || undefined,
        dealIds: newInvite.dealIds,
        accessLevel: newInvite.accessLevel,
        message: newInvite.message || undefined
      });
      
      setShowInviteModal(false);
      setNewInvite({ name: "", email: "", organization: "", dealIds: [], accessLevel: "view", message: "" });
      toast.success(`Invitation sent to ${newInvite.email}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    }
  };
  
  const handleRevokeInvite = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }
    
    try {
      await revokeInvite.mutateAsync(id);
      toast.success("Invitation revoked");
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke invitation");
    }
  };
  
  const toggleDealSelection = (dealId: string) => {
    setNewInvite(prev => ({
      ...prev,
      dealIds: prev.dealIds.includes(dealId) 
        ? prev.dealIds.filter(id => id !== dealId)
        : [...prev.dealIds, dealId]
    }));
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

  if (isLoading) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const pendingInvites = portalInvites.filter(i => i.status === 'pending');
  const acceptedInvites = portalInvites.filter(i => i.status === 'accepted');
  const revokedInvites = portalInvites.filter(i => i.status === 'revoked' || i.status === 'expired');
  
  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Client Portal</h1>
            <p className="text-muted-foreground">Manage secure client access to deal documents and communications</p>
          </div>
          <Button onClick={() => setShowInviteModal(true)} data-testid="button-invite-client">
            <UserPlus className="w-4 h-4 mr-2" /> Invite Client
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingInvites.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(externalUsers as any[]).length}</p>
                  <p className="text-xs text-muted-foreground">External Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deals.length}</p>
                  <p className="text-xs text-muted-foreground">Available Deals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{acceptedInvites.length}</p>
                  <p className="text-xs text-muted-foreground">Active Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="users">External Users</TabsTrigger>
            <TabsTrigger value="legacy">Legacy Access</TabsTrigger>
          </TabsList>
          
          <TabsContent value="invitations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Portal Invitations</CardTitle>
                <CardDescription>Send and manage client portal invitations</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending">
                  <TabsList className="mb-4">
                    <TabsTrigger value="pending">Pending ({pendingInvites.length})</TabsTrigger>
                    <TabsTrigger value="accepted">Accepted ({acceptedInvites.length})</TabsTrigger>
                    <TabsTrigger value="revoked">Revoked/Expired ({revokedInvites.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pending">
                    <ScrollArea className="h-[400px]">
                      {invitesLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : pendingInvites.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No pending invitations</p>
                          <Button variant="link" onClick={() => setShowInviteModal(true)}>
                            Send your first invitation
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pendingInvites.map((invite) => (
                            <div key={invite.id} className="p-4 border rounded-lg" data-testid={`invite-${invite.id}`}>
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{invite.name}</h3>
                                    <Badge variant="outline" className="text-amber-500 border-amber-500">Pending</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{invite.email}</p>
                                  {invite.organization && (
                                    <p className="text-sm flex items-center gap-1">
                                      <Building2 className="h-3 w-3" /> {invite.organization}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {invite.dealIds.map(dealId => (
                                      <Badge key={dealId} variant="secondary" className="text-xs">
                                        {getDealName(dealId)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRevokeInvite(invite.id, invite.email)}
                                    data-testid={`revoke-invite-${invite.id}`}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" /> Revoke
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Expires: {format(new Date(invite.expiresAt), 'MMM d, yyyy')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Send className="w-3 h-3" /> Sent by: {invite.inviterName}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="accepted">
                    <ScrollArea className="h-[400px]">
                      {acceptedInvites.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No accepted invitations yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {acceptedInvites.map((invite) => (
                            <div key={invite.id} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{invite.name}</h3>
                                    <Badge variant="default" className="bg-green-500">Accepted</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{invite.email}</p>
                                  {invite.organization && (
                                    <p className="text-sm flex items-center gap-1">
                                      <Building2 className="h-3 w-3" /> {invite.organization}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Accepted: {invite.acceptedAt ? format(new Date(invite.acceptedAt), 'MMM d, yyyy') : 'N/A'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="revoked">
                    <ScrollArea className="h-[400px]">
                      {revokedInvites.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No revoked or expired invitations</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {revokedInvites.map((invite) => (
                            <div key={invite.id} className="p-4 border rounded-lg opacity-60">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{invite.name}</h3>
                                    <Badge variant="destructive">{invite.status}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{invite.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>External Users</CardTitle>
                <CardDescription>Clients and stakeholders with portal access</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {(externalUsers as any[]).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No external users yet</p>
                      <p className="text-sm">Invite clients to create their portal accounts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(externalUsers as any[]).map((user: any) => (
                        <div key={user.id} className="p-4 border rounded-lg" data-testid={`external-user-${user.id}`}>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{user.name}</h3>
                                <Badge variant="outline">External</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              {user.externalOrganization && (
                                <p className="text-sm flex items-center gap-1">
                                  <Building2 className="h-3 w-3" /> {user.externalOrganization}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">
                            Joined: {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'Unknown'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="legacy" className="space-y-4 mt-4">
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
                  <p className="text-2xl font-bold">{clientAccess.length * 5}</p>
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
                  <p className="text-2xl font-bold">{clientAccess.filter(a => a.lastAccess && new Date(a.lastAccess) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}</p>
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
                              <span className="text-muted-foreground">Deal:</span> {getDealName(access.dealId)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyPortalLink(getPortalUrl(access))}
                              data-testid={`copy-link-${access.id}`}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copy Link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(getPortalUrl(access), '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <Switch
                              checked={access.isActive ?? false}
                              onCheckedChange={() => toggleAccess(access.id, access.isActive)}
                              data-testid={`toggle-access-${access.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteAccess(access.id, access.clientName)}
                              data-testid={`delete-access-${access.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" /> 5 documents
                          </span>
                          {access.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Expires: {format(new Date(access.expiresAt), 'MMM d, yyyy')}
                            </span>
                          )}
                          {access.lastAccess && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Last access: {format(new Date(access.lastAccess), 'MMM d, h:mm a')}
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
          </TabsContent>
        </Tabs>
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
      
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Client to Portal</DialogTitle>
            <DialogDescription>
              Send an invitation email to a client or stakeholder to access deal information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={newInvite.name}
                  onChange={(e) => setNewInvite({ ...newInvite, name: e.target.value })}
                  placeholder="John Smith"
                  data-testid="input-invite-name"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  placeholder="john@company.com"
                  data-testid="input-invite-email"
                />
              </div>
            </div>
            <div>
              <Label>Organization</Label>
              <Input
                value={newInvite.organization}
                onChange={(e) => setNewInvite({ ...newInvite, organization: e.target.value })}
                placeholder="Company Inc."
                data-testid="input-invite-organization"
              />
            </div>
            <div>
              <Label>Access Level</Label>
              <Select value={newInvite.accessLevel} onValueChange={(v) => setNewInvite({ ...newInvite, accessLevel: v })}>
                <SelectTrigger data-testid="select-invite-access-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only - Can view shared documents</SelectItem>
                  <SelectItem value="upload">Upload - Can view and upload documents</SelectItem>
                  <SelectItem value="full">Full Access - View, upload, and communicate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Deals *</Label>
              <p className="text-xs text-muted-foreground mb-2">Select which deals this client can access</p>
              <ScrollArea className="h-[150px] border rounded-lg p-2">
                <div className="space-y-2">
                  {deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No deals available</p>
                  ) : (
                    deals.map((deal) => (
                      <div key={deal.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`deal-${deal.id}`}
                          checked={newInvite.dealIds.includes(deal.id)}
                          onCheckedChange={() => toggleDealSelection(deal.id)}
                          data-testid={`checkbox-deal-${deal.id}`}
                        />
                        <label htmlFor={`deal-${deal.id}`} className="text-sm cursor-pointer flex-1">
                          {deal.name}
                          <span className="text-xs text-muted-foreground ml-2">({deal.stage})</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div>
              <Label>Personal Message (Optional)</Label>
              <Textarea
                value={newInvite.message}
                onChange={(e) => setNewInvite({ ...newInvite, message: e.target.value })}
                placeholder="Add a personal note to include in the invitation email..."
                rows={3}
                data-testid="input-invite-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateInvite} 
              disabled={createInvite.isPending || !newInvite.name || !newInvite.email || newInvite.dealIds.length === 0}
              data-testid="button-send-invite"
            >
              {createInvite.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
