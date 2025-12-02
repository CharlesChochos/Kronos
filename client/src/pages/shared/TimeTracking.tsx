import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Play,
  Pause,
  Square,
  Plus,
  Calendar,
  Briefcase,
  BarChart3,
  TrendingUp,
  Timer
} from "lucide-react";
import { useCurrentUser, useDeals, useTasks } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays } from "date-fns";
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
  Cell
} from "recharts";

type TimeEntry = {
  id: string;
  date: Date;
  dealId: string;
  dealName: string;
  taskId?: string;
  taskName?: string;
  duration: number;
  description: string;
  billable: boolean;
};

type TimeTrackingProps = {
  role: 'CEO' | 'Employee';
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function TimeTracking({ role }: TimeTrackingProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDeal, setTimerDeal] = useState<string>("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  
  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    const demoEntries: TimeEntry[] = [];
    const dealsList = deals.length > 0 ? deals : [
      { id: '1', name: 'TechCorp Acquisition' },
      { id: '2', name: 'FinServe IPO' },
      { id: '3', name: 'RetailMax M&A' },
    ];
    
    for (let i = 0; i < 20; i++) {
      const deal = dealsList[Math.floor(Math.random() * dealsList.length)];
      demoEntries.push({
        id: `entry-${i}`,
        date: subDays(new Date(), Math.floor(Math.random() * 14)),
        dealId: (deal as any).id || `deal-${i}`,
        dealName: (deal as any).name || `Deal ${i}`,
        duration: Math.floor(Math.random() * 240) + 30,
        description: ['Research', 'Due Diligence', 'Client Call', 'Document Review', 'Team Meeting'][Math.floor(Math.random() * 5)],
        billable: Math.random() > 0.2,
      });
    }
    return demoEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  const [newEntry, setNewEntry] = useState({
    dealId: '',
    hours: '',
    minutes: '',
    description: '',
    billable: true,
  });

  const weekStart = startOfWeek(selectedWeek);
  const weekEnd = endOfWeek(selectedWeek);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeklyHours = useMemo(() => {
    return weekDays.map(day => {
      const dayEntries = entries.filter(e => isSameDay(e.date, day));
      const totalMinutes = dayEntries.reduce((sum, e) => sum + e.duration, 0);
      return {
        day: format(day, 'EEE'),
        hours: Math.round(totalMinutes / 60 * 10) / 10,
        date: day,
      };
    });
  }, [entries, weekDays]);

  const hoursByDeal = useMemo(() => {
    const dealHours: Record<string, number> = {};
    entries.forEach(e => {
      dealHours[e.dealName] = (dealHours[e.dealName] || 0) + e.duration;
    });
    return Object.entries(dealHours)
      .map(([name, minutes]) => ({ name, hours: Math.round(minutes / 60 * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [entries]);

  const stats = useMemo(() => {
    const thisWeekEntries = entries.filter(e => e.date >= weekStart && e.date <= weekEnd);
    const thisWeekMinutes = thisWeekEntries.reduce((sum, e) => sum + e.duration, 0);
    const billableMinutes = thisWeekEntries.filter(e => e.billable).reduce((sum, e) => sum + e.duration, 0);
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration, 0);
    
    return {
      thisWeek: Math.round(thisWeekMinutes / 60 * 10) / 10,
      billable: Math.round(billableMinutes / 60 * 10) / 10,
      total: Math.round(totalMinutes / 60 * 10) / 10,
      billableRate: thisWeekMinutes > 0 ? Math.round((billableMinutes / thisWeekMinutes) * 100) : 0,
    };
  }, [entries, weekStart, weekEnd]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleStartTimer = () => {
    if (!timerDeal) return;
    setIsTimerRunning(true);
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    (window as any).timerInterval = interval;
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    clearInterval((window as any).timerInterval);
    
    if (timerSeconds >= 60) {
      const dealName = deals.find(d => d.id === timerDeal)?.name || 'Unknown Deal';
      setEntries(prev => [{
        id: `entry-${Date.now()}`,
        date: new Date(),
        dealId: timerDeal,
        dealName,
        duration: Math.round(timerSeconds / 60),
        description: 'Timer entry',
        billable: true,
      }, ...prev]);
    }
    
    setTimerSeconds(0);
    setTimerDeal('');
  };

  const handleAddEntry = () => {
    const totalMinutes = parseInt(newEntry.hours || '0') * 60 + parseInt(newEntry.minutes || '0');
    if (!newEntry.dealId || totalMinutes <= 0) return;
    
    const dealName = deals.find(d => d.id === newEntry.dealId)?.name || 'Unknown Deal';
    
    setEntries(prev => [{
      id: `entry-${Date.now()}`,
      date: new Date(),
      dealId: newEntry.dealId,
      dealName,
      duration: totalMinutes,
      description: newEntry.description,
      billable: newEntry.billable,
    }, ...prev]);
    
    setShowAddEntry(false);
    setNewEntry({ dealId: '', hours: '', minutes: '', description: '', billable: true });
  };

  return (
    <Layout role={role} pageTitle="Time Tracking" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-primary" />
              Time Tracking
            </h1>
            <p className="text-muted-foreground">Track time spent on deals and tasks</p>
          </div>
          <Button onClick={() => setShowAddEntry(true)} data-testid="button-add-entry">
            <Plus className="w-4 h-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Timer Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="flex-1 max-w-xs">
                <Label className="text-sm text-muted-foreground mb-2 block">Select Deal</Label>
                <Select value={timerDeal} onValueChange={setTimerDeal} disabled={isTimerRunning}>
                  <SelectTrigger data-testid="select-timer-deal">
                    <SelectValue placeholder="Choose a deal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deals.filter(d => d.status === 'Active').map(deal => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-4xl font-mono font-bold min-w-[120px] text-center">
                  {String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:
                  {String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0')}:
                  {String(timerSeconds % 60).padStart(2, '0')}
                </div>
                
                <div className="flex items-center gap-2">
                  {!isTimerRunning ? (
                    <Button 
                      onClick={handleStartTimer} 
                      disabled={!timerDeal}
                      className="bg-green-500 hover:bg-green-600"
                      data-testid="button-start-timer"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setIsTimerRunning(false);
                          clearInterval((window as any).timerInterval);
                        }}
                        data-testid="button-pause-timer"
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                      <Button 
                        onClick={handleStopTimer}
                        className="bg-red-500 hover:bg-red-600"
                        data-testid="button-stop-timer"
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">{stats.thisWeek}h</p>
                </div>
                <Timer className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Billable Hours</p>
                  <p className="text-2xl font-bold text-green-500">{stats.billable}h</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Billable Rate</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.billableRate}%</p>
                </div>
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Logged</p>
                  <p className="text-2xl font-bold">{stats.total}h</p>
                </div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Hours */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Weekly Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Hours by Deal */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Hours by Deal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={hoursByDeal}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="hours"
                    label={({ name, hours }) => `${name}: ${hours}h`}
                  >
                    {hoursByDeal.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Time Entries */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {entries.slice(0, 15).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-full rounded-full",
                        entry.billable ? "bg-green-500" : "bg-gray-500"
                      )} />
                      <div>
                        <p className="font-medium">{entry.dealName}</p>
                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">{formatDuration(entry.duration)}</p>
                      <p className="text-xs text-muted-foreground">{format(entry.date, 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deal</Label>
              <Select value={newEntry.dealId} onValueChange={(v) => setNewEntry(prev => ({ ...prev, dealId: v }))}>
                <SelectTrigger data-testid="select-entry-deal">
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  min="0"
                  value={newEntry.hours}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, hours: e.target.value }))}
                  placeholder="0"
                  data-testid="input-hours"
                />
              </div>
              <div className="space-y-2">
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={newEntry.minutes}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, minutes: e.target.value }))}
                  placeholder="0"
                  data-testid="input-minutes"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newEntry.description}
                onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What did you work on?"
                data-testid="input-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={newEntry.billable}
                onChange={(e) => setNewEntry(prev => ({ ...prev, billable: e.target.checked }))}
              />
              <Label htmlFor="billable">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} data-testid="button-save-entry">Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
