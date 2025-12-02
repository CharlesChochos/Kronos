import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Award,
  XCircle,
  BarChart3,
  PieChart,
  Target,
  Users,
  Building,
  DollarSign,
  Lightbulb,
  AlertTriangle
} from "lucide-react";
import { useCurrentUser, useDeals } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];

export default function WinLossAnalysis() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  
  const [timeframe, setTimeframe] = useState<string>("year");

  const wonDeals = useMemo(() => deals.filter(d => d.status === 'Closed'), [deals]);
  const lostDeals = useMemo(() => deals.filter(d => d.status === 'Lost'), [deals]);
  const activeDeals = useMemo(() => deals.filter(d => d.status === 'Active'), [deals]);

  const winRate = useMemo(() => {
    const completed = wonDeals.length + lostDeals.length;
    return completed > 0 ? Math.round((wonDeals.length / completed) * 100) : 0;
  }, [wonDeals, lostDeals]);

  const stats = useMemo(() => ({
    totalWon: wonDeals.length,
    totalLost: lostDeals.length,
    wonValue: wonDeals.reduce((sum, d) => sum + d.value, 0),
    lostValue: lostDeals.reduce((sum, d) => sum + d.value, 0),
    avgWonValue: wonDeals.length > 0 ? Math.round(wonDeals.reduce((sum, d) => sum + d.value, 0) / wonDeals.length) : 0,
    avgLostValue: lostDeals.length > 0 ? Math.round(lostDeals.reduce((sum, d) => sum + d.value, 0) / lostDeals.length) : 0,
  }), [wonDeals, lostDeals]);

  const winLossByStage = useMemo(() => {
    const stages = ['Origination', 'Pitch', 'Due Diligence', 'Negotiation', 'Documentation', 'Closing'];
    return stages.map(stage => ({
      stage,
      won: wonDeals.filter(d => d.stage === stage).length,
      lost: lostDeals.filter(d => d.stage === stage).length,
    }));
  }, [wonDeals, lostDeals]);

  const winLossBySector = useMemo(() => {
    const sectorMap: Record<string, { won: number; lost: number }> = {};
    wonDeals.forEach(d => {
      if (!sectorMap[d.sector]) sectorMap[d.sector] = { won: 0, lost: 0 };
      sectorMap[d.sector].won++;
    });
    lostDeals.forEach(d => {
      if (!sectorMap[d.sector]) sectorMap[d.sector] = { won: 0, lost: 0 };
      sectorMap[d.sector].lost++;
    });
    return Object.entries(sectorMap).map(([sector, data]) => ({
      sector,
      won: data.won,
      lost: data.lost,
      winRate: data.won + data.lost > 0 ? Math.round((data.won / (data.won + data.lost)) * 100) : 0,
    }));
  }, [wonDeals, lostDeals]);

  const monthlyTrend = [
    { month: 'Jan', won: 2, lost: 1 },
    { month: 'Feb', won: 3, lost: 2 },
    { month: 'Mar', won: 2, lost: 0 },
    { month: 'Apr', won: 4, lost: 1 },
    { month: 'May', won: 3, lost: 2 },
    { month: 'Jun', won: 5, lost: 1 },
    { month: 'Jul', won: 4, lost: 3 },
    { month: 'Aug', won: 6, lost: 2 },
    { month: 'Sep', won: 4, lost: 1 },
    { month: 'Oct', won: 5, lost: 2 },
    { month: 'Nov', won: 7, lost: 1 },
    { month: 'Dec', won: wonDeals.length, lost: lostDeals.length },
  ];

  const lossReasons = [
    { reason: 'Price/Valuation', count: 8, percentage: 32 },
    { reason: 'Competition', count: 5, percentage: 20 },
    { reason: 'Deal Timing', count: 4, percentage: 16 },
    { reason: 'Market Conditions', count: 3, percentage: 12 },
    { reason: 'Buyer Fit', count: 3, percentage: 12 },
    { reason: 'Due Diligence Issues', count: 2, percentage: 8 },
  ];

  const winFactors = [
    { factor: 'Strong Relationships', count: 12, percentage: 35 },
    { factor: 'Market Timing', count: 8, percentage: 24 },
    { factor: 'Valuation Alignment', count: 6, percentage: 18 },
    { factor: 'Unique Value Prop', count: 5, percentage: 15 },
    { factor: 'Speed to Close', count: 3, percentage: 8 },
  ];

  return (
    <Layout role="CEO" pageTitle="Win/Loss Analysis" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Win/Loss Analysis
            </h1>
            <p className="text-muted-foreground">Analyze deal outcomes to improve performance</p>
          </div>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold text-primary">{winRate}%</p>
                </div>
                <Target className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deals Won</p>
                  <p className="text-2xl font-bold text-green-500">{stats.totalWon}</p>
                </div>
                <Award className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deals Lost</p>
                  <p className="text-2xl font-bold text-red-500">{stats.totalLost}</p>
                </div>
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Won Value</p>
                  <p className="text-2xl font-bold text-green-500">${stats.wonValue}M</p>
                </div>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lost Value</p>
                  <p className="text-2xl font-bold text-red-500">${stats.lostValue}M</p>
                </div>
                <DollarSign className="w-5 h-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Win/Loss Trend */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Monthly Win/Loss Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="lost" name="Lost" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Win/Loss by Sector */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                Win Rate by Sector
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winLossBySector}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sector" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="won" name="Won" fill="#10b981" />
                  <Bar dataKey="lost" name="Lost" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Loss Reasons */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Top Loss Reasons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lossReasons.map((reason, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{reason.reason}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{reason.count} deals</Badge>
                        <span className="text-sm text-muted-foreground">{reason.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full" 
                        style={{ width: `${reason.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Win Factors */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-green-500" />
                Top Win Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {winFactors.map((factor, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{factor.factor}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{factor.count} deals</Badge>
                        <span className="text-sm text-muted-foreground">{factor.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${factor.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deal Lists */}
        <Tabs defaultValue="won" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="won" data-testid="tab-won-deals">Won Deals ({wonDeals.length})</TabsTrigger>
            <TabsTrigger value="lost" data-testid="tab-lost-deals">Lost Deals ({lostDeals.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="won">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {wonDeals.map(deal => (
                      <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                        <div>
                          <p className="font-medium">{deal.name}</p>
                          <p className="text-sm text-muted-foreground">{deal.client} • {deal.sector}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-500">${deal.value}M</p>
                          <Badge variant="secondary">{deal.stage}</Badge>
                        </div>
                      </div>
                    ))}
                    {wonDeals.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">No won deals yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="lost">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {lostDeals.map(deal => (
                      <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                        <div>
                          <p className="font-medium">{deal.name}</p>
                          <p className="text-sm text-muted-foreground">{deal.client} • {deal.sector}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-500">${deal.value}M</p>
                          <Badge variant="secondary">{deal.stage}</Badge>
                        </div>
                      </div>
                    ))}
                    {lostDeals.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">No lost deals</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
