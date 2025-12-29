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
import { Input } from "@/components/ui/input";
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
  Calendar,
  Search
} from "lucide-react";
import { useCurrentUser, useUsers, useDealsListing, useTasks } from "@/lib/api";
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
  const { data: deals = [] } = useDealsListing();
  const { data: tasks = [] } = useTasks();
  
  const [timeframe, setTimeframe] = useState<string>("month");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState<string>("");

  // Helper to get date range based on timeframe
  const getTimeframeRange = (tf: string) => {
    const now = new Date();
    let start: Date;
    switch (tf) {
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start, end: now };
  };

  const teamMembers = useMemo(() => {
    const { start, end } = getTimeframeRange(timeframe);
    
    // Helper to check if a date is within the timeframe
    const isInTimeframe = (dateStr: string | Date | null | undefined) => {
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= start && date <= end;
    };
    
    return users
      .filter(u => u.status === 'active')
      .map(user => {
      // Get ALL user's tasks (for base counts)
      const allUserTasks = tasks.filter(t => t.assignedTo === user.id);
      const allUserCompletedTasks = allUserTasks.filter(t => t.status === 'Completed');
      
      // Get ALL user's deals
      const allUserDeals = deals.filter(d => 
        d.lead === user.name || (d as any).podTeam?.some((p: any) => p.name === user.name)
      );
      
      // Filter tasks for the timeframe (completed within timeframe)
      const timeframeCompletedTasks = allUserCompletedTasks.filter(t => {
        if (!t.completedAt) return false;
        return isInTimeframe(t.completedAt);
      });
      
      // Filter deals created within the timeframe
      const timeframeDeals = allUserDeals.filter(d => {
        if (!d.createdAt) return false;
        return isInTimeframe(d.createdAt);
      });
      
      // Filter tasks that have activity within the timeframe (due or completed in timeframe)
      const timeframeTasks = allUserTasks.filter(t => {
        const dueInRange = t.dueDate && isInTimeframe(t.dueDate);
        const completedInRange = t.completedAt && isInTimeframe(t.completedAt);
        return dueInRange || completedInRange;
      });
      
      // Use timeframe data when available, fall back to all-time if no data in timeframe
      const hasTimeframeData = timeframeTasks.length > 0 || timeframeDeals.length > 0;
      const displayTasks = hasTimeframeData ? timeframeTasks : allUserTasks;
      const displayCompletedTasks = hasTimeframeData ? timeframeCompletedTasks : allUserCompletedTasks;
      const displayDeals = hasTimeframeData ? timeframeDeals : allUserDeals;
      
      const taskCompletionRate = displayTasks.length > 0 
        ? Math.round((displayCompletedTasks.length / displayTasks.length) * 100) 
        : 0;
      
      const avgDealValue = displayDeals.length > 0
        ? Math.round(displayDeals.reduce((sum, d) => sum + d.value, 0) / displayDeals.length)
        : 0;
      
      const onTimeCompletions = displayCompletedTasks.filter(t => {
        if (!t.dueDate || !t.completedAt) return false;
        const dueDate = new Date(t.dueDate);
        const completedDate = new Date(t.completedAt);
        return completedDate <= dueDate;
      }).length;
      
      const tasksWithCompletionDate = displayCompletedTasks.filter(t => t.completedAt).length;
      const onTimeRate = tasksWithCompletionDate > 0
        ? Math.round((onTimeCompletions / tasksWithCompletionDate) * 100)
        : 0; // Default to 0% if no completed tasks
      
      const activeDeals = displayDeals.filter(d => d.status === 'Active').length;
      const closedDeals = displayDeals.filter(d => d.status === 'Closed').length;
      const pipelineValue = displayDeals.reduce((sum, d) => sum + d.value, 0);
      
      // Calculate a dynamic performance score based on actual metrics
      // Weighted: Task Completion (30%), On-Time Rate (30%), Completed Tasks (20%), Deal Activity (20%)
      const taskWeight = taskCompletionRate * 0.3;
      const onTimeWeight = onTimeRate * 0.3;
      const completedWeight = Math.min(displayCompletedTasks.length * 5, 100) * 0.2; // 5 points per task, max 100
      const dealWeight = Math.min((activeDeals + closedDeals) * 10, 100) * 0.2; // 10 points per deal, max 100
      const calculatedScore = Math.round(taskWeight + onTimeWeight + completedWeight + dealWeight);

      return {
        ...user,
        taskCompletionRate,
        avgDealValue,
        onTimeRate,
        totalTasks: displayTasks.length,
        completedTasks: displayCompletedTasks.length,
        activeDeals,
        closedDeals,
        pipelineValue,
        calculatedScore, // Dynamic score based on performance
        hasTimeframeData, // Flag to indicate if data is from timeframe or all-time
      };
    });
  }, [users, deals, tasks, timeframe]);

  const teamStats = useMemo(() => {
    const totalTasks = teamMembers.reduce((sum, m) => sum + m.totalTasks, 0);
    const completedTasks = teamMembers.reduce((sum, m) => sum + m.completedTasks, 0);
    const activeDeals = teamMembers.reduce((sum, m) => sum + m.activeDeals, 0);
    const avgCompletionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;
    
    return { totalTasks, completedTasks, activeDeals, avgCompletionRate };
  }, [teamMembers]);

  // Performance trends calculated based on timeframe
  const performanceTrends = useMemo(() => {
    const now = new Date();
    const data: { period: string; tasks: number; deals: number; revenue: number }[] = [];
    
    // Generate data points based on selected timeframe
    if (timeframe === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
        const dayName = date.toLocaleString('default', { weekday: 'short' });
        
        const dayTasks = tasks.filter(t => {
          if (t.status !== 'Completed' || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate.toDateString() === date.toDateString();
        }).length;
        
        const dayDeals = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt.toDateString() === date.toDateString();
        }).length;
        
        const dayRevenue = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt.toDateString() === date.toDateString();
        }).reduce((sum, d) => sum + d.value, 0);
        
        data.push({ period: dayName, tasks: dayTasks, deals: dayDeals, revenue: dayRevenue });
      }
    } else if (timeframe === 'month') {
      // Weeks of current month - cover entire month (up to 5 weeks for 31-day months)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weeksNeeded = Math.ceil(daysInMonth / 7);
      
      for (let week = 0; week < weeksNeeded; week++) {
        const weekStartDay = 1 + (week * 7);
        const weekEndDay = Math.min((week + 1) * 7, daysInMonth);
        const weekStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), weekStartDay);
        const weekEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), weekEndDay, 23, 59, 59);
        
        const weekTasks = tasks.filter(t => {
          if (t.status !== 'Completed' || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= weekStart && completedDate <= weekEnd;
        }).length;
        
        const weekDeals = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
        }).length;
        
        const weekRevenue = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
        }).reduce((sum, d) => sum + d.value, 0);
        
        data.push({ period: `Week ${week + 1}`, tasks: weekTasks, deals: weekDeals, revenue: weekRevenue });
      }
    } else if (timeframe === 'quarter') {
      // All 3 months of current quarter (always show all 3)
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(now.getFullYear(), quarterMonth + i, 1);
        const monthEnd = new Date(now.getFullYear(), quarterMonth + i + 1, 0, 23, 59, 59);
        const monthName = monthStart.toLocaleString('default', { month: 'short' });
        
        const monthTasks = tasks.filter(t => {
          if (t.status !== 'Completed' || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= monthStart && completedDate <= monthEnd;
        }).length;
        
        const monthDeals = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).length;
        
        const monthRevenue = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).reduce((sum, d) => sum + d.value, 0);
        
        data.push({ period: monthName, tasks: monthTasks, deals: monthDeals, revenue: monthRevenue });
      }
    } else {
      // Year - always show all 12 months
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(now.getFullYear(), i, 1);
        const monthEnd = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59);
        const monthName = monthStart.toLocaleString('default', { month: 'short' });
        
        const monthTasks = tasks.filter(t => {
          if (t.status !== 'Completed' || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= monthStart && completedDate <= monthEnd;
        }).length;
        
        const monthDeals = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).length;
        
        const monthRevenue = deals.filter(d => {
          if (d.status !== 'Closed') return false;
          const createdAt = d.createdAt ? new Date(d.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).reduce((sum, d) => sum + d.value, 0);
        
        data.push({ period: monthName, tasks: monthTasks, deals: monthDeals, revenue: monthRevenue });
      }
    }
    
    return data;
  }, [tasks, deals, timeframe]);

  const leaderboard = useMemo(() => {
    return [...teamMembers]
      .sort((a, b) => b.calculatedScore - a.calculatedScore)
      .slice(0, 5);
  }, [teamMembers]);
  
  // Filtered team members based on search
  const filteredTeamMembers = useMemo(() => {
    if (!memberSearch.trim()) return teamMembers;
    const searchLower = memberSearch.toLowerCase();
    return teamMembers.filter(m => 
      m.name.toLowerCase().includes(searchLower) ||
      (m.jobTitle?.toLowerCase() || '').includes(searchLower) ||
      (m.email?.toLowerCase() || '').includes(searchLower)
    );
  }, [teamMembers, memberSearch]);

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
    { metric: 'Deal Activity', value: Math.min((selectedMemberData.activeDeals + selectedMemberData.closedDeals) * 10, 100) },
    { metric: 'Pipeline Value', value: Math.min(selectedMemberData.pipelineValue / 10, 100) },
    { metric: 'Overall Score', value: selectedMemberData.calculatedScore },
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
          {/* Performance Trends Chart */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Performance Trends ({timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : timeframe === 'quarter' ? 'This Quarter' : 'This Year'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
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
                        {(member.name || "?").split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.jobTitle || member.role}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">{member.calculatedScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members Grid */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Members ({filteredTeamMembers.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-members"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeamMembers.map(member => (
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
                          {(member.name || "?").split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{member.name}</h4>
                        <Badge variant="secondary" className="text-xs mt-1">{member.jobTitle || member.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-sm">{member.calculatedScore}</span>
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
                      {(selectedMemberData.name || "?").split(' ').map(n => n[0]).join('')}
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
