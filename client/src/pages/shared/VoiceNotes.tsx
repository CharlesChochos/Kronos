import { useState, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { 
  Mic, 
  MicOff,
  Play, 
  Pause,
  Square,
  Search, 
  Clock,
  Users,
  Briefcase,
  Trash2,
  Download,
  Share2,
  MessageSquare,
  Volume2
} from "lucide-react";
import { useCurrentUser, useDeals, useUsers } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type VoiceNote = {
  id: string;
  title: string;
  duration: number;
  authorId: string;
  authorName: string;
  dealId?: string;
  dealName?: string;
  sharedWith: string[];
  transcript?: string;
  createdAt: string;
};

export default function VoiceNotes({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: users = [] } = useUsers();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([
    {
      id: "1",
      title: "TechCorp Deal Update",
      duration: 125,
      authorId: "user-1",
      authorName: "Josh Anderson",
      dealId: "deal-1",
      dealName: "TechCorp Acquisition",
      sharedWith: ["user-2", "user-3"],
      transcript: "Quick update on TechCorp - we've received the updated financials and the numbers look strong. Revenue growth is at 35% YoY. I think we should move forward with the next phase of DD. Let's schedule a call tomorrow to discuss the timeline.",
      createdAt: "2024-12-01T14:30:00Z"
    },
    {
      id: "2",
      title: "Client Meeting Notes - FinServ",
      duration: 240,
      authorId: "user-2",
      authorName: "Sarah Chen",
      dealId: "deal-2",
      dealName: "FinServ Merger",
      sharedWith: ["user-1"],
      transcript: "Just finished the call with FinServ management. They're eager to move forward but have concerns about valuation multiples. Key points: 1) They want a minimum 8x EBITDA, 2) Employee retention is critical, 3) They're open to an earnout structure. Follow up needed on the transition timeline.",
      createdAt: "2024-11-30T16:45:00Z"
    },
    {
      id: "3",
      title: "Team Standup Summary",
      duration: 180,
      authorId: "user-1",
      authorName: "Josh Anderson",
      sharedWith: ["user-2", "user-3", "user-4", "user-5"],
      transcript: "Team standup highlights: Michael is finishing the valuation model today. Emily is coordinating with legal on the LOI. David is preparing the management presentation. Everyone's on track for the Friday deadline.",
      createdAt: "2024-11-29T10:00:00Z"
    },
    {
      id: "4",
      title: "Investor Feedback - Healthcare Deal",
      duration: 95,
      authorId: "user-3",
      authorName: "Michael Brown",
      dealId: "deal-3",
      dealName: "Healthcare Divestiture",
      sharedWith: [],
      createdAt: "2024-11-28T11:20:00Z"
    }
  ]);

  const [newNote, setNewNote] = useState({
    title: "",
    dealId: ""
  });

  const [shareWith, setShareWith] = useState<string[]>([]);

  const filteredNotes = voiceNotes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.dealName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myNotes = filteredNotes.filter(n => n.authorId === currentUser?.id);
  const sharedWithMe = filteredNotes.filter(n => n.sharedWith.includes(currentUser?.id || ""));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    toast.info("Recording started (simulated)");
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }

    if (recordingTime > 0) {
      const deal = deals.find(d => d.id === newNote.dealId);
      const note: VoiceNote = {
        id: Date.now().toString(),
        title: newNote.title || `Voice Note ${format(new Date(), 'MMM d, h:mm a')}`,
        duration: recordingTime,
        authorId: currentUser?.id || "",
        authorName: currentUser?.name || "Unknown",
        dealId: newNote.dealId || undefined,
        dealName: deal?.name,
        sharedWith: [],
        createdAt: new Date().toISOString()
      };

      setVoiceNotes([note, ...voiceNotes]);
      setShowRecordModal(false);
      setNewNote({ title: "", dealId: "" });
      setRecordingTime(0);
      toast.success("Voice note saved!");
    }
  };

  const cancelRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    setRecordingTime(0);
  };

  const togglePlay = (noteId: string) => {
    if (playingId === noteId) {
      setPlayingId(null);
      setPlayProgress(0);
    } else {
      setPlayingId(noteId);
      setPlayProgress(0);
      const note = voiceNotes.find(n => n.id === noteId);
      if (note) {
        const interval = setInterval(() => {
          setPlayProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setPlayingId(null);
              return 0;
            }
            return prev + (100 / note.duration);
          });
        }, 1000);
      }
    }
  };

  const shareNote = () => {
    if (!selectedNote || shareWith.length === 0) return;

    setVoiceNotes(voiceNotes.map(n =>
      n.id === selectedNote.id
        ? { ...n, sharedWith: [...new Set([...n.sharedWith, ...shareWith])] }
        : n
    ));
    setShowShareModal(false);
    setShareWith([]);
    setSelectedNote(null);
    toast.success("Voice note shared!");
  };

  const deleteNote = (id: string) => {
    setVoiceNotes(voiceNotes.filter(n => n.id !== id));
    toast.success("Voice note deleted");
  };

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Voice Notes</h1>
            <p className="text-muted-foreground">Record and share audio updates with your team</p>
          </div>
          <Button onClick={() => setShowRecordModal(true)} data-testid="button-record-note">
            <Mic className="w-4 h-4 mr-2" /> Record Note
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myNotes.length}</p>
                  <p className="text-xs text-muted-foreground">My Notes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Share2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sharedWithMe.length}</p>
                  <p className="text-xs text-muted-foreground">Shared With Me</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatDuration(voiceNotes.reduce((sum, n) => sum + n.duration, 0))}</p>
                  <p className="text-xs text-muted-foreground">Total Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{voiceNotes.filter(n => n.dealId).length}</p>
                  <p className="text-xs text-muted-foreground">Deal-Related</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search voice notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-notes"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5" /> My Voice Notes
            </h2>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {myNotes.map((note) => (
                  <Card key={note.id} className="hover:border-primary/50 transition-colors" data-testid={`note-${note.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{note.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {note.dealName && (
                              <Badge variant="outline" className="text-xs">
                                <Briefcase className="w-3 h-3 mr-1" /> {note.dealName}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatDuration(note.duration)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePlay(note.id)}
                          data-testid={`play-${note.id}`}
                        >
                          {playingId === note.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: playingId === note.id ? `${playProgress}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDuration(note.duration)}</span>
                      </div>

                      {note.transcript && (
                        <div className="p-2 bg-secondary/30 rounded text-xs text-muted-foreground mb-3">
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          {note.transcript.substring(0, 100)}...
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedNote(note); setShowShareModal(true); }}>
                            <Share2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)} className="text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {note.sharedWith.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> Shared with {note.sharedWith.length} people
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {myNotes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No voice notes yet. Click "Record Note" to create one.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5" /> Shared With Me
            </h2>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {sharedWithMe.map((note) => (
                  <Card key={note.id} className="hover:border-primary/50 transition-colors" data-testid={`shared-note-${note.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{note.title}</h3>
                          <p className="text-xs text-muted-foreground">by {note.authorName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {note.dealName && (
                              <Badge variant="outline" className="text-xs">
                                <Briefcase className="w-3 h-3 mr-1" /> {note.dealName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePlay(note.id)}
                        >
                          {playingId === note.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: playingId === note.id ? `${playProgress}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDuration(note.duration)}</span>
                      </div>

                      {note.transcript && (
                        <div className="p-2 bg-secondary/30 rounded text-xs text-muted-foreground">
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          {note.transcript.substring(0, 100)}...
                        </div>
                      )}

                      <div className="mt-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sharedWithMe.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No voice notes shared with you yet
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      <Dialog open={showRecordModal} onOpenChange={setShowRecordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Voice Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Give your note a title"
                disabled={isRecording}
                data-testid="input-note-title"
              />
            </div>
            <div>
              <Label>Related Deal (optional)</Label>
              <Select value={newNote.dealId} onValueChange={(v) => setNewNote({ ...newNote, dealId: v })} disabled={isRecording}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col items-center py-8">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                isRecording ? "bg-red-500 animate-pulse" : "bg-primary"
              )}>
                {isRecording ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </div>
              <p className="text-3xl font-mono mt-4">{formatDuration(recordingTime)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isRecording ? "Recording..." : "Click to start recording"}
              </p>
            </div>
          </div>
          <DialogFooter>
            {isRecording ? (
              <>
                <Button variant="outline" onClick={cancelRecording}>Cancel</Button>
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="w-4 h-4 mr-2" /> Stop & Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowRecordModal(false)}>Cancel</Button>
                <Button onClick={startRecording} data-testid="button-start-recording">
                  <Mic className="w-4 h-4 mr-2" /> Start Recording
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Voice Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share "{selectedNote?.title}" with team members:
            </p>
            <div className="space-y-2">
              {users.filter(u => u.id !== currentUser?.id).map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                    shareWith.includes(user.id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  )}
                  onClick={() => {
                    if (shareWith.includes(user.id)) {
                      setShareWith(shareWith.filter(id => id !== user.id));
                    } else {
                      setShareWith([...shareWith, user.id]);
                    }
                  }}
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  </div>
                  {shareWith.includes(user.id) && (
                    <Badge className="bg-primary">Selected</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowShareModal(false); setShareWith([]); }}>Cancel</Button>
            <Button onClick={shareNote} disabled={shareWith.length === 0} data-testid="button-share-note">
              Share with {shareWith.length} people
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
