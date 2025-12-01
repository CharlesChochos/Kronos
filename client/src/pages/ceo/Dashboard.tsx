import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { MARKET_DATA, USERS, DEALS, TASKS } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 550 },
  { name: 'Apr', value: 480 },
  { name: 'May', value: 650 },
  { name: 'Jun', value: 700 },
];

export default function Dashboard() {
  return (
    <Layout role="CEO" pageTitle="Dashboard" userName="Joshua Orlinsky">
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column: Quick Actions & Filters - Integrated into sidebar visually in mockup but separate here for simplicity or as a widget */}
        <div className="col-span-12 md:col-span-3 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all">
                <Plus className="w-4 h-4" /> New Deal
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all">
                <Activity className="w-4 h-4" /> Generate Report
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all">
                <Users className="w-4 h-4" /> Assign Team
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-secondary/50 hover:bg-primary/10 hover:text-primary border-transparent hover:border-primary/20 transition-all">
                <Clock className="w-4 h-4" /> Schedule Meeting
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Deals</CardTitle>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">6</div>
              <p className="text-xs text-muted-foreground mt-1">Total Active Deals</p>
              
              <div className="mt-6 space-y-4">
                {DEALS.slice(0, 3).map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between group cursor-pointer">
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
                  <div className="text-lg font-bold text-green-400">$3,425M</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Total Value</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-primary">83%</div>
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
                    <div key={metric.name} className="flex items-center justify-between">
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
                    <p className="text-muted-foreground">Welcome back, Joshua. Here's your personalized command center.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-secondary/50 border-border">
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
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">High Priority</Badge>
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer transition-colors">Closing Soon</Badge>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">Documents</Badge>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">Closer Tasks</Badge>
                    <div className="ml-auto text-xs text-primary cursor-pointer hover:underline">Clear All</div>
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
                    {USERS.map((user, index) => (
                        <div key={user.id} className="p-4 border-b border-border/50 hover:bg-secondary/30 transition-colors group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                        index === 0 ? "bg-primary" : "bg-secondary border border-border"
                                    )}>
                                        {user.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">{user.name}</h4>
                                        <p className="text-xs text-muted-foreground">{user.role}</p>
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                    {index === 0 ? "45 tasks" : `${Math.floor(Math.random() * 20)} tasks`}
                                </div>
                            </div>
                            
                            <div className="pl-11">
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1 text-green-400"><CheckSquare className="w-3 h-3" /> {user.completedTasks} completed</span>
                                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {user.activeDeals} active deals</span>
                                    <span className="flex items-center gap-1 ml-auto font-mono text-primary">Score: {user.score}</span>
                                </div>
                                {/* Progress Bar Visual */}
                                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(user.score / 10) * 100}%` }}></div>
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
                        {USERS.sort((a, b) => b.score - a.score).map((user, index) => (
                            <div key={user.id} className="p-4 border-l-2 border-transparent hover:border-primary hover:bg-secondary/30 transition-all cursor-pointer">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                                    <span className={cn("text-sm font-bold font-mono", index === 0 ? "text-accent" : "text-primary")}>{user.score}</span>
                                </div>
                                <div className="font-medium text-sm">{user.name}</div>
                                <div className="text-xs text-muted-foreground mb-2">{user.role}</div>
                                
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Completed</div>
                                        <div className="text-xs font-bold">{user.completedTasks}</div>
                                    </div>
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Active</div>
                                        <div className="text-xs font-bold">{user.activeDeals}</div>
                                    </div>
                                    <div className="bg-secondary/50 rounded py-1">
                                        <div className="text-[10px] text-muted-foreground">Deals</div>
                                        <div className="text-xs font-bold">{user.activeDeals}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </Layout>
  );
}
