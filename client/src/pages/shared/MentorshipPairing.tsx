import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
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
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  Heart,
  Star
} from "lucide-react";
import { useUsers } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

type MentorshipPair = {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorRole: string;
  menteeId: string;
  menteeName: string;
  menteeRole: string;
  focusAreas: string[];
  goals: { id: string; text: string; completed: boolean }[];
  meetingFrequency: string;
  nextMeeting: string | null;
  startDate: string;
  status: 'active' | 'completed' | 'paused';
  progressScore: number;
  sessionsCompleted: number;
};

const DEFAULT_PAIRINGS: MentorshipPair[] = [
  {
    id: "1",
    mentorId: "user-1",
    mentorName: "Sarah Chen",
    mentorRole: "Managing Director",
    menteeId: "user-2",
    menteeName: "Michael Brown",
    menteeRole: "Associate",
    focusAreas: ["Financial Modeling", "Client Relationships", "Deal Structuring"],
    goals: [
      { id: "g1", text: "Complete advanced LBO modeling course", completed: true },
      { id: "g2", text: "Lead a client presentation independently", completed: false },
      { id: "g3", text: "Develop sector expertise in Technology", completed: false }
    ],
    meetingFrequency: "Weekly",
    nextMeeting: "2024-12-05T14:00:00Z",
    startDate: "2024-09-01T00:00:00Z",
    status: "active",
    progressScore: 65,
    sessionsCompleted: 12
  },
  {
    id: "2",
    mentorId: "user-3",
    mentorName: "David Park",
    mentorRole: "Director",
    menteeId: "user-4",
    menteeName: "Emily Johnson",
    menteeRole: "Analyst",
    focusAreas: ["Due Diligence", "Research Methods", "Presentation Skills"],
    goals: [
      { id: "g1", text: "Improve DD checklist efficiency", completed: true },
      { id: "g2", text: "Present at team meeting", completed: true },
      { id: "g3", text: "Build investor contact network", completed: false }
    ],
    meetingFrequency: "Bi-weekly",
    nextMeeting: "2024-12-10T10:00:00Z",
    startDate: "2024-10-15T00:00:00Z",
    status: "active",
    progressScore: 78,
    sessionsCompleted: 6
  },
  {
    id: "3",
    mentorId: "user-5",
    mentorName: "Lisa Wang",
    mentorRole: "Managing Director",
    menteeId: "user-6",
    menteeName: "James Wilson",
    menteeRole: "Associate",
    focusAreas: ["Leadership", "Team Management", "Strategic Thinking"],
    goals: [
      { id: "g1", text: "Lead small deal team", completed: true },
      { id: "g2", text: "Complete leadership training", completed: true },
      { id: "g3", text: "Mentor an analyst", completed: true }
    ],
    meetingFrequency: "Monthly",
    nextMeeting: null,
    startDate: "2024-03-01T00:00:00Z",
    status: "completed",
    progressScore: 100,
    sessionsCompleted: 9
  }
];

export default function MentorshipPairing({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: users = [] } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [pairings, setPairings] = useState<MentorshipPair[]>(() => {
    const saved = localStorage.getItem('osreaper_mentorship_pairings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_PAIRINGS;
      }
    }
    return DEFAULT_PAIRINGS;
  });

  useEffect(() => {
    localStorage.setItem('osreaper_mentorship_pairings', JSON.stringify(pairings));
  }, [pairings]);

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

  const filteredPairings = pairings.filter(p =>
    p.mentorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.menteeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.focusAreas.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreatePairing = () => {
    if (!newPairing.mentorId || !newPairing.menteeId) {
      toast.error("Please select both mentor and mentee");
      return;
    }

    const mentor = users.find(u => u.id === newPairing.mentorId);
    const mentee = users.find(u => u.id === newPairing.menteeId);

    const pairing: MentorshipPair = {
      id: Date.now().toString(),
      mentorId: newPairing.mentorId,
      mentorName: mentor?.name || "Unknown",
      mentorRole: mentor?.role || "Unknown",
      menteeId: newPairing.menteeId,
      menteeName: mentee?.name || "Unknown",
      menteeRole: mentee?.role || "Unknown",
      focusAreas: newPairing.focusAreas.split(",").map(s => s.trim()).filter(Boolean),
      goals: newPairing.goals.split("\n").map((text, i) => ({
        id: `g${i}`,
        text: text.trim(),
        completed: false
      })).filter(g => g.text),
      meetingFrequency: newPairing.meetingFrequency,
      nextMeeting: newPairing.firstMeeting || null,
      startDate: new Date().toISOString(),
      status: "active",
      progressScore: 0,
      sessionsCompleted: 0
    };

    setPairings([pairing, ...pairings]);
    setShowCreateModal(false);
    setNewPairing({ mentorId: "", menteeId: "", focusAreas: "", goals: "", meetingFrequency: "Weekly", firstMeeting: "" });
    toast.success("Mentorship pairing created successfully");
  };

  const toggleGoal = (pairingId: string, goalId: string) => {
    setPairings(pairings.map(p => {
      if (p.id === pairingId) {
        const updatedGoals = p.goals.map(g =>
          g.id === goalId ? { ...g, completed: !g.completed } : g
        );
        const completedCount = updatedGoals.filter(g => g.completed).length;
        const progressScore = Math.round((completedCount / updatedGoals.length) * 100);
        return { ...p, goals: updatedGoals, progressScore };
      }
      return p;
    }));
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
                    {Math.round(pairings.filter(p => p.status === 'active').reduce((sum, p) => sum + p.progressScore, 0) / Math.max(pairings.filter(p => p.status === 'active').length, 1))}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Progress</p>
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
                  <p className="text-2xl font-bold">{pairings.reduce((sum, p) => sum + p.sessionsCompleted, 0)}</p>
                  <p className="text-xs text-muted-foreground">Sessions Held</p>
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
                              <p className="text-xs text-muted-foreground">{pairing.mentorRole} (Mentor)</p>
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
                              <p className="text-xs text-muted-foreground">{pairing.menteeRole} (Mentee)</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pairing.status)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Focus Areas</p>
                          <div className="flex flex-wrap gap-1">
                            {pairing.focusAreas.map((area, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{area}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Progress</p>
                          <div className="flex items-center gap-2">
                            <Progress value={pairing.progressScore} className="flex-1" />
                            <span className="text-sm font-medium">{pairing.progressScore}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Development Goals</p>
                        <div className="space-y-1">
                          {pairing.goals.map((goal) => (
                            <div
                              key={goal.id}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/30 p-1 rounded"
                              onClick={() => toggleGoal(pairing.id, goal.id)}
                            >
                              <CheckCircle className={`w-4 h-4 ${goal.completed ? 'text-green-500' : 'text-muted-foreground'}`} />
                              <span className={goal.completed ? 'line-through text-muted-foreground' : ''}>{goal.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {pairing.meetingFrequency}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {pairing.sessionsCompleted} sessions
                        </span>
                        {pairing.nextMeeting && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Next: {format(new Date(pairing.nextMeeting), 'MMM d')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Since {format(new Date(pairing.startDate), 'MMM yyyy')}
                        </span>
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
