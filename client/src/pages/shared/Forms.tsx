import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useForms, useCreateForm, useUpdateForm, useDeleteForm, usePublishForm, useUnpublishForm, useShareForm, useFormSubmissions, useCurrentUser, type Form, type FormField, type FormBranchCondition, type FormTableColumn, type FormTableCell, type FormContentBlock } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, FileText, Share2, Trash2, Edit, Eye, Copy, Send, GripVertical, X, Type, Mail, List, Calendar, Hash, Paperclip, Heading, AlignLeft, Table, FileTextIcon, Image, ChevronDown, ChevronUp, GitBranch, Link, Upload, Search, ExternalLink, Download, ChevronLeft, User, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import jsPDF from "jspdf";

const FIELD_TYPES = [
  { value: 'heading', label: 'Section Heading', icon: Heading, category: 'layout' },
  { value: 'content', label: 'Rich Content', icon: FileTextIcon, category: 'layout' },
  { value: 'text', label: 'Short Text', icon: Type, category: 'input' },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft, category: 'input' },
  { value: 'email', label: 'Email', icon: Mail, category: 'input' },
  { value: 'single-select', label: 'Dropdown', icon: List, category: 'input' },
  { value: 'multi-select', label: 'Multi Select', icon: List, category: 'input' },
  { value: 'date', label: 'Date', icon: Calendar, category: 'input' },
  { value: 'number', label: 'Number', icon: Hash, category: 'input' },
  { value: 'file', label: 'File Upload', icon: Paperclip, category: 'input' },
  { value: 'table', label: 'Info Table', icon: Table, category: 'layout' },
] as const;

export default function Forms() {
  const [location] = useLocation();
  const role: 'CEO' | 'Employee' = location.startsWith('/ceo') ? 'CEO' : 'Employee';
  
  const { data: currentUser } = useCurrentUser();
  const { data: forms, isLoading } = useForms();
  const createForm = useCreateForm();
  const updateForm = useUpdateForm();
  const deleteForm = useDeleteForm();
  const publishForm = usePublishForm();
  const unpublishForm = useUnpublishForm();
  const shareForm = useShareForm();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");
  const [shareEmails, setShareEmails] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingFields, setEditingFields] = useState<FormField[]>([]);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingCoverImage, setEditingCoverImage] = useState("");
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("build");

  // Check if user is Dimitra or Charles (admin users who can edit/manage forms)
  const isFormAdmin = currentUser?.name?.toLowerCase().includes('dimitra') || 
                      currentUser?.email?.toLowerCase().includes('dimitra') ||
                      currentUser?.name?.toLowerCase().includes('charles') || 
                      currentUser?.email?.toLowerCase().includes('charles');

  // Filter forms: admins see all, others see only published forms
  // Also filter by search query
  const filteredForms = useMemo(() => {
    if (!forms) return [];
    
    let result = forms;
    
    // Non-admins only see published forms
    if (!isFormAdmin) {
      result = result.filter(f => f.status === 'published');
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.title.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [forms, isFormAdmin, searchQuery]);

  // Function to open form in new tab (for non-admin users)
  const handleOpenForm = (form: Form) => {
    if (form.shareToken) {
      window.open(`/form/${form.shareToken}`, '_blank');
    }
  };

  const handleCreateForm = async () => {
    if (!newFormTitle.trim()) {
      toast.error("Please enter a form title");
      return;
    }
    try {
      const form = await createForm.mutateAsync({
        title: newFormTitle,
        description: newFormDescription || undefined,
        fields: [],
      });
      toast.success("Form created successfully");
      setShowCreateDialog(false);
      setNewFormTitle("");
      setNewFormDescription("");
      setSelectedForm(form);
      setEditingTitle(form.title);
      setEditingDescription(form.description || "");
      setEditingCoverImage(form.coverImage || "");
      setEditingFields(form.fields || []);
      setActiveTab("build");
      setShowEditDialog(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenEdit = (form: Form) => {
    setSelectedForm(form);
    setEditingTitle(form.title);
    setEditingDescription(form.description || "");
    setEditingCoverImage(form.coverImage || "");
    setEditingFields(form.fields || []);
    setActiveTab("build");
    setShowEditDialog(true);
  };

  const handleSaveForm = async () => {
    if (!selectedForm) return;
    try {
      await updateForm.mutateAsync({
        id: selectedForm.id,
        title: editingTitle,
        description: editingDescription,
        coverImage: editingCoverImage || null,
        fields: editingFields,
      });
      toast.success("Form saved successfully");
      setShowEditDialog(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePublishForm = async (form: Form) => {
    try {
      await publishForm.mutateAsync(form.id);
      toast.success("Form published successfully");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUnpublishForm = async (form: Form) => {
    if (!confirm(`Are you sure you want to revert "${form.title}" to draft? The share link will stop working until you publish again.`)) return;
    try {
      await unpublishForm.mutateAsync(form.id);
      toast.success("Form reverted to draft");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteForm = async (form: Form) => {
    if (!confirm(`Are you sure you want to delete "${form.title}"?`)) return;
    try {
      await deleteForm.mutateAsync(form.id);
      toast.success("Form deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenShare = (form: Form) => {
    setSelectedForm(form);
    setShareEmails("");
    setShareMessage("");
    setShowShareDialog(true);
  };

  const handleShareForm = async () => {
    if (!selectedForm) return;
    const emails = shareEmails.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      toast.error("Please enter at least one email");
      return;
    }
    try {
      const result = await shareForm.mutateAsync({
        id: selectedForm.id,
        emails,
        message: shareMessage || undefined,
      });
      toast.success(`Form shared with ${emails.length} recipient(s)`);
      setShowShareDialog(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCopyLink = async (form: Form) => {
    if (!form.shareToken) {
      toast.error("Form must be published first");
      return;
    }
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/form/${form.shareToken}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const handlePreview = (form: Form) => {
    setSelectedForm(form);
    setShowPreviewDialog(true);
  };

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: type === 'heading' ? 'Section Title' : 
             type === 'content' ? 'Information Block' :
             type === 'table' ? 'Reference Table' :
             `New ${type} field`,
      required: type === 'heading' || type === 'content' || type === 'table' ? false : false,
      options: type === 'single-select' || type === 'multi-select' ? ['Option 1', 'Option 2'] : undefined,
      description: undefined,
      placeholder: undefined,
      tableColumns: type === 'table' ? [
        { id: 'col1', header: 'Column 1' },
        { id: 'col2', header: 'Column 2' },
      ] : undefined,
      tableRows: type === 'table' ? [
        [{ value: 'Row 1 Cell 1' }, { value: 'Row 1 Cell 2' }],
      ] : undefined,
      contentBlocks: type === 'content' ? [
        { type: 'paragraph', text: 'Enter your information content here.' }
      ] : undefined,
    };
    setEditingFields([...editingFields, newField]);
    setExpandedFieldId(newField.id);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...editingFields];
    updated[index] = { ...updated[index], ...updates };
    setEditingFields(updated);
  };

  const removeField = (index: number) => {
    setEditingFields(editingFields.filter((_, i) => i !== index));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= editingFields.length) return;
    const updated = [...editingFields];
    const [removed] = updated.splice(from, 1);
    updated.splice(to, 0, removed);
    setEditingFields(updated);
  };

  const getSelectableFieldsForBranching = (currentFieldIndex: number) => {
    return editingFields
      .slice(0, currentFieldIndex)
      .filter(f => f.type === 'single-select' || f.type === 'multi-select');
  };

  const addTableColumn = (fieldIndex: number) => {
    const field = editingFields[fieldIndex];
    if (!field.tableColumns) return;
    const newColId = `col_${Date.now()}`;
    const newColumns = [...field.tableColumns, { id: newColId, header: `Column ${field.tableColumns.length + 1}` }];
    const newRows = (field.tableRows || []).map(row => [...row, { value: '' }]);
    updateField(fieldIndex, { tableColumns: newColumns, tableRows: newRows });
  };

  const removeTableColumn = (fieldIndex: number, colIndex: number) => {
    const field = editingFields[fieldIndex];
    if (!field.tableColumns || field.tableColumns.length <= 1) return;
    const newColumns = field.tableColumns.filter((_, i) => i !== colIndex);
    const newRows = (field.tableRows || []).map(row => row.filter((_, i) => i !== colIndex));
    updateField(fieldIndex, { tableColumns: newColumns, tableRows: newRows });
  };

  const addTableRow = (fieldIndex: number) => {
    const field = editingFields[fieldIndex];
    const colCount = field.tableColumns?.length || 2;
    const newRow = Array(colCount).fill(null).map(() => ({ value: '' }));
    updateField(fieldIndex, { tableRows: [...(field.tableRows || []), newRow] });
  };

  const removeTableRow = (fieldIndex: number, rowIndex: number) => {
    const field = editingFields[fieldIndex];
    if (!field.tableRows || field.tableRows.length <= 1) return;
    updateField(fieldIndex, { tableRows: field.tableRows.filter((_, i) => i !== rowIndex) });
  };

  const updateTableCell = (fieldIndex: number, rowIndex: number, colIndex: number, value: string) => {
    const field = editingFields[fieldIndex];
    if (!field.tableRows) return;
    const newRows = field.tableRows.map((row, ri) => 
      ri === rowIndex ? row.map((cell, ci) => ci === colIndex ? { value } : cell) : row
    );
    updateField(fieldIndex, { tableRows: newRows });
  };

  const updateTableHeader = (fieldIndex: number, colIndex: number, header: string) => {
    const field = editingFields[fieldIndex];
    if (!field.tableColumns) return;
    const newColumns = field.tableColumns.map((col, i) => i === colIndex ? { ...col, header } : col);
    updateField(fieldIndex, { tableColumns: newColumns });
  };

  const addContentBlock = (fieldIndex: number, type: 'paragraph' | 'heading' | 'list' | 'link') => {
    const field = editingFields[fieldIndex];
    const newBlock: FormContentBlock = type === 'list' 
      ? { type: 'list', items: ['Item 1', 'Item 2'] }
      : type === 'link'
      ? { type: 'link', linkText: 'Click here', url: 'https://' }
      : { type, text: type === 'heading' ? 'Section Heading' : 'Enter text here...' };
    updateField(fieldIndex, { contentBlocks: [...(field.contentBlocks || []), newBlock] });
  };

  const updateContentBlock = (fieldIndex: number, blockIndex: number, updates: Partial<FormContentBlock>) => {
    const field = editingFields[fieldIndex];
    if (!field.contentBlocks) return;
    const newBlocks = field.contentBlocks.map((block, i) => i === blockIndex ? { ...block, ...updates } : block);
    updateField(fieldIndex, { contentBlocks: newBlocks });
  };

  const removeContentBlock = (fieldIndex: number, blockIndex: number) => {
    const field = editingFields[fieldIndex];
    if (!field.contentBlocks || field.contentBlocks.length <= 1) return;
    updateField(fieldIndex, { contentBlocks: field.contentBlocks.filter((_, i) => i !== blockIndex) });
  };

  return (
    <Layout role={role}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title-forms">Forms</h1>
            <p className="text-muted-foreground">
              {isFormAdmin ? "Create and share forms to collect information" : "View and submit forms"}
            </p>
          </div>
          {isFormAdmin && (
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-form">
              <Plus className="h-4 w-4 mr-2" />
              Create Form
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-forms"
          />
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading forms...</p>
        </div>
      ) : filteredForms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredForms.map((form) => (
            <Card 
              key={form.id} 
              data-testid={`card-form-${form.id}`}
              className={!isFormAdmin ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
              onClick={!isFormAdmin ? () => handleOpenForm(form) : undefined}
            >
              {form.coverImage && (
                <div className="h-32 overflow-hidden rounded-t-lg">
                  <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{form.title}</CardTitle>
                    {form.description && (
                      <CardDescription className="mt-1">{form.description}</CardDescription>
                    )}
                  </div>
                  {isFormAdmin && (
                    <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
                      {form.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>{form.fields?.length || 0} fields</p>
                  <p>Created {format(new Date(form.createdAt), 'MMM d, yyyy')}</p>
                </div>
                {isFormAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(form)} data-testid={`button-edit-form-${form.id}`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePreview(form)} data-testid={`button-preview-form-${form.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {form.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => handlePublishForm(form)} data-testid={`button-publish-form-${form.id}`}>
                        <Send className="h-4 w-4 mr-1" />
                        Publish
                      </Button>
                    )}
                    {form.status === 'published' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenShare(form)} data-testid={`button-share-form-${form.id}`}>
                          <Share2 className="h-4 w-4 mr-1" />
                          Share
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(form)} data-testid={`button-copy-link-${form.id}`}>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Link
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleUnpublishForm(form)} className="text-amber-600 hover:text-amber-700" data-testid={`button-unpublish-form-${form.id}`}>
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Revert to Draft
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setSelectedForm(form); setShowSubmissionsDialog(true); }} data-testid={`button-submissions-${form.id}`}>
                      <FileText className="h-4 w-4 mr-1" />
                      Submissions
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteForm(form)} className="text-destructive hover:text-destructive" data-testid={`button-delete-form-${form.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center text-primary">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    <span className="text-sm">Click to open form</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "No forms found" : (isFormAdmin ? "No forms yet" : "No published forms available")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search terms" 
                : (isFormAdmin ? "Create your first form to start collecting information" : "Check back later for new forms")}
            </p>
            {isFormAdmin && !searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Form
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>Enter a title and optional description for your form</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="form-title">Title</Label>
              <Input
                id="form-title"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="Enter form title"
                data-testid="input-form-title"
              />
            </div>
            <div>
              <Label htmlFor="form-description">Description (optional)</Label>
              <Textarea
                id="form-description"
                value={newFormDescription}
                onChange={(e) => setNewFormDescription(e.target.value)}
                placeholder="Enter form description"
                data-testid="input-form-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateForm} disabled={createForm.isPending} data-testid="button-submit-create-form">
              {createForm.isPending ? "Creating..." : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Form</DialogTitle>
            <DialogDescription>Design your form with fields, content, and conditional logic</DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="build">Build</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-title">Form Title</Label>
                  <Input
                    id="edit-title"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    data-testid="input-edit-title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    data-testid="input-edit-description"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-cover-image">Cover Image URL</Label>
                <Input
                  id="edit-cover-image"
                  value={editingCoverImage}
                  onChange={(e) => setEditingCoverImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  data-testid="input-edit-cover-image"
                />
                <p className="text-sm text-muted-foreground mt-1">Add a header image to your form (optional)</p>
                {editingCoverImage && (
                  <div className="mt-3 h-32 overflow-hidden rounded-lg border">
                    <img src={editingCoverImage} alt="Cover preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="build" className="space-y-6">
              <div>
                <Label className="mb-3 block">Add Field</Label>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Layout Elements</p>
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.filter(ft => ft.category === 'layout').map((ft) => (
                      <Button key={ft.value} variant="outline" size="sm" onClick={() => addField(ft.value)} data-testid={`button-add-field-${ft.value}`}>
                        <ft.icon className="h-4 w-4 mr-1" />
                        {ft.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">Input Fields</p>
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.filter(ft => ft.category === 'input').map((ft) => (
                      <Button key={ft.value} variant="outline" size="sm" onClick={() => addField(ft.value)} data-testid={`button-add-field-${ft.value}`}>
                        <ft.icon className="h-4 w-4 mr-1" />
                        {ft.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Form Fields ({editingFields.length})</Label>
                {editingFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 border rounded-md">
                    No fields yet. Click a field type above to add one.
                  </p>
                ) : (
                  editingFields.map((field, index) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      index={index}
                      totalFields={editingFields.length}
                      isExpanded={expandedFieldId === field.id}
                      onToggleExpand={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
                      onUpdate={(updates) => updateField(index, updates)}
                      onRemove={() => removeField(index)}
                      onMoveUp={() => moveField(index, index - 1)}
                      onMoveDown={() => moveField(index, index + 1)}
                      selectableFields={getSelectableFieldsForBranching(index)}
                      onAddTableColumn={() => addTableColumn(index)}
                      onRemoveTableColumn={(colIdx) => removeTableColumn(index, colIdx)}
                      onAddTableRow={() => addTableRow(index)}
                      onRemoveTableRow={(rowIdx) => removeTableRow(index, rowIdx)}
                      onUpdateTableCell={(rowIdx, colIdx, val) => updateTableCell(index, rowIdx, colIdx, val)}
                      onUpdateTableHeader={(colIdx, header) => updateTableHeader(index, colIdx, header)}
                      onAddContentBlock={(type) => addContentBlock(index, type)}
                      onUpdateContentBlock={(blockIdx, updates) => updateContentBlock(index, blockIdx, updates)}
                      onRemoveContentBlock={(blockIdx) => removeContentBlock(index, blockIdx)}
                    />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-6">
              <FormPreview
                title={editingTitle}
                description={editingDescription}
                coverImage={editingCoverImage}
                fields={editingFields}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveForm} disabled={updateForm.isPending} data-testid="button-save-form">
              {updateForm.isPending ? "Saving..." : "Save Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Preview</DialogTitle>
            <DialogDescription>This is how your form will appear to respondents</DialogDescription>
          </DialogHeader>
          {selectedForm && (
            <FormPreview
              title={selectedForm.title}
              description={selectedForm.description || ""}
              coverImage={selectedForm.coverImage || ""}
              fields={selectedForm.fields}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Form</DialogTitle>
            <DialogDescription>Share "{selectedForm?.title}" via email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedForm?.shareToken && (
              <div>
                <Label>Form Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/form/${selectedForm.shareToken}`}
                    className="flex-1"
                    data-testid="input-share-link"
                  />
                  <Button variant="outline" onClick={() => handleCopyLink(selectedForm)} data-testid="button-copy-share-link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="share-emails">Email Addresses</Label>
              <Textarea
                id="share-emails"
                value={shareEmails}
                onChange={(e) => setShareEmails(e.target.value)}
                placeholder="Enter email addresses, separated by commas"
                data-testid="input-share-emails"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Platform users will receive a task. External users will receive an email.
              </p>
            </div>
            <div>
              <Label htmlFor="share-message">Message (optional)</Label>
              <Textarea
                id="share-message"
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Add a personal message"
                data-testid="input-share-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={handleShareForm} disabled={shareForm.isPending} data-testid="button-send-share">
              <Send className="h-4 w-4 mr-2" />
              {shareForm.isPending ? "Sending..." : "Send Invitations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubmissionsDialog
        open={showSubmissionsDialog}
        onOpenChange={setShowSubmissionsDialog}
        form={selectedForm}
      />
      </div>
    </Layout>
  );
}

interface FieldEditorProps {
  field: FormField;
  index: number;
  totalFields: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  selectableFields: FormField[];
  onAddTableColumn: () => void;
  onRemoveTableColumn: (colIndex: number) => void;
  onAddTableRow: () => void;
  onRemoveTableRow: (rowIndex: number) => void;
  onUpdateTableCell: (rowIndex: number, colIndex: number, value: string) => void;
  onUpdateTableHeader: (colIndex: number, header: string) => void;
  onAddContentBlock: (type: 'paragraph' | 'heading' | 'list' | 'link') => void;
  onUpdateContentBlock: (blockIndex: number, updates: Partial<FormContentBlock>) => void;
  onRemoveContentBlock: (blockIndex: number) => void;
}

function FieldEditor({
  field, index, totalFields, isExpanded, onToggleExpand, onUpdate, onRemove, onMoveUp, onMoveDown,
  selectableFields, onAddTableColumn, onRemoveTableColumn, onAddTableRow, onRemoveTableRow,
  onUpdateTableCell, onUpdateTableHeader, onAddContentBlock, onUpdateContentBlock, onRemoveContentBlock
}: FieldEditorProps) {
  const fieldType = FIELD_TYPES.find(ft => ft.value === field.type);
  const Icon = fieldType?.icon || Type;
  const isLayoutField = field.type === 'heading' || field.type === 'content' || field.type === 'table';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === totalFields - 1}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Icon className="h-3 w-3" />
              {fieldType?.label || field.type}
            </Badge>
            <Input
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Field label"
              className="flex-1"
              data-testid={`input-field-label-${index}`}
            />
            {!isLayoutField && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) => onUpdate({ required: checked })}
                  data-testid={`switch-required-${index}`}
                />
                <Label className="text-sm">Required</Label>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={onToggleExpand}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-4 pt-3 border-t">
              {!isLayoutField && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm">Description / Help Text</Label>
                      <Input
                        value={field.description || ''}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        placeholder="Add help text for this field"
                        data-testid={`input-field-description-${index}`}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Placeholder</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => onUpdate({ placeholder: e.target.value })}
                        placeholder="Placeholder text"
                        data-testid={`input-field-placeholder-${index}`}
                      />
                    </div>
                  </div>

                  {selectableFields.length > 0 && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Conditional Logic</Label>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <Select
                          value={field.showWhen?.fieldId || 'none'}
                          onValueChange={(val) => {
                            if (val === 'none') {
                              onUpdate({ showWhen: undefined });
                            } else {
                              onUpdate({ showWhen: { fieldId: val, operator: 'equals', value: '' } });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Show when..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Always show</SelectItem>
                            {selectableFields.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.showWhen && (
                          <>
                            <Select
                              value={field.showWhen.operator}
                              onValueChange={(val: 'equals' | 'not_equals' | 'contains') => onUpdate({ showWhen: { ...field.showWhen!, operator: val } })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="not_equals">Not Equals</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              value={field.showWhen.value}
                              onChange={(e) => onUpdate({ showWhen: { ...field.showWhen!, value: e.target.value } })}
                              placeholder="Value"
                            />
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        This field will only be shown when the selected condition is met.
                      </p>
                    </div>
                  )}
                </>
              )}

              {(field.type === 'single-select' || field.type === 'multi-select') && (
                <div>
                  <Label className="text-sm">Options (comma-separated)</Label>
                  <Input
                    value={field.options?.join(', ') || ''}
                    onChange={(e) => onUpdate({ options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                    placeholder="Option 1, Option 2, Option 3"
                    data-testid={`input-field-options-${index}`}
                  />
                </div>
              )}

              {field.type === 'table' && (
                <div className="space-y-3">
                  <Label className="text-sm">Table Configuration</Label>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {field.tableColumns?.map((col, ci) => (
                            <th key={col.id} className="p-2 border-r last:border-r-0">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={col.header}
                                  onChange={(e) => onUpdateTableHeader(ci, e.target.value)}
                                  className="h-7 text-xs"
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemoveTableColumn(ci)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </th>
                          ))}
                          <th className="p-2 w-12">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddTableColumn}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {field.tableRows?.map((row, ri) => (
                          <tr key={ri} className="border-t">
                            {row.map((cell, ci) => (
                              <td key={ci} className="p-2 border-r last:border-r-0">
                                <Input
                                  value={cell.value}
                                  onChange={(e) => onUpdateTableCell(ri, ci, e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </td>
                            ))}
                            <td className="p-2 w-12">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemoveTableRow(ri)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="outline" size="sm" onClick={onAddTableRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add Row
                  </Button>
                </div>
              )}

              {field.type === 'content' && (
                <div className="space-y-3">
                  <Label className="text-sm">Content Blocks</Label>
                  {field.contentBlocks?.map((block, bi) => (
                    <div key={bi} className="flex gap-2 items-start">
                      <Badge variant="secondary" className="mt-2">{block.type}</Badge>
                      <div className="flex-1">
                        {block.type === 'list' ? (
                          <Textarea
                            value={block.items?.join('\n') || ''}
                            onChange={(e) => onUpdateContentBlock(bi, { items: e.target.value.split('\n').filter(Boolean) })}
                            placeholder="One item per line"
                            rows={3}
                          />
                        ) : block.type === 'link' ? (
                          <div className="space-y-2">
                            <Input
                              value={block.linkText || ''}
                              onChange={(e) => onUpdateContentBlock(bi, { linkText: e.target.value })}
                              placeholder="Link text"
                            />
                            <Input
                              value={block.url || ''}
                              onChange={(e) => onUpdateContentBlock(bi, { url: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                        ) : (
                          <Textarea
                            value={block.text || ''}
                            onChange={(e) => onUpdateContentBlock(bi, { text: e.target.value })}
                            placeholder="Enter text..."
                            rows={block.type === 'heading' ? 1 : 3}
                          />
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveContentBlock(bi)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onAddContentBlock('paragraph')}>
                      <AlignLeft className="h-3 w-3 mr-1" /> Paragraph
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onAddContentBlock('heading')}>
                      <Heading className="h-3 w-3 mr-1" /> Heading
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onAddContentBlock('list')}>
                      <List className="h-3 w-3 mr-1" /> List
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onAddContentBlock('link')}>
                      <Link className="h-3 w-3 mr-1" /> Link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} data-testid={`button-remove-field-${index}`}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

interface FormPreviewProps {
  title: string;
  description: string;
  coverImage: string;
  fields: FormField[];
}

function FormPreview({ title, description, coverImage, fields }: FormPreviewProps) {
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});

  const shouldShowField = (field: FormField): boolean => {
    if (!field.showWhen) return true;
    const triggerValue = formValues[field.showWhen.fieldId];
    const conditionValue = field.showWhen.value;
    
    switch (field.showWhen.operator) {
      case 'equals':
        return triggerValue === conditionValue || (Array.isArray(triggerValue) && triggerValue.includes(conditionValue));
      case 'not_equals':
        return triggerValue !== conditionValue && (!Array.isArray(triggerValue) || !triggerValue.includes(conditionValue));
      case 'contains':
        return Array.isArray(triggerValue) ? triggerValue.includes(conditionValue) : String(triggerValue || '').includes(conditionValue);
      default:
        return true;
    }
  };

  const visibleFields = fields.filter(shouldShowField);

  return (
    <div className="bg-[#f5f0e8] rounded-lg overflow-hidden border border-[#e5ddd0]">
      {coverImage && (
        <div className="h-20 overflow-hidden">
          <img src={coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="bg-white m-4 rounded-lg p-6 space-y-6 border border-[#e5ddd0]">
        <div className="border-b border-[#e5ddd0] pb-4">
          <h2 className="text-2xl font-bold text-[#3d3428]">{title || "Untitled Form"}</h2>
          {description && <p className="text-[#6b5d4d] mt-2 leading-relaxed">{description}</p>}
        </div>

        {visibleFields.map((field) => (
          <div key={field.id} className="space-y-2">
            {field.type === 'heading' && (
              <h3 className="text-lg font-semibold pt-4 border-t border-[#e5ddd0] text-[#3d3428]">{field.label}</h3>
            )}

            {field.type === 'content' && (
              <div className="py-3 px-4 bg-[#faf7f2] rounded-md border border-[#e5ddd0]">
                <h4 className="font-medium text-[#3d3428] mb-2">{field.label}</h4>
                <div className="text-[#6b5d4d] text-sm space-y-2">
                  {field.contentBlocks?.map((block, bi) => (
                    <div key={bi}>
                      {block.type === 'heading' && <h5 className="font-semibold text-[#3d3428]">{block.text}</h5>}
                      {block.type === 'paragraph' && <p>{block.text}</p>}
                      {block.type === 'list' && (
                        <ul className="list-disc pl-5 space-y-1">
                          {block.items?.map((item, ii) => <li key={ii}>{item}</li>)}
                        </ul>
                      )}
                      {block.type === 'link' && (
                        <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-[#8b5a2b] underline hover:no-underline">
                          {block.linkText}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {field.type === 'table' && (
              <div>
                <Label className="font-medium text-[#3d3428]">{field.label}</Label>
                {field.description && <p className="text-[#8b7355] text-sm mt-1">{field.description}</p>}
                <div className="border border-[#d4cbc0] rounded-md overflow-x-auto mt-2 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f5f0e8]">
                      <tr>
                        {field.tableColumns?.map((col) => (
                          <th key={col.id} className="p-3 text-left font-medium text-[#3d3428] border-r border-[#e5ddd0] last:border-r-0">
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {field.tableRows?.map((row, ri) => (
                        <tr key={ri} className="border-t border-[#e5ddd0]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="p-3 text-[#5c4f3d] border-r border-[#e5ddd0] last:border-r-0">
                              {cell.value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {field.type !== 'heading' && field.type !== 'content' && field.type !== 'table' && (
              <div>
                <Label className="font-medium text-[#3d3428]">
                  {field.label}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </Label>
                {field.description && (
                  <p className="text-sm text-[#8b7355]">{field.description}</p>
                )}
                <div className="mt-1.5">
                  {(field.type === 'text' || field.type === 'email' || field.type === 'number') && (
                    <Input
                      type={field.type}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      value={String(formValues[field.id] || '')}
                      onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
                      className="border-[#d4cbc0] focus:border-[#8b7355] focus:ring-[#8b7355]"
                    />
                  )}
                  {field.type === 'textarea' && (
                    <Textarea
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      value={String(formValues[field.id] || '')}
                      onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
                      className="border-[#d4cbc0] focus:border-[#8b7355] focus:ring-[#8b7355]"
                    />
                  )}
                  {field.type === 'date' && (
                    <Input
                      type="date"
                      value={String(formValues[field.id] || '')}
                      onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
                      className="border-[#d4cbc0] focus:border-[#8b7355] focus:ring-[#8b7355]"
                    />
                  )}
                  {field.type === 'single-select' && (
                    <Select
                      value={String(formValues[field.id] || '')}
                      onValueChange={(val) => setFormValues({ ...formValues, [field.id]: val })}
                    >
                      <SelectTrigger className="border-[#d4cbc0]">
                        <SelectValue placeholder={field.placeholder || "Choose one..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === 'multi-select' && (
                    <div className="space-y-2">
                      {field.options?.map((opt) => {
                        const selected = Array.isArray(formValues[field.id]) && formValues[field.id].includes(opt);
                        return (
                          <div key={opt} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const current = Array.isArray(formValues[field.id]) ? formValues[field.id] as string[] : [];
                                setFormValues({
                                  ...formValues,
                                  [field.id]: e.target.checked ? [...current, opt] : current.filter(v => v !== opt)
                                });
                              }}
                              className="h-4 w-4 border-[#d4cbc0] accent-[#5c4f3d]"
                            />
                            <span className="text-[#5c4f3d]">{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {field.type === 'file' && (
                    <div className="border-2 border-dashed border-[#d4cbc0] rounded-lg p-6 text-center cursor-pointer hover:border-[#8b7355] hover:bg-[#faf7f2] transition-colors">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-[#8b7355]" />
                      <p className="text-sm text-[#5c4f3d] font-medium">Click to upload files</p>
                      <p className="text-xs text-[#8b7355] mt-1">Drag and drop or click to browse</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        <Button className="w-full bg-[#5c4f3d] hover:bg-[#4a3f31] text-white" disabled>Submit (Preview Mode)</Button>
      </div>
    </div>
  );
}

function SubmissionsDialog({ open, onOpenChange, form }: { open: boolean; onOpenChange: (open: boolean) => void; form: Form | null }) {
  const { data: submissions, isLoading } = useFormSubmissions(form?.id);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  if (!form) return null;

  const handleDownloadPDF = (submission: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(form.title, margin, yPos);
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Form Submission Report', margin, yPos);
    yPos += 15;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.text('Submitted By:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(submission.submitterName || 'Anonymous', margin + 35, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Email:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(submission.submitterEmail || 'Not provided', margin + 35, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(submission.createdAt), 'MMMM d, yyyy \'at\' h:mm a'), margin + 35, yPos);
    yPos += 15;

    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Responses', margin, yPos);
    yPos += 10;

    let attachmentCount = 0;
    const attachments: { label: string; url: string; filename: string }[] = [];

    submission.responses.forEach((resp: any) => {
      const field = form.fields.find(f => f.id === resp.fieldId);
      const isFile = field?.type === 'file';
      
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(field?.label || resp.fieldId, margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);

      if (isFile) {
        const files = Array.isArray(resp.value) ? resp.value : [resp.value];
        files.forEach((file: any) => {
          if (file && (file.url || typeof file === 'string')) {
            attachmentCount++;
            const filename = file.filename || `Attachment ${attachmentCount}`;
            const url = file.url || file;
            attachments.push({ label: field?.label || 'File', url, filename });
            doc.text(`[Attachment ${attachmentCount}] ${filename}`, margin + 5, yPos);
            yPos += 5;
          }
        });
      } else {
        const value = Array.isArray(resp.value) ? resp.value.join(', ') : String(resp.value || 'No response');
        const lines = doc.splitTextToSize(value, maxWidth - 5);
        lines.forEach((line: string) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
      }
      yPos += 8;
    });

    if (attachments.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      yPos += 5;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('File Attachments', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      attachments.forEach((att, i) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${i + 1}. ${att.filename}`, margin, yPos);
        yPos += 4;
        doc.setTextColor(0, 100, 200);
        const urlLines = doc.splitTextToSize(att.url, maxWidth - 10);
        urlLines.forEach((line: string) => {
          doc.text(line, margin + 5, yPos);
          yPos += 4;
        });
        doc.setTextColor(60, 60, 60);
        yPos += 3;
      });
    }

    const filename = `${form.title.replace(/[^a-z0-9]/gi, '_')}_${submission.submitterName?.replace(/[^a-z0-9]/gi, '_') || 'submission'}.pdf`;
    doc.save(filename);
    toast.success('PDF downloaded successfully');
  };

  const renderFileValue = (value: any) => {
    if (!value) return null;
    
    if (typeof value === 'object' && value.url) {
      return (
        <a 
          href={value.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 bg-muted hover:bg-accent text-foreground rounded-lg transition-colors"
        >
          <Paperclip className="h-4 w-4" />
          <span className="font-medium">{value.filename || 'View attachment'}</span>
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((file: any, idx: number) => (
            <a 
              key={idx}
              href={file.url || file} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-muted hover:bg-accent text-foreground rounded-lg transition-colors"
            >
              <Paperclip className="h-4 w-4" />
              <span className="font-medium">{file.filename || `File ${idx + 1}`}</span>
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          ))}
        </div>
      );
    }
    
    return String(value);
  };

  const renderResponseValue = (field: FormField | undefined, value: any) => {
    if (!value && value !== 0) return <span className="text-muted-foreground italic">No response</span>;
    
    if (field?.type === 'file') {
      return renderFileValue(value);
    }
    
    if (field?.type === 'multi-select' && Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item: string, idx: number) => (
            <Badge key={idx} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      );
    }
    
    if (field?.type === 'single-select') {
      return (
        <Badge variant="secondary">
          {String(value)}
        </Badge>
      );
    }
    
    if (field?.type === 'date') {
      try {
        return <span className="text-foreground">{format(new Date(value), 'MMMM d, yyyy')}</span>;
      } catch {
        return <span className="text-foreground">{String(value)}</span>;
      }
    }
    
    return (
      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
        {Array.isArray(value) ? value.join(', ') : String(value)}
      </p>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) setSelectedSubmission(null); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          {selectedSubmission ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)} data-testid="button-back-submissions">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <DialogTitle>Submission Details</DialogTitle>
                <DialogDescription>
                  View complete form responses
                </DialogDescription>
              </div>
            </div>
          ) : (
            <>
              <DialogTitle>Submissions for "{form.title}"</DialogTitle>
              <DialogDescription>
                {submissions?.length || 0} response{submissions?.length !== 1 ? 's' : ''} received
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          {selectedSubmission ? (
            <div className="py-4 space-y-6">
              <div className="bg-gradient-to-r from-muted to-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {selectedSubmission.submitterName || 'Anonymous'}
                      </h3>
                      <p className="text-muted-foreground">{selectedSubmission.submitterEmail || 'No email provided'}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(selectedSubmission.createdAt), 'MMMM d, yyyy \'at\' h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDownloadPDF(selectedSubmission)} 
                    data-testid="button-download-submission-detail"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Form Responses</h4>
                
                <div className="grid gap-4">
                  {selectedSubmission.responses.map((resp: any, i: number) => {
                    const field = form.fields.find(f => f.id === resp.fieldId);
                    
                    return (
                      <div 
                        key={i} 
                        className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow"
                        data-testid={`response-field-${i}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Label className="text-sm font-medium text-muted-foreground block mb-2">
                              {field?.label || resp.fieldId}
                            </Label>
                            <div className="mt-1">
                              {renderResponseValue(field, resp.value)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-muted-foreground">Loading submissions...</p>
              </div>
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="space-y-3 py-4">
              {submissions.map((sub) => (
                <Card 
                  key={sub.id} 
                  className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                  onClick={() => setSelectedSubmission(sub)}
                  data-testid={`card-submission-${sub.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{sub.submitterName || 'Anonymous'}</p>
                          <p className="text-sm text-muted-foreground">{sub.submitterEmail || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(sub.createdAt), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {format(new Date(sub.createdAt), 'h:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setSelectedSubmission(sub); }}
                            data-testid={`button-view-submission-${sub.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDownloadPDF(sub); }}
                            data-testid={`button-download-submission-${sub.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No submissions yet</h3>
              <p className="text-muted-foreground">Share this form to start collecting responses</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
