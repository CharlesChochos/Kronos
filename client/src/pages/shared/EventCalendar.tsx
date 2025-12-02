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
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Briefcase,
  Trash2,
  Video
} from "lucide-react";
import { useCurrentUser, useMeetings, useDeals, useUsers, useCreateMeeting, useDeleteMeeting } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { toast } from "sonner";
import type { Meeting } from "@shared/schema";

type EventCalendarProps = {
  role: 'CEO' | 'Employee';
};

export default function EventCalendar({ role }: EventCalendarProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: meetings = [] } = useMeetings();
  const { data: deals = [] } = useDeals();
  const { data: users = [] } = useUsers();
  const createMeetingMutation = useCreateMeeting();
  const deleteMeetingMutation = useDeleteMeeting();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Meeting | null>(null);
  
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

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const events = getEventsForDate(date);
    if (events.length === 1) {
      setSelectedEvent(events[0]);
      setShowEventDetail(true);
    } else if (events.length > 1) {
      setSelectedDate(date);
    } else {
      setNewEvent(prev => ({
        ...prev,
        date: format(date, 'yyyy-MM-dd')
      }));
      setShowEventModal(true);
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

  const getDealName = (dealId: string | null | undefined) => {
    if (!dealId) return null;
    const deal = deals.find(d => d.id === dealId);
    return deal?.name || null;
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

  const eventTypeColors: Record<string, string> = {
    meeting: "bg-blue-500",
    call: "bg-green-500",
    deadline: "bg-red-500",
    presentation: "bg-purple-500",
    other: "bg-gray-500"
  };

  return (
    <Layout role={role} pageTitle="Calendar" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">Schedule and track events, meetings, and deadlines</p>
          </div>
          <Button onClick={() => setShowEventModal(true)} data-testid="button-new-event">
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Button>
        </div>

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
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "min-h-[100px] p-1 bg-card cursor-pointer transition-colors hover:bg-secondary/30",
                          !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                          isSelected && "ring-2 ring-primary ring-inset",
                          isToday(day) && "bg-primary/5"
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
                          {dayEvents.slice(0, 3).map(event => (
                            <div
                              key={event.id}
                              className={cn(
                                "text-[10px] px-1 py-0.5 rounded truncate text-white cursor-pointer",
                                eventTypeColors.meeting
                              )}
                              onClick={(e) => handleEventClick(event, e)}
                              data-testid={`event-${event.id}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">
                              +{dayEvents.length - 3} more
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
                <ScrollArea className="h-[300px]">
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
                              {getDealName(event.dealId) && (
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  {getDealName(event.dealId)}
                                </Badge>
                              )}
                            </div>
                            <div className={cn("w-2 h-2 rounded-full mt-1.5", eventTypeColors.meeting)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {selectedDate && getEventsForDate(selectedDate).length > 1 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Events on {format(selectedDate, 'MMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getEventsForDate(selectedDate).map(event => (
                      <div
                        key={event.id}
                        className="p-2 rounded bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDetail(true);
                        }}
                      >
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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
    </Layout>
  );
}
