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
  Sparkles,
  Save,
  Copy,
  FileSignature,
  Scale,
  HandshakeIcon,
  ScrollText,
  ClipboardList,
  FileCheck,
  Building2,
  PenLine,
  ExternalLink,
} from "lucide-react";
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useDealsListing, useCurrentUser, type DocumentRecord } from "@/lib/api";

type DocumentManagementProps = {
  role?: 'CEO' | 'Employee';
  defaultTab?: 'templates' | 'library';
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

const ibTemplates = [
  { 
    id: "nda", 
    name: "Non-Disclosure Agreement", 
    shortName: "NDA",
    description: "Confidentiality agreement for deal discussions",
    icon: FileSignature,
    category: "Legal"
  },
  { 
    id: "teaser", 
    name: "Investment Teaser", 
    shortName: "Teaser",
    description: "One-page investment opportunity summary",
    icon: FileText,
    category: "Marketing"
  },
  { 
    id: "cim", 
    name: "Confidential Info Memo", 
    shortName: "CIM",
    description: "Comprehensive company information memorandum",
    icon: ScrollText,
    category: "Marketing"
  },
  { 
    id: "loi", 
    name: "Letter of Intent", 
    shortName: "LOI",
    description: "Non-binding preliminary acquisition terms",
    icon: PenLine,
    category: "Legal"
  },
  { 
    id: "term_sheet", 
    name: "Term Sheet", 
    shortName: "Term Sheet",
    description: "Key transaction terms and conditions",
    icon: ClipboardList,
    category: "Legal"
  },
  { 
    id: "engagement_letter", 
    name: "Engagement Letter", 
    shortName: "Engagement",
    description: "Advisory services agreement",
    icon: HandshakeIcon,
    category: "Legal"
  },
  { 
    id: "due_diligence_checklist", 
    name: "Due Diligence Checklist", 
    shortName: "DD Checklist",
    description: "Comprehensive DD request list",
    icon: FileCheck,
    category: "Operations"
  },
  { 
    id: "management_presentation", 
    name: "Management Presentation", 
    shortName: "Mgmt Pres",
    description: "Executive team presentation outline",
    icon: Building2,
    category: "Marketing"
  },
  { 
    id: "fairness_opinion", 
    name: "Fairness Opinion", 
    shortName: "Fairness",
    description: "Transaction fairness assessment",
    icon: Scale,
    category: "Analysis"
  },
  { 
    id: "process_letter", 
    name: "Process Letter", 
    shortName: "Process",
    description: "Bid process instructions for buyers",
    icon: ScrollText,
    category: "Operations"
  },
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

export default function DocumentManagement({ role = 'CEO', defaultTab = 'templates' }: DocumentManagementProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: documents = [], isLoading } = useDocuments();
  const { data: deals = [] } = useDealsListing();
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
  
    const [selectedTemplate, setSelectedTemplate] = useState<typeof ibTemplates[0] | null>(null);
  const [selectedDealForGeneration, setSelectedDealForGeneration] = useState<string>("none");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    type: "uploaded",
    category: "general",
    dealId: "",
    tags: "",
    files: [] as File[],
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
  
  const filteredTemplates = ibTemplates.filter((template) =>
    template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    template.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
    template.category.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds 10MB limit`);
      } else {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length > 0) {
      setUploadForm({ ...uploadForm, files: [...uploadForm.files, ...validFiles] });
    }
  };

  const removeFile = (index: number) => {
    setUploadForm({
      ...uploadForm,
      files: uploadForm.files.filter((_, i) => i !== index)
    });
  };

  const handleUpload = async () => {
    if (uploadForm.files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsUploading(true);
    const dealIdToUse = uploadForm.dealId === "none" ? undefined : uploadForm.dealId || undefined;
    const selectedDeal = dealIdToUse ? deals.find(d => d.id === dealIdToUse) : undefined;
    const tags = uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()) : [];

    let uploadedCount = 0;
    let failedCount = 0;

    try {
      for (const file of uploadForm.files) {
        try {
          const base64Content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });

          await createDocument.mutateAsync({
            title: file.name.replace(/\.[^/.]+$/, ""),
            type: uploadForm.type,
            category: uploadForm.category,
            filename: file.name,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            content: base64Content,
            dealId: dealIdToUse,
            dealName: selectedDeal?.name || undefined,
            tags,
          });
          uploadedCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failedCount++;
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} document(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
      } else {
        toast.error("Failed to upload documents");
      }

      setShowUploadDialog(false);
      setUploadForm({
        type: "uploaded",
        category: "general",
        dealId: "",
        tags: "",
        files: [],
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload documents");
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

  const handleDownload = async (doc: DocumentRecord & { contentUnavailable?: boolean }) => {
    // Check if legacy file is unavailable
    if (doc.contentUnavailable) {
      toast.error("This file was stored in temporary storage and is no longer available. Please re-upload the document.");
      return;
    }

    try {
      // Use the server download endpoint which handles all content types properly
      const response = await fetch(`/api/documents/${doc.id}/download`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Download failed" }));
        toast.error(error.error || "Failed to download document");
        return;
      }
      
      // Create a blob from the response and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName || doc.filename || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download document");
    }
  };

  // Helper to infer mimeType from filename if not provided
  const inferMimeType = (doc: DocumentRecord): string => {
    if (doc.mimeType) return doc.mimeType;
    const filename = (doc.originalName || doc.filename || '').toLowerCase();
    if (filename.endsWith('.pdf')) return 'application/pdf';
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
    if (filename.endsWith('.gif')) return 'image/gif';
    if (filename.endsWith('.txt')) return 'text/plain';
    if (filename.endsWith('.csv')) return 'text/csv';
    if (filename.endsWith('.doc') || filename.endsWith('.docx')) return 'application/msword';
    if (filename.endsWith('.xls') || filename.endsWith('.xlsx')) return 'application/vnd.ms-excel';
    return '';
  };

  // Check if document can be viewed in browser
  const canViewInBrowser = (doc: DocumentRecord & { contentUnavailable?: boolean }): boolean => {
    // Can't view if content is unavailable (legacy files)
    if (doc.contentUnavailable) return false;
    const mimeType = inferMimeType(doc);
    // PDFs and images can be viewed in browser
    return mimeType.includes('pdf') || mimeType.includes('image') || mimeType.includes('text');
  };

  const handleViewInNewTab = async (doc: DocumentRecord & { contentUnavailable?: boolean }) => {
    // Check if legacy file is unavailable
    if (doc.contentUnavailable) {
      toast.error("This file was stored in temporary storage and is no longer available. Please re-upload the document.");
      return;
    }

    try {
      // Use the server download endpoint and open the result in a new tab
      const response = await fetch(`/api/documents/${doc.id}/download`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to open document" }));
        toast.error(error.error || "Failed to open document");
        return;
      }
      
      // Create a blob URL and open it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        toast.error("Unable to open document. Please allow popups for this site.");
        window.URL.revokeObjectURL(url);
      }
      // Note: We don't revoke the URL immediately because the new window needs it
    } catch (error) {
      console.error('Failed to open document:', error);
      toast.error("Failed to open document");
    }
  };

  const handlePreview = (doc: DocumentRecord) => {
    setSelectedDocument(doc);
    setShowPreviewDialog(true);
  };
  
  const handleTemplateSelect = (template: typeof ibTemplates[0]) => {
    setSelectedTemplate(template);
    setGeneratedContent("");
    setIsEditing(false);
  };
  
  const handleGenerateDocument = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const hasDeal = selectedDealForGeneration && selectedDealForGeneration !== "none";
      const dealData = hasDeal ? deals.find(d => d.id === selectedDealForGeneration) : null;
      
      const response = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateName: selectedTemplate.name,
          dealId: hasDeal ? selectedDealForGeneration : undefined,
          deal: dealData,
          compliance: { sec: true, finra: true, legal: true }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate document');
      }
      
      const data = await response.json();
      setGeneratedContent(data.content);
      toast.success("Document generated successfully!");
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || "Failed to generate document");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSaveGeneratedDocument = async () => {
    if (!generatedContent || !selectedTemplate) {
      toast.error("No document content to save");
      return;
    }
    
    try {
      const hasDeal = selectedDealForGeneration && selectedDealForGeneration !== "none";
      const dealData = hasDeal ? deals.find(d => d.id === selectedDealForGeneration) : null;
      const textEncoder = new TextEncoder();
      const contentBytes = textEncoder.encode(generatedContent);
      
      // Convert UTF-8 bytes to base64 safely (handles non-ASCII characters)
      const binaryString = Array.from(contentBytes, byte => String.fromCharCode(byte)).join('');
      const base64Content = `data:text/plain;base64,${btoa(binaryString)}`;
      
      await createDocument.mutateAsync({
        title: `${selectedTemplate.name}${dealData ? ` - ${dealData.name}` : ''}`,
        type: selectedTemplate.id,
        category: "deal_document",
        filename: `${selectedTemplate.shortName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.txt`,
        originalName: `${selectedTemplate.shortName}.txt`,
        mimeType: 'text/plain',
        size: contentBytes.length,
        content: base64Content,
        dealId: hasDeal ? selectedDealForGeneration : undefined,
        dealName: dealData?.name || undefined,
        tags: ['ai-generated', selectedTemplate.category.toLowerCase()],
      });
      
      toast.success("Document saved to library!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save document");
    }
  };
  
  const handleCopyContent = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Content copied to clipboard!");
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
              Generate AI-powered documents or manage your document library
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-upload-document">
                  <Upload className="h-4 w-4" />
                  Upload
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
                    <Label>Files *</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.gif"
                        data-testid="input-file-upload"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer"
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to select files (max 10MB each)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          You can select multiple files at once
                        </p>
                      </div>
                    </div>
                    {uploadForm.files.length > 0 && (
                      <div className="space-y-2 mt-3 max-h-32 overflow-y-auto">
                        {uploadForm.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileIcon(file.type)}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
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
                        <SelectItem value="none">No deal association</SelectItem>
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
                    disabled={isUploading || createDocument.isPending || uploadForm.files.length === 0}
                    data-testid="button-confirm-upload"
                  >
                    {isUploading || createDocument.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading {uploadForm.files.length} file(s)...
                      </>
                    ) : (
                      `Upload ${uploadForm.files.length > 0 ? `(${uploadForm.files.length})` : ''}`
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {defaultTab === 'templates' && (
          <div className="space-y-0">
            <div className="grid grid-cols-12 gap-6 min-h-[600px]">
              <div className="col-span-3">
                <Card className="h-full border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">IB Templates</CardTitle>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                        data-testid="input-search-templates"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-1 px-3 pb-3">
                        {filteredTemplates.map((template) => {
                          const Icon = template.icon;
                          return (
                            <div
                              key={template.id}
                              onClick={() => handleTemplateSelect(template)}
                              className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-secondary/80 ${
                                selectedTemplate?.id === template.id 
                                  ? 'bg-primary/10 border border-primary/30' 
                                  : 'border border-transparent'
                              }`}
                              data-testid={`template-${template.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-md ${
                                  selectedTemplate?.id === template.id 
                                    ? 'bg-primary/20 text-primary' 
                                    : 'bg-secondary text-muted-foreground'
                                }`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{template.name}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {template.description}
                                  </p>
                                  <Badge variant="outline" className="mt-1.5 text-[10px] px-1.5 py-0">
                                    {template.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              <div className="col-span-9">
                <Card className="h-full border-border">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {selectedTemplate ? selectedTemplate.name : 'Select a Template'}
                        </CardTitle>
                        <CardDescription>
                          {selectedTemplate 
                            ? selectedTemplate.description 
                            : 'Choose a template from the left panel to generate a document'}
                        </CardDescription>
                      </div>
                      {selectedTemplate && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedDealForGeneration}
                            onValueChange={setSelectedDealForGeneration}
                          >
                            <SelectTrigger className="w-48" data-testid="select-generation-deal">
                              <Briefcase className="h-4 w-4 mr-2" />
                              <SelectValue placeholder="Link to deal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No deal</SelectItem>
                              {deals.map((deal) => (
                                <SelectItem key={deal.id} value={deal.id}>
                                  {deal.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleGenerateDocument}
                            disabled={isGenerating}
                            className="gap-2"
                            data-testid="button-generate-document"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Generate
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1">
                    {!selectedTemplate ? (
                      <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">No Template Selected</h3>
                        <p className="text-muted-foreground max-w-md">
                          Select an investment banking template from the left panel to generate a professional document using AI.
                        </p>
                      </div>
                    ) : !generatedContent ? (
                      <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                          <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Ready to Generate</h3>
                        <p className="text-muted-foreground max-w-md mb-4">
                          Click "Generate" to create a {selectedTemplate.name} document. 
                          {selectedDealForGeneration && selectedDealForGeneration !== "none" && ' The document will be customized for the selected deal.'}
                        </p>
                        <Button
                          onClick={handleGenerateDocument}
                          disabled={isGenerating}
                          size="lg"
                          className="gap-2"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate Document
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col h-[500px]">
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-secondary/30">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI Generated
                            </Badge>
                            {isEditing && (
                              <Badge variant="outline" className="gap-1">
                                <Edit2 className="h-3 w-3" />
                                Editing
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyContent}
                              className="gap-1"
                              data-testid="button-copy-content"
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsEditing(!isEditing)}
                              className="gap-1"
                              data-testid="button-toggle-edit"
                            >
                              <Edit2 className="h-4 w-4" />
                              {isEditing ? 'Preview' : 'Edit'}
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveGeneratedDocument}
                              className="gap-1"
                              data-testid="button-save-document"
                            >
                              <Save className="h-4 w-4" />
                              Save to Library
                            </Button>
                          </div>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                          {isEditing ? (
                            <Textarea
                              value={generatedContent}
                              onChange={(e) => setGeneratedContent(e.target.value)}
                              className="min-h-[440px] font-mono text-sm resize-none"
                              data-testid="textarea-document-content"
                            />
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                {generatedContent}
                              </pre>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {defaultTab === 'library' && (
          <div className="space-y-6">
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
                      ? "No documents yet. Upload your first document or generate one using AI!"
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
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handlePreview(doc)}
                                    className="h-8 w-8"
                                    title="Preview"
                                    data-testid={`button-preview-${doc.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                {doc.content && canViewInBrowser(doc) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewInNewTab(doc)}
                                    className="h-8 w-8"
                                    title="Open in new tab"
                                    data-testid={`button-view-${doc.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                {doc.content && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload(doc)}
                                    className="h-8 w-8"
                                    title="Download"
                                    data-testid={`button-download-${doc.id}`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(doc)}
                                  className="h-8 w-8"
                                  data-testid={`button-edit-${doc.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(doc.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  data-testid={`button-delete-${doc.id}`}
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
          </div>
        )}
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedDocument?.title}
              </DialogTitle>
              {selectedDocument && (
                <div className="flex items-center gap-2 mr-8">
                  {canViewInBrowser(selectedDocument) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewInNewTab(selectedDocument)}
                      data-testid="button-view-new-tab"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedDocument)}
                    data-testid="button-download-preview"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {selectedDocument?.content && (
              selectedDocument.mimeType?.includes('text') || selectedDocument.type === 'text/plain' ? (
                <pre className="whitespace-pre-wrap font-sans text-sm p-4 bg-secondary/30 rounded-lg">
                  {atob(selectedDocument.content.split(',')[1] || '')}
                </pre>
              ) : selectedDocument.mimeType?.includes('image') ? (
                <img src={selectedDocument.content} alt={selectedDocument.title} className="max-w-full" />
              ) : selectedDocument.mimeType?.includes('pdf') ? (
                <iframe src={selectedDocument.content} className="w-full h-[55vh]" title={selectedDocument.title} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Preview not available for this file type.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => selectedDocument && handleDownload(selectedDocument)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download to view
                  </Button>
                </div>
              )
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Document
            </DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={selectedDocument.title}
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
                  value={selectedDocument.dealId || "none"}
                  onValueChange={(value) => {
                    const dealIdToUse = value === "none" ? undefined : value;
                    const deal = dealIdToUse ? deals.find(d => d.id === dealIdToUse) : undefined;
                    setSelectedDocument({
                      ...selectedDocument,
                      dealId: dealIdToUse,
                      dealName: deal?.name || undefined,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No deal association" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deal association</SelectItem>
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
              {updateDocument.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
