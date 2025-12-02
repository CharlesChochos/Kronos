import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Building,
  Phone,
  Mail,
  MapPin,
  Clock,
  Target,
  DollarSign,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useCurrentUser, useDeals } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";

type InvestorEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'meeting' | 'call' | 'deadline' | 'followup' | 'presentation';
  investor: string;
  deal?: string;
  status: 'scheduled' | 'completed' | 'pending';
  notes?: string;
  location?: string;
};

const demoEvents: InvestorEvent[] = [
  {
    id: '1',
    title: 'LP Meeting - First Round Capital',
    date: new Date(),
    type: 'meeting',
    investor: 'First Round Capital',
    deal: 'TechCorp Acquisition',
    status: 'scheduled',
    location: 'NYC Office'
  },
  {
    id: '2',
    title: 'Due Diligence Call',
    date: new Date(Date.now() + 86400000),
    type: 'call',
    investor: 'Andreessen Horowitz',
    status: 'scheduled',
  },
  {
    id: '3',
    title: 'Term Sheet Deadline',
    date: new Date(Date.now() + 86400000 * 3),
    type: 'deadline',
    investor: 'Sequoia Capital',
    deal: 'FinServe IPO',
    status: 'pending',
  },
  {
    id: '4',
    title: 'Investor Presentation',
    date: new Date(Date.now() + 86400000 * 5),
    type: 'presentation',
    investor: 'Blackstone',
    deal: 'RetailMax M&A',
    status: 'scheduled',
    location: 'Virtual - Zoom'
  },
  {
    id: '5',
    title: 'Follow-up with GP',
    date: new Date(Date.now() + 86400000 * 7),
    type: 'followup',
    investor: 'KKR',
    status: 'pending',
  },
];

const eventTypeColors: Record<string, string> = {
  meeting: 'bg-blue-500',
  call: 'bg-green-500',
  deadline: 'bg-red-500',
  followup: 'bg-yellow-500',
  presentation: 'bg-purple-500',
};

const eventTypeLabels: Record<string, string> = {
  meeting: 'Meeting',
  call: 'Call',
  deadline: 'Deadline',
  followup: 'Follow-up',
  presentation: 'Presentation',
};

export default function CapitalRaisingCalendar() {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<InvestorEvent[]>(demoEvents);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    type: 'meeting' as InvestorEvent['type'],
    investor: '',
    deal: '',
    location: '',
    notes: '',
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...daysInMonth];

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filterType !== 'all' && event.type !== filterType) return false;
      return true;
    });
  }, [events, filterType]);

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date));
  };

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter(e => e.date >= new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.investor) return;
    
    const eventDate = new Date(newEvent.date);
    if (newEvent.time) {
      const [hours, minutes] = newEvent.time.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const event: InvestorEvent = {
      id: crypto.randomUUID(),
      title: newEvent.title,
      date: eventDate,
      type: newEvent.type,
      investor: newEvent.investor,
      deal: newEvent.deal || undefined,
      status: 'scheduled',
      location: newEvent.location || undefined,
      notes: newEvent.notes || undefined,
    };
    
    setEvents(prev => [...prev, event]);
    setShowAddEvent(false);
    setNewEvent({
      title: '',
      date: '',
      time: '',
      type: 'meeting',
      investor: '',
      deal: '',
      location: '',
      notes: '',
    });
  };

  const investorStats = useMemo(() => {
    const scheduled = events.filter(e => e.status === 'scheduled').length;
    const completed = events.filter(e => e.status === 'completed').length;
    const pending = events.filter(e => e.status === 'pending').length;
    const thisMonth = events.filter(e => isSameMonth(e.date, currentMonth)).length;
    
    return { scheduled, completed, pending, thisMonth };
  }, [events, currentMonth]);

  return (
    <Layout role="CEO" pageTitle="Capital Raising Calendar" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Capital Raising Calendar</h1>
            <p className="text-muted-foreground">Track investor touchpoints and fundraising milestones</p>
          </div>
          <Button onClick={() => setShowAddEvent(true)} data-testid="button-add-event">
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">{investorStats.thisMonth}</p>
                </div>
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-500">{investorStats.scheduled}</p>
                </div>
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">{investorStats.pending}</p>
                </div>
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-500">{investorStats.completed}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
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
                      <SelectItem value="meeting">Meetings</SelectItem>
                      <SelectItem value="call">Calls</SelectItem>
                      <SelectItem value="deadline">Deadlines</SelectItem>
                      <SelectItem value="followup">Follow-ups</SelectItem>
                      <SelectItem value="presentation">Presentations</SelectItem>
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
                    return <div key={`empty-${idx}`} className="h-24 bg-secondary/20 rounded-lg" />;
                  }
                  
                  const dayEvents = getEventsForDate(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "h-24 p-1 rounded-lg border text-left transition-colors overflow-hidden",
                        isToday(day) && "border-primary",
                        isSelected && "bg-primary/10 border-primary",
                        !isSelected && "border-border hover:bg-secondary/50"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-xs px-1 py-0.5 rounded truncate text-white",
                              eventTypeColors[event.type]
                            )}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full mt-1.5",
                          eventTypeColors[event.type]
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {eventTypeLabels[event.type]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(event.date, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Building className="w-3 h-3" />
                            <span className="truncate">{event.investor}</span>
                          </div>
                          {event.deal && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <DollarSign className="w-3 h-3" />
                              <span className="truncate">{event.deal}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No upcoming events</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Events */}
        {selectedDate && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Events on {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getEventsForDate(selectedDate).map(event => (
                  <Card key={event.id} className="bg-secondary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn("text-white", eventTypeColors[event.type])}>
                          {eventTypeLabels[event.type]}
                        </Badge>
                        <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </div>
                      <h4 className="font-medium">{event.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{event.investor}</p>
                      {event.deal && <p className="text-sm text-muted-foreground">Deal: {event.deal}</p>}
                      {event.location && <p className="text-sm text-muted-foreground">Location: {event.location}</p>}
                    </CardContent>
                  </Card>
                ))}
                {getEventsForDate(selectedDate).length === 0 && (
                  <p className="text-muted-foreground col-span-full text-center py-8">
                    No events scheduled for this date
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Investor Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Event Title</Label>
              <Input
                placeholder="e.g., LP Meeting with First Round"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-event-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                  data-testid="input-event-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newEvent.type} onValueChange={(v) => setNewEvent(prev => ({ ...prev, type: v as InvestorEvent['type'] }))}>
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Investor</Label>
              <Input
                placeholder="e.g., Sequoia Capital"
                value={newEvent.investor}
                onChange={(e) => setNewEvent(prev => ({ ...prev, investor: e.target.value }))}
                data-testid="input-investor"
              />
            </div>
            <div className="space-y-2">
              <Label>Related Deal (optional)</Label>
              <Select value={newEvent.deal} onValueChange={(v) => setNewEvent(prev => ({ ...prev, deal: v }))}>
                <SelectTrigger data-testid="select-deal">
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.name}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                placeholder="e.g., NYC Office or Virtual - Zoom"
                value={newEvent.location}
                onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                data-testid="input-location"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={newEvent.notes}
                onChange={(e) => setNewEvent(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEvent(false)}>Cancel</Button>
            <Button onClick={handleAddEvent} data-testid="button-save-event">Save Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
