import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Search, 
  Clock, 
  Eye, 
  CheckCircle, 
  Archive, 
  Download, 
  Share2,
  Bot,
  Sparkles,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useCurrentUser, useDeals, useGenerateDocument } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

const TEMPLATES = [
  { id: 1, name: "Term Sheet", description: "Standard term sheet template for initial deal terms", lastUsed: "2025-12-01", complexity: "Medium" },
  { id: 2, name: "Letter of Intent", description: "LOI template for preliminary offers and expressions of interest", lastUsed: "2025-12-01", complexity: "Medium" },
  { id: 3, name: "Due Diligence Request", description: "Comprehensive information request checklist", lastUsed: "2025-11-28", complexity: "Medium" },
  { id: 4, name: "Purchase Agreement", description: "Legal document for acquisition transactions", lastUsed: "2025-11-25", complexity: "High" },
  { id: 5, name: "NDA", description: "Non-disclosure agreement for confidential information", lastUsed: "2025-12-02", complexity: "Low" },
  { id: 6, name: "Board Resolution", description: "Corporate governance and approval template", lastUsed: "2025-11-20", complexity: "Medium" },
];

type DocumentGeneratorProps = {
  role?: 'CEO' | 'Employee';
};

export default function DocumentGenerator({ role = 'CEO' }: DocumentGeneratorProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [], isLoading } = useDeals();
  const generateDocument = useGenerateDocument();
  
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<string>("");
  const [complianceOptions, setComplianceOptions] = useState({
    sec: false,
    finra: false,
    legal: true,
  });

  // Set initial deal once data loads or when deals change
  useEffect(() => {
    if (deals.length > 0 && !selectedDeal) {
      setSelectedDeal(deals[0].id);
    } else if (deals.length === 0 && selectedDeal) {
      setSelectedDeal('');
    }
  }, [deals]);

  const filteredTemplates = TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    
    setGeneratedContent(null);
    
    const template = TEMPLATES.find(t => t.id === selectedTemplate);
    const deal = deals.find(d => d.id === selectedDeal);
    
    try {
      const result = await generateDocument.mutateAsync({
        templateName: template?.name || '',
        dealData: deal ? {
          name: deal.name,
          client: deal.client,
          sector: deal.sector,
          value: deal.value,
          stage: deal.stage,
          description: deal.description,
        } : null,
        complianceOptions,
      });
      
      setGeneratedContent(result.content);
      toast.success("Document generated with AI!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate document");
    }
  };

  const handleExport = (format: 'pdf' | 'word') => {
    if (!generatedContent) {
      toast.error("Generate a document first");
      return;
    }
    
    const templateName = TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'document';
    const fileName = templateName.replace(/\s+/g, '_');
    
    if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(templateName.toUpperCase(), margin, 20);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const lines = doc.splitTextToSize(generatedContent, maxWidth);
      let y = 45;
      const lineHeight = 5;
      
      const addHeader = () => {
        doc.setFillColor(26, 26, 46);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(templateName.toUpperCase(), margin, 16);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      };
      
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          addHeader();
          y = 35;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated by OSReaper - ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - 10);
      
      doc.save(`${fileName}.pdf`);
      toast.success("PDF exported successfully!");
    } else {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${templateName}</title>
  <style>
    body { font-family: 'Calibri', sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; }
    pre { white-space: pre-wrap; font-family: 'Calibri', sans-serif; }
    .footer { margin-top: 40px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${templateName}</h1>
  <pre>${generatedContent}</pre>
  <div class="footer">Generated by OSReaper - ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
      
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document exported successfully!");
    }
  };

  const handlePreview = () => {
    if (generatedContent) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<pre style="font-family: monospace; padding: 40px; max-width: 800px; margin: 0 auto;">${generatedContent}</pre>`);
      }
    }
  };

  return (
    <Layout role={role} pageTitle="Document Generator" userName={currentUser?.name || ""}>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Left Sidebar: Templates */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-6">
          <Card className="bg-card border-border flex-1 flex flex-col">
             <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Templates</CardTitle>
                <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input 
                      placeholder="Search templates..." 
                      className="pl-8 h-8 text-xs bg-secondary/50 border-transparent focus:border-primary" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-templates"
                    />
                </div>
             </CardHeader>
             <ScrollArea className="flex-1">
                <div className="px-4 pb-4 space-y-2">
                    {filteredTemplates.map((template) => (
                        <div 
                            key={template.id}
                            onClick={() => { setSelectedTemplate(template.id); setGeneratedContent(null); }}
                            className={cn(
                                "p-3 rounded-lg border cursor-pointer transition-all duration-200 group",
                                selectedTemplate === template.id 
                                    ? "bg-primary/10 border-primary shadow-sm" 
                                    : "bg-transparent border-transparent hover:bg-secondary/50 hover:border-border"
                            )}
                            data-testid={`template-${template.id}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={cn("font-medium text-sm", selectedTemplate === template.id ? "text-primary" : "text-foreground")}>
                                    {template.name}
                                </h4>
                                <Badge variant="outline" className={cn(
                                    "text-[9px] px-1 h-4",
                                    template.complexity === 'High' ? "border-red-500/50 text-red-400" :
                                    template.complexity === 'Medium' ? "border-yellow-500/50 text-yellow-400" :
                                    "border-green-500/50 text-green-400"
                                )}>
                                    {template.complexity}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
                            <div className="flex items-center text-[10px] text-muted-foreground/60">
                                <Clock className="w-3 h-3 mr-1" /> Last used: {template.lastUsed}
                                <ChevronRight className={cn("w-3 h-3 ml-auto opacity-0 transition-opacity", selectedTemplate === template.id && "opacity-100 text-primary")} />
                            </div>
                        </div>
                    ))}
                </div>
             </ScrollArea>
          </Card>
        </div>

        {/* Center: Preview / Generator Area */}
        <div className="col-span-12 md:col-span-6">
            <Card className="h-full bg-card border-border flex flex-col relative overflow-hidden">
                {selectedTemplate ? (
                    <>
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20">
                            {generateDocument.isPending && <div className="h-full bg-primary animate-pulse w-full"></div>}
                        </div>
                        <CardHeader className="border-b border-border/50 pb-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-xl">{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</CardTitle>
                                    <CardDescription>
                                      {generatedContent ? 'Document generated - ready for review' : 'AI-assisted generation ready'}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="gap-2"
                                      onClick={handlePreview}
                                      disabled={!generatedContent}
                                    >
                                        <Eye className="w-4 h-4" /> Preview
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      className="gap-2" 
                                      onClick={handleGenerate} 
                                      disabled={generateDocument.isPending}
                                      data-testid="button-generate"
                                    >
                                        {generateDocument.isPending ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                                        ) : (
                                            <><Sparkles className="w-4 h-4" /> Generate with AI</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 bg-secondary/20 p-8 overflow-y-auto">
                             {/* Document View */}
                             <div className="bg-white text-black p-10 shadow-lg min-h-[600px] w-full max-w-2xl mx-auto rounded-sm">
                                <div className="mb-8">
                                    <h1 className="text-2xl font-bold text-center mb-2">{TEMPLATES.find(t => t.id === selectedTemplate)?.name.toUpperCase()}</h1>
                                    <p className="text-center text-gray-500 text-sm">Generated via OSReaper</p>
                                </div>
                                
                                <div className="space-y-4 text-sm leading-relaxed font-serif text-gray-800 whitespace-pre-wrap">
                                    {generatedContent ? (
                                      generatedContent
                                    ) : generateDocument.isPending ? (
                                        <div className="space-y-2 mt-4 animate-pulse">
                                            <div className="h-2 bg-gray-200 rounded w-full"></div>
                                            <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                                            <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                                            <div className="h-2 bg-gray-200 rounded w-full"></div>
                                            <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                                        </div>
                                    ) : (
                                      <p className="text-gray-400 italic">Select parameters on the right and click "Generate with AI" to populate this document...</p>
                                    )}
                                </div>
                             </div>
                        </CardContent>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 opacity-50" />
                        </div>
                        <h3 className="text-lg font-medium">Select a Template</h3>
                        <p className="text-sm max-w-xs text-center mt-2">Choose a document template from the left panel to begin the generation process.</p>
                    </div>
                )}
            </Card>
        </div>

        {/* Right Sidebar: Controls */}
        <div className="col-span-12 md:col-span-3 space-y-6">
            <Card className="bg-card border-border h-full">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Document Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium flex items-center gap-2"><Bot className="w-3 h-3 text-primary" /> Deal Reference</label>
                        {deals.length > 0 ? (
                          <Select value={selectedDeal || undefined} onValueChange={setSelectedDeal}>
                            <SelectTrigger className="h-8 text-sm bg-secondary/50">
                              <SelectValue placeholder="Select a deal..." />
                            </SelectTrigger>
                            <SelectContent>
                              {deals.map(deal => (
                                <SelectItem key={deal.id} value={deal.id}>
                                  {deal.name} - {deal.client}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-8 px-3 text-sm bg-secondary/50 border border-border rounded-md flex items-center text-muted-foreground">
                            No deals available
                          </div>
                        )}
                    </div>

                    <Separator className="bg-border/50" />

                    <div className="space-y-3">
                        <label className="text-xs font-medium">Compliance Routing</label>
                        
                        <div className="flex items-start gap-2">
                            <Checkbox 
                              checked={complianceOptions.sec}
                              onCheckedChange={(checked) => setComplianceOptions({ ...complianceOptions, sec: !!checked })}
                            />
                            <div>
                                <div className="text-xs font-medium">SEC Review</div>
                                <div className="text-[10px] text-muted-foreground">Securities and Exchange Commission compliance</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Checkbox 
                              checked={complianceOptions.finra}
                              onCheckedChange={(checked) => setComplianceOptions({ ...complianceOptions, finra: !!checked })}
                            />
                            <div>
                                <div className="text-xs font-medium">FINRA Review</div>
                                <div className="text-[10px] text-muted-foreground">Financial Industry Regulatory Authority</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                             <Checkbox 
                               checked={complianceOptions.legal}
                               onCheckedChange={(checked) => setComplianceOptions({ ...complianceOptions, legal: !!checked })}
                             />
                             <div>
                                <div className="text-xs font-medium">Legal Review</div>
                                <div className="text-[10px] text-muted-foreground">Internal legal counsel review</div>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    <div className="space-y-2">
                        <label className="text-xs font-medium">Export Options</label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-8 bg-secondary/30"
                              onClick={() => handleExport('pdf')}
                              disabled={!generatedContent}
                              data-testid="button-export-pdf"
                            >
                                <Download className="w-3 h-3 mr-1" /> PDF
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-8 bg-secondary/30"
                              onClick={() => handleExport('word')}
                              disabled={!generatedContent}
                              data-testid="button-export-word"
                            >
                                <Download className="w-3 h-3 mr-1" /> Word
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </Layout>
  );
}
