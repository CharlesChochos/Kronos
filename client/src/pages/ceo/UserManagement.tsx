import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useCurrentUser } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Shield,
  Ban,
  RefreshCw,
  UserCog,
  FileText,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle?: string;
  status: string;
  createdAt: string;
  avatar?: string;
  twoFactorEnabled?: boolean;
};

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
};

const roleColors: Record<string, string> = {
  CEO: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Director: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Managing Director": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  Associate: "bg-green-500/20 text-green-400 border-green-500/30",
  Analyst: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  rejected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const actionLabels: Record<string, string> = {
  user_signup: "User Registration",
  user_approved: "User Approved",
  user_rejected: "User Rejected",
  user_suspended: "User Suspended",
  user_reactivated: "User Reactivated",
  role_changed: "Role Changed",
  login: "Login",
  login_2fa: "Login (2FA)",
  "2fa_enabled": "2FA Enabled",
  "2fa_disabled": "2FA Disabled",
  document_created: "Document Created",
  document_updated: "Document Updated",
  document_archived: "Document Archived",
  investor_created: "Investor Created",
  investor_updated: "Investor Updated",
  investor_deactivated: "Investor Deactivated",
};

export default function UserManagement() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: pendingUsers = [], isLoading: loadingPending } = useQuery<User[]>({
    queryKey: ["/api/admin/pending-users"],
  });

  const { data: auditLogs = [], isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const activeUsers = allUsers.filter(u => u.status === "active");
  const suspendedUsers = allUsers.filter(u => u.status === "suspended");

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast.success("User approved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast.success("User registration rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to suspend user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      setShowSuspendDialog(false);
      setSelectedUser(null);
      toast.success("User suspended successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reactivate user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast.success("User reactivated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change role");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      setShowRoleDialog(false);
      setSelectedUser(null);
      setNewRole("");
      toast.success("User role updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Layout role="CEO" pageTitle="User Management" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">
            Manage user access, roles, and review audit logs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeUsers.length}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingUsers.length}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/20">
                <Ban className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suspendedUsers.length}</p>
                <p className="text-sm text-muted-foreground">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeUsers.filter(u => u.twoFactorEnabled).length}</p>
                <p className="text-sm text-muted-foreground">2FA Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Active ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="suspended" className="gap-2">
            <Ban className="h-4 w-4" />
            Suspended ({suspendedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Pending Registrations
              </CardTitle>
              <CardDescription>
                Review and approve new user registration requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending registrations
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((user) => (
                      <TableRow key={user.id} className="border-border" data-testid={`row-pending-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.jobTitle ? (
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {user.jobTitle}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-reject-${user.id}`}
                                >
                                  <UserX className="h-4 w-4" />
                                  Reject
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will reject {user.name}'s registration request. They will need to submit a new registration if they want to access the platform.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => rejectMutation.mutate(user.id)}>
                                    Reject Registration
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button
                              size="sm"
                              className="gap-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveMutation.mutate(user.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${user.id}`}
                            >
                              <UserCheck className="h-4 w-4" />
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Active Users
              </CardTitle>
              <CardDescription>
                Manage active team members and their roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : activeUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active users
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>2FA</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeUsers.map((user) => (
                      <TableRow key={user.id} className="border-border" data-testid={`row-active-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.jobTitle ? (
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {user.jobTitle}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleColors[user.role] || ""}>
                            {user.role === 'Associate' ? 'Standard' : user.role === 'Analyst' ? 'Basic' : user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.twoFactorEnabled ? (
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                setSelectedUser(user);
                                setNewRole(user.role);
                                setShowRoleDialog(true);
                              }}
                              data-testid={`button-change-role-${user.id}`}
                            >
                              <UserCog className="h-4 w-4" />
                              Access
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowSuspendDialog(true);
                              }}
                              data-testid={`button-suspend-${user.id}`}
                            >
                              <Ban className="h-4 w-4" />
                              Suspend
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspended">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" />
                Suspended Users
              </CardTitle>
              <CardDescription>
                Users who have been suspended from the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : suspendedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No suspended users
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suspendedUsers.map((user) => (
                      <TableRow key={user.id} className="border-border" data-testid={`row-suspended-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 opacity-50">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-red-500/20 text-red-400 text-sm">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-muted-foreground">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.jobTitle ? (
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 opacity-50">
                              {user.jobTitle}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${roleColors[user.role] || ""} opacity-50`}>
                            {user.role === 'Associate' ? 'Standard' : user.role === 'Analyst' ? 'Basic' : user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => reactivateMutation.mutate(user.id)}
                            disabled={reactivateMutation.isPending}
                            data-testid={`button-reactivate-${user.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Reactivate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                Security and activity logs for compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs available
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {auditLogs.map((log, index) => (
                      <div key={log.id}>
                        <div className="flex items-start gap-4 py-3" data-testid={`audit-log-${log.id}`}>
                          <div className="p-2 rounded-lg bg-secondary/50 mt-0.5">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{log.userName || "System"}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="text-xs">
                                {actionLabels[log.action] || log.action}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {log.entityType}: {log.entityName || log.entityId || "N/A"}
                            </p>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              {log.ipAddress && ` • ${log.ipAddress}`}
                            </p>
                          </div>
                        </div>
                        {index < auditLogs.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Change Access Level
            </DialogTitle>
            <DialogDescription>
              Update the platform access level for {selectedUser?.name}. This controls what features and data they can access.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CEO">CEO (Full Access)</SelectItem>
                <SelectItem value="Managing Director">Managing Director</SelectItem>
                <SelectItem value="Director">Director</SelectItem>
                <SelectItem value="Associate">Standard</SelectItem>
                <SelectItem value="Analyst">Basic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && newRole) {
                  changeRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
                }
              }}
              disabled={changeRoleMutation.isPending || !newRole}
              data-testid="button-confirm-role-change"
            >
              {changeRoleMutation.isPending ? "Updating..." : "Update Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Suspend User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedUser?.name}? They will be immediately logged out and unable to access the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUser) {
                  suspendMutation.mutate(selectedUser.id);
                }
              }}
              disabled={suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
