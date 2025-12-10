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
import { useCurrentUser, useDeals, useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, CalendarEventType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { toast } from "sonner";

type InvestorEvent = {
  id: string;
  title: string;
  date: Date;
  time?: string;
  type: 'meeting' | 'call' | 'deadline' | 'followup' | 'presentation';
  investor: string;
  deal?: string;
  status: 'scheduled' | 'completed' | 'pending';
  notes?: string;
  location?: string;
};

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
  const { data: calendarEvents = [], isLoading: eventsLoading } = useCalendarEvents();
  const createEventMutation = useCreateCalendarEvent();
  const updateEventMutation = useUpdateCalendarEvent();
  const deleteEventMutation = useDeleteCalendarEvent();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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
  
  // Transform database events to component format
  const events: InvestorEvent[] = useMemo(() => {
    return calendarEvents.map((event: CalendarEventType) => ({
      id: event.id || '',
      title: event.title,
      date: event.date ? parseISO(event.date) : new Date(),
      time: event.time || undefined,
      type: (event.type || 'meeting') as InvestorEvent['type'],
      investor: event.investor || 'Unknown Investor',
      deal: event.dealName || undefined,
      status: (event.status || 'scheduled') as 'scheduled' | 'completed' | 'pending',
      notes: event.notes || undefined,
      location: event.location || undefined,
    }));
  }, [calendarEvents]);

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

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.investor) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Find the deal to get its name
    const selectedDeal = deals.find((d: any) => d.id === newEvent.deal);
    
    try {
      await createEventMutation.mutateAsync({
        title: newEvent.title,
        date: newEvent.date,
        time: newEvent.time || null,
        type: newEvent.type,
        description: null,
        dealId: newEvent.deal || null,
        dealName: selectedDeal?.name || null,
        location: newEvent.location || null,
        participants: [],
        isAllDay: false,
        color: null,
        investor: newEvent.investor || null,
        status: 'scheduled',
        notes: newEvent.notes || null,
      });
      
      toast.success("Event added successfully");
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
    } catch (error) {
      toast.error("Failed to create event");
      console.error("Failed to create event:", error);
    }
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
                              {event.time 
                                ? `${format(event.date, 'MMM d')}, ${event.time.replace(/^(\d{1,2}):(\d{2})$/, (_, h, m) => {
                                    const hour = parseInt(h);
                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                    const displayHour = hour % 12 || 12;
                                    return `${displayHour}:${m} ${ampm}`;
                                  })}`
                                : format(event.date, 'MMM d')}
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
                <Select
                  value={newEvent.time}
                  onValueChange={(v) => setNewEvent(prev => ({ ...prev, time: v }))}
                >
                  <SelectTrigger data-testid="select-event-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 36 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 6;
                      const minute = (i % 2) * 30;
                      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const display = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
                      return <SelectItem key={time24} value={time24}>{display}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
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
              <Select value={newEvent.deal || "none"} onValueChange={(v) => setNewEvent(prev => ({ ...prev, deal: v === "none" ? '' : v }))}>
                <SelectTrigger data-testid="select-deal">
                  <SelectValue placeholder="Select a deal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
