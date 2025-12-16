import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useTaskTemplates, useCreateTaskTemplate, useUpdateTaskTemplate, useDeleteTaskTemplate, useApplyTaskTemplate, useUsers, useCurrentUser, type TaskTemplate, type TemplateSection, type TemplateTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Edit, Copy, GripVertical, X, Search, ChevronDown, ChevronRight, Calendar, User, Clock, ListTodo, Play, LayoutTemplate, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const CATEGORIES = [
  { value: 'HR', label: 'Human Resources' },
  { value: 'Onboarding', label: 'Employee Onboarding' },
  { value: 'Offboarding', label: 'Employee Offboarding' },
  { value: 'Project', label: 'Project Management' },
  { value: 'General', label: 'General' },
];

function generateId() {
  return crypto.randomUUID();
}

export default function TaskTemplates() {
  const [location] = useLocation();
  const role: 'CEO' | 'Employee' = location.startsWith('/ceo') ? 'CEO' : 'Employee';
  
  const { data: currentUser } = useCurrentUser();
  const { data: templates, isLoading } = useTaskTemplates();
  const { data: users } = useUsers();
  const createTemplate = useCreateTaskTemplate();
  const updateTemplate = useUpdateTaskTemplate();
  const deleteTemplate = useDeleteTaskTemplate();
  const applyTemplate = useApplyTaskTemplate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingCategory, setEditingCategory] = useState("HR");
  const [editingSections, setEditingSections] = useState<TemplateSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [applyStartDate, setApplyStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [applyContextName, setApplyContextName] = useState("");
  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, string>>({});

  const isTemplateAdmin = currentUser?.name?.toLowerCase().includes('dimitra') || 
                          currentUser?.email?.toLowerCase().includes('dimitra') ||
                          currentUser?.name?.toLowerCase().includes('charles') || 
                          currentUser?.email?.toLowerCase().includes('charles');

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    let result = templates;
    if (categoryFilter !== "all") {
      result = result.filter(t => t.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    return result;
  }, [templates, categoryFilter, searchQuery]);

  const handleCreateTemplate = async () => {
    if (!editingName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    try {
      const template = await createTemplate.mutateAsync({
        name: editingName,
        description: editingDescription || undefined,
        category: editingCategory,
        sections: editingSections,
      });
      toast.success("Template created successfully");
      setShowCreateDialog(false);
      resetEditingState();
      setSelectedTemplate(template);
      setEditingName(template.name);
      setEditingDescription(template.description || "");
      setEditingCategory(template.category);
      setEditingSections(template.sections || []);
      setShowEditDialog(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetEditingState = () => {
    setEditingName("");
    setEditingDescription("");
    setEditingCategory("HR");
    setEditingSections([]);
    setExpandedSections(new Set());
  };

  const handleOpenEdit = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setEditingName(template.name);
    setEditingDescription(template.description || "");
    setEditingCategory(template.category);
    setEditingSections(template.sections || []);
    const allSectionIds = new Set(template.sections?.map(s => s.id) || []);
    setExpandedSections(allSectionIds);
    setShowEditDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplate.id,
        name: editingName,
        description: editingDescription,
        category: editingCategory,
        sections: editingSections,
      });
      toast.success("Template saved successfully");
      setShowEditDialog(false);
      resetEditingState();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success("Template deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenApply = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setApplyStartDate(format(new Date(), 'yyyy-MM-dd'));
    setApplyContextName("");
    setAssigneeOverrides({});
    setShowApplyDialog(true);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      const result = await applyTemplate.mutateAsync({
        id: selectedTemplate.id,
        startDate: applyStartDate,
        contextType: selectedTemplate.category,
        contextName: applyContextName || undefined,
        assigneeOverrides: Object.keys(assigneeOverrides).length > 0 ? assigneeOverrides : undefined,
      });
      toast.success(`Created ${result.tasksCreated} tasks from template`);
      setShowApplyDialog(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDuplicateTemplate = async (template: TaskTemplate) => {
    try {
      await createTemplate.mutateAsync({
        name: `${template.name} (Copy)`,
        description: template.description || undefined,
        category: template.category,
        sections: template.sections,
      });
      toast.success("Template duplicated");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const addSection = () => {
    const newSection: TemplateSection = {
      id: generateId(),
      title: "New Section",
      position: editingSections.length,
      tasks: [],
    };
    setEditingSections([...editingSections, newSection]);
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(newSection.id);
      return next;
    });
  };

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setEditingSections(editingSections.map(s => 
      s.id === sectionId ? { ...s, ...updates } : s
    ));
  };

  const deleteSection = (sectionId: string) => {
    setEditingSections(editingSections.filter(s => s.id !== sectionId));
  };

  const addTask = (sectionId: string) => {
    const section = editingSections.find(s => s.id === sectionId);
    if (!section) return;
    const newTask: TemplateTask = {
      id: generateId(),
      title: "New Task",
      position: section.tasks.length,
    };
    updateSection(sectionId, { tasks: [...section.tasks, newTask] });
  };

  const updateTask = (sectionId: string, taskId: string, updates: Partial<TemplateTask>) => {
    const section = editingSections.find(s => s.id === sectionId);
    if (!section) return;
    const updatedTasks = section.tasks.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    );
    updateSection(sectionId, { tasks: updatedTasks });
  };

  const deleteTask = (sectionId: string, taskId: string) => {
    const section = editingSections.find(s => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { tasks: section.tasks.filter(t => t.id !== taskId) });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const getUserName = (userId: string | undefined) => {
    if (!userId || !users) return "Unassigned";
    const user = users.find(u => u.id === userId);
    return user?.name || "Unknown User";
  };

  const totalTaskCount = (sections: TemplateSection[]) => {
    return sections.reduce((acc, s) => acc + s.tasks.length, 0);
  };

  if (!isTemplateAdmin) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Access Restricted</CardTitle>
              <CardDescription>
                Task templates are only available to HR administrators.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
              <LayoutTemplate className="h-6 w-6 text-primary" />
              Task Templates
            </h1>
            <p className="text-muted-foreground mt-1">Create reusable task templates for HR workflows</p>
          </div>
          <Button onClick={() => { resetEditingState(); setShowCreateDialog(true); }} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Templates Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || categoryFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Create your first task template to get started"
                }
              </p>
              {!searchQuery && categoryFilter === "all" && (
                <Button onClick={() => { resetEditingState(); setShowCreateDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <Card key={template.id} className="group hover:border-primary/50 transition-colors" data-testid={`card-template-${template.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(template)} data-testid={`button-edit-template-${template.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicateTemplate(template)} data-testid={`button-duplicate-template-${template.id}`}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template)} data-testid={`button-delete-template-${template.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-4 w-4" />
                      {totalTaskCount(template.sections)} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-4 w-4" />
                      {template.sections.length} sections
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Used {template.usageCount || 0} times</span>
                    <span>Updated {format(new Date(template.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => handleOpenApply(template)}
                    data-testid={`button-apply-template-${template.id}`}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task Template</DialogTitle>
            <DialogDescription>Create a new reusable task template for HR workflows</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="e.g., Employee Onboarding"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder="Describe what this template is for..."
                data-testid="input-template-description"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={editingCategory} onValueChange={setEditingCategory}>
                <SelectTrigger data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplate.isPending} data-testid="button-confirm-create">
              {createTemplate.isPending ? "Creating..." : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetEditingState(); setShowEditDialog(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              Edit Template
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  data-testid="input-edit-template-name"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editingCategory} onValueChange={setEditingCategory}>
                  <SelectTrigger data-testid="select-edit-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mb-4">
              <Label>Description</Label>
              <Textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder="Template description..."
                className="resize-none"
                data-testid="input-edit-template-description"
              />
            </div>
            <Separator className="mb-4" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Sections & Tasks</h3>
              <Button size="sm" onClick={addSection} data-testid="button-add-section">
                <Plus className="h-4 w-4 mr-1" />
                Add Section
              </Button>
            </div>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {editingSections.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No sections yet. Add a section to start building your template.</p>
                    </CardContent>
                  </Card>
                ) : (
                  editingSections.map((section, sectionIndex) => (
                    <Card key={section.id} className="border-muted" data-testid={`section-${section.id}`}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-0 h-auto"
                            onClick={() => toggleSection(section.id)}
                          >
                            {expandedSections.has(section.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                            className="flex-1 h-8 font-medium"
                            data-testid={`input-section-title-${section.id}`}
                          />
                          <Badge variant="outline">{section.tasks.length} tasks</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => deleteSection(section.id)}
                            data-testid={`button-delete-section-${section.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      {expandedSections.has(section.id) && (
                        <CardContent className="pt-0 px-4 pb-4">
                          <div className="space-y-2 pl-6">
                            {section.tasks.map((task, taskIndex) => (
                              <div 
                                key={task.id} 
                                className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                                data-testid={`task-${task.id}`}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move mt-1" />
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={task.title}
                                    onChange={(e) => updateTask(section.id, task.id, { title: e.target.value })}
                                    placeholder="Task title"
                                    className="h-8"
                                    data-testid={`input-task-title-${task.id}`}
                                  />
                                  <Textarea
                                    value={task.description || ""}
                                    onChange={(e) => updateTask(section.id, task.id, { description: e.target.value })}
                                    placeholder="Task description (optional)"
                                    className="resize-none min-h-[60px]"
                                    data-testid={`input-task-description-${task.id}`}
                                  />
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <Label className="text-xs text-muted-foreground">Assignee</Label>
                                      <Select 
                                        value={task.assigneeId || "unassigned"} 
                                        onValueChange={(val) => updateTask(section.id, task.id, { assigneeId: val === "unassigned" ? undefined : val })}
                                      >
                                        <SelectTrigger className="h-8" data-testid={`select-task-assignee-${task.id}`}>
                                          <SelectValue placeholder="Select assignee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">Unassigned</SelectItem>
                                          {users?.filter(u => !u.isExternal).map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="w-32">
                                      <Label className="text-xs text-muted-foreground">Due (days after start)</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={task.relativeDueDays ?? ""}
                                        onChange={(e) => updateTask(section.id, task.id, { relativeDueDays: e.target.value ? parseInt(e.target.value) : undefined })}
                                        placeholder="e.g., 7"
                                        className="h-8"
                                        data-testid={`input-task-due-days-${task.id}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => deleteTask(section.id, task.id)}
                                  data-testid={`button-delete-task-${task.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => addTask(section.id)}
                              data-testid={`button-add-task-${section.id}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Task
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { resetEditingState(); setShowEditDialog(false); }}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={updateTemplate.isPending} data-testid="button-save-template">
              {updateTemplate.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Use Template: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              This will create {selectedTemplate ? totalTaskCount(selectedTemplate.sections) : 0} tasks from this template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={applyStartDate}
                  onChange={(e) => setApplyStartDate(e.target.value)}
                  className="pl-10"
                  data-testid="input-apply-start-date"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Task due dates will be calculated relative to this date</p>
            </div>
            <div>
              <Label>Context Name (Optional)</Label>
              <Input
                value={applyContextName}
                onChange={(e) => setApplyContextName(e.target.value)}
                placeholder="e.g., New Hire: John Smith"
                data-testid="input-apply-context-name"
              />
              <p className="text-xs text-muted-foreground mt-1">Helps identify what these tasks are for</p>
            </div>
            {selectedTemplate && selectedTemplate.sections.length > 0 && (
              <div>
                <Label className="mb-2 block">Preview</Label>
                <ScrollArea className="h-48 border rounded-lg p-3">
                  {selectedTemplate.sections.map(section => (
                    <div key={section.id} className="mb-3">
                      <h4 className="font-medium text-sm mb-1">{section.title}</h4>
                      <div className="space-y-1 pl-4">
                        {section.tasks.map(task => (
                          <div key={task.id} className="text-sm flex items-center gap-2">
                            <ListTodo className="h-3 w-3 text-muted-foreground" />
                            <span>{task.title}</span>
                            {task.relativeDueDays !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                Day {task.relativeDueDays}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApplyTemplate} disabled={applyTemplate.isPending} data-testid="button-confirm-apply">
              {applyTemplate.isPending ? "Creating Tasks..." : "Create Tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
