import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Briefcase,
  Trash2,
  Video,
  CalendarOff,
  Check,
  X,
  User
} from "lucide-react";
import { useCurrentUser, useMeetings, useDeals, useUsers, useCreateMeeting, useDeleteMeeting, useTimeOffRequests, useCreateTimeOffRequest, useUpdateTimeOffRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import type { Meeting, TimeOffRequest } from "@shared/schema";

type EventCalendarProps = {
  role: 'CEO' | 'Employee';
};

export default function EventCalendar({ role }: EventCalendarProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: meetings = [] } = useMeetings();
  const { data: deals = [] } = useDeals();
  const { data: users = [] } = useUsers();
  const { data: timeOffRequests = [] } = useTimeOffRequests();
  const createMeetingMutation = useCreateMeeting();
  const deleteMeetingMutation = useDeleteMeeting();
  const createTimeOffMutation = useCreateTimeOffRequest();
  const updateTimeOffMutation = useUpdateTimeOffRequest();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Meeting | null>(null);
  const [selectedDayItems, setSelectedDayItems] = useState<{meetings: Meeting[], timeOffs: TimeOffRequest[]}>({ meetings: [], timeOffs: [] });
  const [activeTab, setActiveTab] = useState("calendar");
  
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    duration: 60,
    location: "",
    dealId: "",
    description: "",
    videoLink: "",
    videoPlatform: ""
  });

  const [newTimeOff, setNewTimeOff] = useState({
    type: "Vacation",
    startDate: "",
    endDate: "",
    notes: ""
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const getEventsForDate = (date: Date) => {
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.scheduledFor);
      return isSameDay(meetingDate, date);
    });
  };

  const getTimeOffForDate = (date: Date) => {
    return timeOffRequests.filter(request => {
      if (request.status !== 'Approved') return false;
      const start = parseISO(request.startDate);
      const end = parseISO(request.endDate);
      return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
    });
  };

  const myTimeOffRequests = useMemo(() => {
    if (role === 'CEO') return [];
    return timeOffRequests.filter(r => r.userId === currentUser?.id);
  }, [timeOffRequests, currentUser?.id, role]);

  const pendingTimeOffRequests = useMemo(() => {
    if (role !== 'CEO') return [];
    return timeOffRequests.filter(r => r.status === 'Pending');
  }, [timeOffRequests, role]);

  const approvedTimeOffRequests = useMemo(() => {
    return timeOffRequests.filter(r => r.status === 'Approved');
  }, [timeOffRequests]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const events = getEventsForDate(date);
    const timeOffs = getTimeOffForDate(date);
    
    const totalItems = events.length + timeOffs.length;
    
    if (totalItems === 0) {
      setNewEvent(prev => ({
        ...prev,
        date: format(date, 'yyyy-MM-dd')
      }));
      setShowEventModal(true);
    } else if (events.length === 1 && timeOffs.length === 0) {
      setSelectedEvent(events[0]);
      setShowEventDetail(true);
    } else {
      setSelectedDayItems({ meetings: events, timeOffs });
      setShowDayDetail(true);
    }
  };

  const handleEventClick = (event: Meeting, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast.error("Please fill in title, date and time");
      return;
    }

    try {
      const scheduledFor = new Date(`${newEvent.date}T${newEvent.time}`);
      
      await createMeetingMutation.mutateAsync({
        title: newEvent.title,
        scheduledFor,
        duration: newEvent.duration,
        location: newEvent.location || null,
        dealId: newEvent.dealId || null,
        description: newEvent.description || null,
        videoLink: newEvent.videoLink || null,
        videoPlatform: newEvent.videoPlatform || null,
        organizerId: currentUser?.id || null,
        participants: [],
        status: 'scheduled',
      });
      
      toast.success("Event created successfully!");
      setShowEventModal(false);
      setNewEvent({
        title: "",
        date: "",
        time: "",
        duration: 60,
        location: "",
        dealId: "",
        description: "",
        videoLink: "",
        videoPlatform: ""
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteMeetingMutation.mutateAsync(eventId);
      toast.success("Event deleted successfully!");
      setShowEventDetail(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete event");
    }
  };

  const handleCreateTimeOff = async () => {
    if (!newTimeOff.startDate || !newTimeOff.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    try {
      await createTimeOffMutation.mutateAsync({
        type: newTimeOff.type,
        startDate: newTimeOff.startDate,
        endDate: newTimeOff.endDate,
        notes: newTimeOff.notes || undefined,
      });
      
      toast.success("Time off request submitted!");
      setShowTimeOffModal(false);
      setNewTimeOff({
        type: "Vacation",
        startDate: "",
        endDate: "",
        notes: ""
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
    }
  };

  const handleApproveTimeOff = async (requestId: string) => {
    try {
      await updateTimeOffMutation.mutateAsync({
        id: requestId,
        updates: {
          status: 'Approved',
        }
      });
      toast.success("Time off approved!");
      setShowTimeOffDetail(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve request");
    }
  };

  const handleDenyTimeOff = async (requestId: string) => {
    try {
      await updateTimeOffMutation.mutateAsync({
        id: requestId,
        updates: {
          status: 'Denied',
        }
      });
      toast.success("Time off denied");
      setShowTimeOffDetail(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to deny request");
    }
  };

  const getDealName = (dealId: string | null | undefined) => {
    if (!dealId) return null;
    const deal = deals.find(d => d.id === dealId);
    return deal?.name || null;
  };

  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return "Unknown";
    const user = users.find(u => u.id === userId);
    return user?.name || "Unknown";
  };

  const formatEventTime = (meeting: Meeting) => {
    const date = new Date(meeting.scheduledFor);
    return format(date, 'h:mm a');
  };

  const formatEventDate = (meeting: Meeting) => {
    const date = new Date(meeting.scheduledFor);
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return meetings
      .filter(m => new Date(m.scheduledFor) >= now)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .slice(0, 5);
  }, [meetings]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Denied': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getTimeOffTypeColor = (type: string) => {
    switch (type) {
      case 'Vacation': return 'bg-blue-500';
      case 'Sick': return 'bg-red-500';
      case 'Personal': return 'bg-purple-500';
      case 'WFH': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Layout role={role} pageTitle="Calendar" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">
              {role === 'CEO' 
                ? 'Manage events and review time off requests'
                : 'Schedule events and request time off'}
            </p>
          </div>
          <div className="flex gap-2">
            {role === 'Employee' && (
              <Button variant="outline" onClick={() => setShowTimeOffModal(true)} data-testid="button-request-time-off">
                <CalendarOff className="w-4 h-4 mr-2" />
                Request Time Off
              </Button>
            )}
            <Button onClick={() => setShowEventModal(true)} data-testid="button-new-event">
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            {role === 'CEO' ? (
              <TabsTrigger value="requests" className="relative">
                Time Off Requests
                {pendingTimeOffRequests.length > 0 && (
                  <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-orange-500">
                    {pendingTimeOffRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            ) : (
              <TabsTrigger value="my-requests">My Requests</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">
                        {format(currentMonth, 'MMMM yyyy')}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                          data-testid="button-prev-month"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMonth(new Date())}
                          data-testid="button-today"
                        >
                          Today
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                          data-testid="button-next-month"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-secondary/50 p-2 text-center text-xs font-medium text-muted-foreground">
                          {day}
                        </div>
                      ))}
                      {calendarDays.map((day, idx) => {
                        const dayEvents = getEventsForDate(day);
                        const dayTimeOffs = getTimeOffForDate(day);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const hasTimeOff = dayTimeOffs.length > 0;
                        
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "min-h-[100px] p-1 bg-card cursor-pointer transition-colors hover:bg-secondary/30",
                              !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                              isSelected && "ring-2 ring-primary ring-inset",
                              isToday(day) && "bg-primary/5",
                              hasTimeOff && "bg-orange-500/5"
                            )}
                            onClick={() => handleDateClick(day)}
                            data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                          >
                            <div className={cn(
                              "text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                              isToday(day) && "bg-primary text-primary-foreground"
                            )}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-0.5">
                              {dayTimeOffs.slice(0, 1).map(timeOff => (
                                <div
                                  key={timeOff.id}
                                  className={cn(
                                    "text-[10px] px-1 py-0.5 rounded truncate text-white",
                                    getTimeOffTypeColor(timeOff.type)
                                  )}
                                >
                                  {getUserName(timeOff.userId)} - {timeOff.type}
                                </div>
                              ))}
                              {dayEvents.slice(0, 2).map(event => (
                                <div
                                  key={event.id}
                                  className="text-[10px] px-1 py-0.5 rounded truncate text-white bg-blue-500 cursor-pointer"
                                  onClick={(e) => handleEventClick(event, e)}
                                  data-testid={`event-${event.id}`}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {(dayEvents.length + dayTimeOffs.length) > 3 && (
                                <div className="text-[10px] text-muted-foreground px-1">
                                  +{(dayEvents.length + dayTimeOffs.length) - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Upcoming Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {upcomingEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
                      ) : (
                        <div className="space-y-3">
                          {upcomingEvents.map(event => (
                            <div
                              key={event.id}
                              className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowEventDetail(true);
                              }}
                              data-testid={`upcoming-event-${event.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{event.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(event.scheduledFor), 'MMM d')} at {formatEventTime(event)}
                                  </p>
                                </div>
                                <div className="w-2 h-2 rounded-full mt-1.5 bg-blue-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarOff className="w-4 h-4" />
                      Approved Time Off
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[150px]">
                      {approvedTimeOffRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No approved time off</p>
                      ) : (
                        <div className="space-y-2">
                          {approvedTimeOffRequests.slice(0, 5).map(request => (
                            <div
                              key={request.id}
                              className="p-2 rounded bg-secondary/30"
                            >
                              <p className="font-medium text-xs">{getUserName(request.userId)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {request.type}: {request.startDate} - {request.endDate}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {role === 'CEO' ? (
            <TabsContent value="requests" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Time Off Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingTimeOffRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No pending requests</p>
                  ) : (
                    <div className="space-y-4">
                      {pendingTimeOffRequests.map(request => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{getUserName(request.userId)}</p>
                              <p className="text-sm text-muted-foreground">
                                {request.type}: {request.startDate} to {request.endDate}
                              </p>
                              {request.notes && (
                                <p className="text-xs text-muted-foreground mt-1">"{request.notes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDenyTimeOff(request.id)}
                              disabled={updateTimeOffMutation.isPending}
                              data-testid={`deny-request-${request.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveTimeOff(request.id)}
                              disabled={updateTimeOffMutation.isPending}
                              data-testid={`approve-request-${request.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ) : (
            <TabsContent value="my-requests" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>My Time Off Requests</CardTitle>
                  <Button onClick={() => setShowTimeOffModal(true)} data-testid="button-new-request">
                    <Plus className="w-4 h-4 mr-2" />
                    New Request
                  </Button>
                </CardHeader>
                <CardContent>
                  {myTimeOffRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No time off requests yet</p>
                  ) : (
                    <div className="space-y-4">
                      {myTimeOffRequests.map(request => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{request.type}</p>
                              <Badge variant="outline" className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.startDate} to {request.endDate}
                            </p>
                            {request.notes && (
                              <p className="text-xs text-muted-foreground mt-1">Note: {request.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>Add a new event to your calendar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Event title"
                data-testid="input-event-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-event-date"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                  data-testid="input-event-time"
                />
              </div>
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Select
                value={newEvent.duration.toString()}
                onValueChange={(v) => setNewEvent(prev => ({ ...prev, duration: parseInt(v) }))}
              >
                <SelectTrigger data-testid="select-event-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={newEvent.location}
                onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Location or meeting room"
                data-testid="input-event-location"
              />
            </div>
            <div>
              <Label>Video Platform</Label>
              <Select
                value={newEvent.videoPlatform || "none"}
                onValueChange={(v) => setNewEvent(prev => ({ ...prev, videoPlatform: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-event-video">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No video call</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newEvent.videoPlatform && (
              <div>
                <Label>Meeting Link</Label>
                <Input
                  value={newEvent.videoLink}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, videoLink: e.target.value }))}
                  placeholder="https://..."
                  data-testid="input-event-meeting-link"
                />
              </div>
            )}
            <div>
              <Label>Related Deal</Label>
              <Select
                value={newEvent.dealId || "none"}
                onValueChange={(v) => setNewEvent(prev => ({ ...prev, dealId: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-event-deal">
                  <SelectValue placeholder="Select deal (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No deal</SelectItem>
                  {deals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Event description..."
                rows={3}
                data-testid="input-event-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventModal(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={createMeetingMutation.isPending} data-testid="button-create-event">
              {createMeetingMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEventDetail} onOpenChange={setShowEventDetail}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>Event Details</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{formatEventDate(selectedEvent)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{formatEventTime(selectedEvent)} ({selectedEvent.duration} min)</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.videoLink && (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <a 
                    href={selectedEvent.videoLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Join {selectedEvent.videoPlatform === 'google_meet' ? 'Google Meet' : 
                          selectedEvent.videoPlatform === 'teams' ? 'Teams' : 
                          selectedEvent.videoPlatform === 'zoom' ? 'Zoom' : 'Meeting'}
                  </a>
                </div>
              )}
              {getDealName(selectedEvent.dealId) && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline">{getDealName(selectedEvent.dealId)}</Badge>
                </div>
              )}
              {selectedEvent.description && (
                <div>
                  <Separator className="my-3" />
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}
              disabled={deleteMeetingMutation.isPending}
              data-testid="button-delete-event"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowEventDetail(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTimeOffModal} onOpenChange={setShowTimeOffModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>Submit a time off request for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select
                value={newTimeOff.type}
                onValueChange={(v) => setNewTimeOff(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger data-testid="select-time-off-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Sick">Sick Leave</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="WFH">Work From Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newTimeOff.startDate}
                  onChange={(e) => setNewTimeOff(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-time-off-start"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newTimeOff.endDate}
                  onChange={(e) => setNewTimeOff(prev => ({ ...prev, endDate: e.target.value }))}
                  data-testid="input-time-off-end"
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={newTimeOff.notes}
                onChange={(e) => setNewTimeOff(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Reason for time off..."
                rows={3}
                data-testid="input-time-off-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeOffModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTimeOff} disabled={createTimeOffMutation.isPending} data-testid="button-submit-time-off">
              {createTimeOffMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDayDetail} onOpenChange={setShowDayDetail}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Day Details'}
            </DialogTitle>
            <DialogDescription>Events and time off for this day</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4">
              {selectedDayItems.timeOffs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <CalendarOff className="w-4 h-4" />
                    Time Off
                  </h4>
                  <div className="space-y-2">
                    {selectedDayItems.timeOffs.map(timeOff => (
                      <div
                        key={timeOff.id}
                        className={cn(
                          "p-3 rounded-lg text-white",
                          getTimeOffTypeColor(timeOff.type)
                        )}
                      >
                        <p className="font-medium">{getUserName(timeOff.userId)}</p>
                        <p className="text-sm opacity-90">{timeOff.type}</p>
                        <p className="text-xs opacity-80">{timeOff.startDate} - {timeOff.endDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.meetings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Meetings
                  </h4>
                  <div className="space-y-2">
                    {selectedDayItems.meetings.map(meeting => (
                      <div
                        key={meeting.id}
                        className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors"
                        onClick={() => {
                          setSelectedEvent(meeting);
                          setShowDayDetail(false);
                          setShowEventDetail(true);
                        }}
                      >
                        <p className="font-medium">{meeting.title}</p>
                        <p className="text-sm text-muted-foreground">{formatEventTime(meeting)}</p>
                        {meeting.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {meeting.location}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedDate) {
                  setNewEvent(prev => ({
                    ...prev,
                    date: format(selectedDate, 'yyyy-MM-dd')
                  }));
                }
                setShowDayDetail(false);
                setShowEventModal(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
            <Button variant="outline" onClick={() => setShowDayDetail(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
