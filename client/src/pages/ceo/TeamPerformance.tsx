import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Clock,
  CheckCircle,
  BarChart3,
  Star,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from "lucide-react";
import { useCurrentUser, useUsers, useDeals, useTasks } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

export default function TeamPerformance() {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  
  const [timeframe, setTimeframe] = useState<string>("month");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const teamMembers = useMemo(() => {
    return users.filter(u => u.accessLevel !== 'admin').map(user => {
      const userTasks = tasks.filter(t => t.assignedTo === user.id);
      const completedTasks = userTasks.filter(t => t.status === 'Completed');
      const userDeals = deals.filter(d => d.lead === user.name || d.podTeam?.some(p => p.name === user.name));
      
      const taskCompletionRate = userTasks.length > 0 
        ? Math.round((completedTasks.length / userTasks.length) * 100) 
        : 0;
      
      const avgDealValue = userDeals.length > 0
        ? Math.round(userDeals.reduce((sum, d) => sum + d.value, 0) / userDeals.length)
        : 0;
      
      const onTimeCompletions = completedTasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        const completedDate = t.completedAt ? new Date(t.completedAt) : null;
        if (!completedDate) return false;
        return completedDate <= dueDate;
      }).length;
      
      const tasksWithCompletionDate = completedTasks.filter(t => t.completedAt).length;
      const onTimeRate = tasksWithCompletionDate > 0
        ? Math.round((onTimeCompletions / tasksWithCompletionDate) * 100)
        : taskCompletionRate;

      return {
        ...user,
        taskCompletionRate,
        avgDealValue,
        onTimeRate,
        totalTasks: userTasks.length,
        completedTasks: completedTasks.length,
        activeDeals: userDeals.filter(d => d.status === 'Active').length,
        closedDeals: userDeals.filter(d => d.status === 'Closed').length,
        pipelineValue: userDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });
  }, [users, deals, tasks]);

  const teamStats = useMemo(() => {
    const totalTasks = teamMembers.reduce((sum, m) => sum + m.totalTasks, 0);
    const completedTasks = teamMembers.reduce((sum, m) => sum + m.completedTasks, 0);
    const activeDeals = teamMembers.reduce((sum, m) => sum + m.activeDeals, 0);
    const avgCompletionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;
    
    return { totalTasks, completedTasks, activeDeals, avgCompletionRate };
  }, [teamMembers]);

  // Monthly performance is calculated from actual task and deal data
  const monthlyPerformance = useMemo(() => {
    const now = new Date();
    const months: { month: string; tasks: number; deals: number; revenue: number }[] = [];
    
    // Generate data for last 6 months based on actual tasks and deals
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      // Count completed tasks in this month
      const monthTasks = tasks.filter(t => {
        if (t.status !== 'Completed' || !t.completedAt) return false;
        const completedDate = new Date(t.completedAt);
        return completedDate >= date && completedDate <= monthEnd;
      }).length;
      
      // Count closed deals in this month (using createdAt as proxy since no updatedAt)
      const monthDeals = deals.filter(d => {
        if (d.status !== 'Closed') return false;
        const createdAt = d.createdAt ? new Date(d.createdAt) : null;
        return createdAt && createdAt >= date && createdAt <= monthEnd;
      }).length;
      
      // Calculate revenue from closed deals
      const monthRevenue = deals.filter(d => {
        if (d.status !== 'Closed') return false;
        const createdAt = d.createdAt ? new Date(d.createdAt) : null;
        return createdAt && createdAt >= date && createdAt <= monthEnd;
      }).reduce((sum, d) => sum + d.value, 0);
      
      months.push({ month: monthName, tasks: monthTasks, deals: monthDeals, revenue: monthRevenue });
    }
    
    return months;
  }, [tasks, deals]);

  const leaderboard = useMemo(() => {
    return [...teamMembers]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }, [teamMembers]);

  const roleDistribution = useMemo(() => {
    const roles: Record<string, number> = {};
    teamMembers.forEach(m => {
      roles[m.role] = (roles[m.role] || 0) + 1;
    });
    return Object.entries(roles).map(([name, value]) => ({ name, value }));
  }, [teamMembers]);

  const selectedMemberData = selectedMember 
    ? teamMembers.find(m => m.id === selectedMember) 
    : null;

  const selectedMemberRadar = selectedMemberData ? [
    { metric: 'Task Completion', value: selectedMemberData.taskCompletionRate },
    { metric: 'On-Time Delivery', value: selectedMemberData.onTimeRate },
    { metric: 'Deal Activity', value: Math.min(selectedMemberData.activeDeals * 20, 100) },
    { metric: 'Pipeline Value', value: Math.min(selectedMemberData.pipelineValue / 10, 100) },
    { metric: 'Score', value: selectedMemberData.score || 0 },
  ] : [];

  return (
    <Layout role="CEO" pageTitle="Team Performance" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Performance Analytics</h1>
            <p className="text-muted-foreground">Monitor team productivity, workload, and trends</p>
          </div>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Team Size</p>
                  <p className="text-2xl font-bold">{teamMembers.length}</p>
                </div>
                <Users className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold">{teamStats.completedTasks}/{teamStats.totalTasks}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Completion Rate</p>
                  <p className="text-2xl font-bold">{teamStats.avgCompletionRate}%</p>
                </div>
                <Target className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Deals</p>
                  <p className="text-2xl font-bold">{teamStats.activeDeals}</p>
                </div>
                <Briefcase className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Performance Chart */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Monthly Performance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyPerformance}>
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
                  <Bar dataKey="tasks" name="Tasks Completed" fill="#3b82f6" />
                  <Bar dataKey="deals" name="Deals Closed" fill="#10b981" />
                  <Bar dataKey="revenue" name="Revenue ($M)" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaderboard.map((member, idx) => (
                  <div 
                    key={member.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedMember(member.id)}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      idx === 0 && "bg-yellow-500/20 text-yellow-500",
                      idx === 1 && "bg-gray-400/20 text-gray-400",
                      idx === 2 && "bg-orange-500/20 text-orange-500",
                      idx > 2 && "bg-secondary text-muted-foreground"
                    )}>
                      {idx + 1}
                    </div>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">{member.score || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members Grid */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map(member => (
                <Card 
                  key={member.id} 
                  className={cn(
                    "bg-secondary/30 border cursor-pointer transition-all",
                    selectedMember === member.id ? "border-primary" : "border-transparent hover:border-border"
                  )}
                  onClick={() => setSelectedMember(member.id)}
                  data-testid={`team-member-card-${member.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{member.name}</h4>
                        <Badge variant="secondary" className="text-xs mt-1">{member.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-sm">{member.score || 0}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Task Completion</span>
                          <span className="font-medium">{member.taskCompletionRate}%</span>
                        </div>
                        <Progress value={member.taskCompletionRate} className="h-1.5" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 rounded bg-secondary/50">
                          <p className="text-muted-foreground text-xs">Active Deals</p>
                          <p className="font-medium">{member.activeDeals}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <p className="text-muted-foreground text-xs">Pipeline</p>
                          <p className="font-medium">${member.pipelineValue}M</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Member Details */}
        {selectedMemberData && (
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {selectedMemberData.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {selectedMemberData.name} - Performance Details
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <div>
                  <h4 className="font-medium mb-4">Performance Metrics</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={selectedMemberRadar}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--border))" />
                      <Radar 
                        name={selectedMemberData.name} 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.3} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats Grid */}
                <div>
                  <h4 className="font-medium mb-4">Detailed Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Total Tasks</p>
                      <p className="text-2xl font-bold">{selectedMemberData.totalTasks}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-500">{selectedMemberData.completedTasks}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">On-Time Rate</p>
                      <p className="text-2xl font-bold">{selectedMemberData.onTimeRate}%</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Avg Deal Value</p>
                      <p className="text-2xl font-bold">${selectedMemberData.avgDealValue}M</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Active Deals</p>
                      <p className="text-2xl font-bold text-blue-500">{selectedMemberData.activeDeals}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground">Closed Deals</p>
                      <p className="text-2xl font-bold text-purple-500">{selectedMemberData.closedDeals}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
