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
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Send
} from "lucide-react";
import { useCurrentUser, useDeals } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
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

export default function DealAnnouncements({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const { data: deals = [] } = useDeals();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([
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
  ]);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general" as Announcement['type'],
    dealId: "",
    isPinned: false,
    notifyTeam: true
  });

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
            <h1 className="text-2xl font-display font-bold">Deal Announcements</h1>
            <p className="text-muted-foreground">Share updates, celebrate wins, and keep the team informed</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-announcement">
            <Plus className="w-4 h-4 mr-2" /> New Announcement
          </Button>
        </div>

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

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-announcements"
          />
        </div>

        <ScrollArea className="h-[600px]">
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
    </Layout>
  );
}
