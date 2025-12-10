import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser, usePortalDeals, usePortalUpdates, usePortalMessages, useSendPortalMessage, useDocumentsByDeal, useLogout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Loader2, Building2, FileText, MessageSquare, TrendingUp, Calendar, 
  Download, Send, LogOut, User, Clock, CheckCircle2, AlertCircle, Info
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Deal } from "@/lib/api";

export default function PortalDashboard() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: deals = [], isLoading: dealsLoading } = usePortalDeals();
  const logoutMutation = useLogout();
  
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setLocation("/portal/login");
    } catch {
      toast.error("Failed to log out");
    }
  };
  
  if (userLoading || dealsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || user.role !== "External") {
    setLocation("/portal/login");
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Kronos</h1>
                <p className="text-xs text-muted-foreground">Client Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{(user as any).externalOrganization || user.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}</h2>
          <p className="text-muted-foreground">
            {(user as any).externalOrganization ? `${(user as any).externalOrganization} Portal` : "Your deal dashboard"}
          </p>
        </div>
        
        {deals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Deals Available</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                You don't have access to any deals yet. Contact your relationship manager for more information.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Deals</h3>
              {deals.map((deal) => (
                <DealCard 
                  key={deal.id} 
                  deal={deal} 
                  isSelected={selectedDeal?.id === deal.id}
                  onClick={() => {
                    setSelectedDeal(deal);
                    setActiveTab("overview");
                  }}
                />
              ))}
            </div>
            
            <div className="lg:col-span-2">
              {selectedDeal ? (
                <DealDetail 
                  deal={selectedDeal} 
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              ) : (
                <Card className="h-full min-h-[400px]">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select a Deal</h3>
                    <p className="text-muted-foreground text-center">
                      Click on a deal to view details, documents, and updates.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DealCard({ deal, isSelected, onClick }: { deal: Deal; isSelected: boolean; onClick: () => void }) {
  // Map legacy IB stages to new stages
  const mapIBStage = (stage: string) => {
    const legacyMap: Record<string, string> = {
      'Due Diligence': 'Diligence',
      'Negotiation': 'Legal',
      'Closing': 'Close',
      'Execution': 'Structuring',
      'Signing': 'Close',
    };
    return legacyMap[stage] || stage;
  };
  
  const stageColors: Record<string, string> = {
    Origination: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Structuring: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    Diligence: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    Legal: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    Close: "bg-green-500/10 text-green-500 border-green-500/20",
    Closed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };
  
  const mappedStage = mapIBStage(deal.stage);
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
      onClick={onClick}
      data-testid={`card-deal-${deal.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold">{deal.name}</h4>
            <p className="text-sm text-muted-foreground">{deal.client}</p>
          </div>
          <Badge variant="outline" className={stageColors[mappedStage] || ""}>
            {mappedStage}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{deal.progress}%</span>
          </div>
          <Progress value={deal.progress} className="h-2" />
        </div>
        
        {deal.value && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Deal Value</span>
            <span className="font-semibold">${deal.value.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DealDetail({ deal, activeTab, onTabChange }: { deal: Deal; activeTab: string; onTabChange: (tab: string) => void }) {
  const { data: updates = [], isLoading: updatesLoading } = usePortalUpdates(deal.id);
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = usePortalMessages(deal.id);
  const { data: documents = [], isLoading: docsLoading } = useDocumentsByDeal(deal.id);
  const sendMessageMutation = useSendPortalMessage();
  
  const [newMessage, setNewMessage] = useState("");
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      await sendMessageMutation.mutateAsync({ dealId: deal.id, content: newMessage.trim() });
      setNewMessage("");
      refetchMessages();
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    }
  };
  
  const handleDownload = (doc: any) => {
    if (doc.content) {
      const link = document.createElement("a");
      link.href = doc.content;
      link.download = doc.originalName || doc.filename;
      link.click();
    } else {
      toast.error("Document content not available");
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{deal.name}</CardTitle>
            <CardDescription>{deal.client} - {deal.sector}</CardDescription>
          </div>
          <Badge variant={deal.status === "active" ? "default" : "secondary"}>
            {deal.status}
          </Badge>
        </div>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="px-6">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="updates" data-testid="tab-updates">Updates</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="pt-6">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Current Stage
                </div>
                <p className="font-semibold">{deal.stage}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Progress
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={deal.progress} className="flex-1" />
                  <span className="font-semibold">{deal.progress}%</span>
                </div>
              </div>
            </div>
            
            {deal.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm">{deal.description}</p>
              </div>
            )}
            
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
              <div className="p-4 border rounded-lg">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{messages.length}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{updates.length}</p>
                <p className="text-xs text-muted-foreground">Updates</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="updates" className="mt-0">
            {updatesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : updates.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No updates yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {updates.map((update: any) => (
                    <div key={update.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{update.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {update.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{update.content}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{update.authorName}</span>
                        <span>-</span>
                        <span>{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="documents" className="mt-0">
            {docsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No documents shared yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.title || doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category} - {format(new Date(doc.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="messages" className="mt-0">
            <div className="flex flex-col h-[400px]">
              <ScrollArea className="flex-1 pr-4 mb-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Start the conversation below</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg: any) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.isExternal ? "justify-end" : "justify-start"}`}
                      >
                        <div 
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.isExternal 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <div className={`text-xs mt-1 ${msg.isExternal ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {msg.senderName} - {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[60px] resize-none"
                  data-testid="input-message"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
