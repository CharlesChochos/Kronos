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
  Calendar as CalendarIcon,
  User,
  Briefcase,
  CheckSquare,
  MessageSquare,
  AlertTriangle,
  Shield,
  Clock,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  Loader2
} from "lucide-react";
import { useCurrentUser, useAuditLogs } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, subDays, isAfter, isBefore, parseISO } from "date-fns";

const actionIcons: Record<string, React.ElementType> = {
  Deal: Briefcase,
  Task: CheckSquare,
  Document: FileText,
  User: User,
  Message: MessageSquare,
  System: Shield,
  TimeEntry: Clock,
  TimeOffRequest: CalendarIcon,
  Investor: User,
  InvestorInteraction: MessageSquare,
};

const actionColors: Record<string, string> = {
  CREATE: 'text-green-500',
  UPDATE: 'text-blue-500',
  DELETE: 'text-red-500',
  VIEW: 'text-gray-500',
  EXPORT: 'text-purple-500',
  LOGIN: 'text-green-500',
  LOGOUT: 'text-gray-500',
  ASSIGN: 'text-yellow-500',
  COMPLETE: 'text-green-500',
};

const actionIconMap: Record<string, React.ElementType> = {
  CREATE: PlusCircle,
  UPDATE: Edit,
  DELETE: Trash2,
  VIEW: Eye,
};

export default function AuditTrail() {
  const { data: currentUser } = useCurrentUser();
  const { data: auditLogs = [], isLoading } = useAuditLogs(500);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const logs = useMemo(() => {
    return auditLogs.map(log => ({
      ...log,
      timestampObj: parseISO(log.timestamp),
    }));
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!log.details?.toLowerCase().includes(query) && 
            !log.userName?.toLowerCase().includes(query) &&
            !log.entityType?.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filterAction !== 'all' && log.action !== filterAction) return false;
      if (filterEntity !== 'all' && log.entityType !== filterEntity) return false;
      if (dateRange.from && isBefore(log.timestampObj, dateRange.from)) return false;
      if (dateRange.to && isAfter(log.timestampObj, dateRange.to)) return false;
      return true;
    });
  }, [logs, searchQuery, filterAction, filterEntity, dateRange]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayLogs = logs.filter(l => format(l.timestampObj, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
    const deleteActions = logs.filter(l => l.action === 'DELETE');
    const uniqueUsers = new Set(logs.map(l => l.userId)).size;
    
    return {
      total: logs.length,
      today: todayLogs.length,
      deletes: deleteActions.length,
      activeUsers: uniqueUsers,
    };
  }, [logs]);

  const uniqueEntityTypes = useMemo(() => {
    return [...new Set(logs.map(l => l.entityType))].filter(Boolean);
  }, [logs]);

  const exportAuditLog = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'],
      ...filteredLogs.map(l => [
        format(l.timestampObj, 'yyyy-MM-dd HH:mm:ss'),
        l.userName || 'Unknown',
        l.action,
        l.entityType,
        l.entityId,
        l.details || '',
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getSeverity = (action: string) => {
    if (action === 'DELETE') return 'critical';
    if (action === 'UPDATE' || action === 'EXPORT') return 'warning';
    return 'info';
  };

  return (
    <Layout role="CEO" pageTitle="Audit Trail" userName={currentUser?.name || ""}>
      <div className="space-y-6">
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
                  <p className="text-sm text-muted-foreground">Delete Actions</p>
                  <p className="text-2xl font-bold text-red-500">{stats.deletes}</p>
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
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-40" data-testid="select-filter-entity">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {uniqueEntityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
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

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Activity Log ({filteredLogs.length} events)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const EntityIcon = actionIcons[log.entityType] || FileText;
                    const ActionIcon = actionIconMap[log.action] || FileText;
                    const severity = getSeverity(log.action);
                    
                    return (
                      <div
                        key={log.id}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-lg border transition-colors hover:bg-secondary/50",
                          severity === 'critical' && "border-red-500/30 bg-red-500/5",
                          severity === 'warning' && "border-yellow-500/30 bg-yellow-500/5",
                          severity === 'info' && "border-border"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          severity === 'critical' && "bg-red-500/20",
                          severity === 'warning' && "bg-yellow-500/20",
                          severity === 'info' && "bg-primary/20"
                        )}>
                          <EntityIcon className={cn(
                            "w-5 h-5",
                            severity === 'critical' && "text-red-500",
                            severity === 'warning' && "text-yellow-500",
                            severity === 'info' && "text-primary"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.userName || 'System'}</span>
                            <Badge variant="secondary" className={cn("text-xs capitalize", actionColors[log.action])}>
                              {log.action}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{log.entityType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{log.details || `${log.action} ${log.entityType}`}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Entity ID: {log.entityId}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {format(log.timestampObj, 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {filteredLogs.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No audit events found</p>
                      <p className="text-sm mt-1">Actions will be logged here as they occur</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
