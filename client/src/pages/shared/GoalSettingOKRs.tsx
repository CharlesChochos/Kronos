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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  Target, 
  Plus, 
  Search, 
  CheckCircle,
  Circle,
  TrendingUp,
  Calendar,
  Users,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Award
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type KeyResult = {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
};

type OKR = {
  id: string;
  objective: string;
  description: string;
  ownerId: string;
  ownerName: string;
  quarter: string;
  year: number;
  keyResults: KeyResult[];
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  overallProgress: number;
  createdAt: string;
  type: 'individual' | 'team';
  teamName?: string;
};

export default function GoalSettingOKRs({ role }: { role: 'CEO' | 'Employee' }) {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOKRs, setExpandedOKRs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("all");

  const [okrs, setOKRs] = useState<OKR[]>([
    {
      id: "1",
      objective: "Increase deal pipeline value by 50%",
      description: "Grow our active deal pipeline to drive revenue growth",
      ownerId: "user-1",
      ownerName: "Josh Anderson",
      quarter: "Q4",
      year: 2024,
      keyResults: [
        { id: "kr1", title: "Close 5 new deals worth $10M+", targetValue: 5, currentValue: 3, unit: "deals", progress: 60 },
        { id: "kr2", title: "Add 20 qualified prospects to pipeline", targetValue: 20, currentValue: 15, unit: "prospects", progress: 75 },
        { id: "kr3", title: "Achieve 90% client satisfaction score", targetValue: 90, currentValue: 87, unit: "%", progress: 97 }
      ],
      status: "on-track",
      overallProgress: 77,
      createdAt: "2024-10-01T00:00:00Z",
      type: "team",
      teamName: "Deal Team Alpha"
    },
    {
      id: "2",
      objective: "Build world-class investment banking team",
      description: "Attract and develop top talent for sustainable growth",
      ownerId: "user-1",
      ownerName: "Josh Anderson",
      quarter: "Q4",
      year: 2024,
      keyResults: [
        { id: "kr1", title: "Hire 3 senior associates", targetValue: 3, currentValue: 2, unit: "hires", progress: 67 },
        { id: "kr2", title: "Complete training program for all analysts", targetValue: 100, currentValue: 80, unit: "%", progress: 80 },
        { id: "kr3", title: "Reduce turnover rate to under 10%", targetValue: 10, currentValue: 12, unit: "%", progress: 83 }
      ],
      status: "at-risk",
      overallProgress: 77,
      createdAt: "2024-10-01T00:00:00Z",
      type: "individual"
    },
    {
      id: "3",
      objective: "Improve operational efficiency",
      description: "Streamline processes and reduce time-to-close",
      ownerId: "user-2",
      ownerName: "Sarah Chen",
      quarter: "Q4",
      year: 2024,
      keyResults: [
        { id: "kr1", title: "Reduce deal cycle time by 20%", targetValue: 20, currentValue: 15, unit: "% reduction", progress: 75 },
        { id: "kr2", title: "Automate 5 manual processes", targetValue: 5, currentValue: 5, unit: "processes", progress: 100 },
        { id: "kr3", title: "Achieve 95% on-time task completion", targetValue: 95, currentValue: 92, unit: "%", progress: 97 }
      ],
      status: "on-track",
      overallProgress: 91,
      createdAt: "2024-10-01T00:00:00Z",
      type: "individual"
    }
  ]);

  const [newOKR, setNewOKR] = useState({
    objective: "",
    description: "",
    ownerId: currentUser?.id || "",
    quarter: "Q1",
    year: 2025,
    keyResults: [{ title: "", targetValue: 0, unit: "" }],
    type: "individual" as 'individual' | 'team',
    teamName: ""
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedOKRs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedOKRs(newExpanded);
  };

  const filteredOKRs = okrs.filter(okr => {
    const matchesSearch = okr.objective.toLowerCase().includes(searchQuery.toLowerCase()) ||
      okr.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (okr.teamName && okr.teamName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === "my-okrs") return matchesSearch && okr.ownerId === currentUser?.id;
    if (activeTab === "team-okrs") return matchesSearch && okr.type === 'team';
    if (activeTab === "individual") return matchesSearch && okr.type === 'individual';
    return matchesSearch;
  });

  const handleCreateOKR = () => {
    if (!newOKR.objective || newOKR.keyResults.filter(kr => kr.title).length === 0) {
      toast.error("Please add an objective and at least one key result");
      return;
    }

    if (newOKR.type === 'team' && !newOKR.teamName) {
      toast.error("Please enter a team name for team OKRs");
      return;
    }

    const owner = users.find(u => u.id === newOKR.ownerId) || currentUser;
    const okr: OKR = {
      id: Date.now().toString(),
      objective: newOKR.objective,
      description: newOKR.description,
      ownerId: newOKR.ownerId || currentUser?.id || "",
      ownerName: owner?.name || "Unknown",
      quarter: newOKR.quarter,
      year: newOKR.year,
      keyResults: newOKR.keyResults.filter(kr => kr.title).map((kr, i) => ({
        id: `kr${i}`,
        title: kr.title,
        targetValue: kr.targetValue,
        currentValue: 0,
        unit: kr.unit,
        progress: 0
      })),
      status: "on-track",
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      type: newOKR.type,
      teamName: newOKR.type === 'team' ? newOKR.teamName : undefined
    };

    setOKRs([okr, ...okrs]);
    setShowCreateModal(false);
    setNewOKR({
      objective: "",
      description: "",
      ownerId: currentUser?.id || "",
      quarter: "Q1",
      year: 2025,
      keyResults: [{ title: "", targetValue: 0, unit: "" }],
      type: "individual",
      teamName: ""
    });
    toast.success("OKR created successfully");
  };

  const updateKeyResultProgress = (okrId: string, krId: string, newValue: number) => {
    setOKRs(okrs.map(okr => {
      if (okr.id === okrId) {
        const updatedKRs = okr.keyResults.map(kr => {
          if (kr.id === krId) {
            const progress = Math.min(Math.round((newValue / kr.targetValue) * 100), 100);
            return { ...kr, currentValue: newValue, progress };
          }
          return kr;
        });
        const overallProgress = Math.round(updatedKRs.reduce((sum, kr) => sum + kr.progress, 0) / updatedKRs.length);
        let status: OKR['status'] = 'on-track';
        if (overallProgress >= 100) status = 'completed';
        else if (overallProgress < 50) status = 'behind';
        else if (overallProgress < 70) status = 'at-risk';
        
        return { ...okr, keyResults: updatedKRs, overallProgress, status };
      }
      return okr;
    }));
  };

  const addKeyResultField = () => {
    setNewOKR({
      ...newOKR,
      keyResults: [...newOKR.keyResults, { title: "", targetValue: 0, unit: "" }]
    });
  };

  const updateKeyResultField = (index: number, field: string, value: any) => {
    const updatedKRs = [...newOKR.keyResults];
    updatedKRs[index] = { ...updatedKRs[index], [field]: value };
    setNewOKR({ ...newOKR, keyResults: updatedKRs });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-500';
      case 'at-risk': return 'bg-yellow-500';
      case 'behind': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Layout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Goal Setting & OKRs</h1>
            <p className="text-muted-foreground">Track objectives and key results across the organization</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} data-testid="button-create-okr">
            <Plus className="w-4 h-4 mr-2" /> New OKR
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{okrs.length}</p>
                  <p className="text-xs text-muted-foreground">Total OKRs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{okrs.filter(o => o.status === 'on-track').length}</p>
                  <p className="text-xs text-muted-foreground">On Track</p>
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
                    {Math.round(okrs.reduce((sum, o) => sum + o.overallProgress, 0) / Math.max(okrs.length, 1))}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Award className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{okrs.filter(o => o.status === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Objectives & Key Results</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search OKRs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-okrs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All OKRs</TabsTrigger>
                <TabsTrigger value="my-okrs">My OKRs</TabsTrigger>
                <TabsTrigger value="team-okrs">Team Goals</TabsTrigger>
                <TabsTrigger value="individual">Individual Goals</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {filteredOKRs.map((okr) => (
                      <Card key={okr.id} className="hover:border-primary/50 transition-colors" data-testid={`okr-${okr.id}`}>
                        <CardContent className="p-4">
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => toggleExpand(okr.id)}
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <button className="mt-1">
                                {expandedOKRs.has(okr.id) ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium">{okr.objective}</h3>
                                  <Badge className={cn("text-white", getStatusColor(okr.status))}>
                                    {okr.status.replace('-', ' ')}
                                  </Badge>
                                  <Badge variant="outline" className={okr.type === 'team' ? 'border-blue-500 text-blue-500' : 'border-purple-500 text-purple-500'}>
                                    {okr.type === 'team' ? 'Team' : 'Individual'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{okr.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {okr.type === 'team' && okr.teamName ? okr.teamName : okr.ownerName}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {okr.quarter} {okr.year}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" /> {okr.keyResults.length} Key Results
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <div className="text-right">
                                <p className="text-2xl font-bold">{okr.overallProgress}%</p>
                                <Progress value={okr.overallProgress} className="w-24 h-2" />
                              </div>
                            </div>
                          </div>

                          {expandedOKRs.has(okr.id) && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              {okr.keyResults.map((kr) => (
                                <div key={kr.id} className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {kr.progress >= 100 ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-muted-foreground" />
                                      )}
                                      <span className="text-sm font-medium">{kr.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-6">
                                      <Progress value={kr.progress} className="flex-1 h-2" />
                                      <span className="text-xs text-muted-foreground w-20">
                                        {kr.currentValue}/{kr.targetValue} {kr.unit}
                                      </span>
                                    </div>
                                  </div>
                                  <Input
                                    type="number"
                                    value={kr.currentValue}
                                    onChange={(e) => updateKeyResultProgress(okr.id, kr.id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8"
                                    data-testid={`input-kr-${kr.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {filteredOKRs.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No OKRs found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New OKR</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div>
                <Label>Objective *</Label>
                <Input
                  value={newOKR.objective}
                  onChange={(e) => setNewOKR({ ...newOKR, objective: e.target.value })}
                  placeholder="What do you want to achieve?"
                  data-testid="input-objective"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newOKR.description}
                  onChange={(e) => setNewOKR({ ...newOKR, description: e.target.value })}
                  placeholder="Why is this important?"
                  data-testid="input-okr-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Goal Type *</Label>
                  <Select value={newOKR.type} onValueChange={(v) => setNewOKR({ ...newOKR, type: v as 'individual' | 'team' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual Goal</SelectItem>
                      <SelectItem value="team">Team Goal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newOKR.type === 'team' && (
                  <div>
                    <Label>Team Name *</Label>
                    <Input
                      value={newOKR.teamName}
                      onChange={(e) => setNewOKR({ ...newOKR, teamName: e.target.value })}
                      placeholder="Enter team name"
                      data-testid="input-team-name"
                    />
                  </div>
                )}
                {newOKR.type === 'individual' && (
                  <div>
                    <Label>Owner</Label>
                    <Select value={newOKR.ownerId} onValueChange={(v) => setNewOKR({ ...newOKR, ownerId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quarter</Label>
                  <Select value={newOKR.quarter} onValueChange={(v) => setNewOKR({ ...newOKR, quarter: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1">Q1</SelectItem>
                      <SelectItem value="Q2">Q2</SelectItem>
                      <SelectItem value="Q3">Q3</SelectItem>
                      <SelectItem value="Q4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Select value={newOKR.year.toString()} onValueChange={(v) => setNewOKR({ ...newOKR, year: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Key Results</Label>
                <div className="space-y-2 mt-2">
                  {newOKR.keyResults.map((kr, index) => (
                    <div key={index} className="grid grid-cols-6 gap-2">
                      <Input
                        className="col-span-3"
                        value={kr.title}
                        onChange={(e) => updateKeyResultField(index, 'title', e.target.value)}
                        placeholder="Key result description"
                        data-testid={`input-kr-title-${index}`}
                      />
                      <Input
                        type="number"
                        value={kr.targetValue || ''}
                        onChange={(e) => updateKeyResultField(index, 'targetValue', parseInt(e.target.value) || 0)}
                        placeholder="Target"
                        data-testid={`input-kr-target-${index}`}
                      />
                      <Input
                        className="col-span-2"
                        value={kr.unit}
                        onChange={(e) => updateKeyResultField(index, 'unit', e.target.value)}
                        placeholder="Unit (%, deals, etc.)"
                        data-testid={`input-kr-unit-${index}`}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addKeyResultField}>
                    <Plus className="w-3 h-3 mr-1" /> Add Key Result
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateOKR} data-testid="button-submit-okr">Create OKR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
