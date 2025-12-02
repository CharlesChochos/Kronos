import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FileText,
  Search,
  Download,
  Filter,
  Calendar as CalendarIcon,
  User,
  Briefcase,
  CheckSquare,
  MessageSquare,
  AlertTriangle,
  Shield,
  Clock,
  ChevronRight,
  Eye
} from "lucide-react";
import { useCurrentUser, useDeals, useTasks, useUsers } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, subDays, isAfter, isBefore } from "date-fns";

type AuditEvent = {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout' | 'assign' | 'complete';
  entity: 'deal' | 'task' | 'document' | 'user' | 'message' | 'system';
  entityId?: string;
  entityName?: string;
  details: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'critical';
};

const generateDemoAuditEvents = (): AuditEvent[] => {
  const events: AuditEvent[] = [];
  const users = ['Josh Orlinsky', 'Sarah Johnson', 'Michael Chen', 'Emily Davis', 'James Wilson'];
  const actions: AuditEvent['action'][] = ['create', 'update', 'view', 'export', 'assign', 'complete'];
  const entities: AuditEvent['entity'][] = ['deal', 'task', 'document', 'user', 'message'];
  
  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const entity = entities[Math.floor(Math.random() * entities.length)];
    
    let details = '';
    let severity: AuditEvent['severity'] = 'info';
    
    switch (action) {
      case 'create': 
        details = `Created new ${entity}`; 
        break;
      case 'update': 
        details = `Updated ${entity} information`; 
        severity = 'warning';
        break;
      case 'delete': 
        details = `Deleted ${entity}`; 
        severity = 'critical';
        break;
      case 'view': 
        details = `Viewed ${entity} details`; 
        break;
      case 'export': 
        details = `Exported ${entity} data`; 
        severity = 'warning';
        break;
      case 'assign': 
        details = `Assigned ${entity} to team member`; 
        break;
      case 'complete': 
        details = `Marked ${entity} as complete`; 
        break;
    }
    
    events.push({
      id: `audit-${i}`,
      timestamp: subDays(new Date(), Math.floor(Math.random() * 30)),
      userId: `user-${i % 5}`,
      userName: user,
      action,
      entity,
      entityId: `${entity}-${i}`,
      entityName: `${entity.charAt(0).toUpperCase() + entity.slice(1)} #${i + 1}`,
      details,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      severity,
    });
  }
  
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const actionIcons: Record<string, React.ElementType> = {
  deal: Briefcase,
  task: CheckSquare,
  document: FileText,
  user: User,
  message: MessageSquare,
  system: Shield,
};

const actionColors: Record<string, string> = {
  create: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  view: 'text-gray-500',
  export: 'text-purple-500',
  login: 'text-green-500',
  logout: 'text-gray-500',
  assign: 'text-yellow-500',
  complete: 'text-green-500',
};

export default function AuditTrail() {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  
  const [events] = useState<AuditEvent[]>(generateDemoAuditEvents);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (searchQuery && !event.details.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !event.userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterAction !== 'all' && event.action !== filterAction) return false;
      if (filterEntity !== 'all' && event.entity !== filterEntity) return false;
      if (filterUser !== 'all' && event.userName !== filterUser) return false;
      if (filterSeverity !== 'all' && event.severity !== filterSeverity) return false;
      if (dateRange.from && isBefore(event.timestamp, dateRange.from)) return false;
      if (dateRange.to && isAfter(event.timestamp, dateRange.to)) return false;
      return true;
    });
  }, [events, searchQuery, filterAction, filterEntity, filterUser, filterSeverity, dateRange]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayEvents = events.filter(e => format(e.timestamp, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
    const criticalEvents = events.filter(e => e.severity === 'critical');
    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    
    return {
      total: events.length,
      today: todayEvents.length,
      critical: criticalEvents.length,
      activeUsers: uniqueUsers,
    };
  }, [events]);

  const exportAuditLog = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity', 'Details', 'IP Address', 'Severity'],
      ...filteredEvents.map(e => [
        format(e.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        e.userName,
        e.action,
        e.entity,
        e.details,
        e.ipAddress,
        e.severity,
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <Layout role="CEO" pageTitle="Audit Trail" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Audit Trail & Compliance
            </h1>
            <p className="text-muted-foreground">Track all system activities and user actions</p>
          </div>
          <Button onClick={exportAuditLog} data-testid="button-export-audit">
            <Download className="w-4 h-4 mr-2" />
            Export Log
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Activity</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.today}</p>
                </div>
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Events</p>
                  <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold text-green-500">{stats.activeUsers}</p>
                </div>
                <User className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-audit"
                  />
                </div>
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-32" data-testid="select-filter-action">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="assign">Assign</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-32" data-testid="select-filter-entity">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="deal">Deals</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="message">Messages</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-32" data-testid="select-filter-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-auto" data-testid="button-date-range">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dateRange.from && dateRange.to 
                      ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                      : 'Date Range'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Event Log */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Activity Log ({filteredEvents.length} events)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredEvents.map((event) => {
                  const Icon = actionIcons[event.entity] || FileText;
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border transition-colors hover:bg-secondary/50",
                        event.severity === 'critical' && "border-red-500/30 bg-red-500/5",
                        event.severity === 'warning' && "border-yellow-500/30 bg-yellow-500/5",
                        event.severity === 'info' && "border-border"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        event.severity === 'critical' && "bg-red-500/20",
                        event.severity === 'warning' && "bg-yellow-500/20",
                        event.severity === 'info' && "bg-primary/20"
                      )}>
                        <Icon className={cn(
                          "w-5 h-5",
                          event.severity === 'critical' && "text-red-500",
                          event.severity === 'warning' && "text-yellow-500",
                          event.severity === 'info' && "text-primary"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{event.userName}</span>
                          <Badge variant="secondary" className={cn("text-xs capitalize", actionColors[event.action])}>
                            {event.action}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{event.entity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{event.details}</p>
                        {event.entityName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Entity: {event.entityName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {format(event.timestamp, 'MMM d, h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          IP: {event.ipAddress}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {filteredEvents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No events match your filters</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
