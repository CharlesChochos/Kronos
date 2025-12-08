import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useCurrentUser } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  Search,
  Filter,
  FileText,
  User,
  Briefcase,
  Clock,
  Shield,
  Activity,
  Download,
  RefreshCw,
  ChevronRight,
  Eye,
  Calendar,
} from "lucide-react";

type AuditLog = {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
  timestamp: string;
};

const actionLabels: Record<string, string> = {
  user_signup: "User Registration",
  user_approved: "User Approved",
  user_rejected: "User Rejected",
  user_suspended: "User Suspended",
  user_reactivated: "User Reactivated",
  role_changed: "Role Changed",
  login: "Login",
  login_failed: "Login Failed",
  logout: "Logout",
  login_2fa: "Login (2FA)",
  "2fa_enabled": "2FA Enabled",
  "2fa_disabled": "2FA Disabled",
  deal_created: "Deal Created",
  deal_updated: "Deal Updated",
  deal_deleted: "Deal Deleted",
  deal_stage_changed: "Deal Stage Changed",
  task_created: "Task Created",
  task_updated: "Task Updated",
  task_completed: "Task Completed",
  task_deleted: "Task Deleted",
  document_created: "Document Created",
  document_updated: "Document Updated",
  document_deleted: "Document Deleted",
  document_archived: "Document Archived",
  document_downloaded: "Document Downloaded",
  investor_created: "Investor Created",
  investor_updated: "Investor Updated",
  investor_deleted: "Investor Deleted",
  investor_deactivated: "Investor Deactivated",
  meeting_created: "Meeting Created",
  meeting_updated: "Meeting Updated",
  meeting_deleted: "Meeting Deleted",
  message_sent: "Message Sent",
  password_reset: "Password Reset",
  password_changed: "Password Changed",
};

const entityTypeIcons: Record<string, any> = {
  user: User,
  deal: Briefcase,
  task: FileText,
  document: FileText,
  investor: User,
  meeting: Calendar,
  message: Activity,
  auth: Shield,
};

const actionCategories: Record<string, string> = {
  user_signup: "user",
  user_approved: "user",
  user_rejected: "user",
  user_suspended: "user",
  user_reactivated: "user",
  role_changed: "user",
  login: "auth",
  login_failed: "auth",
  logout: "auth",
  login_2fa: "auth",
  "2fa_enabled": "auth",
  "2fa_disabled": "auth",
  deal_created: "deal",
  deal_updated: "deal",
  deal_deleted: "deal",
  deal_stage_changed: "deal",
  task_created: "task",
  task_updated: "task",
  task_completed: "task",
  task_deleted: "task",
  document_created: "document",
  document_updated: "document",
  document_deleted: "document",
  document_archived: "document",
  document_downloaded: "document",
  investor_created: "investor",
  investor_updated: "investor",
  investor_deleted: "investor",
  investor_deactivated: "investor",
  meeting_created: "meeting",
  meeting_updated: "meeting",
  meeting_deleted: "meeting",
  message_sent: "message",
  password_reset: "auth",
  password_changed: "auth",
};

const categoryColors: Record<string, string> = {
  user: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  auth: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  deal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  task: "bg-green-500/20 text-green-400 border-green-500/30",
  document: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  investor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  meeting: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  message: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export default function AuditLogs({ role }: { role?: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const userRole = role || currentUser?.role || 'Employee';
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: auditLogs = [], isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/users"],
  });

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      actionLabels[log.action]?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntityType =
      filterEntityType === "all" || log.entityType === filterEntityType;

    const matchesUser =
      filterUser === "all" || log.userId === filterUser;

    return matchesSearch && matchesEntityType && matchesUser;
  });

  const uniqueEntityTypes = Array.from(new Set(auditLogs.map((log) => log.entityType))).filter(Boolean);

  const getActionLabel = (action: string) => {
    return actionLabels[action] || action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getCategory = (action: string) => {
    return actionCategories[action] || "other";
  };

  const getCategoryColor = (action: string) => {
    const category = getCategory(action);
    return categoryColors[category] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const getEntityIcon = (entityType: string) => {
    const Icon = entityTypeIcons[entityType] || Activity;
    return Icon;
  };

  const formatDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return null;

    return (
      <div className="space-y-2 text-sm">
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-muted-foreground capitalize min-w-[120px]">
              {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}:
            </span>
            <span className="text-foreground">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const escapeCsvField = (field: string): string => {
    if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const exportLogs = () => {
    const headers = ["Timestamp", "User", "Action", "Entity Type", "Entity", "IP Address", "Details"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.timestamp || log.createdAt), "yyyy-MM-dd HH:mm:ss"),
      log.userName || "System",
      getActionLabel(log.action),
      log.entityType || "-",
      log.entityName || "-",
      log.ipAddress || "-",
      JSON.stringify(log.details || {}),
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout role={userRole as 'CEO' | 'Employee'} pageTitle="Audit Logs" userName={currentUser?.name || ""}>
      <div className="space-y-6" data-testid="audit-logs-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">
              {userRole === 'CEO' ? 'Audit Logs' : 'My Activity Log'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {userRole === 'CEO' 
                ? 'Track all user activities and system events for compliance' 
                : 'View your activity history for compliance and record keeping'}
            </p>
          </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportLogs}
            data-testid="button-export-logs"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{auditLogs.length}</p>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(auditLogs.map((l) => l.userId)).size}
              </p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Shield className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {auditLogs.filter((l) => l.action?.includes("login") || l.action?.includes("2fa")).length}
              </p>
              <p className="text-sm text-muted-foreground">Auth Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Clock className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {auditLogs.filter((l) => {
                  const logDate = new Date(l.timestamp || l.createdAt);
                  const today = new Date();
                  return logDate.toDateString() === today.toDateString();
                }).length}
              </p>
              <p className="text-sm text-muted-foreground">Today's Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                View and filter all system activities
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono">
              {filteredLogs.length} records
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={filterEntityType} onValueChange={setFilterEntityType}>
              <SelectTrigger className="w-[180px]" data-testid="select-entity-type">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueEntityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userRole === 'CEO' && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[200px]" data-testid="select-user">
                  <User className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[150px]">User</TableHead>
                    <TableHead className="w-[200px]">Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                    <TableHead className="w-[80px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const EntityIcon = getEntityIcon(log.entityType);
                    return (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`row-audit-log-${log.id}`}
                      >
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(log.timestamp || log.createdAt), "MMM d, yyyy")}
                            <span className="text-muted-foreground">
                              {format(new Date(log.timestamp || log.createdAt), "HH:mm:ss")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <span className="truncate max-w-[100px]">
                              {log.userName || "System"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getCategoryColor(log.action)}
                          >
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.entityType && (
                            <div className="flex items-center gap-2">
                              <EntityIcon className="w-4 h-4 text-muted-foreground" />
                              <span className="capitalize">{log.entityType}</span>
                              {log.entityName && (
                                <>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-muted-foreground truncate max-w-[150px]">
                                    {log.entityName}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {log.ipAddress || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            data-testid={`button-view-details-${log.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this activity
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Timestamp</p>
                  <p className="font-mono text-sm">
                    {format(new Date(selectedLog.timestamp || selectedLog.createdAt), "PPpp")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">User</p>
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedLog.userName || "System"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Action</p>
                  <Badge
                    variant="outline"
                    className={getCategoryColor(selectedLog.action)}
                  >
                    {getActionLabel(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">IP Address</p>
                  <p className="font-mono text-sm">
                    {selectedLog.ipAddress || "Not recorded"}
                  </p>
                </div>
              </div>

              {selectedLog.entityType && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Entity</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    {(() => {
                      const EntityIcon = getEntityIcon(selectedLog.entityType);
                      return <EntityIcon className="w-4 h-4" />;
                    })()}
                    <span className="capitalize">{selectedLog.entityType}</span>
                    {selectedLog.entityName && (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>{selectedLog.entityName}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Additional Details</p>
                  <div className="p-3 bg-muted rounded-md">
                    {formatDetails(selectedLog.details)}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground font-mono">
                Log ID: {selectedLog.id}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
