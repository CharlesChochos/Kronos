import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { 
  Users, 
  Plus, 
  Search, 
  Building,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Briefcase,
  Star,
  StarOff,
  Pencil,
  Trash2,
  ExternalLink,
  Calendar,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Sparkles
} from "lucide-react";
import { useDeals, useStakeholders, useCreateStakeholder, useUpdateStakeholder, useDeleteStakeholder } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Stakeholder } from "@shared/schema";

type StakeholderType = 'investor' | 'advisor' | 'legal' | 'banker' | 'consultant' | 'client' | 'other';

type LocalStakeholder = {
  id: string;
  name: string;
  title: string;
  company: string;
  type: StakeholderType;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  focus?: string;
  notes?: string;
  deals: string[];
  isFavorite: boolean;
  lastContact?: string;
  createdAt?: string;
};

export default function StakeholderDirectory({ role }: { role: 'CEO' | 'Employee' }) {
  const queryClient = useQueryClient();
  const { data: deals = [] } = useDeals();
  const { data: dbStakeholders = [], isLoading } = useStakeholders();
  const createStakeholderMutation = useCreateStakeholder();
  const updateStakeholderMutation = useUpdateStakeholder();
  const deleteStakeholderMutation = useDeleteStakeholder();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<LocalStakeholder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docScanInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<Array<Record<string, string>>>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [importColumnMap, setImportColumnMap] = useState<Record<string, string>>({
    name: '',
    title: '',
    company: '',
    type: '',
    email: '',
    phone: '',
    linkedin: '',
    website: '',
    location: '',
    focus: '',
    notes: ''
  });
  
  const handleDocumentScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const supportedFormats = ['txt', 'csv', 'json', 'md', 'xlsx', 'xls'];
    
    if (!supportedFormats.includes(ext) && !file.type.includes('text') && !file.type.includes('spreadsheet')) {
      toast.error("Please upload a document (TXT, CSV, JSON, MD, Excel)");
      if (docScanInputRef.current) docScanInputRef.current.value = '';
      return;
    }
    
    setIsScanning(true);
    
    try {
      let content = '';
      
      if (ext === 'xlsx' || ext === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        content = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
      }
      
      if (!content || content.trim().length === 0) {
        toast.error("Document appears to be empty");
        setIsScanning(false);
        if (docScanInputRef.current) docScanInputRef.current.value = '';
        return;
      }
      
      const response = await fetch("/api/stakeholders/scan-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentContent: content.slice(0, 50000),
          filename: file.name,
          autoCreate: true
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to scan document");
      }
      
      const result = await response.json();
      
      if (result.successCount > 0) {
        toast.success(`Successfully imported ${result.successCount} stakeholder${result.successCount > 1 ? 's' : ''} from document`);
        // Refresh the stakeholder list to show newly created entries
        queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
      } else if (result.totalFound === 0) {
        toast.info("No stakeholder contacts found in the document");
      } else {
        toast.error("Failed to create stakeholders from document");
      }
      
      if (result.failedCount > 0) {
        toast.warning(`${result.failedCount} stakeholder${result.failedCount > 1 ? 's' : ''} could not be imported`);
      }
    } catch (error) {
      console.error('Document scan error:', error);
      toast.error("Failed to extract information from document");
    }
    
    setIsScanning(false);
    if (docScanInputRef.current) docScanInputRef.current.value = '';
  };

  // Known sectors for extraction from long text
  const KNOWN_SECTORS = [
    'technology', 'tech', 'software', 'saas', 'fintech', 'biotech', 'medtech', 'edtech', 'proptech', 'insurtech', 'regtech', 'cleantech', 'agtech',
    'healthcare', 'health', 'pharmaceuticals', 'pharma', 'medical devices', 'life sciences', 'biomedical', 'genomics', 'diagnostics',
    'finance', 'financial services', 'banking', 'investment', 'asset management', 'private equity', 'venture capital', 'hedge fund', 'wealth management',
    'energy', 'oil', 'gas', 'renewable', 'solar', 'wind', 'utilities', 'power', 'clean energy', 'green energy',
    'consumer', 'retail', 'e-commerce', 'ecommerce', 'cpg', 'consumer goods', 'fmcg', 'food', 'beverage', 'apparel', 'fashion',
    'industrial', 'manufacturing', 'aerospace', 'defense', 'automotive', 'machinery', 'chemicals', 'materials', 'logistics', 'transportation',
    'real estate', 'property', 'reit', 'hospitality', 'hotels', 'commercial real estate', 'residential',
    'telecommunications', 'telecom', 'media', 'entertainment', 'gaming', 'advertising', 'publishing', 'streaming',
    'infrastructure', 'construction', 'engineering', 'mining', 'metals',
    'agriculture', 'farming', 'agribusiness', 'food production',
    'education', 'edtech', 'training', 'e-learning',
    'government', 'public sector', 'non-profit', 'ngo',
    'services', 'professional services', 'consulting', 'legal', 'accounting'
  ];

  // Extract sectors from long text by scanning for known sector terms
  const extractSectorsFromText = (text: string): string => {
    if (!text) return '';
    const lowerText = text.toLowerCase();
    const foundSectors: string[] = [];
    
    for (const sector of KNOWN_SECTORS) {
      // Use word boundary matching to avoid partial matches
      const regex = new RegExp(`\\b${sector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText) && !foundSectors.some(s => s.toLowerCase() === sector.toLowerCase())) {
        // Capitalize first letter of each word
        const formatted = sector.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        foundSectors.push(formatted);
      }
    }
    
    return foundSectors.join(', ');
  };

  // Scan all columns in a row to find sector information
  const extractSectorsFromRow = (row: Record<string, string>, focusColumn?: string): string => {
    // First try the mapped focus column if available
    if (focusColumn && row[focusColumn]) {
      const extractedFromFocus = extractSectorsFromText(row[focusColumn]);
      if (extractedFromFocus) return extractedFromFocus;
    }
    
    // Scan ALL columns for sector-related terms
    let allFoundSectors: string[] = [];
    for (const [key, value] of Object.entries(row)) {
      if (value && typeof value === 'string') {
        const extracted = extractSectorsFromText(value);
        if (extracted) {
          const sectors = extracted.split(', ');
          for (const s of sectors) {
            if (!allFoundSectors.includes(s)) {
              allFoundSectors.push(s);
            }
          }
        }
      }
    }
    
    return allFoundSectors.join(', ');
  };

  const stakeholders: LocalStakeholder[] = useMemo(() => dbStakeholders.map(s => ({
    id: s.id,
    name: s.name,
    title: s.title,
    company: s.company,
    type: s.type as StakeholderType,
    email: s.email || undefined,
    phone: s.phone || undefined,
    linkedin: s.linkedin || undefined,
    website: s.website || undefined,
    location: s.location || undefined,
    focus: s.focus || undefined,
    notes: s.notes || undefined,
    deals: s.deals || [],
    isFavorite: s.isFavorite || false,
    lastContact: s.lastContact || undefined,
    createdAt: s.createdAt?.toString()
  })), [dbStakeholders]);

  const [newStakeholder, setNewStakeholder] = useState({
    name: "",
    title: "",
    company: "",
    type: "investor" as StakeholderType,
    email: "",
    phone: "",
    linkedin: "",
    website: "",
    location: "",
    focus: "",
    notes: ""
  });

  const typeColors: Record<string, string> = {
    investor: "bg-green-500",
    advisor: "bg-blue-500",
    legal: "bg-purple-500",
    banker: "bg-yellow-500",
    consultant: "bg-orange-500",
    client: "bg-red-500",
    other: "bg-gray-500"
  };

  const filteredStakeholders = stakeholders.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "favorites") return matchesSearch && s.isFavorite;
    return matchesSearch && s.type === activeTab;
  });

  const handleCreateStakeholder = async () => {
    if (!newStakeholder.name || !newStakeholder.company) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await createStakeholderMutation.mutateAsync({
        name: newStakeholder.name,
        title: newStakeholder.title,
        company: newStakeholder.company,
        type: newStakeholder.type,
        email: newStakeholder.email || undefined,
        phone: newStakeholder.phone || undefined,
        linkedin: newStakeholder.linkedin || undefined,
        website: newStakeholder.website || undefined,
        location: newStakeholder.location || undefined,
        focus: newStakeholder.focus || undefined,
        notes: newStakeholder.notes || undefined,
        deals: [],
        isFavorite: false
      });

      setShowCreateModal(false);
      setNewStakeholder({
        name: "", title: "", company: "", type: "investor",
        email: "", phone: "", linkedin: "", website: "", location: "", focus: "", notes: ""
      });
      toast.success("Stakeholder added to directory");
    } catch (error) {
      toast.error("Failed to add stakeholder");
    }
  };

  const toggleFavorite = async (id: string) => {
    if (id.startsWith('inv-')) return;
    
    const stakeholder = stakeholders.find(s => s.id === id);
    if (!stakeholder) return;
    
    try {
      await updateStakeholderMutation.mutateAsync({
        id,
        updates: { isFavorite: !stakeholder.isFavorite }
      });
    } catch (error) {
      toast.error("Failed to update favorite");
    }
  };

  const deleteStakeholder = async (id: string) => {
    if (id.startsWith('inv-')) return;
    
    try {
      await deleteStakeholderMutation.mutateAsync(id);
      toast.success("Stakeholder removed");
    } catch (error) {
      toast.error("Failed to remove stakeholder");
    }
  };

  const getTypeCounts = () => {
    const counts: Record<string, number> = {};
    stakeholders.forEach(s => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });
    return counts;
  };

  const typeCounts = getTypeCounts();
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const isExcel = ['xlsx', 'xls'].includes(ext);
    const isCSV = ['csv', 'tsv', 'txt'].includes(ext);
    
    if (!isExcel && !isCSV) {
      toast.error("Please use a CSV, Excel (.xlsx, .xls), or text file.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    const processData = (headers: string[], dataRows: Record<string, string>[]) => {
      if (dataRows.length === 0) {
        toast.error("No valid data found in file");
        return;
      }
      
      setImportData(dataRows);
      setSelectedRows(new Set(dataRows.map((_, i) => i)));
      
      const autoMap: Record<string, string> = { ...importColumnMap };
      const lowerHeaders = headers.map(h => h.toLowerCase());
      
      const fieldMappings: Record<string, string[]> = {
        name: ['name', 'full name', 'contact name', 'stakeholder', 'person'],
        title: ['title', 'job title', 'position', 'role'],
        company: ['company', 'organization', 'firm', 'employer', 'org'],
        type: ['type', 'category', 'stakeholder type'],
        email: ['email', 'e-mail', 'email address', 'mail'],
        phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
        linkedin: ['linkedin', 'linked in', 'linkedin url', 'li'],
        website: ['website', 'web', 'url', 'site'],
        location: ['location', 'city', 'address', 'region', 'country'],
        focus: ['focus', 'sector', 'sector focus', 'sectors', 'industry', 'industries', 'investment focus', 'specialization', 'expertise', 'vertical', 'verticals'],
        notes: ['notes', 'comments', 'description', 'remarks']
      };
      
      Object.entries(fieldMappings).forEach(([field, aliases]) => {
        const match = headers.find((h, i) => {
          const lowerH = lowerHeaders[i];
          // Check both directions: alias in header OR header in alias (for exact matches like "Email")
          return aliases.some(alias => lowerH.includes(alias) || alias.includes(lowerH));
        });
        if (match) autoMap[field] = match;
      });
      
      setImportColumnMap(autoMap);
      setShowImportModal(true);
    };
    
    // Sanitize string values for database storage
    const sanitizeValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Remove null bytes and control characters, keep printable ASCII and common unicode
      return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    };
    
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });
          
          if (jsonData.length === 0) {
            toast.error("File is empty or has no data rows");
            return;
          }
          
          const headers = Object.keys(jsonData[0]).map(h => sanitizeValue(h));
          const rows = jsonData.map(row => {
            const sanitizedRow: Record<string, string> = {};
            headers.forEach((header, i) => {
              const originalKey = Object.keys(jsonData[0])[i];
              sanitizedRow[header] = sanitizeValue(row[originalKey]);
            });
            return sanitizedRow;
          }).filter(row => Object.values(row).some(v => v));
          
          processData(headers, rows);
        } catch (error) {
          console.error('Excel parsing error:', error);
          toast.error("Failed to parse Excel file. Please ensure it's a valid spreadsheet.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        let content = e.target?.result as string;
        content = sanitizeValue(content);
        
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          toast.error("File is empty");
          return;
        }
        
        const delimiter = content.includes('\t') ? '\t' : ',';
        const headers = lines[0].split(delimiter).map(h => sanitizeValue(h.replace(/^"|"$/g, '')));
        
        const rows = lines.slice(1).map(line => {
          const values = line.split(delimiter).map(v => sanitizeValue(v.replace(/^"|"$/g, '')));
          const row: Record<string, string> = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        }).filter(row => Object.values(row).some(v => v));
        
        processData(headers, rows);
      };
      reader.readAsText(file, 'UTF-8');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };
  
  const toggleAllRows = () => {
    if (selectedRows.size === importData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(importData.map((_, i) => i)));
    }
  };
  
  const handleImportSubmit = async () => {
    if (!importColumnMap.name || !importColumnMap.company) {
      toast.error("Please map Name and Company columns");
      return;
    }
    
    if (selectedRows.size === 0) {
      toast.error("Please select at least one row to import");
      return;
    }
    
    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const index of Array.from(selectedRows)) {
      const row = importData[index];
      if (!row) continue;
      
      const typeValue = row[importColumnMap.type]?.toLowerCase() || 'other';
      const validTypes: StakeholderType[] = ['investor', 'advisor', 'legal', 'banker', 'consultant', 'client', 'other'];
      const type = validTypes.includes(typeValue as StakeholderType) ? typeValue as StakeholderType : 'other';
      
      // Extract sector/focus from mapped column or scan all columns
      const focusValue = extractSectorsFromRow(row, importColumnMap.focus);
      
      try {
        await createStakeholderMutation.mutateAsync({
          name: row[importColumnMap.name] || '',
          title: row[importColumnMap.title] || '',
          company: row[importColumnMap.company] || '',
          type,
          email: row[importColumnMap.email] || undefined,
          phone: row[importColumnMap.phone] || undefined,
          linkedin: row[importColumnMap.linkedin] || undefined,
          website: row[importColumnMap.website] || undefined,
          location: row[importColumnMap.location] || undefined,
          focus: focusValue || undefined,
          notes: row[importColumnMap.notes] || undefined,
          deals: [],
          isFavorite: false
        });
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    setIsImporting(false);
    setShowImportModal(false);
    setImportData([]);
    setSelectedRows(new Set());
    
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} stakeholder${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to import ${errorCount} stakeholder${errorCount > 1 ? 's' : ''}`);
    }
  };
  
  const importHeaders = importData.length > 0 ? Object.keys(importData[0]) : [];

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">External Stakeholder Directory</h1>
            <p className="text-muted-foreground">Manage contacts for investors, advisors, legal counsel, and more</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={docScanInputRef}
              accept=".txt,.csv,.json,.md,.xlsx,.xls"
              onChange={handleDocumentScan}
              className="hidden"
              data-testid="input-doc-scan"
            />
            <Button
              variant="outline"
              onClick={() => docScanInputRef.current?.click()}
              disabled={isScanning}
              data-testid="button-scan-document"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Import
                </>
              )}
            </Button>
            <Button onClick={() => setShowCreateModal(true)} data-testid="button-add-stakeholder">
              <Plus className="w-4 h-4 mr-2" /> Add Stakeholder
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stakeholders.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(typeColors).slice(0, 5).map(([type, color]) => (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", color.replace("bg-", "bg-") + "/10")}>
                    <Building className={cn("w-5 h-5", color.replace("bg-", "text-"))} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{typeCounts[type] || 0}</p>
                    <p className="text-xs text-muted-foreground capitalize">{type}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Directory</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search stakeholders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-stakeholders"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="all">All ({stakeholders.length})</TabsTrigger>
                <TabsTrigger value="favorites">
                  <Star className="w-3 h-3 mr-1" /> Favorites ({stakeholders.filter(s => s.isFavorite).length})
                </TabsTrigger>
                <TabsTrigger value="investor">Investors</TabsTrigger>
                <TabsTrigger value="legal">Legal</TabsTrigger>
                <TabsTrigger value="banker">Bankers</TabsTrigger>
                <TabsTrigger value="advisor">Advisors</TabsTrigger>
                <TabsTrigger value="client">Clients</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-[450px]">
                  <div className="grid grid-cols-2 gap-4">
                    {filteredStakeholders.map((stakeholder) => (
                      <Card key={stakeholder.id} className="hover:border-primary/50 transition-colors" data-testid={`stakeholder-${stakeholder.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                <AvatarFallback className={cn("text-white", typeColors[stakeholder.type])}>
                                  {stakeholder.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{stakeholder.name}</h3>
                                  <button onClick={() => toggleFavorite(stakeholder.id)} className="hover:opacity-80">
                                    {stakeholder.isFavorite ? (
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    ) : (
                                      <StarOff className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-sm text-muted-foreground">{stakeholder.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    <Building className="w-3 h-3 mr-1" /> {stakeholder.company}
                                  </Badge>
                                  <Badge className={cn("text-white text-xs", typeColors[stakeholder.type])}>
                                    {stakeholder.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 text-sm mb-3">
                            {stakeholder.email && (
                              <a href={`mailto:${stakeholder.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                                <Mail className="w-3 h-3" /> {stakeholder.email}
                              </a>
                            )}
                            {stakeholder.phone && (
                              <a href={`tel:${stakeholder.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                                <Phone className="w-3 h-3" /> {stakeholder.phone}
                              </a>
                            )}
                            {stakeholder.location && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-3 h-3" /> {stakeholder.location}
                              </p>
                            )}
                          </div>

                          {stakeholder.focus && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              <span className="text-xs text-muted-foreground font-medium mr-1">Sectors:</span>
                              {stakeholder.focus.split(',').map((sector, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                                  {sector.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {stakeholder.notes && (
                            <p className="text-xs text-muted-foreground p-2 bg-secondary/30 rounded mb-3 line-clamp-2">
                              {stakeholder.notes}
                            </p>
                          )}

                          {stakeholder.deals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {stakeholder.deals.map(dealId => {
                                const deal = deals.find(d => d.id === dealId);
                                return deal ? (
                                  <Badge key={dealId} variant="outline" className="text-[10px]">
                                    <Briefcase className="w-2 h-2 mr-1" /> {deal.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex gap-1">
                              {stakeholder.linkedin && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={stakeholder.linkedin} target="_blank" rel="noopener noreferrer">
                                    <Linkedin className="w-3 h-3" />
                                  </a>
                                </Button>
                              )}
                              {stakeholder.website && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={stakeholder.website} target="_blank" rel="noopener noreferrer">
                                    <Globe className="w-3 h-3" />
                                  </a>
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedStakeholder(stakeholder); setShowEditModal(true); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently remove {stakeholder.name} from {stakeholder.company} from the directory.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteStakeholder(stakeholder.id)}>
                                      Remove Stakeholder
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {stakeholder.lastContact && (
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Last contact: {format(new Date(stakeholder.lastContact), 'MMM d, yyyy')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {filteredStakeholders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No stakeholders found
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Stakeholder</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={selectedStakeholder?.name || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Full name"
                    data-testid="input-edit-stakeholder-name"
                  />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={selectedStakeholder?.title || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder="Job title"
                    data-testid="input-edit-stakeholder-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company *</Label>
                  <Input
                    value={selectedStakeholder?.company || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, company: e.target.value } : null)}
                    placeholder="Company name"
                    data-testid="input-edit-stakeholder-company"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={selectedStakeholder?.type || 'investor'} onValueChange={(v: any) => setSelectedStakeholder(prev => prev ? { ...prev, type: v } : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="legal">Legal Counsel</SelectItem>
                      <SelectItem value="banker">Banker</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={selectedStakeholder?.email || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="email@example.com"
                    data-testid="input-edit-stakeholder-email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={selectedStakeholder?.phone || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    placeholder="+1 555-000-0000"
                    data-testid="input-edit-stakeholder-phone"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={selectedStakeholder?.location || ''}
                  onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, location: e.target.value } : null)}
                  placeholder="City, State"
                  data-testid="input-edit-stakeholder-location"
                />
              </div>
              {selectedStakeholder?.type === 'investor' && (
                <div>
                  <Label>Sector Focus</Label>
                  <Input
                    value={selectedStakeholder?.focus || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, focus: e.target.value } : null)}
                    placeholder="e.g. Technology, Healthcare, Consumer"
                    data-testid="input-edit-stakeholder-focus"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for matching investors to deals by sector</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={selectedStakeholder?.linkedin || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, linkedin: e.target.value } : null)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={selectedStakeholder?.website || ''}
                    onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, website: e.target.value } : null)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={selectedStakeholder?.notes || ''}
                  onChange={(e) => setSelectedStakeholder(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                  data-testid="input-edit-stakeholder-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (selectedStakeholder) {
                try {
                  await updateStakeholderMutation.mutateAsync({
                    id: selectedStakeholder.id,
                    updates: {
                      name: selectedStakeholder.name,
                      title: selectedStakeholder.title,
                      company: selectedStakeholder.company,
                      type: selectedStakeholder.type,
                      email: selectedStakeholder.email || null,
                      phone: selectedStakeholder.phone || null,
                      linkedin: selectedStakeholder.linkedin || null,
                      website: selectedStakeholder.website || null,
                      location: selectedStakeholder.location || null,
                      focus: selectedStakeholder.focus || null,
                      notes: selectedStakeholder.notes || null,
                    }
                  });
                  toast.success("Stakeholder updated");
                  setShowEditModal(false);
                } catch (error) {
                  toast.error("Failed to update stakeholder");
                }
              }
            }} data-testid="button-save-stakeholder">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Stakeholder</DialogTitle>
            <DialogDescription>
              Enter stakeholder details manually.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newStakeholder.name}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                    placeholder="Full name"
                    data-testid="input-stakeholder-name"
                  />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newStakeholder.title}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, title: e.target.value })}
                    placeholder="Job title"
                    data-testid="input-stakeholder-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company *</Label>
                  <Input
                    value={newStakeholder.company}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, company: e.target.value })}
                    placeholder="Company name"
                    data-testid="input-stakeholder-company"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newStakeholder.type} onValueChange={(v: any) => setNewStakeholder({ ...newStakeholder, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="legal">Legal Counsel</SelectItem>
                      <SelectItem value="banker">Banker</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newStakeholder.email}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-stakeholder-email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newStakeholder.phone}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, phone: e.target.value })}
                    placeholder="+1 555-000-0000"
                    data-testid="input-stakeholder-phone"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={newStakeholder.location}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, location: e.target.value })}
                  placeholder="City, State"
                  data-testid="input-stakeholder-location"
                />
              </div>
              {newStakeholder.type === 'investor' && (
                <div>
                  <Label>Sector Focus</Label>
                  <Input
                    value={newStakeholder.focus}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, focus: e.target.value })}
                    placeholder="e.g. Technology, Healthcare, Consumer"
                    data-testid="input-stakeholder-focus"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for matching investors to deals by sector</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={newStakeholder.linkedin}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={newStakeholder.website}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newStakeholder.notes}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                  data-testid="input-stakeholder-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateStakeholder} data-testid="button-submit-stakeholder">Add Stakeholder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-card border-border overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import Stakeholders
            </DialogTitle>
            <DialogDescription>
              Map your CSV columns to stakeholder fields and select rows to import
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2 p-3 bg-secondary/30 rounded-lg">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Select value={importColumnMap.name} onValueChange={(v) => setImportColumnMap({ ...importColumnMap, name: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {importHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Select value={importColumnMap.title} onValueChange={(v) => setImportColumnMap({ ...importColumnMap, title: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {importHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company *</Label>
                <Select value={importColumnMap.company} onValueChange={(v) => setImportColumnMap({ ...importColumnMap, company: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {importHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={importColumnMap.type} onValueChange={(v) => setImportColumnMap({ ...importColumnMap, type: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {importHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Select value={importColumnMap.email} onValueChange={(v) => setImportColumnMap({ ...importColumnMap, email: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {importHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedRows.size} of {importData.length} rows selected
              </span>
              <Button variant="ghost" size="sm" onClick={toggleAllRows}>
                {selectedRows.size === importData.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-[300px] border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedRows.size === importData.length && importData.length > 0}
                        onCheckedChange={toggleAllRows}
                      />
                    </TableHead>
                    {importHeaders.slice(0, 5).map(h => (
                      <TableHead key={h} className="text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((row, index) => (
                    <TableRow 
                      key={index}
                      className={cn(!selectedRows.has(index) && "opacity-50")}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedRows.has(index)}
                          onCheckedChange={() => toggleRowSelection(index)}
                        />
                      </TableCell>
                      {importHeaders.slice(0, 5).map(h => (
                        <TableCell key={h} className="text-xs truncate max-w-[150px]">
                          {row[h] || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>Cancel</Button>
            <Button onClick={handleImportSubmit} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Import {selectedRows.size} Stakeholders
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
