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
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Megaphone, 
  Plus, 
  Search, 
  MessageSquare,
  ThumbsUp,
  Share2,
  Pin,
  Clock,
  Users,
  Briefcase,
  Trophy,
  PartyPopper,
  Bell,
  Send,
  Vote,
  CheckCircle,
  BarChart3,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import { useCurrentUser, useDeals, useUsers } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays } from "date-fns";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  content: string;
  type: 'deal-closed' | 'milestone' | 'team-update' | 'celebration' | 'general';
  dealId?: string;
  dealName?: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  reactions: { emoji: string; count: number; userIds: string[] }[];
  comments: { id: string; authorName: string; content: string; createdAt: string }[];
  createdAt: string;
};

type PollOption = {
  id: string;
  text: string;
  votes: string[];
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  creatorId: string;
  creatorName: string;
  expiresAt: string;
  isAnonymous: boolean;
  allowMultiple: boolean;
  status: 'active' | 'closed';
  createdAt: string;
};

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "TechCorp Acquisition Successfully Closed!",
    content: "Thrilled to announce the successful closing of the TechCorp acquisition deal worth $150M. This marks our largest technology sector deal this year. Congratulations to the entire deal team for their outstanding work!",
    type: "deal-closed",
    dealId: "deal-1",
    dealName: "TechCorp Acquisition",
    authorId: "user-1",
    authorName: "Josh Anderson",
    isPinned: true,
    reactions: [
      { emoji: "🎉", count: 12, userIds: ["u1", "u2", "u3"] },
      { emoji: "👏", count: 8, userIds: ["u4", "u5"] },
      { emoji: "🚀", count: 5, userIds: ["u6", "u7"] }
    ],
    comments: [
      { id: "c1", authorName: "Sarah Chen", content: "Amazing work team! This was a challenging deal.", createdAt: "2024-12-01T10:30:00Z" },
      { id: "c2", authorName: "Michael Brown", content: "Proud to be part of this team!", createdAt: "2024-12-01T11:15:00Z" }
    ],
    createdAt: "2024-12-01T09:00:00Z"
  },
  {
    id: "2",
    title: "FinServ Deal Reaches Due Diligence Phase",
    content: "The FinServ merger has officially entered the due diligence phase. The deal team should prepare for intensive document review over the next 6 weeks. DD room access has been configured.",
    type: "milestone",
    dealId: "deal-2",
    dealName: "FinServ Merger",
    authorId: "user-2",
    authorName: "Sarah Chen",
    isPinned: false,
    reactions: [
      { emoji: "💪", count: 6, userIds: ["u1", "u2"] },
      { emoji: "📊", count: 4, userIds: ["u3"] }
    ],
    comments: [],
    createdAt: "2024-11-28T14:00:00Z"
  },
  {
    id: "3",
    title: "Welcome New Team Members!",
    content: "Please join me in welcoming Emily Johnson and David Park to our investment banking team. Emily joins as an Analyst from Goldman Sachs, and David as an Associate from Morgan Stanley. Looking forward to great work together!",
    type: "team-update",
    authorId: "user-1",
    authorName: "Josh Anderson",
    isPinned: false,
    reactions: [
      { emoji: "👋", count: 15, userIds: ["u1", "u2", "u3", "u4", "u5"] },
      { emoji: "🎊", count: 8, userIds: ["u6", "u7"] }
    ],
    comments: [
      { id: "c1", authorName: "Lisa Wang", content: "Welcome to the team! Excited to work with you both.", createdAt: "2024-11-25T10:00:00Z" }
    ],
    createdAt: "2024-11-25T09:00:00Z"
  },
  {
    id: "4",
    title: "Q4 Deal Pipeline Record!",
    content: "We've hit a new record for Q4 deal pipeline value - $2.3B in active deals! This is 40% higher than last year. Thank you all for your dedication and hard work. Let's keep the momentum going!",
    type: "celebration",
    authorId: "user-1",
    authorName: "Josh Anderson",
    isPinned: false,
    reactions: [
      { emoji: "🎉", count: 20, userIds: ["u1", "u2", "u3", "u4", "u5", "u6"] },
      { emoji: "🏆", count: 12, userIds: ["u7", "u8", "u9"] },
      { emoji: "💰", count: 8, userIds: ["u10"] }
    ],
    comments: [],
    createdAt: "2024-11-20T16:00:00Z"
  }
];

const getDefaultPolls = (): Poll[] => [
  {
    id: "1",
    question: "Which day works best for the weekly team standup?",
    options: [
      { id: "o1", text: "Monday morning", votes: ["u1", "u2", "u3", "u4"] },
      { id: "o2", text: "Tuesday morning", votes: ["u5", "u6"] },
      { id: "o3", text: "Wednesday morning", votes: ["u7", "u8", "u9"] },
      { id: "o4", text: "Friday afternoon", votes: ["u10"] }
    ],
    creatorId: "user-1",
    creatorName: "Josh Anderson",
    expiresAt: addDays(new Date(), 2).toISOString(),
    isAnonymous: false,
    allowMultiple: false,
    status: "active",
    createdAt: "2024-12-01T09:00:00Z"
  },
  {
    id: "2",
    question: "What type of team building activity would you prefer?",
    options: [
      { id: "o1", text: "Escape room", votes: ["u1", "u2", "u3", "u4", "u5"] },
      { id: "o2", text: "Cooking class", votes: ["u6", "u7"] },
      { id: "o3", text: "Sports event", votes: ["u8", "u9", "u10", "u11"] },
      { id: "o4", text: "Happy hour", votes: ["u12", "u13", "u14"] }
    ],
    creatorId: "user-2",
    creatorName: "Sarah Chen",
    expiresAt: addDays(new Date(), 5).toISOString(),
    isAnonymous: true,
    allowMultiple: false,
    status: "active",
    createdAt: "2024-11-28T14:00:00Z"
  }
];

export default function DealAnnouncements({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const { data: users = [] } = useUsers();
  const [activeTab, setActiveTab] = useState<'announcements' | 'polls'>('announcements');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [showPollResultsModal, setShowPollResultsModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const saved = localStorage.getItem('osreaper_announcements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_ANNOUNCEMENTS;
      }
    }
    return DEFAULT_ANNOUNCEMENTS;
  });

  useEffect(() => {
    localStorage.setItem('osreaper_announcements', JSON.stringify(announcements));
  }, [announcements]);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general" as Announcement['type'],
    dealId: "",
    isPinned: false,
    notifyTeam: true
  });

  const [polls, setPolls] = useState<Poll[]>(() => {
    const saved = localStorage.getItem('osreaper_polls');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getDefaultPolls();
      }
    }
    return getDefaultPolls();
  });

  useEffect(() => {
    localStorage.setItem('osreaper_polls', JSON.stringify(polls));
  }, [polls]);

  const [newPoll, setNewPoll] = useState({
    question: "",
    options: ["", "", ""],
    expiresInDays: 3,
    isAnonymous: false,
    allowMultiple: false
  });

  const filteredPolls = polls.filter(p =>
    p.question.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activePolls = filteredPolls.filter(p => p.status === 'active');
  const closedPolls = filteredPolls.filter(p => p.status === 'closed');

  const filteredAnnouncements = announcements
    .filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleCreateAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast.error("Please fill in all required fields");
      return;
    }

    const deal = deals.find(d => d.id === newAnnouncement.dealId);
    const announcement: Announcement = {
      id: Date.now().toString(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      type: newAnnouncement.type,
      dealId: newAnnouncement.dealId || undefined,
      dealName: deal?.name,
      authorId: currentUser?.id || "",
      authorName: currentUser?.name || "Unknown",
      isPinned: newAnnouncement.isPinned,
      reactions: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    setAnnouncements([announcement, ...announcements]);
    setShowCreateModal(false);
    setNewAnnouncement({ title: "", content: "", type: "general", dealId: "", isPinned: false, notifyTeam: true });
    
    if (newAnnouncement.notifyTeam) {
      toast.success("Announcement posted and team notified!");
    } else {
      toast.success("Announcement posted successfully");
    }
  };

  const addReaction = (announcementId: string, emoji: string) => {
    setAnnouncements(announcements.map(a => {
      if (a.id === announcementId) {
        const existingReaction = a.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          if (existingReaction.userIds.includes(currentUser?.id || "")) {
            return {
              ...a,
              reactions: a.reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, userIds: r.userIds.filter(id => id !== currentUser?.id) }
                  : r
              ).filter(r => r.count > 0)
            };
          } else {
            return {
              ...a,
              reactions: a.reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentUser?.id || ""] }
                  : r
              )
            };
          }
        } else {
          return {
            ...a,
            reactions: [...a.reactions, { emoji, count: 1, userIds: [currentUser?.id || ""] }]
          };
        }
      }
      return a;
    }));
  };

  const addComment = (announcementId: string) => {
    if (!newComment.trim()) return;

    setAnnouncements(announcements.map(a => {
      if (a.id === announcementId) {
        return {
          ...a,
          comments: [...a.comments, {
            id: Date.now().toString(),
            authorName: currentUser?.name || "Unknown",
            content: newComment,
            createdAt: new Date().toISOString()
          }]
        };
      }
      return a;
    }));

    setNewComment("");
    setCommentingOn(null);
    toast.success("Comment added");
  };

  const togglePin = (id: string) => {
    setAnnouncements(announcements.map(a =>
      a.id === id ? { ...a, isPinned: !a.isPinned } : a
    ));
  };

  const handleCreatePoll = () => {
    const validOptions = newPoll.options.filter(o => o.trim());
    if (!newPoll.question || validOptions.length < 2) {
      toast.error("Please add a question and at least 2 options");
      return;
    }

    const poll: Poll = {
      id: Date.now().toString(),
      question: newPoll.question,
      options: validOptions.map((text, i) => ({
        id: `o${i}`,
        text,
        votes: []
      })),
      creatorId: currentUser?.id || "",
      creatorName: currentUser?.name || "Unknown",
      expiresAt: addDays(new Date(), newPoll.expiresInDays).toISOString(),
      isAnonymous: newPoll.isAnonymous,
      allowMultiple: newPoll.allowMultiple,
      status: "active",
      createdAt: new Date().toISOString()
    };

    setPolls([poll, ...polls]);
    setShowCreatePollModal(false);
    setNewPoll({ question: "", options: ["", "", ""], expiresInDays: 3, isAnonymous: false, allowMultiple: false });
    toast.success("Poll created successfully");
  };

  const votePoll = (pollId: string, optionId: string) => {
    setPolls(polls.map(poll => {
      if (poll.id === pollId) {
        const hasVoted = poll.options.some(o => o.votes.includes(currentUser?.id || ""));
        if (hasVoted && !poll.allowMultiple) {
          return {
            ...poll,
            options: poll.options.map(o => ({
              ...o,
              votes: o.id === optionId
                ? [...o.votes.filter(v => v !== currentUser?.id), currentUser?.id || ""]
                : o.votes.filter(v => v !== currentUser?.id)
            }))
          };
        } else {
          return {
            ...poll,
            options: poll.options.map(o => ({
              ...o,
              votes: o.id === optionId
                ? o.votes.includes(currentUser?.id || "")
                  ? o.votes.filter(v => v !== currentUser?.id)
                  : [...o.votes, currentUser?.id || ""]
                : o.votes
            }))
          };
        }
      }
      return poll;
    }));
    toast.success("Vote recorded");
  };

  const closePoll = (pollId: string) => {
    setPolls(polls.map(p =>
      p.id === pollId ? { ...p, status: 'closed' as const } : p
    ));
    toast.success("Poll closed");
  };

  const deletePoll = (pollId: string) => {
    setPolls(polls.filter(p => p.id !== pollId));
    toast.success("Poll deleted");
  };

  const getTotalVotes = (poll: Poll) => {
    return poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  };

  const getVotePercentage = (poll: Poll, option: PollOption) => {
    const total = getTotalVotes(poll);
    return total > 0 ? Math.round((option.votes.length / total) * 100) : 0;
  };

  const addPollOption = () => {
    setNewPoll({ ...newPoll, options: [...newPoll.options, ""] });
  };

  const updatePollOption = (index: number, value: string) => {
    const options = [...newPoll.options];
    options[index] = value;
    setNewPoll({ ...newPoll, options });
  };

  const removePollOption = (index: number) => {
    if (newPoll.options.length > 2) {
      setNewPoll({ ...newPoll, options: newPoll.options.filter((_, i) => i !== index) });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deal-closed': return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 'milestone': return <Briefcase className="w-5 h-5 text-blue-500" />;
      case 'team-update': return <Users className="w-5 h-5 text-green-500" />;
      case 'celebration': return <PartyPopper className="w-5 h-5 text-purple-500" />;
      default: return <Megaphone className="w-5 h-5 text-primary" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'deal-closed': 'bg-yellow-500',
      'milestone': 'bg-blue-500',
      'team-update': 'bg-green-500',
      'celebration': 'bg-purple-500',
      'general': 'bg-gray-500'
    };
    return <Badge className={cn("text-white", colors[type])}>{type.replace('-', ' ')}</Badge>;
  };

  const reactionEmojis = ["🎉", "👏", "💪", "🚀", "❤️", "👍"];

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Team Communications</h1>
            <p className="text-muted-foreground">Announcements, polls, and team updates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreatePollModal(true)} data-testid="button-create-poll">
              <Vote className="w-4 h-4 mr-2" /> New Poll
            </Button>
            <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-announcement">
              <Plus className="w-4 h-4 mr-2" /> New Announcement
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'announcements' | 'polls')} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="announcements" className="gap-2">
                <Megaphone className="w-4 h-4" /> Announcements
                <Badge variant="secondary" className="ml-1">{announcements.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="polls" className="gap-2">
                <Vote className="w-4 h-4" /> Quick Polls
                <Badge variant="secondary" className="ml-1">{activePolls.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'announcements' ? "Search announcements..." : "Search polls..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>

          <TabsContent value="announcements" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Megaphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{announcements.length}</p>
                      <p className="text-xs text-muted-foreground">Total Announcements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{announcements.filter(a => a.type === 'deal-closed').length}</p>
                      <p className="text-xs text-muted-foreground">Deals Closed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{announcements.reduce((sum, a) => sum + a.comments.length, 0)}</p>
                      <p className="text-xs text-muted-foreground">Comments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <ThumbsUp className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{announcements.reduce((sum, a) => sum + a.reactions.reduce((s, r) => s + r.count, 0), 0)}</p>
                      <p className="text-xs text-muted-foreground">Reactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
              <Card key={announcement.id} className={cn("hover:border-primary/50 transition-colors", announcement.isPinned && "border-yellow-500/50 bg-yellow-500/5")} data-testid={`announcement-${announcement.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-secondary rounded-lg">
                        {getTypeIcon(announcement.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{announcement.title}</h3>
                          {announcement.isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(announcement.type)}
                          {announcement.dealName && (
                            <Badge variant="outline">{announcement.dealName}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {role === 'CEO' && (
                      <Button variant="ghost" size="sm" onClick={() => togglePin(announcement.id)}>
                        <Pin className={cn("w-4 h-4", announcement.isPinned && "text-yellow-500 fill-yellow-500")} />
                      </Button>
                    )}
                  </div>

                  <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{announcement.content}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">
                          {announcement.authorName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {announcement.authorName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {reactionEmojis.map((emoji) => {
                      const reaction = announcement.reactions.find(r => r.emoji === emoji);
                      const hasReacted = reaction?.userIds.includes(currentUser?.id || "");
                      return (
                        <button
                          key={emoji}
                          onClick={() => addReaction(announcement.id, emoji)}
                          className={cn(
                            "px-2 py-1 rounded-full text-sm transition-colors",
                            hasReacted ? "bg-primary/20 border border-primary" : "bg-secondary hover:bg-secondary/80"
                          )}
                          data-testid={`reaction-${announcement.id}-${emoji}`}
                        >
                          {emoji} {reaction?.count || 0}
                        </button>
                      );
                    })}
                  </div>

                  {announcement.comments.length > 0 && (
                    <div className="border-t pt-4 space-y-3">
                      {announcement.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {comment.authorName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 bg-secondary/30 rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{comment.authorName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {commentingOn === announcement.id ? (
                    <div className="mt-4 flex gap-2">
                      <Input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        onKeyDown={(e) => e.key === 'Enter' && addComment(announcement.id)}
                        data-testid={`input-comment-${announcement.id}`}
                      />
                      <Button size="sm" onClick={() => addComment(announcement.id)}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCommentingOn(announcement.id)}>
                      <MessageSquare className="w-4 h-4 mr-1" /> Comment
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="polls" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Vote className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{activePolls.length}</p>
                      <p className="text-xs text-muted-foreground">Active Polls</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{closedPolls.length}</p>
                      <p className="text-xs text-muted-foreground">Closed Polls</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{polls.reduce((sum, p) => sum + getTotalVotes(p), 0)}</p>
                      <p className="text-xs text-muted-foreground">Total Votes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {Math.round(polls.reduce((sum, p) => sum + getTotalVotes(p), 0) / Math.max(polls.length, 1))}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg. Responses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Vote className="w-5 h-5 text-green-500" /> Active Polls
                </h2>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    {activePolls.map((poll) => (
                      <Card key={poll.id} className="hover:border-primary/50 transition-colors" data-testid={`poll-${poll.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium">{poll.question}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {poll.isAnonymous && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <EyeOff className="w-3 h-3 mr-1" /> Anonymous
                                  </Badge>
                                )}
                                {poll.allowMultiple && (
                                  <Badge variant="outline" className="text-[10px]">Multiple choice</Badge>
                                )}
                              </div>
                            </div>
                            {(role === 'CEO' || poll.creatorId === currentUser?.id) && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => closePoll(poll.id)}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deletePoll(poll.id)} className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            {poll.options.map((option) => {
                              const percentage = getVotePercentage(poll, option);
                              const isSelected = option.votes.includes(currentUser?.id || "");
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => votePoll(poll.id, option.id)}
                                  className={cn(
                                    "w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                                    isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                  )}
                                  data-testid={`vote-${poll.id}-${option.id}`}
                                >
                                  <div
                                    className="absolute inset-0 bg-primary/10 transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                  <div className="relative flex items-center justify-between">
                                    <span className="text-sm">{option.text}</span>
                                    <span className="text-xs text-muted-foreground">{percentage}%</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {getTotalVotes(poll)} votes
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Ends {formatDistanceToNow(new Date(poll.expiresAt), { addSuffix: true })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {activePolls.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No active polls
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-gray-500" /> Closed Polls
                </h2>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    {closedPolls.map((poll) => {
                      const winner = [...poll.options].sort((a, b) => b.votes.length - a.votes.length)[0];
                      return (
                        <Card key={poll.id} className="opacity-80" data-testid={`poll-closed-${poll.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-medium">{poll.question}</h3>
                                <Badge variant="secondary" className="mt-1">Closed</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedPoll(poll); setShowPollResultsModal(true); }}
                              >
                                <Eye className="w-4 h-4 mr-1" /> Results
                              </Button>
                            </div>

                            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                              <p className="text-xs text-muted-foreground mb-1">Winner</p>
                              <p className="font-medium">{winner?.text}</p>
                              <p className="text-sm text-muted-foreground">
                                {winner?.votes.length || 0} votes ({getVotePercentage(poll, winner || { id: '', text: '', votes: [] })}%)
                              </p>
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>{getTotalVotes(poll)} total votes</span>
                              <span>by {poll.creatorName}</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {closedPolls.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No closed polls
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                placeholder="Announcement title"
                data-testid="input-announcement-title"
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                placeholder="Share the news with your team..."
                rows={4}
                data-testid="input-announcement-content"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newAnnouncement.type} onValueChange={(v: any) => setNewAnnouncement({ ...newAnnouncement, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal-closed">Deal Closed</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="team-update">Team Update</SelectItem>
                    <SelectItem value="celebration">Celebration</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Related Deal</Label>
                <Select value={newAnnouncement.dealId || "none"} onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, dealId: v === "none" ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newAnnouncement.isPinned}
                  onCheckedChange={(checked) => setNewAnnouncement({ ...newAnnouncement, isPinned: checked })}
                />
                <Label>Pin announcement</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newAnnouncement.notifyTeam}
                  onCheckedChange={(checked) => setNewAnnouncement({ ...newAnnouncement, notifyTeam: checked })}
                />
                <Label>Notify team</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateAnnouncement} data-testid="button-submit-announcement">Post Announcement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePollModal} onOpenChange={setShowCreatePollModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question *</Label>
              <Input
                value={newPoll.question}
                onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
                placeholder="What do you want to ask?"
                data-testid="input-poll-question"
              />
            </div>
            <div>
              <Label>Options *</Label>
              <div className="space-y-2 mt-2">
                {newPoll.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      data-testid={`input-poll-option-${index}`}
                    />
                    {newPoll.options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => removePollOption(index)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPollOption}>
                  <Plus className="w-3 h-3 mr-1" /> Add Option
                </Button>
              </div>
            </div>
            <div>
              <Label>Expires in (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={newPoll.expiresInDays}
                onChange={(e) => setNewPoll({ ...newPoll, expiresInDays: parseInt(e.target.value) || 3 })}
                data-testid="input-poll-expires-days"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPoll.isAnonymous}
                  onCheckedChange={(checked) => setNewPoll({ ...newPoll, isAnonymous: checked })}
                />
                <Label>Anonymous voting</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPoll.allowMultiple}
                  onCheckedChange={(checked) => setNewPoll({ ...newPoll, allowMultiple: checked })}
                />
                <Label>Allow multiple choices</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePollModal(false)}>Cancel</Button>
            <Button onClick={handleCreatePoll} data-testid="button-submit-poll">Create Poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPollResultsModal} onOpenChange={setShowPollResultsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Poll Results</DialogTitle>
          </DialogHeader>
          {selectedPoll && (
            <div className="space-y-4">
              <h3 className="font-medium">{selectedPoll.question}</h3>
              <div className="space-y-3">
                {[...selectedPoll.options]
                  .sort((a, b) => b.votes.length - a.votes.length)
                  .map((option, index) => (
                    <div key={option.id}>
                      <div className="flex justify-between mb-1">
                        <span className={cn("text-sm", index === 0 && "font-medium")}>
                          {index === 0 && "🏆 "}{option.text}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {option.votes.length} ({getVotePercentage(selectedPoll, option)}%)
                        </span>
                      </div>
                      <Progress value={getVotePercentage(selectedPoll, option)} />
                    </div>
                  ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Total: {getTotalVotes(selectedPoll)} votes
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPollResultsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
