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
  StarOff,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDealTemplates, useCreateDealTemplate, useUpdateDealTemplate, useDeleteDealTemplate, DealTemplateType } from "@/lib/api";

type DealTemplate = DealTemplateType;

export default function DealTemplates({ role }: { role: 'CEO' | 'Employee' }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DealTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: templates = [], isLoading } = useDealTemplates();
  
  // Predefined categories that always show, plus any additional types from templates
  const PREDEFINED_CATEGORIES = ["Deal", "HR", "Compliance", "Operations", "Finance", "Legal"];
  const TEMPLATE_CATEGORIES = useMemo(() => {
    const templateTypes = new Set(templates.map(t => t.dealType));
    // Combine predefined with any custom types from templates
    const allCategories = new Set([...PREDEFINED_CATEGORIES, ...templateTypes]);
    return ["all", ...Array.from(allCategories).sort()];
  }, [templates]);
  const createTemplate = useCreateDealTemplate();
  const updateTemplate = useUpdateDealTemplate();
  const deleteTemplateMutation = useDeleteDealTemplate();

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    sector: "Technology",
    dealType: "Deal",
    estimatedDuration: 90,
    stages: "",
    checklistItems: ""
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.dealType === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.description) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await createTemplate.mutateAsync({
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
      });
      setShowCreateModal(false);
      setNewTemplate({ name: "", description: "", sector: "Technology", dealType: "Deal", estimatedDuration: 90, stages: "", checklistItems: "" });
      toast.success("Template created successfully");
    } catch (error) {
      toast.error("Failed to create template");
    }
  };

  const toggleFavorite = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    try {
      await updateTemplate.mutateAsync({
        id,
        updates: { isFavorite: !template.isFavorite }
      });
    } catch (error) {
      toast.error("Failed to update favorite");
    }
  };

  const duplicateTemplate = async (template: DealTemplate) => {
    try {
      await createTemplate.mutateAsync({
        name: `${template.name} (Copy)`,
        description: template.description,
        sector: template.sector,
        dealType: template.dealType,
        stages: template.stages,
        defaultTasks: template.defaultTasks,
        estimatedDuration: template.estimatedDuration,
        checklistItems: template.checklistItems,
        isFavorite: false,
        usageCount: 0,
      });
      toast.success("Template duplicated");
    } catch (error) {
      toast.error("Failed to duplicate template");
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await deleteTemplateMutation.mutateAsync(id);
      toast.success("Template deleted");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const useTemplate = async (template: DealTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        updates: { usageCount: (template.usageCount || 0) + 1 }
      });
      toast.success(`Creating new deal from "${template.name}" template`);
    } catch (error) {
      console.error("Failed to update usage count:", error);
      toast.success(`Creating new deal from "${template.name}" template`);
    }
  };

  if (isLoading) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Templates</h1>
            <p className="text-muted-foreground">Create and manage reusable configurations</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-template">
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {TEMPLATE_CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={categoryFilter === category ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(category)}
              data-testid={`filter-category-${category}`}
            >
              {category === "all" ? "All" : category}
            </Button>
          ))}
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
                  <p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)}</p>
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
                <Label>Category</Label>
                <Select value={newTemplate.dealType} onValueChange={(v) => setNewTemplate({ ...newTemplate, dealType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
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
                placeholder="Origination, Structuring, Diligence, Legal, Close"
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
