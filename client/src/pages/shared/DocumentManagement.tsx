import { useState, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  FileText,
  Upload,
  Search,
  Download,
  Trash2,
  Edit2,
  FolderOpen,
  File,
  FileSpreadsheet,
  FileImage,
  FileCode,
  Filter,
  Plus,
  Eye,
  Briefcase,
  Clock,
  User,
  Tag,
  Loader2,
  X,
} from "lucide-react";
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useDeals, useCurrentUser, type DocumentRecord } from "@/lib/api";

type DocumentManagementProps = {
  role?: 'CEO' | 'Employee';
};

const documentCategories = [
  { value: "deal_document", label: "Deal Documents" },
  { value: "compliance", label: "Compliance" },
  { value: "template", label: "Templates" },
  { value: "internal", label: "Internal" },
  { value: "client", label: "Client Materials" },
  { value: "general", label: "General" },
];

const documentTypes = [
  { value: "teaser", label: "Teaser" },
  { value: "cim", label: "CIM" },
  { value: "nda", label: "NDA" },
  { value: "loi", label: "LOI" },
  { value: "term_sheet", label: "Term Sheet" },
  { value: "sba", label: "SBA" },
  { value: "uploaded", label: "Uploaded File" },
  { value: "report", label: "Report" },
  { value: "presentation", label: "Presentation" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "other", label: "Other" },
];

const getFileIcon = (mimeType?: string, type?: string) => {
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || type === 'spreadsheet') {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (mimeType?.includes('image')) {
    return <FileImage className="h-5 w-5 text-purple-500" />;
  }
  if (mimeType?.includes('pdf')) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (mimeType?.includes('code') || mimeType?.includes('json') || mimeType?.includes('xml')) {
    return <FileCode className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentManagement({ role = 'CEO' }: DocumentManagementProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: documents = [], isLoading } = useDocuments();
  const { data: deals = [] } = useDeals();
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dealFilter, setDealFilter] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    title: "",
    type: "uploaded",
    category: "general",
    dealId: "",
    tags: "",
    file: null as File | null,
  });

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.filename || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.uploaderName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesDeal = dealFilter === "all" || doc.dealId === dealFilter;
    return matchesSearch && matchesCategory && matchesDeal;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setUploadForm({ ...uploadForm, file, title: uploadForm.title || file.name.replace(/\.[^/.]+$/, "") });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result as string;
        const selectedDeal = deals.find(d => d.id === uploadForm.dealId);

        await createDocument.mutateAsync({
          title: uploadForm.title,
          type: uploadForm.type,
          category: uploadForm.category,
          filename: uploadForm.file!.name,
          originalName: uploadForm.file!.name,
          mimeType: uploadForm.file!.type,
          size: uploadForm.file!.size,
          content: base64Content,
          dealId: uploadForm.dealId || undefined,
          dealName: selectedDeal?.name || undefined,
          tags: uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()) : [],
        });

        toast.success("Document uploaded successfully");
        setShowUploadDialog(false);
        setUploadForm({
          title: "",
          type: "uploaded",
          category: "general",
          dealId: "",
          tags: "",
          file: null,
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
      };

      reader.readAsDataURL(uploadForm.file);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (doc: DocumentRecord) => {
    setSelectedDocument(doc);
    setShowEditDialog(true);
  };

  const handleUpdateDocument = async (updates: Partial<DocumentRecord>) => {
    if (!selectedDocument) return;

    try {
      await updateDocument.mutateAsync({ id: selectedDocument.id, updates });
      toast.success("Document updated successfully");
      setShowEditDialog(false);
      setSelectedDocument(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update document");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocument.mutateAsync(id);
      toast.success("Document deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const handleDownload = (doc: DocumentRecord) => {
    if (!doc.content) {
      toast.error("Document content not available for download");
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = doc.content;
      link.download = doc.originalName || doc.filename || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const handlePreview = (doc: DocumentRecord) => {
    setSelectedDocument(doc);
    setShowPreviewDialog(true);
  };

  const documentsByCategory = documentCategories.map(cat => ({
    ...cat,
    count: documents.filter(d => d.category === cat.value).length,
  }));

  return (
    <Layout role={role} userName={currentUser?.name} pageTitle="Document Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Document Management</h1>
            <p className="text-muted-foreground mt-1">
              Upload, organize, and manage your documents
            </p>
          </div>
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-upload-document">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </DialogTitle>
                <DialogDescription>
                  Upload a new document to the platform
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>File *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.gif"
                      data-testid="input-file-upload"
                    />
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        {getFileIcon(uploadForm.file.type)}
                        <span className="text-sm">{uploadForm.file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadForm({ ...uploadForm, file: null });
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer"
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to select a file (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-title">Title *</Label>
                  <Input
                    id="doc-title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="Document title"
                    data-testid="input-document-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={uploadForm.type}
                      onValueChange={(value) => setUploadForm({ ...uploadForm, type: value })}
                    >
                      <SelectTrigger data-testid="select-document-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={uploadForm.category}
                      onValueChange={(value) => setUploadForm({ ...uploadForm, category: value })}
                    >
                      <SelectTrigger data-testid="select-document-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Associate with Deal (optional)</Label>
                  <Select
                    value={uploadForm.dealId}
                    onValueChange={(value) => setUploadForm({ ...uploadForm, dealId: value })}
                  >
                    <SelectTrigger data-testid="select-document-deal">
                      <SelectValue placeholder="Select a deal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No deal association</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-tags">Tags (comma-separated)</Label>
                  <Input
                    id="doc-tags"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="e.g., confidential, quarterly, draft"
                    data-testid="input-document-tags"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || createDocument.isPending || !uploadForm.file || !uploadForm.title}
                  data-testid="button-confirm-upload"
                >
                  {isUploading || createDocument.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {documentsByCategory.map((cat) => (
            <Card
              key={cat.value}
              className={`border-border bg-card/50 cursor-pointer transition-colors hover:border-primary/50 ${
                categoryFilter === cat.value ? "border-primary" : ""
              }`}
              onClick={() => setCategoryFilter(categoryFilter === cat.value ? "all" : cat.value)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{cat.count}</p>
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                  </div>
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Documents</CardTitle>
                <CardDescription>
                  {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-secondary/50"
                    data-testid="input-search-documents"
                  />
                </div>
                <Select value={dealFilter} onValueChange={setDealFilter}>
                  <SelectTrigger className="w-48" data-testid="select-filter-deal">
                    <Briefcase className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by deal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Deals</SelectItem>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(categoryFilter !== "all" || dealFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCategoryFilter("all");
                      setDealFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {documents.length === 0
                  ? "No documents yet. Upload your first document!"
                  : "No documents match your filters."}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow
                        key={doc.id}
                        className="border-border"
                        data-testid={`row-document-${doc.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.mimeType, doc.type)}
                            <div>
                              <p className="font-medium">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">{doc.filename}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                            {documentTypes.find(t => t.value === doc.type)?.label || doc.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {documentCategories.find(c => c.value === doc.category)?.label || doc.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          {doc.dealName ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Briefcase className="h-3 w-3" />
                              {doc.dealName}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatFileSize(doc.size)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">{format(new Date(doc.createdAt), "MMM d, yyyy")}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {doc.uploaderName || "Unknown"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {doc.content && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePreview(doc)}
                                data-testid={`button-preview-document-${doc.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(doc)}
                              data-testid={`button-download-document-${doc.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(doc)}
                              data-testid={`button-edit-document-${doc.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:bg-red-500/10"
                              onClick={() => handleDelete(doc.id)}
                              data-testid={`button-delete-document-${doc.id}`}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Document</DialogTitle>
              <DialogDescription>Update document details</DialogDescription>
            </DialogHeader>
            {selectedDocument && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    defaultValue={selectedDocument.title}
                    onChange={(e) => setSelectedDocument({ ...selectedDocument, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={selectedDocument.type}
                      onValueChange={(value) => setSelectedDocument({ ...selectedDocument, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={selectedDocument.category}
                      onValueChange={(value) => setSelectedDocument({ ...selectedDocument, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Associate with Deal</Label>
                  <Select
                    value={selectedDocument.dealId || ""}
                    onValueChange={(value) => {
                      const deal = deals.find(d => d.id === value);
                      setSelectedDocument({
                        ...selectedDocument,
                        dealId: value || undefined,
                        dealName: deal?.name || undefined,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No deal association" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No deal association</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  handleUpdateDocument({
                    title: selectedDocument?.title,
                    type: selectedDocument?.type,
                    category: selectedDocument?.category,
                    dealId: selectedDocument?.dealId,
                    dealName: selectedDocument?.dealName,
                  })
                }
                disabled={updateDocument.isPending}
              >
                {updateDocument.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedDocument && getFileIcon(selectedDocument.mimeType, selectedDocument.type)}
                {selectedDocument?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="relative h-[70vh] bg-secondary/30 rounded-lg overflow-hidden">
              {selectedDocument?.content && selectedDocument.mimeType?.includes('image') ? (
                <img
                  src={selectedDocument.content}
                  alt={selectedDocument.title}
                  className="w-full h-full object-contain"
                />
              ) : selectedDocument?.content && selectedDocument.mimeType?.includes('pdf') ? (
                <iframe
                  src={selectedDocument.content}
                  className="w-full h-full"
                  title={selectedDocument.title}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4" />
                    <p>Preview not available for this file type</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => selectedDocument && handleDownload(selectedDocument)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
