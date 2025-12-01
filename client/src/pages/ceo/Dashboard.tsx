import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Briefcase, 
  Users, 
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Filter,
  Plus,
  Settings,
  CheckSquare
} from "lucide-react";
import { MARKET_DATA } from "@/lib/mockData";
import { useCurrentUser, useUsers, useDeals, useTasks, useCreateDeal } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const createDeal = useCreateDeal();

  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>('Closing Soon');
  const [newDeal, setNewDeal] = useState({
    name: '',
    client: '',
    sector: 'Technology',
    value: '',
    stage: 'Origination',
    lead: '',
    status: 'Active',
    progress: 0,
  });

  const activeDeals = deals.filter(d => d.status === 'Active');
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const topUsers = [...users].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

  const handleCreateDeal = async () => {
    if (!newDeal.name || !newDeal.client || !newDeal.value) {
      toast.error("Please fill in all required fields");
      return;
    }
    const parsedValue = parseInt(newDeal.value);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Please enter a valid deal value");
      return;
    }
    try {
      await createDeal.mutateAsync({
        name: newDeal.name,
        client: newDeal.client,
        sector: newDeal.sector,
        value: parsedValue,
        stage: newDeal.stage,
        lead: newDeal.lead || currentUser?.name || 'Unassigned',
        status: newDeal.status,
        progress: newDeal.progress || 0,
      });
      toast.success("Deal created successfully!");
      setShowNewDealModal(false);
      setNewDeal({ name: '', client: '', sector: 'Technology', value: '', stage: 'Origination', lead: '', status: 'Active', progress: 0 });
    } catch (error: any) {
      toast.error(error.message || "Failed to create deal");
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilter(activeFilter === filter ? null : filter);
    toast.info(`Filter: ${filter} ${activeFilter === filter ? 'cleared' : 'applied'}`);
  };

  if (usersLoading || dealsLoading || tasksLoading) {
    return (
      <Layout role="CEO" pageTitle="Dashboard" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="CEO" pageTitle="Dashboard" userName={currentUser?.name || ""}>
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column: Quick Actions & Filters */}
        <div className="col-span-12 md:col-span-3 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                onClick={() => setShowNewDealModal(true)}
                data-testid="button-new-deal"
              >
                <Plus className="w-4 h-4" /> New Deal
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                onClick={() => setLocation('/ceo/documents')}
                data-testid="button-generate-report"
              >
                <Activity className="w-4 h-4" /> Generate Report
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                onClick={() => setLocation('/ceo/team')}
                data-testid="button-assign-team"
              >
                <Users className="w-4 h-4" /> Assign Team
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all"
                onClick={() => toast.info("Meeting scheduler coming soon!")}
                data-testid="button-schedule-meeting"
              >
                <Clock className="w-4 h-4" /> Schedule Meeting
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Deals</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation('/ceo/deals')}>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{activeDeals.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total Active Deals</p>
              
              <div className="mt-6 space-y-4">
                {activeDeals.slice(0, 3).map((deal) => (
                  <div 
                    key={deal.id} 
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => setLocation('/ceo/deals')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold",
                        deal.stage === 'Origination' ? "bg-blue-500" : 
                        deal.stage === 'Diligence' ? "bg-orange-500" : "bg-purple-500"
                      )}>
                        {deal.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{deal.name}</p>
                        <p className="text-xs text-muted-foreground">{deal.stage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{deal.value}M</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <div className="text-lg font-bold text-green-400">${totalValue.toLocaleString()}M</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Total Value</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-primary">{deals.length > 0 ? Math.round((activeDeals.length / deals.length) * 100) : 0}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Active Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Market Pulse</CardTitle>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-4">
                {MARKET_DATA.map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 p-2 rounded -mx-2 transition-colors">
                        <div>
                            <div className="text-sm font-medium">{metric.name}</div>
                            <div className="text-[10px] text-muted-foreground">{metric.description}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold">{metric.value}</div>
                            <div className={cn("text-xs", metric.trend === 'up' ? "text-green-400" : "text-red-400")}>
                                {metric.change}
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Main Content */}
        <div className="col-span-12 md:col-span-6 space-y-6">
            {/* Welcome Banner */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {currentUser?.name?.split(' ')[0]}. Here's your personalized command center.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs bg-secondary/50 border-border"
                      onClick={() => toast.info("Dashboard customization coming soon!")}
                    >
                        <Settings className="w-3 h-3 mr-2" /> Customize
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded border border-green-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        System Active
                    </div>
                </div>
            </div>

            {/* Task Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-wrap items-center gap-2">
                    <div className="text-xs font-medium text-muted-foreground mr-2 uppercase flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Filters
                    </div>
                    <Badge 
                      variant={activeFilter === 'High Priority' ? 'default' : 'secondary'} 
                      className="cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => toggleFilter('High Priority')}
                    >
                      High Priority
                    </Badge>
                    <Badge 
                      className={cn(
                        "cursor-pointer transition-colors",
                        activeFilter === 'Closing Soon' 
                          ? "bg-accent text-accent-foreground hover:bg-accent/90" 
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                      onClick={() => toggleFilter('Closing Soon')}
                    >
                      Closing Soon
                    </Badge>
                    <Badge 
                      variant={activeFilter === 'Documents' ? 'default' : 'secondary'}
                      className="cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => toggleFilter('Documents')}
                    >
                      Documents
                    </Badge>
                    <Badge 
                      variant={activeFilter === 'Closer Tasks' ? 'default' : 'secondary'}
                      className="cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => toggleFilter('Closer Tasks')}
                    >
                      Closer Tasks
                    </Badge>
                    <div 
                      className="ml-auto text-xs text-primary cursor-pointer hover:underline"
                      onClick={() => { setActiveFilter(null); toast.info("All filters cleared"); }}
                    >
                      Clear All
                    </div>
                </CardContent>
                <div className="h-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20"></div>
                <div className="p-2 bg-secondary/30 text-[10px] text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Activity className="w-3 h-3 text-accent" />
                    Electric Current Model Active • Auto-routing Enabled
                </div>
            </Card>

            {/* Team Task Progress */}
            <Card className="bg-card border-border h-[500px] overflow-hidden flex flex-col">
                 <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Task Progress</CardTitle>
                    <div className="text-[10px] text-green-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Live
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto">
                    {users.map((user, index) => (
                        <div 
                          key={user.id} 
                          className="p-4 border-b border-border/50 hover:bg-secondary/30 transition-colors group cursor-pointer"
                          onClick={() => setLocation('/ceo/team')}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                        index === 0 ? "bg-primary" : "bg-secondary border border-border"
                                    )}>
                                        {user.name.split(' ').map((n: string) => n[0]).join('')}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">{user.name}</h4>
                                        <p className="text-xs text-muted-foreground">{user.role}</p>
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                    {tasks.filter(t => t.assignedTo === user.id).length} tasks
                                </div>
                            </div>
                            
                            <div className="pl-11">
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1 text-green-400"><CheckSquare className="w-3 h-3" /> {user.completedTasks || 0} completed</span>
                                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {user.activeDeals || 0} active deals</span>
                                    <span className="flex items-center gap-1 ml-auto font-mono text-primary">Score: {user.score || 0}</span>
                                </div>
                                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${((user.score || 0) / 100) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Velocity Scoreboard */}
        <div className="col-span-12 md:col-span-3 space-y-6">
            <Card className="bg-card border-border h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live Velocity Scoreboard</CardTitle>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="space-y-1">
                        {topUsers.map((user, index) => (
                            <div 
                              key={user.id} 
                              className="p-4 border-l-2 border-transparent hover:border-primary hover:bg-secondary/30 transition-all cursor-pointer"
                              onClick={() => setLocation('/ceo/team')}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                                    <span className={cn("text-sm font-bold font-mono", index === 0 ? "text-accent" : "text-primary")}>{user.score || 0}</span>
                                </div>
                                <div className="font-medium text-sm">{user.name}</div>
                                <div className="text-xs text-muted-foreground mb-2">{user.role}</div>
                                
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Completed</div>
                                        <div className="text-xs font-bold">{user.completedTasks || 0}</div>
                                    </div>
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Active</div>
                                        <div className="text-xs font-bold">{user.activeDeals || 0}</div>
                                    </div>
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Deals</div>
                                        <div className="text-xs font-bold">{user.activeDeals || 0}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>

      {/* New Deal Modal */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deal Name *</Label>
              <Input 
                placeholder="Project Codename" 
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Input 
                placeholder="Client Company Name" 
                value={newDeal.client}
                onChange={(e) => setNewDeal({ ...newDeal, client: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value (in millions) *</Label>
                <Input 
                  type="number" 
                  placeholder="100" 
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={newDeal.sector} onValueChange={(v) => setNewDeal({ ...newDeal, sector: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="Consumer">Consumer</SelectItem>
                    <SelectItem value="Industrials">Industrials</SelectItem>
                    <SelectItem value="Financial">Financial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Origination">Origination</SelectItem>
                  <SelectItem value="Structuring">Structuring</SelectItem>
                  <SelectItem value="Diligence">Diligence</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Close">Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending}>
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
