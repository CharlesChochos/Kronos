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
  Briefcase,
  AlertTriangle,
  Clock
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isWithinInterval, addDays } from "date-fns";

type TimeOffRequest = {
  id: string;
  userId: string;
  userName: string;
  type: 'vacation' | 'sick' | 'personal' | 'wfh';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'denied';
  notes?: string;
};

type VacationCalendarProps = {
  role: 'CEO' | 'Employee';
};

const typeColors: Record<string, string> = {
  vacation: 'bg-blue-500',
  sick: 'bg-red-500',
  personal: 'bg-purple-500',
  wfh: 'bg-green-500',
};

const typeLabels: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick Leave',
  personal: 'Personal',
  wfh: 'Work from Home',
};

const typeIcons: Record<string, React.ElementType> = {
  vacation: Plane,
  sick: AlertTriangle,
  personal: Clock,
  wfh: Home,
};

const demoRequests: TimeOffRequest[] = [
  {
    id: '1',
    userId: '1',
    userName: 'Sarah Johnson',
    type: 'vacation',
    startDate: addDays(new Date(), 5),
    endDate: addDays(new Date(), 12),
    status: 'approved',
  },
  {
    id: '2',
    userId: '2',
    userName: 'Michael Chen',
    type: 'wfh',
    startDate: addDays(new Date(), 1),
    endDate: addDays(new Date(), 1),
    status: 'approved',
  },
  {
    id: '3',
    userId: '3',
    userName: 'Emily Davis',
    type: 'personal',
    startDate: addDays(new Date(), 3),
    endDate: addDays(new Date(), 3),
    status: 'pending',
  },
  {
    id: '4',
    userId: '4',
    userName: 'James Wilson',
    type: 'sick',
    startDate: new Date(),
    endDate: addDays(new Date(), 1),
    status: 'approved',
  },
];

export default function VacationCalendar({ role }: VacationCalendarProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [requests, setRequests] = useState<TimeOffRequest[]>(demoRequests);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  
  const [newRequest, setNewRequest] = useState({
    type: 'vacation' as TimeOffRequest['type'],
    startDate: '',
    endDate: '',
    notes: '',
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...daysInMonth];

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filterType !== 'all' && req.type !== filterType) return false;
      return true;
    });
  }, [requests, filterType]);

  const getRequestsForDate = (date: Date) => {
    return filteredRequests.filter(req => 
      isWithinInterval(date, { start: req.startDate, end: req.endDate }) &&
      req.status === 'approved'
    );
  };

  const upcomingRequests = useMemo(() => {
    return filteredRequests
      .filter(r => r.startDate >= new Date() && r.status === 'approved')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 10);
  }, [filteredRequests]);

  const pendingRequests = useMemo(() => {
    return requests.filter(r => r.status === 'pending');
  }, [requests]);

  const stats = useMemo(() => {
    const today = new Date();
    const outToday = requests.filter(r => 
      r.status === 'approved' && isWithinInterval(today, { start: r.startDate, end: r.endDate })
    ).length;
    
    const thisMonth = requests.filter(r => 
      r.status === 'approved' && 
      (isSameMonth(r.startDate, currentMonth) || isSameMonth(r.endDate, currentMonth))
    ).length;
    
    return { outToday, thisMonth, pending: pendingRequests.length };
  }, [requests, currentMonth, pendingRequests]);

  const handleAddRequest = () => {
    if (!newRequest.startDate || !newRequest.endDate) return;
    
    const request: TimeOffRequest = {
      id: `req-${Date.now()}`,
      userId: currentUser?.id || '',
      userName: currentUser?.name || '',
      type: newRequest.type,
      startDate: new Date(newRequest.startDate),
      endDate: new Date(newRequest.endDate),
      status: 'pending',
      notes: newRequest.notes,
    };
    
    setRequests(prev => [...prev, request]);
    setShowAddRequest(false);
    setNewRequest({ type: 'vacation', startDate: '', endDate: '', notes: '' });
  };

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
  };

  const handleDeny = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' as const } : r));
  };

  return (
    <Layout role={role} pageTitle="Vacation Calendar" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
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

        {/* Stats */}
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
          {/* Calendar */}
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
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="wfh">Work from Home</SelectItem>
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
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
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
                              typeColors[req.type]
                            )}
                          >
                            {req.userName.split(' ')[0]}
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
              
              {/* Legend */}
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pending Approvals (CEO only) */}
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
                              {req.userName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{req.userName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {typeLabels[req.type]} • {format(req.startDate, 'MMM d')} - {format(req.endDate, 'MMM d')}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-6 text-xs"
                            onClick={() => handleApprove(req.id)}
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-red-500"
                            onClick={() => handleDeny(req.id)}
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

            {/* Upcoming Time Off */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Plane className="w-4 h-4 text-primary" />
                  Upcoming Time Off
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {upcomingRequests.map(req => {
                      const Icon = typeIcons[req.type];
                      return (
                        <div key={req.id} className="p-2 rounded border border-border hover:bg-secondary/50">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                {req.userName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{req.userName}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(req.startDate, 'MMM d')} - {format(req.endDate, 'MMM d')}
                              </p>
                            </div>
                            <Badge className={cn("text-white text-xs", typeColors[req.type])}>
                              {typeLabels[req.type]}
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Request Dialog */}
      <Dialog open={showAddRequest} onOpenChange={setShowAddRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newRequest.type} onValueChange={(v) => setNewRequest(prev => ({ ...prev, type: v as TimeOffRequest['type'] }))}>
                <SelectTrigger data-testid="select-request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="wfh">Work from Home</SelectItem>
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
            <Button onClick={handleAddRequest} data-testid="button-submit-request">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
