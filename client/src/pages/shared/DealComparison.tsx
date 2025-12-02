import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GitCompare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Target,
  BarChart3,
  CheckCircle,
  XCircle,
  Minus,
  Plus,
  ArrowUpDown
} from "lucide-react";
import { useCurrentUser, useDeals, useTasks } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip
} from "recharts";

type DealComparisonProps = {
  role: 'CEO' | 'Employee';
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DealComparison({ role }: DealComparisonProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("value");

  const activeDeals = useMemo(() => {
    return deals.filter(d => d.status === 'Active');
  }, [deals]);

  const toggleDeal = (dealId: string) => {
    setSelectedDeals(prev => {
      if (prev.includes(dealId)) {
        return prev.filter(id => id !== dealId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, dealId];
    });
  };

  const comparisonDeals = useMemo(() => {
    return selectedDeals.map(id => {
      const deal = deals.find(d => d.id === id);
      if (!deal) return null;
      
      const dealTasks = tasks.filter(t => t.dealId === id);
      const completedTasks = dealTasks.filter(t => t.status === 'Completed');
      const taskCompletionRate = dealTasks.length > 0 
        ? Math.round((completedTasks.length / dealTasks.length) * 100) 
        : 0;
      
      const stageScores: Record<string, number> = {
        'Origination': 15,
        'Pitch': 30,
        'Due Diligence': 50,
        'Negotiation': 70,
        'Documentation': 85,
        'Closing': 95,
      };
      
      return {
        ...deal,
        totalTasks: dealTasks.length,
        completedTasks: completedTasks.length,
        taskCompletionRate,
        stageScore: stageScores[deal.stage] || 50,
        teamSize: deal.podTeam?.length || 0,
        investorCount: deal.taggedInvestors?.length || 0,
      };
    }).filter(Boolean);
  }, [selectedDeals, deals, tasks]);

  const radarData = useMemo(() => {
    if (comparisonDeals.length === 0) return [];
    
    const metrics = ['Value', 'Progress', 'Stage', 'Team', 'Tasks', 'Investors'];
    const maxValues = {
      Value: Math.max(...comparisonDeals.map(d => d!.value), 1),
      Progress: 100,
      Stage: 100,
      Team: Math.max(...comparisonDeals.map(d => d!.teamSize), 1),
      Tasks: 100,
      Investors: Math.max(...comparisonDeals.map(d => d!.investorCount), 1),
    };
    
    return metrics.map(metric => {
      const point: any = { metric };
      comparisonDeals.forEach((deal, idx) => {
        if (!deal) return;
        let value = 0;
        switch (metric) {
          case 'Value': value = (deal.value / maxValues.Value) * 100; break;
          case 'Progress': value = deal.progress || 0; break;
          case 'Stage': value = deal.stageScore; break;
          case 'Team': value = (deal.teamSize / maxValues.Team) * 100; break;
          case 'Tasks': value = deal.taskCompletionRate; break;
          case 'Investors': value = (deal.investorCount / maxValues.Investors) * 100; break;
        }
        point[deal.name] = Math.round(value);
      });
      return point;
    });
  }, [comparisonDeals]);

  const sortedActiveDeals = useMemo(() => {
    return [...activeDeals].sort((a, b) => {
      switch (sortBy) {
        case 'value': return b.value - a.value;
        case 'progress': return (b.progress || 0) - (a.progress || 0);
        case 'name': return a.name.localeCompare(b.name);
        case 'stage': {
          const stages = ['Origination', 'Pitch', 'Due Diligence', 'Negotiation', 'Documentation', 'Closing'];
          return stages.indexOf(b.stage) - stages.indexOf(a.stage);
        }
        default: return 0;
      }
    });
  }, [activeDeals, sortBy]);

  const compareMetric = (deals: typeof comparisonDeals, key: string) => {
    if (deals.length < 2) return null;
    const values = deals.map(d => {
      if (!d) return 0;
      switch (key) {
        case 'value': return d.value;
        case 'progress': return d.progress || 0;
        case 'teamSize': return d.teamSize;
        case 'taskCompletion': return d.taskCompletionRate;
        default: return 0;
      }
    });
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { max, min, diff: max - min };
  };

  return (
    <Layout role={role} pageTitle="Deal Comparison" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-primary" />
              Deal Comparison
            </h1>
            <p className="text-muted-foreground">Compare deals side-by-side to prioritize focus</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedDeals.length}/4 deals selected
            </span>
            {selectedDeals.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDeals([])}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Deal Selection */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Select Deals</CardTitle>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-28 h-8" data-testid="select-sort">
                    <ArrowUpDown className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">Value</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="stage">Stage</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-3 space-y-2">
                  {sortedActiveDeals.map(deal => (
                    <button
                      key={deal.id}
                      onClick={() => toggleDeal(deal.id)}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-colors",
                        selectedDeals.includes(deal.id) 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:border-primary/50"
                      )}
                      data-testid={`deal-select-${deal.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={selectedDeals.includes(deal.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{deal.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{deal.stage}</Badge>
                            <span className="text-xs text-muted-foreground">${deal.value}M</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Comparison View */}
          <div className="lg:col-span-3 space-y-6">
            {selectedDeals.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-16 text-center">
                  <GitCompare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium">Select Deals to Compare</h3>
                  <p className="text-muted-foreground mt-1">
                    Choose up to 4 deals from the list to see a side-by-side comparison
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Radar Chart */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Performance Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--border))" />
                        {comparisonDeals.map((deal, idx) => deal && (
                          <Radar 
                            key={deal.id}
                            name={deal.name} 
                            dataKey={deal.name} 
                            stroke={COLORS[idx]} 
                            fill={COLORS[idx]} 
                            fillOpacity={0.2} 
                          />
                        ))}
                        <Legend />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Side-by-Side Comparison */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Side-by-Side Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium">Metric</th>
                            {comparisonDeals.map((deal, idx) => deal && (
                              <th key={deal.id} className="text-left p-3">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: COLORS[idx] }}
                                  />
                                  <span className="font-medium truncate max-w-[150px]">{deal.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Value</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3 font-medium">
                                ${deal.value}M
                                {compareMetric(comparisonDeals, 'value')?.max === deal.value && (
                                  <Badge variant="default" className="ml-2 text-xs">Highest</Badge>
                                )}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Stage</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">
                                <Badge variant="secondary">{deal.stage}</Badge>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Progress</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{deal.progress || 0}%</span>
                                  {compareMetric(comparisonDeals, 'progress')?.max === (deal.progress || 0) && (
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Team Size</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">
                                <span className="flex items-center gap-1">
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                  {deal.teamSize}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Task Completion</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">
                                <span className={cn(
                                  "font-medium",
                                  deal.taskCompletionRate >= 70 && "text-green-500",
                                  deal.taskCompletionRate >= 40 && deal.taskCompletionRate < 70 && "text-yellow-500",
                                  deal.taskCompletionRate < 40 && "text-red-500"
                                )}>
                                  {deal.completedTasks}/{deal.totalTasks} ({deal.taskCompletionRate}%)
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Client</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">{deal.client}</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Sector</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">{deal.sector}</td>
                            ))}
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-muted-foreground">Lead</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">{deal.lead}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 text-muted-foreground">Investors Tagged</td>
                            {comparisonDeals.map(deal => deal && (
                              <td key={deal.id} className="p-3">{deal.investorCount}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
