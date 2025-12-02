import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { 
  Vote, 
  Plus, 
  Search, 
  Clock,
  Users,
  CheckCircle,
  BarChart3,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function QuickPolls({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [polls, setPolls] = useState<Poll[]>([
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
    },
    {
      id: "3",
      question: "Should we adopt a new deal tracking tool?",
      options: [
        { id: "o1", text: "Yes, definitely", votes: ["u1", "u2", "u3", "u4", "u5", "u6", "u7"] },
        { id: "o2", text: "No, current tools work fine", votes: ["u8", "u9"] },
        { id: "o3", text: "Need more info to decide", votes: ["u10", "u11", "u12"] }
      ],
      creatorId: "user-1",
      creatorName: "Josh Anderson",
      expiresAt: "2024-11-30T23:59:59Z",
      isAnonymous: false,
      allowMultiple: false,
      status: "closed",
      createdAt: "2024-11-25T10:00:00Z"
    }
  ]);

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
    setShowCreateModal(false);
    setNewPoll({ question: "", options: ["", "", ""], expiresInDays: 3, isAnonymous: false, allowMultiple: false });
    toast.success("Poll created successfully");
  };

  const vote = (pollId: string, optionId: string) => {
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

  const hasUserVoted = (poll: Poll) => {
    return poll.options.some(o => o.votes.includes(currentUser?.id || ""));
  };

  const addOptionField = () => {
    setNewPoll({ ...newPoll, options: [...newPoll.options, ""] });
  };

  const updateOption = (index: number, value: string) => {
    const options = [...newPoll.options];
    options[index] = value;
    setNewPoll({ ...newPoll, options });
  };

  const removeOption = (index: number) => {
    if (newPoll.options.length > 2) {
      setNewPoll({ ...newPoll, options: newPoll.options.filter((_, i) => i !== index) });
    }
  };

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Quick Polls</h1>
            <p className="text-muted-foreground">Gather team feedback quickly and easily</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-poll">
            <Plus className="w-4 h-4 mr-2" /> Create Poll
          </Button>
        </div>

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

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search polls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-polls"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Vote className="w-5 h-5 text-green-500" /> Active Polls
            </h2>
            <ScrollArea className="h-[500px]">
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
                              onClick={() => vote(poll.id, option.id)}
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
            <ScrollArea className="h-[500px]">
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
                            onClick={() => { setSelectedPoll(poll); setShowResultsModal(true); }}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Results
                          </Button>
                        </div>

                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                          <p className="text-xs text-muted-foreground mb-1">Winner</p>
                          <p className="font-medium">{winner.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {winner.votes.length} votes ({getVotePercentage(poll, winner)}%)
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
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
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
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      data-testid={`input-option-${index}`}
                    />
                    {newPoll.options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => removeOption(index)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOptionField}>
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
                data-testid="input-expires-days"
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
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreatePoll} data-testid="button-submit-poll">Create Poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
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
            <Button onClick={() => setShowResultsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
