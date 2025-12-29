import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Timer,
  TrendingUp,
  CheckCircle,
  Users,
  Search,
  BarChart3,
  Hourglass,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface UserTimeAnalytics {
  userId: string;
  userName: string;
  email: string;
  jobTitle: string | null;
  avatar: string | null;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  tasksWithTiming: number;
  totalDurationMinutes: number;
  avgDurationMinutes: number;
  completedThisWeek: number;
  byPriority: { High: number; Medium: number; Low: number };
  recentTasks: Array<{
    id: string;
    title: string;
    priority: string;
    durationMinutes: number | null;
    completedAt: string;
  }>;
}

interface TimeAnalyticsData {
  users: UserTimeAnalytics[];
  overall: {
    totalTasksCompleted: number;
    tasksWithTiming: number;
    totalDurationMinutes: number;
    avgDurationMinutes: number;
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const PRIORITY_COLORS = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#22c55e",
};

export default function TimeAnalytics() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TimeAnalyticsData>({
    queryKey: ["/api/analytics/time"],
  });

  const filteredUsers = data?.users.filter(
    (u) =>
      u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const selectedUserData = selectedUser
    ? data?.users.find((u) => u.userId === selectedUser)
    : null;

  const chartData = filteredUsers.slice(0, 10).map((u) => ({
    name: u.userName.split(" ")[0],
    avgTime: u.avgDurationMinutes,
    completed: u.completedTasks,
  }));

  const priorityData = selectedUserData
    ? [
        { name: "High", value: selectedUserData.byPriority.High, color: PRIORITY_COLORS.High },
        { name: "Medium", value: selectedUserData.byPriority.Medium, color: PRIORITY_COLORS.Medium },
        { name: "Low", value: selectedUserData.byPriority.Low, color: PRIORITY_COLORS.Low },
      ]
    : [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Time Analytics</h1>
            <p className="text-muted-foreground">
              Track task completion times across your team
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="stat-total-completed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Completed</p>
                  <p className="text-2xl font-bold">{data?.overall.totalTasksCompleted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-tasks-timed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Timer className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Timed</p>
                  <p className="text-2xl font-bold">{data?.overall.tasksWithTiming || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-time">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Hourglass className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Time</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(data?.overall.totalDurationMinutes || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-avg-time">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Time/Task</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(data?.overall.avgDurationMinutes || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" data-testid="chart-avg-time">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Average Completion Time by Team Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: "Minutes", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatDuration(value), "Avg Time"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="avgTime" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="user-list">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-search"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                {filteredUsers.map((user) => (
                  <div
                    key={user.userId}
                    className={cn(
                      "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                      selectedUser === user.userId && "bg-muted"
                    )}
                    onClick={() => setSelectedUser(user.userId)}
                    data-testid={`user-row-${user.userId}`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.completedTasks} completed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {formatDuration(user.avgDurationMinutes)}
                      </p>
                      <p className="text-xs text-muted-foreground">avg</p>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {selectedUserData && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card data-testid="selected-user-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedUserData.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedUserData.userName}</p>
                    <p className="text-sm font-normal text-muted-foreground">
                      {selectedUserData.jobTitle || "Team Member"}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tasks</p>
                    <p className="text-xl font-bold">{selectedUserData.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-xl font-bold text-green-500">
                      {selectedUserData.completedTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-xl font-bold text-blue-500">
                      {selectedUserData.inProgressTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-xl font-bold">{selectedUserData.completedThisWeek}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Completion Rate</p>
                  <Progress
                    value={
                      selectedUserData.totalTasks > 0
                        ? (selectedUserData.completedTasks / selectedUserData.totalTasks) * 100
                        : 0
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedUserData.totalTasks > 0
                      ? Math.round(
                          (selectedUserData.completedTasks / selectedUserData.totalTasks) * 100
                        )
                      : 0}
                    % complete
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="text-lg font-semibold">
                      {formatDuration(selectedUserData.totalDurationMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg/Task</p>
                    <p className="text-lg font-semibold">
                      {formatDuration(selectedUserData.avgDurationMinutes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="priority-chart">
              <CardHeader>
                <CardTitle>Tasks by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                {priorityData.some((p) => p.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No completed tasks yet
                  </div>
                )}
                <div className="flex justify-center gap-4 mt-2">
                  {priorityData.map((p) => (
                    <div key={p.name} className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs">
                        {p.name}: {p.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="recent-tasks">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recent Completed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[250px]">
                  {selectedUserData.recentTasks.length > 0 ? (
                    selectedUserData.recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 border-b"
                        data-testid={`task-row-${task.id}`}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                task.priority === "High" && "border-red-500 text-red-500",
                                task.priority === "Medium" && "border-amber-500 text-amber-500",
                                task.priority === "Low" && "border-green-500 text-green-500"
                              )}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">
                            {task.durationMinutes
                              ? formatDuration(task.durationMinutes)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No timed tasks yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
