import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Plus, 
  Search, 
  UserPlus,
  GraduationCap,
  Target,
  Calendar,
  MessageSquare,
  TrendingUp,
  Award,
  Heart,
  Loader2,
  Trash2
} from "lucide-react";
import { useUsers, useMentorshipPairings, useCreateMentorshipPairing, useUpdateMentorshipPairing, useDeleteMentorshipPairing } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import type { MentorshipPairing } from "@shared/schema";

export default function MentorshipPairing({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: users = [] } = useUsers();
  const { data: pairings = [], isLoading } = useMentorshipPairings();
  const createPairing = useCreateMentorshipPairing();
  const updatePairing = useUpdateMentorshipPairing();
  const deletePairing = useDeleteMentorshipPairing();

  const handleDeletePairing = async (id: string) => {
    if (!confirm("Are you sure you want to remove this mentorship pairing?")) return;
    try {
      await deletePairing.mutateAsync(id);
      toast.success("Mentorship pairing removed");
    } catch (error) {
      toast.error("Failed to remove pairing");
    }
  };
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [newPairing, setNewPairing] = useState({
    mentorId: "",
    menteeId: "",
    focusAreas: "",
    goals: "",
    meetingFrequency: "Weekly",
    firstMeeting: ""
  });

  const seniorRoles = ['Managing Director', 'Director', 'CEO'];
  const mentors = users.filter(u => seniorRoles.includes(u.role));
  const mentees = users.filter(u => !seniorRoles.includes(u.role));

  // Helper to get user info from ID
  const getUserRole = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.role || "Unknown";
  };

  const filteredPairings = pairings.filter(p =>
    p.mentorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.menteeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.focusAreas || []).some((f: string) => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreatePairing = async () => {
    if (!newPairing.mentorId || !newPairing.menteeId) {
      toast.error("Please select both mentor and mentee");
      return;
    }

    const mentor = users.find(u => u.id === newPairing.mentorId);
    const mentee = users.find(u => u.id === newPairing.menteeId);

    try {
      await createPairing.mutateAsync({
        mentorId: newPairing.mentorId,
        mentorName: mentor?.name || "Unknown",
        menteeId: newPairing.menteeId,
        menteeName: mentee?.name || "Unknown",
        focusAreas: newPairing.focusAreas.split(",").map(s => s.trim()).filter(Boolean),
        goals: newPairing.goals.split("\n").map(s => s.trim()).filter(Boolean),
        meetingFrequency: newPairing.meetingFrequency,
        startDate: new Date().toISOString(),
        status: "active",
      });

      setShowCreateModal(false);
      setNewPairing({ mentorId: "", menteeId: "", focusAreas: "", goals: "", meetingFrequency: "Weekly", firstMeeting: "" });
      toast.success("Mentorship pairing created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create pairing");
    }
  };

  const updatePairingStatus = async (id: string, status: string) => {
    try {
      await updatePairing.mutateAsync({
        id,
        updates: { 
          status, 
          endDate: status === 'completed' ? new Date().toISOString() : undefined 
        },
      });
      toast.success("Pairing status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update pairing");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Mentorship Pairing</h1>
            <p className="text-muted-foreground">Manage mentor-mentee relationships and track development goals</p>
          </div>
          {role === 'CEO' && (
            <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-pairing">
              <Plus className="w-4 h-4 mr-2" /> New Pairing
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pairings.filter(p => p.status === 'active').length}</p>
                  <p className="text-xs text-muted-foreground">Active Pairings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pairings.filter(p => p.status === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">Completed Programs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {pairings.reduce((sum, p) => sum + (p.goals || []).length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pairings.length}</p>
                  <p className="text-xs text-muted-foreground">Total Pairs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mentorship Pairs</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pairings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-pairings"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {filteredPairings.map((pairing) => (
                  <Card key={pairing.id} className="hover:border-primary/50 transition-colors" data-testid={`pairing-${pairing.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {pairing.mentorName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{pairing.mentorName}</p>
                              <p className="text-xs text-muted-foreground">{getUserRole(pairing.mentorId)} (Mentor)</p>
                            </div>
                          </div>
                          <Heart className="w-4 h-4 text-red-400" />
                          <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-secondary">
                                {pairing.menteeName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{pairing.menteeName}</p>
                              <p className="text-xs text-muted-foreground">{getUserRole(pairing.menteeId)} (Mentee)</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pairing.status)}
                          {role === 'CEO' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePairing(pairing.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              data-testid={`delete-pairing-${pairing.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Focus Areas</p>
                          <div className="flex flex-wrap gap-1">
                            {(pairing.focusAreas || []).map((area, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{area}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Goals</p>
                          <div className="text-sm">
                            {(pairing.goals || []).length} development goals
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Development Goals</p>
                        <div className="space-y-1">
                          {(pairing.goals || []).map((goal, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 text-sm p-1 rounded"
                            >
                              <Target className="w-4 h-4 text-muted-foreground" />
                              <span>{goal}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {pairing.meetingFrequency || 'Weekly'}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Since {format(new Date(pairing.startDate), 'MMM yyyy')}
                        </span>
                        {pairing.notes && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Has notes
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredPairings.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No mentorship pairings found
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Mentorship Pairing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mentor *</Label>
              <Select value={newPairing.mentorId} onValueChange={(v) => setNewPairing({ ...newPairing, mentorId: v })}>
                <SelectTrigger data-testid="select-mentor">
                  <SelectValue placeholder="Select a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mentee *</Label>
              <Select value={newPairing.menteeId} onValueChange={(v) => setNewPairing({ ...newPairing, menteeId: v })}>
                <SelectTrigger data-testid="select-mentee">
                  <SelectValue placeholder="Select a mentee" />
                </SelectTrigger>
                <SelectContent>
                  {mentees.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Focus Areas (comma-separated)</Label>
              <Input
                value={newPairing.focusAreas}
                onChange={(e) => setNewPairing({ ...newPairing, focusAreas: e.target.value })}
                placeholder="Financial Modeling, Leadership, Client Relations"
                data-testid="input-focus-areas"
              />
            </div>
            <div>
              <Label>Development Goals (one per line)</Label>
              <Textarea
                value={newPairing.goals}
                onChange={(e) => setNewPairing({ ...newPairing, goals: e.target.value })}
                placeholder="Complete certification&#10;Lead a project&#10;..."
                rows={4}
                data-testid="input-goals"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Meeting Frequency</Label>
                <Select value={newPairing.meetingFrequency} onValueChange={(v) => setNewPairing({ ...newPairing, meetingFrequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>First Meeting</Label>
                <Input
                  type="datetime-local"
                  value={newPairing.firstMeeting}
                  onChange={(e) => setNewPairing({ ...newPairing, firstMeeting: e.target.value })}
                  data-testid="input-first-meeting"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreatePairing} data-testid="button-submit-pairing">Create Pairing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
