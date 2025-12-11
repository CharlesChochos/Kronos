import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { useCurrentUser, useDealsListing } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Map legacy IB stages to new stages
const mapIBStage = (stage: string) => {
  const legacyMap: Record<string, string> = {
    'Due Diligence': 'Diligence',
    'Negotiation': 'Legal',
    'Closing': 'Close',
    'Execution': 'Structuring',
    'Signing': 'Close',
    'Qualification': 'Origination',
    'Pitch': 'Structuring',
    'Documentation': 'Legal',
  };
  return legacyMap[stage] || stage;
};

export default function PipelineForecasting() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDealsListing();
  
  const [timeframe, setTimeframe] = useState<string>("Q4 2024");
  const [scenarioType, setScenarioType] = useState<string>("base");
  const [closeRateAdjustment, setCloseRateAdjustment] = useState<number[]>([100]);
  const [dealValueAdjustment, setDealValueAdjustment] = useState<number[]>([100]);

  const stageWeights: Record<string, number> = {
    'Origination': 0.15,
    'Structuring': 0.35,
    'Diligence': 0.55,
    'Legal': 0.80,
    'Close': 0.95,
  };

  const forecasts = useMemo(() => {
    const closeRate = closeRateAdjustment[0] / 100;
    const valueMultiplier = dealValueAdjustment[0] / 100;
    
    const activeDeals = deals.filter(d => d.status === 'Active');
    
    const weightedPipeline = activeDeals.reduce((sum, deal) => {
      const mappedStage = mapIBStage(deal.stage);
      const weight = stageWeights[mappedStage] || 0.5;
      return sum + (deal.value * weight * closeRate * valueMultiplier);
    }, 0);

    const bestCase = activeDeals.reduce((sum, deal) => {
      const mappedStage = mapIBStage(deal.stage);
      const weight = Math.min((stageWeights[mappedStage] || 0.5) + 0.2, 1);
      return sum + (deal.value * weight * 1.1 * valueMultiplier);
    }, 0);

    const worstCase = activeDeals.reduce((sum, deal) => {
      const mappedStage = mapIBStage(deal.stage);
      const weight = Math.max((stageWeights[mappedStage] || 0.5) - 0.2, 0);
      return sum + (deal.value * weight * 0.8 * valueMultiplier);
    }, 0);

    return {
      base: weightedPipeline,
      best: bestCase,
      worst: worstCase,
      total: activeDeals.reduce((sum, d) => sum + d.value, 0),
    };
  }, [deals, closeRateAdjustment, dealValueAdjustment]);

  const monthlyProjections = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return months.slice(currentMonth, currentMonth + 6).map((month, idx) => {
      const factor = 1 + (idx * 0.08);
      return {
        month,
        base: Math.round(forecasts.base * factor / 6),
        best: Math.round(forecasts.best * factor / 6),
        worst: Math.round(forecasts.worst * factor / 6),
      };
    });
  }, [forecasts]);

  const stageDistribution = useMemo(() => {
    const stages = ['Origination', 'Structuring', 'Diligence', 'Legal', 'Close'];
    return stages.map(stage => {
      const stageDeals = deals.filter(d => mapIBStage(d.stage) === stage && d.status === 'Active');
      return {
        name: stage,
        value: stageDeals.reduce((sum, d) => sum + d.value, 0),
        count: stageDeals.length,
      };
    }).filter(s => s.value > 0);
  }, [deals]);

  const sectorDistribution = useMemo(() => {
    const sectorMap: Record<string, number> = {};
    deals.filter(d => d.status === 'Active').forEach(deal => {
      sectorMap[deal.sector] = (sectorMap[deal.sector] || 0) + deal.value;
    });
    return Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
  }, [deals]);

  const quarterlyComparison = [
    { quarter: 'Q1', actual: 45, forecast: 50, target: 55 },
    { quarter: 'Q2', actual: 62, forecast: 58, target: 60 },
    { quarter: 'Q3', actual: 78, forecast: 72, target: 70 },
    { quarter: 'Q4', actual: null, forecast: forecasts.base, target: 85 },
  ];

  const riskAnalysis = useMemo(() => {
    const activeDeals = deals.filter(d => d.status === 'Active');
    const atRisk = activeDeals.filter(d => (d.progress || 0) < 30 && stageWeights[mapIBStage(d.stage)] > 0.3);
    const onTrack = activeDeals.filter(d => (d.progress || 0) >= 50);
    const delayed = activeDeals.filter(d => (d.progress || 0) >= 30 && (d.progress || 0) < 50);
    
    return { atRisk, onTrack, delayed };
  }, [deals]);

  return (
    <Layout role="CEO" pageTitle="Pipeline Forecasting" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pipeline Forecasting</h1>
            <p className="text-muted-foreground">Revenue projections and scenario analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32" data-testid="select-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Q4 2024">Q4 2024</SelectItem>
                <SelectItem value="Q1 2025">Q1 2025</SelectItem>
                <SelectItem value="H1 2025">H1 2025</SelectItem>
                <SelectItem value="FY 2025">FY 2025</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" data-testid="button-export-forecast">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Scenario Controls */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Scenario Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Scenario Type</label>
                <Select value={scenarioType} onValueChange={setScenarioType}>
                  <SelectTrigger data-testid="select-scenario-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base Case</SelectItem>
                    <SelectItem value="best">Best Case</SelectItem>
                    <SelectItem value="worst">Worst Case</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Close Rate Adjustment: {closeRateAdjustment[0]}%
                </label>
                <Slider
                  value={closeRateAdjustment}
                  onValueChange={setCloseRateAdjustment}
                  min={50}
                  max={150}
                  step={5}
                  className="w-full"
                  data-testid="slider-close-rate"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Deal Value Adjustment: {dealValueAdjustment[0]}%
                </label>
                <Slider
                  value={dealValueAdjustment}
                  onValueChange={setDealValueAdjustment}
                  min={50}
                  max={150}
                  step={5}
                  className="w-full"
                  data-testid="slider-deal-value"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold">${forecasts.total}M</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Forecast</p>
                  <p className="text-2xl font-bold">${Math.round(forecasts.base)}M</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round((forecasts.base / forecasts.total) * 100)}% weighted probability
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Best Case</p>
                  <p className="text-2xl font-bold text-green-500">${Math.round(forecasts.best)}M</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Worst Case</p>
                  <p className="text-2xl font-bold text-orange-500">${Math.round(forecasts.worst)}M</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <TrendingDown className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Projection Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Monthly Revenue Projections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyProjections}>
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
                  <Area type="monotone" dataKey="best" name="Best Case" stroke="#10b981" fill="#10b98133" />
                  <Area type="monotone" dataKey="base" name="Base Case" stroke="#3b82f6" fill="#3b82f633" />
                  <Area type="monotone" dataKey="worst" name="Worst Case" stroke="#f59e0b" fill="#f59e0b33" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Stage Distribution */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                Pipeline by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={stageDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: $${value}M`}
                  >
                    {stageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${value}M`, 'Value']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quarterly Comparison */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Quarterly Performance vs Target
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={quarterlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="actual" name="Actual" fill="#10b981" />
                  <Bar dataKey="forecast" name="Forecast" fill="#3b82f6" />
                  <Bar dataKey="target" name="Target" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sector Distribution */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Pipeline by Sector
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value}M`, 'Value']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Risk Analysis */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Deal Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* On Track */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-medium text-green-500">On Track</h3>
                  <Badge variant="secondary" className="ml-auto bg-green-500/20 text-green-500">
                    {riskAnalysis.onTrack.length}
                  </Badge>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {riskAnalysis.onTrack.slice(0, 5).map(deal => (
                      <div key={deal.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{deal.name}</span>
                        <span className="text-muted-foreground">${deal.value}M</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Delayed */}
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-medium text-yellow-500">Delayed</h3>
                  <Badge variant="secondary" className="ml-auto bg-yellow-500/20 text-yellow-500">
                    {riskAnalysis.delayed.length}
                  </Badge>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {riskAnalysis.delayed.slice(0, 5).map(deal => (
                      <div key={deal.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{deal.name}</span>
                        <span className="text-muted-foreground">${deal.value}M</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* At Risk */}
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="font-medium text-red-500">At Risk</h3>
                  <Badge variant="secondary" className="ml-auto bg-red-500/20 text-red-500">
                    {riskAnalysis.atRisk.length}
                  </Badge>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {riskAnalysis.atRisk.slice(0, 5).map(deal => (
                      <div key={deal.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{deal.name}</span>
                        <span className="text-muted-foreground">${deal.value}M</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
