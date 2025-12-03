import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useCurrentUser } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  DollarSign,
  Mail,
  Phone,
  Globe,
  Filter,
  Users,
  Linkedin,
} from "lucide-react";

type Investor = {
  id: string;
  name: string;
  firm: string;
  type: string;
  focus?: string;
  aum?: string;
  checkSize?: string;
  preferredStage?: string;
  location?: string;
  website?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  notes?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const investorTypes = [
  "Private Equity",
  "Venture Capital",
  "Strategic",
  "Family Office",
  "Hedge Fund",
  "Institutional",
  "Sovereign Wealth",
  "Corporate",
];

const focusOptions = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer",
  "Industrial",
  "Energy",
  "Real Estate",
  "Media & Entertainment",
  "Multi-sector",
];

const stageOptions = [
  "Seed",
  "Early Stage",
  "Growth",
  "Late Stage",
  "Buyout",
  "Distressed",
  "All Stages",
];

const emptyInvestor = {
  name: "",
  firm: "",
  type: "",
  focus: "Multi-sector",
  aum: "",
  checkSize: "",
  preferredStage: "",
  location: "",
  website: "",
  email: "",
  phone: "",
  linkedIn: "",
  notes: "",
};

export default function InvestorDatabase() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [formData, setFormData] = useState(emptyInvestor);

  const { data: investors = [], isLoading } = useQuery<Investor[]>({
    queryKey: ["/api/db-investors"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyInvestor) => {
      const response = await fetch("/api/db-investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create investor");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/db-investors"] });
      setShowAddDialog(false);
      setFormData(emptyInvestor);
      toast.success("Investor added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof emptyInvestor> }) => {
      const response = await fetch(`/api/db-investors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update investor");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/db-investors"] });
      setShowEditDialog(false);
      setSelectedInvestor(null);
      setFormData(emptyInvestor);
      toast.success("Investor updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/db-investors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete investor");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/db-investors"] });
      toast.success("Investor removed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredInvestors = investors.filter((investor) => {
    const matchesSearch =
      investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      investor.firm.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (investor.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesType = typeFilter === "all" || investor.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleEdit = (investor: Investor) => {
    setSelectedInvestor(investor);
    setFormData({
      name: investor.name,
      firm: investor.firm,
      type: investor.type,
      focus: investor.focus || "Multi-sector",
      aum: investor.aum || "",
      checkSize: investor.checkSize || "",
      preferredStage: investor.preferredStage || "",
      location: investor.location || "",
      website: investor.website || "",
      email: investor.email || "",
      phone: investor.phone || "",
      linkedIn: investor.linkedIn || "",
      notes: investor.notes || "",
    });
    setShowEditDialog(true);
  };

  const InvestorForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Contact Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Smith"
            data-testid="input-investor-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="firm">Firm Name *</Label>
          <Input
            id="firm"
            value={formData.firm}
            onChange={(e) => setFormData({ ...formData, firm: e.target.value })}
            placeholder="Acme Capital"
            data-testid="input-investor-firm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@acmecapital.com"
            data-testid="input-investor-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            data-testid="input-investor-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Investor Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger data-testid="select-investor-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {investorTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage">Preferred Stage</Label>
          <Select
            value={formData.preferredStage}
            onValueChange={(value) => setFormData({ ...formData, preferredStage: value })}
          >
            <SelectTrigger data-testid="select-investment-stage">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="focus">Sector Focus</Label>
          <Select
            value={formData.focus}
            onValueChange={(value) => setFormData({ ...formData, focus: value })}
          >
            <SelectTrigger data-testid="select-sector-focus">
              <SelectValue placeholder="Select focus" />
            </SelectTrigger>
            <SelectContent>
              {focusOptions.map((focus) => (
                <SelectItem key={focus} value={focus}>
                  {focus}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="New York, NY"
            data-testid="input-investor-location"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aum">AUM (Assets Under Management)</Label>
          <Input
            id="aum"
            value={formData.aum}
            onChange={(e) => setFormData({ ...formData, aum: e.target.value })}
            placeholder="$2.5B"
            data-testid="input-investor-aum"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkSize">Check Size</Label>
          <Input
            id="checkSize"
            value={formData.checkSize}
            onChange={(e) => setFormData({ ...formData, checkSize: e.target.value })}
            placeholder="$10M - $50M"
            data-testid="input-investor-checksize"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://acmecapital.com"
            data-testid="input-investor-website"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="linkedIn">LinkedIn</Label>
          <Input
            id="linkedIn"
            value={formData.linkedIn}
            onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
            placeholder="linkedin.com/in/johnsmith"
            data-testid="input-investor-linkedin"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Key information about the investor..."
          rows={3}
          data-testid="input-investor-notes"
        />
      </div>
    </div>
  );

  return (
    <Layout role="CEO" pageTitle="Investor Database" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Investor Database</h1>
            <p className="text-muted-foreground mt-1">
              Manage your investor contacts and relationships
            </p>
          </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-investor">
              <Plus className="h-4 w-4" />
              Add Investor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Add New Investor
              </DialogTitle>
              <DialogDescription>
                Add a new investor contact to your database
              </DialogDescription>
            </DialogHeader>
            <InvestorForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.name || !formData.firm || !formData.type}
                data-testid="button-save-investor"
              >
                {createMutation.isPending ? "Adding..." : "Add Investor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{investors.length}</p>
                <p className="text-sm text-muted-foreground">Total Investors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {investors.filter((i) => i.type === "Private Equity").length}
                </p>
                <p className="text-sm text-muted-foreground">PE Firms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {investors.filter((i) => i.type === "Venture Capital").length}
                </p>
                <p className="text-sm text-muted-foreground">VC Firms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Building2 className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {investors.filter((i) => i.type === "Family Office").length}
                </p>
                <p className="text-sm text-muted-foreground">Family Offices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Investor Directory</CardTitle>
              <CardDescription>Search and manage investor contacts</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search investors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-secondary/50"
                  data-testid="input-search-investors"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="select-filter-type">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {investorTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredInvestors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {investors.length === 0 ? "No investors in database. Add your first investor!" : "No investors match your search."}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Contact</TableHead>
                    <TableHead>Firm</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>AUM</TableHead>
                    <TableHead>Check Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.map((investor) => (
                    <TableRow key={investor.id} className="border-border" data-testid={`row-investor-${investor.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{investor.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {investor.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {investor.email}
                              </span>
                            )}
                          </div>
                          {investor.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Phone className="h-3 w-3" />
                              {investor.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{investor.firm}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {investor.website && (
                              <a
                                href={investor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Globe className="h-3 w-3" />
                              </a>
                            )}
                            {investor.linkedIn && (
                              <a
                                href={investor.linkedIn.startsWith('http') ? investor.linkedIn : `https://${investor.linkedIn}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Linkedin className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {investor.location && (
                            <p className="text-xs text-muted-foreground mt-0.5">{investor.location}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {investor.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{investor.focus || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{investor.aum || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{investor.checkSize || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(investor)}
                            data-testid={`button-edit-investor-${investor.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              if (confirm("Are you sure you want to remove this investor?")) {
                                deleteMutation.mutate(investor.id);
                              }
                            }}
                            data-testid={`button-delete-investor-${investor.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Investor
            </DialogTitle>
            <DialogDescription>
              Update investor information
            </DialogDescription>
          </DialogHeader>
          <InvestorForm isEdit />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedInvestor) {
                  updateMutation.mutate({ id: selectedInvestor.id, data: formData });
                }
              }}
              disabled={updateMutation.isPending || !formData.name || !formData.firm}
              data-testid="button-update-investor"
            >
              {updateMutation.isPending ? "Updating..." : "Update Investor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
