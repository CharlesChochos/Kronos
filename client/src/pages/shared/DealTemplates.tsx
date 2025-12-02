import { useState } from "react";
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
import { 
  FileStack, 
  Plus, 
  Search, 
  Copy,
  Pencil,
  Trash2,
  CheckCircle,
  Briefcase,
  Building,
  DollarSign,
  Clock,
  Users,
  FileText,
  Star,
  StarOff
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type DealTemplate = {
  id: string;
  name: string;
  description: string;
  sector: string;
  dealType: string;
  stages: string[];
  defaultTasks: { title: string; type: string; priority: string }[];
  estimatedDuration: number;
  checklistItems: string[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function DealTemplates({ role }: { role: 'CEO' | 'Employee' }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DealTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [templates, setTemplates] = useState<DealTemplate[]>([
    {
      id: "1",
      name: "Standard M&A Acquisition",
      description: "Complete template for mergers and acquisitions including due diligence, valuation, and integration planning",
      sector: "Technology",
      dealType: "M&A",
      stages: ["Origination", "Due Diligence", "Valuation", "Negotiation", "Closing", "Integration"],
      defaultTasks: [
        { title: "Initial screening and target identification", type: "Research", priority: "High" },
        { title: "Financial due diligence", type: "Analysis", priority: "High" },
        { title: "Legal review and documentation", type: "Document", priority: "High" },
        { title: "Valuation model preparation", type: "Analysis", priority: "High" },
        { title: "Management presentations", type: "Meeting", priority: "Medium" }
      ],
      estimatedDuration: 120,
      checklistItems: [
        "NDA signed by all parties",
        "Data room access configured",
        "Financial statements collected (3 years)",
        "Management team interviews scheduled",
        "Third-party advisors engaged"
      ],
      isFavorite: true,
      usageCount: 24,
      createdAt: "2024-06-15T10:00:00Z",
      updatedAt: "2024-11-20T14:30:00Z"
    },
    {
      id: "2",
      name: "Series A/B Fundraising",
      description: "Template for venture capital fundraising rounds including investor outreach and term sheet negotiation",
      sector: "All",
      dealType: "Capital Raising",
      stages: ["Preparation", "Investor Outreach", "Due Diligence", "Term Sheet", "Closing"],
      defaultTasks: [
        { title: "Pitch deck preparation", type: "Document", priority: "High" },
        { title: "Financial model update", type: "Analysis", priority: "High" },
        { title: "Investor list curation", type: "Research", priority: "Medium" },
        { title: "Data room setup", type: "Admin", priority: "Medium" }
      ],
      estimatedDuration: 90,
      checklistItems: [
        "Pitch deck finalized",
        "Cap table updated",
        "Financial projections complete",
        "Legal counsel engaged",
        "Reference customers identified"
      ],
      isFavorite: true,
      usageCount: 18,
      createdAt: "2024-07-01T09:00:00Z",
      updatedAt: "2024-10-15T11:00:00Z"
    },
    {
      id: "3",
      name: "Asset Divestiture",
      description: "Template for selling business units or asset portfolios",
      sector: "Healthcare",
      dealType: "Divestiture",
      stages: ["Preparation", "Marketing", "Buyer Selection", "Due Diligence", "Closing"],
      defaultTasks: [
        { title: "Carve-out analysis", type: "Analysis", priority: "High" },
        { title: "Information memorandum", type: "Document", priority: "High" },
        { title: "Buyer identification", type: "Research", priority: "Medium" }
      ],
      estimatedDuration: 180,
      checklistItems: [
        "Standalone financials prepared",
        "Transition services agreement drafted",
        "Employee communication plan ready"
      ],
      isFavorite: false,
      usageCount: 8,
      createdAt: "2024-08-10T14:00:00Z",
      updatedAt: "2024-09-25T16:00:00Z"
    }
  ]);

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    sector: "Technology",
    dealType: "M&A",
    estimatedDuration: 90,
    stages: "",
    checklistItems: ""
  });

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.description) {
      toast.error("Please fill in required fields");
      return;
    }

    const template: DealTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description,
      sector: newTemplate.sector,
      dealType: newTemplate.dealType,
      stages: newTemplate.stages.split(",").map(s => s.trim()).filter(Boolean),
      defaultTasks: [],
      estimatedDuration: newTemplate.estimatedDuration,
      checklistItems: newTemplate.checklistItems.split("\n").map(s => s.trim()).filter(Boolean),
      isFavorite: false,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTemplates([template, ...templates]);
    setShowCreateModal(false);
    setNewTemplate({ name: "", description: "", sector: "Technology", dealType: "M&A", estimatedDuration: 90, stages: "", checklistItems: "" });
    toast.success("Template created successfully");
  };

  const toggleFavorite = (id: string) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
    ));
  };

  const duplicateTemplate = (template: DealTemplate) => {
    const newT: DealTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTemplates([newT, ...templates]);
    toast.success("Template duplicated");
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const useTemplate = (template: DealTemplate) => {
    setTemplates(templates.map(t =>
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    ));
    toast.success(`Creating new deal from "${template.name}" template`);
  };

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Deal Templates</h1>
            <p className="text-muted-foreground">Create and manage reusable deal configurations</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-template">
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileStack className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates.length}</p>
                  <p className="text-xs text-muted-foreground">Total Templates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates.filter(t => t.isFavorite).length}</p>
                  <p className="text-xs text-muted-foreground">Favorites</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + t.usageCount, 0)}</p>
                  <p className="text-xs text-muted-foreground">Times Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{new Set(templates.map(t => t.dealType)).size}</p>
                  <p className="text-xs text-muted-foreground">Deal Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Template Library</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors" data-testid={`template-${template.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <button onClick={() => toggleFavorite(template.id)} className="hover:opacity-80">
                              {template.isFavorite ? (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              ) : (
                                <StarOff className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{template.dealType}</Badge>
                            <Badge variant="secondary">{template.sector}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {template.estimatedDuration} days
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {template.stages.length} stages
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Used {template.usageCount}x
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {template.stages.slice(0, 4).map((stage, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{stage}</Badge>
                        ))}
                        {template.stages.length > 4 && (
                          <Badge variant="outline" className="text-[10px]">+{template.stages.length - 4}</Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => useTemplate(template)} className="flex-1" data-testid={`use-template-${template.id}`}>
                          Use Template
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateTemplate(template)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedTemplate(template); setShowEditModal(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteTemplate(template.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Deal Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g., Standard M&A Template"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Describe when to use this template..."
                data-testid="input-template-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sector</Label>
                <Select value={newTemplate.sector} onValueChange={(v) => setNewTemplate({ ...newTemplate, sector: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="All">All Sectors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deal Type</Label>
                <Select value={newTemplate.dealType} onValueChange={(v) => setNewTemplate({ ...newTemplate, dealType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M&A">M&A</SelectItem>
                    <SelectItem value="Capital Raising">Capital Raising</SelectItem>
                    <SelectItem value="Divestiture">Divestiture</SelectItem>
                    <SelectItem value="Restructuring">Restructuring</SelectItem>
                    <SelectItem value="IPO">IPO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Estimated Duration (days)</Label>
              <Input
                type="number"
                value={newTemplate.estimatedDuration}
                onChange={(e) => setNewTemplate({ ...newTemplate, estimatedDuration: parseInt(e.target.value) || 90 })}
                data-testid="input-template-duration"
              />
            </div>
            <div>
              <Label>Stages (comma-separated)</Label>
              <Input
                value={newTemplate.stages}
                onChange={(e) => setNewTemplate({ ...newTemplate, stages: e.target.value })}
                placeholder="Origination, Due Diligence, Closing"
                data-testid="input-template-stages"
              />
            </div>
            <div>
              <Label>Checklist Items (one per line)</Label>
              <Textarea
                value={newTemplate.checklistItems}
                onChange={(e) => setNewTemplate({ ...newTemplate, checklistItems: e.target.value })}
                placeholder="NDA signed&#10;Data room configured&#10;..."
                rows={4}
                data-testid="input-template-checklist"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} data-testid="button-submit-template">Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
