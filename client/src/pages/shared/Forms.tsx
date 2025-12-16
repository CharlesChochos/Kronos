import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useForms, useCreateForm, useUpdateForm, useDeleteForm, usePublishForm, useShareForm, useFormSubmissions, useCurrentUser, type Form, type FormField } from "@/lib/api";
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
import { toast } from "sonner";
import { Plus, FileText, Share2, Trash2, Edit, Eye, Copy, Send, GripVertical, X, Type, Mail, List, Calendar, Hash, Paperclip, Heading } from "lucide-react";
import { format } from "date-fns";

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'single-select', label: 'Single Select', icon: List },
  { value: 'multi-select', label: 'Multi Select', icon: List },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'file', label: 'File Upload', icon: Paperclip },
  { value: 'heading', label: 'Section Heading', icon: Heading },
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
  const shareForm = useShareForm();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");
  const [shareEmails, setShareEmails] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const [editingFields, setEditingFields] = useState<FormField[]>([]);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const canAccessForms = currentUser?.name?.toLowerCase().includes('dimitra') || 
                         currentUser?.email?.toLowerCase().includes('dimitra') ||
                         currentUser?.name?.toLowerCase().includes('charles') || 
                         currentUser?.email?.toLowerCase().includes('charles');

  if (!canAccessForms) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You do not have access to this page.</p>
        </div>
      </Layout>
    );
  }

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
      setEditingFields(form.fields || []);
      setShowEditDialog(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenEdit = (form: Form) => {
    setSelectedForm(form);
    setEditingTitle(form.title);
    setEditingDescription(form.description || "");
    setEditingFields(form.fields || []);
    setShowEditDialog(true);
  };

  const handleSaveForm = async () => {
    if (!selectedForm) return;
    try {
      await updateForm.mutateAsync({
        id: selectedForm.id,
        title: editingTitle,
        description: editingDescription,
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

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: type === 'heading' ? 'Section Title' : `New ${type} field`,
      required: false,
      options: type === 'single-select' || type === 'multi-select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setEditingFields([...editingFields, newField]);
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

  return (
    <Layout role={role}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title-forms">Forms</h1>
            <p className="text-muted-foreground">Create and share forms to collect information</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-form">
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading forms...</p>
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} data-testid={`card-form-${form.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{form.title}</CardTitle>
                    {form.description && (
                      <CardDescription className="mt-1">{form.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
                    {form.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>{form.fields?.length || 0} fields</p>
                  <p>Created {format(new Date(form.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(form)} data-testid={`button-edit-form-${form.id}`}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {form.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => handlePublishForm(form)} data-testid={`button-publish-form-${form.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No forms yet</h3>
            <p className="text-muted-foreground mb-4">Create your first form to start collecting information</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Form
            </Button>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Form</DialogTitle>
            <DialogDescription>Add and configure form fields</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-title">Title</Label>
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
              <Label className="mb-3 block">Add Field</Label>
              <div className="flex flex-wrap gap-2">
                {FIELD_TYPES.map((ft) => (
                  <Button key={ft.value} variant="outline" size="sm" onClick={() => addField(ft.value)} data-testid={`button-add-field-${ft.value}`}>
                    <ft.icon className="h-4 w-4 mr-1" />
                    {ft.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Form Fields ({editingFields.length})</Label>
              {editingFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border rounded-md">
                  No fields yet. Click a field type above to add one.
                </p>
              ) : (
                editingFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, index - 1)} disabled={index === 0}>
                          <GripVertical className="h-4 w-4 rotate-180" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, index + 1)} disabled={index === editingFields.length - 1}>
                          <GripVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{field.type}</Badge>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            placeholder="Field label"
                            className="flex-1"
                            data-testid={`input-field-label-${index}`}
                          />
                          {field.type !== 'heading' && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={field.required}
                                onCheckedChange={(checked) => updateField(index, { required: checked })}
                                data-testid={`switch-required-${index}`}
                              />
                              <Label className="text-sm">Required</Label>
                            </div>
                          )}
                        </div>
                        {(field.type === 'single-select' || field.type === 'multi-select') && (
                          <div>
                            <Label className="text-sm">Options (comma-separated)</Label>
                            <Input
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => updateField(index, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                              placeholder="Option 1, Option 2, Option 3"
                              data-testid={`input-field-options-${index}`}
                            />
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeField(index)} data-testid={`button-remove-field-${index}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveForm} disabled={updateForm.isPending} data-testid="button-save-form">
              {updateForm.isPending ? "Saving..." : "Save Form"}
            </Button>
          </DialogFooter>
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

function SubmissionsDialog({ open, onOpenChange, form }: { open: boolean; onOpenChange: (open: boolean) => void; form: Form | null }) {
  const { data: submissions, isLoading } = useFormSubmissions(form?.id);

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submissions for "{form.title}"</DialogTitle>
          <DialogDescription>View all responses to this form</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading submissions...</p>
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <Card key={sub.id}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sub.submitterName || 'Anonymous'}</p>
                      <p className="text-sm text-muted-foreground">{sub.submitterEmail || 'No email'}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(sub.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="space-y-2">
                    {sub.responses.map((resp, i) => {
                      const field = form.fields.find(f => f.id === resp.fieldId);
                      return (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{field?.label || resp.fieldId}: </span>
                          <span>{Array.isArray(resp.value) ? resp.value.join(', ') : String(resp.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">No submissions yet</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
