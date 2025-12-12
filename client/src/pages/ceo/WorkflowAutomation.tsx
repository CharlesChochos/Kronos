import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Briefcase,
  Users,
  Target,
  Sparkles,
  Loader2,
  FolderOpen,
  ArrowRight,
  Zap
} from "lucide-react";
import { 
  useScanEmails, 
  useEmailDeals, 
  useGmailLabels,
  useAutoAssignTeam,
  useGenerateMilestones,
  useGenerateAISuggestions,
  useDealsListing
} from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WorkflowAutomation() {
  const [selectedFolder, setSelectedFolder] = useState("Deals");
  
  const { data: gmailLabels = [], isLoading: labelsLoading } = useGmailLabels();
  const { data: emailDeals = [], isLoading: emailDealsLoading, refetch: refetchEmailDeals } = useEmailDeals();
  const { data: allDeals = [] } = useDealsListing();
  
  // Filter to only show investment banking deals (not opportunities or asset management)
  const deals = allDeals.filter(deal => {
    const dealType = (deal as any).dealType;
    return dealType !== 'Opportunity' && dealType !== 'Asset Management';
  });
  const scanEmails = useScanEmails();
  const autoAssignTeam = useAutoAssignTeam();
  const generateMilestones = useGenerateMilestones();
  const generateAISuggestions = useGenerateAISuggestions();
  
  const handleScanEmails = async () => {
    try {
      const result = await scanEmails.mutateAsync(selectedFolder);
      toast.success(`Scanned emails: ${result.processed} processed, ${result.created} deals created`);
      refetchEmailDeals();
    } catch (error: any) {
      toast.error(error.message || "Failed to scan emails");
    }
  };
  
  const handleAutoAssign = async (dealId: string) => {
    try {
      await autoAssignTeam.mutateAsync(dealId);
      toast.success("Team auto-assigned successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to auto-assign team");
    }
  };
  
  const handleGenerateMilestones = async (dealId: string) => {
    try {
      await generateMilestones.mutateAsync({ dealId });
      toast.success("Milestones generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate milestones");
    }
  };
  
  const handleGenerateAISuggestions = async (dealId: string) => {
    try {
      await generateAISuggestions.mutateAsync(dealId);
      toast.success("AI suggestions generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI suggestions");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Processed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Layout role="CEO">
      <div className="p-6 space-y-6" data-testid="workflow-automation-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              Workflow Automation
            </h1>
            <p className="text-muted-foreground mt-1">
              Automate deal creation, team assignment, and task generation
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="gmail-scan-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                Gmail Deal Scanner
              </CardTitle>
              <CardDescription>
                Scan your Gmail for deal-related emails and automatically create deals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Email Folder/Label</label>
                  <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                    <SelectTrigger data-testid="select-gmail-folder">
                      <FolderOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Deals">Deals</SelectItem>
                      <SelectItem value="INBOX">Inbox</SelectItem>
                      {gmailLabels.map(label => (
                        <SelectItem key={label.id} value={label.name}>{label.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button 
                    onClick={handleScanEmails}
                    disabled={scanEmails.isPending}
                    data-testid="button-scan-gmail"
                  >
                    {scanEmails.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Scan Emails
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium mb-3">Recent Email Scans</h4>
                {emailDealsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : emailDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No emails scanned yet</p>
                    <p className="text-sm">Click "Scan Emails" to get started</p>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {emailDeals.slice(0, 10).map(email => (
                        <div 
                          key={email.id} 
                          className="p-3 bg-secondary/30 rounded-lg"
                          data-testid={`email-deal-${email.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{email.subject}</p>
                              <p className="text-xs text-muted-foreground">{email.sender}</p>
                            </div>
                            {getStatusBadge(email.status)}
                          </div>
                          {email.dealId && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                              <ArrowRight className="w-3 h-3" />
                              <span>Created Deal: {email.dealId}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="quick-automation-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Quick Automation
              </CardTitle>
              <CardDescription>
                Run automation on existing deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {deals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No deals found</p>
                      <p className="text-sm">Create deals to use automation</p>
                    </div>
                  ) : (
                    deals.slice(0, 10).map(deal => (
                      <div 
                        key={deal.id} 
                        className="p-4 bg-secondary/30 rounded-lg"
                        data-testid={`automation-deal-${deal.id}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">{deal.name}</p>
                            <p className="text-xs text-muted-foreground">{deal.stage} - ${(deal.value / 1000000).toFixed(1)}M</p>
                          </div>
                          <Badge variant="outline">{deal.stage}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAutoAssign(deal.id)}
                            disabled={autoAssignTeam.isPending}
                            data-testid={`button-auto-assign-${deal.id}`}
                          >
                            <Users className="w-3 h-3 mr-1" />
                            Auto Team
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleGenerateMilestones(deal.id)}
                            disabled={generateMilestones.isPending}
                            data-testid={`button-milestones-${deal.id}`}
                          >
                            <Target className="w-3 h-3 mr-1" />
                            Milestones
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleGenerateAISuggestions(deal.id)}
                            disabled={generateAISuggestions.isPending}
                            data-testid={`button-ai-suggestions-${deal.id}`}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI Suggest
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="automation-stats-card">
          <CardHeader>
            <CardTitle>Automation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-500/10 rounded-lg" data-testid="stat-emails-scanned">
                <Mail className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                <p className="text-2xl font-bold" data-testid="text-emails-count">{emailDeals.length}</p>
                <p className="text-sm text-muted-foreground">Emails Scanned</p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg" data-testid="stat-deals-created">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-2xl font-bold" data-testid="text-deals-created-count">{emailDeals.filter(e => e.dealId).length}</p>
                <p className="text-sm text-muted-foreground">Deals Created</p>
              </div>
              <div className="text-center p-4 bg-purple-500/10 rounded-lg" data-testid="stat-deals-in-progress">
                <Users className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                <p className="text-2xl font-bold">{deals.filter(d => d.stage !== 'Close').length}</p>
                <p className="text-sm text-muted-foreground">Deals In Progress</p>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg" data-testid="stat-active-deals">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="text-2xl font-bold" data-testid="text-active-deals-count">{deals.length}</p>
                <p className="text-sm text-muted-foreground">Active Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
