import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Plane,
  Home,
  AlertTriangle,
  Clock
} from "lucide-react";
import { useCurrentUser, useTimeOffRequests, useCreateTimeOffRequest, useUpdateTimeOffRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday, isWithinInterval, parseISO } from "date-fns";
import { toast } from "sonner";

type VacationCalendarProps = {
  role: 'CEO' | 'Employee';
};

const typeColors: Record<string, string> = {
  Vacation: 'bg-blue-500',
  Sick: 'bg-red-500',
  Personal: 'bg-purple-500',
  WFH: 'bg-green-500',
};

const typeLabels: Record<string, string> = {
  Vacation: 'Vacation',
  Sick: 'Sick Leave',
  Personal: 'Personal',
  WFH: 'Work from Home',
};

const typeIcons: Record<string, React.ElementType> = {
  Vacation: Plane,
  Sick: AlertTriangle,
  Personal: Clock,
  WFH: Home,
};

export default function VacationCalendar({ role }: VacationCalendarProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: timeOffRequests = [], isLoading } = useTimeOffRequests();
  const createRequest = useCreateTimeOffRequest();
  const updateRequest = useUpdateTimeOffRequest();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  
  const [newRequest, setNewRequest] = useState({
    type: 'Vacation',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...daysInMonth];

  const requests = useMemo(() => {
    return timeOffRequests.map(r => ({
      ...r,
      startDateObj: parseISO(r.startDate),
      endDateObj: parseISO(r.endDate),
    }));
  }, [timeOffRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filterType !== 'all' && req.type !== filterType) return false;
      return true;
    });
  }, [requests, filterType]);

  const getRequestsForDate = (date: Date) => {
    return filteredRequests.filter(req => 
      isWithinInterval(date, { start: req.startDateObj, end: req.endDateObj }) &&
      req.status === 'Approved'
    );
  };

  const upcomingRequests = useMemo(() => {
    const today = new Date();
    return filteredRequests
      .filter(r => r.startDateObj >= today && r.status === 'Approved')
      .sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime())
      .slice(0, 10);
  }, [filteredRequests]);

  const pendingRequests = useMemo(() => {
    return requests.filter(r => r.status === 'Pending');
  }, [requests]);

  const stats = useMemo(() => {
    const today = new Date();
    const outToday = requests.filter(r => 
      r.status === 'Approved' && isWithinInterval(today, { start: r.startDateObj, end: r.endDateObj })
    ).length;
    
    const thisMonth = requests.filter(r => 
      r.status === 'Approved' && 
      (isSameMonth(r.startDateObj, currentMonth) || isSameMonth(r.endDateObj, currentMonth))
    ).length;
    
    return { outToday, thisMonth, pending: pendingRequests.length };
  }, [requests, currentMonth, pendingRequests]);

  const handleAddRequest = async () => {
    if (!newRequest.startDate || !newRequest.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    
    try {
      await createRequest.mutateAsync({
        type: newRequest.type,
        startDate: newRequest.startDate,
        endDate: newRequest.endDate,
        notes: newRequest.notes || undefined,
      });
      toast.success('Time off request submitted');
      setShowAddRequest(false);
      setNewRequest({ type: 'Vacation', startDate: '', endDate: '', notes: '' });
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateRequest.mutateAsync({ id, updates: { status: 'Approved' } });
      toast.success('Request approved');
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await updateRequest.mutateAsync({ id, updates: { status: 'Denied' } });
      toast.success('Request denied');
    } catch (error) {
      toast.error('Failed to deny request');
    }
  };

  return (
    <Layout role={role} pageTitle="Vacation Calendar" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" />
              Vacation & Availability
            </h1>
            <p className="text-muted-foreground">Team time off and availability calendar</p>
          </div>
          <Button onClick={() => setShowAddRequest(true)} data-testid="button-request-time-off">
            <Plus className="w-4 h-4 mr-2" />
            Request Time Off
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Out Today</p>
                  <p className="text-2xl font-bold">{stats.outToday}</p>
                </div>
                <Users className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.thisMonth}</p>
                </div>
                <CalendarIcon className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Requests</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-32" data-testid="select-filter-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Vacation">Vacation</SelectItem>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Personal">Personal</SelectItem>
                      <SelectItem value="WFH">Work from Home</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {paddedDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="h-20 bg-secondary/20 rounded-lg" />;
                  }
                  
                  const dayRequests = getRequestsForDate(day);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-20 p-1 rounded-lg border text-left transition-colors overflow-hidden",
                        isToday(day) && "border-primary",
                        !isToday(day) && "border-border"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayRequests.slice(0, 2).map(req => (
                          <div
                            key={req.id}
                            className={cn(
                              "text-xs px-1 py-0.5 rounded truncate text-white",
                              typeColors[req.type] || 'bg-blue-500'
                            )}
                          >
                            {(req.userName || 'User').split(' ')[0]}
                          </div>
                        ))}
                        {dayRequests.length > 2 && (
                          <p className="text-xs text-muted-foreground">+{dayRequests.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                {Object.entries(typeLabels).map(([type, label]) => (
                  <div key={type} className="flex items-center gap-1">
                    <div className={cn("w-3 h-3 rounded", typeColors[type])} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {role === 'CEO' && pendingRequests.length > 0 && (
              <Card className="bg-yellow-500/5 border-yellow-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-yellow-500">
                    <Clock className="w-4 h-4" />
                    Pending Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="p-2 rounded border border-yellow-500/30 bg-yellow-500/5">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-primary/20 text-primary">
                              {(req.userName || 'U').split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{req.userName || 'Unknown'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {typeLabels[req.type] || req.type} • {format(req.startDateObj, 'MMM d')} - {format(req.endDateObj, 'MMM d')}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-6 text-xs"
                            onClick={() => handleApprove(req.id)}
                            disabled={updateRequest.isPending}
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-red-500"
                            onClick={() => handleDeny(req.id)}
                            disabled={updateRequest.isPending}
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Plane className="w-4 h-4 text-primary" />
                  Upcoming Time Off
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {upcomingRequests.map(req => {
                        const Icon = typeIcons[req.type] || Plane;
                        return (
                          <div key={req.id} className="p-2 rounded border border-border hover:bg-secondary/50">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                  {(req.userName || 'U').split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{req.userName || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(req.startDateObj, 'MMM d')} - {format(req.endDateObj, 'MMM d')}
                                </p>
                              </div>
                              <Badge className={cn("text-white text-xs", typeColors[req.type] || 'bg-blue-500')}>
                                {typeLabels[req.type] || req.type}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                      {upcomingRequests.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No upcoming time off</p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showAddRequest} onOpenChange={setShowAddRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newRequest.type} onValueChange={(v) => setNewRequest(prev => ({ ...prev, type: v }))}>
                <SelectTrigger data-testid="select-request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Sick">Sick Leave</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="WFH">Work from Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newRequest.startDate}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newRequest.endDate}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, endDate: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={newRequest.notes}
                onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRequest(false)}>Cancel</Button>
            <Button 
              onClick={handleAddRequest} 
              disabled={createRequest.isPending}
              data-testid="button-submit-request"
            >
              {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
