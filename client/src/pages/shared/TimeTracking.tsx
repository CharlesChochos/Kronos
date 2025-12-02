import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Timer,
  Trash2
} from "lucide-react";
import { useCurrentUser, useDeals, useTimeEntries, useCreateTimeEntry, useDeleteTimeEntry } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { toast } from "sonner";
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

type TimeTrackingProps = {
  role: 'CEO' | 'Employee';
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function TimeTracking({ role }: TimeTrackingProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: timeEntries = [], isLoading } = useTimeEntries();
  const createTimeEntry = useCreateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDeal, setTimerDeal] = useState<string>("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [selectedWeek] = useState(new Date());

  const [newEntry, setNewEntry] = useState({
    dealId: '',
    hours: '',
    minutes: '',
    description: '',
    category: 'General',
    billable: true,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const weekStart = startOfWeek(selectedWeek);
  const weekEnd = endOfWeek(selectedWeek);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const entries = useMemo(() => {
    return timeEntries.map(e => ({
      ...e,
      dateObj: parseISO(e.date),
      dealName: deals.find(d => d.id === e.dealId)?.name || 'Unknown Deal'
    })).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [timeEntries, deals]);

  const weeklyHours = useMemo(() => {
    return weekDays.map(day => {
      const dayEntries = entries.filter(e => isSameDay(e.dateObj, day));
      const totalMinutes = dayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
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
      dealHours[e.dealName] = (dealHours[e.dealName] || 0) + (e.hours || 0);
    });
    return Object.entries(dealHours)
      .map(([name, minutes]) => ({ name, hours: Math.round(minutes / 60 * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [entries]);

  const stats = useMemo(() => {
    const thisWeekEntries = entries.filter(e => e.dateObj >= weekStart && e.dateObj <= weekEnd);
    const thisWeekMinutes = thisWeekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const billableMinutes = thisWeekEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalMinutes = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
    
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
  };

  const handleStopTimer = async () => {
    setIsTimerRunning(false);
    
    if (timerSeconds >= 60) {
      const minutes = Math.round(timerSeconds / 60);
      try {
        await createTimeEntry.mutateAsync({
          dealId: timerDeal,
          hours: minutes,
          date: format(new Date(), 'yyyy-MM-dd'),
          description: 'Timer entry',
          category: 'General',
          billable: true,
        });
        toast.success(`Logged ${formatDuration(minutes)} for deal`);
      } catch (error) {
        toast.error('Failed to save time entry');
      }
    }
    
    setTimerSeconds(0);
    setTimerDeal('');
  };

  const handleAddEntry = async () => {
    const totalMinutes = parseInt(newEntry.hours || '0') * 60 + parseInt(newEntry.minutes || '0');
    if (!newEntry.dealId || totalMinutes <= 0) {
      toast.error('Please select a deal and enter time');
      return;
    }
    
    try {
      await createTimeEntry.mutateAsync({
        dealId: newEntry.dealId,
        hours: totalMinutes,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: newEntry.description,
        category: newEntry.category,
        billable: newEntry.billable,
      });
      toast.success('Time entry saved');
      setShowAddEntry(false);
      setNewEntry({ dealId: '', hours: '', minutes: '', description: '', category: 'General', billable: true });
    } catch (error) {
      toast.error('Failed to save time entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteTimeEntry.mutateAsync(id);
      toast.success('Time entry deleted');
    } catch (error) {
      toast.error('Failed to delete time entry');
    }
  };

  return (
    <Layout role={role} pageTitle="Time Tracking" userName={currentUser?.name || ""}>
      <div className="space-y-6">
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
                        onClick={() => setIsTimerRunning(false)}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Hours by Deal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hoursByDeal.length > 0 ? (
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
                      {hoursByDeal.map((_, index) => (
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
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No time entries yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No time entries yet. Click "Log Time" to add your first entry.
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {entries.slice(0, 15).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 group">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-full rounded-full min-h-[40px]",
                          entry.billable ? "bg-green-500" : "bg-gray-500"
                        )} />
                        <div>
                          <p className="font-medium">{entry.dealName}</p>
                          <p className="text-sm text-muted-foreground">{entry.description || entry.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono font-medium">{formatDuration(entry.hours || 0)}</p>
                          <p className="text-xs text-muted-foreground">{format(entry.dateObj, 'MMM d, yyyy')}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteEntry(entry.id)}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

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
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newEntry.category} onValueChange={(v) => setNewEntry(prev => ({ ...prev, category: v }))}>
                <SelectTrigger data-testid="select-entry-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Meetings">Meetings</SelectItem>
                  <SelectItem value="Research">Research</SelectItem>
                  <SelectItem value="Document Review">Document Review</SelectItem>
                  <SelectItem value="Client Calls">Client Calls</SelectItem>
                  <SelectItem value="Due Diligence">Due Diligence</SelectItem>
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
            <Button 
              onClick={handleAddEntry} 
              disabled={createTimeEntry.isPending}
              data-testid="button-save-entry"
            >
              {createTimeEntry.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
