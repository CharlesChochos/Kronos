import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Search,
  Brain,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Briefcase,
  Target,
  Star,
  AlertTriangle,
  User
} from "lucide-react";
import { useCurrentUser, useUsers, useOnboardingStatus } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type DeploymentTags = {
  dealTeamStatus: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  topFiveArchetypes: string[];
  riskFlag: string | null;
};

type PersonalityAssessment = {
  id: string;
  userId: string;
  status: string;
  completedAt?: string;
  allScores?: { profile: string; score: number }[];
  topThreeProfiles?: { profile: string; score: number }[];
  aiAnalysis?: {
    employeeSnapshot: string;
    scoreDistribution: string;
    primaryArchetype: string;
    secondaryTraits: string;
    supportingTraits: string;
    lowSignalTags: string;
    absentTraits: string;
    dealPhaseFit: string;
    dealTypeProficiency: string;
    managerialNotes: string;
    deploymentTags: DeploymentTags;
    rawResponse: string;
  } | null;
};

type OnboardingPlacement = {
  assignedDealTeam: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  initialSeatRecommendation: string;
  topFiveInferredTags: string[];
  coverageGaps?: string;
};

type ResumeAnalysis = {
  id: string;
  userId: string;
  fileName: string;
  status: string;
  completedAt?: string;
  assignedDealTeam?: string;
  aiAnalysis?: {
    candidateSnapshot: string;
    evidenceAnchors: string;
    transactionProfile: string;
    roleElevationAutonomy: string;
    dealPhaseFit: string;
    dealTypeProficiency: string;
    resumeInferredTags: string;
    managerialNotes: string;
    onboardingPlacement: OnboardingPlacement;
    rawResponse: string;
  } | null;
};

export default function TeamProfiles() {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const { data: onboardingStatus = {} } = useOnboardingStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: allPersonalityAssessments = [] } = useQuery<PersonalityAssessment[]>({
    queryKey: ["all-personality-assessments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/personality-assessments", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allResumeAnalyses = [] } = useQuery<ResumeAnalysis[]>({
    queryKey: ["all-resume-analyses"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resume-analyses", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => u.status === 'active');
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
      );
    }
    
    if (activeTab === "complete") {
      result = result.filter(u => onboardingStatus[u.id]?.isComplete);
    } else if (activeTab === "incomplete") {
      result = result.filter(u => !onboardingStatus[u.id]?.isComplete);
    }
    
    return result;
  }, [users, searchQuery, activeTab, onboardingStatus]);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedPersonality = allPersonalityAssessments.find(a => a.userId === selectedUserId);
  const selectedResume = allResumeAnalyses.find(a => a.userId === selectedUserId);

  const stats = useMemo(() => {
    const activeUsers = users.filter(u => u.status === 'active');
    const complete = activeUsers.filter(u => onboardingStatus[u.id]?.isComplete).length;
    const hasResume = activeUsers.filter(u => onboardingStatus[u.id]?.hasResume).length;
    const hasPersonality = activeUsers.filter(u => onboardingStatus[u.id]?.hasPersonality).length;
    return { total: activeUsers.length, complete, hasResume, hasPersonality };
  }, [users, onboardingStatus]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <Layout role="CEO" pageTitle="Team Profiles" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Team Onboarding Profiles
            </h1>
            <p className="text-muted-foreground mt-1">
              View team members' resume analysis and personality assessment results
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Active Team Members</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.complete}</div>
                  <div className="text-sm text-muted-foreground">Fully Onboarded</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.hasResume}</div>
                  <div className="text-sm text-muted-foreground">Resume Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.hasPersonality}</div>
                  <div className="text-sm text-muted-foreground">Personality Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search team members..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-profiles"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                  <TabsTrigger value="complete">Complete ({stats.complete})</TabsTrigger>
                  <TabsTrigger value="incomplete">Incomplete ({stats.total - stats.complete})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  filteredUsers.map(user => {
                    const status = onboardingStatus[user.id];
                    const personality = allPersonalityAssessments.find(a => a.userId === user.id);
                    const resume = allResumeAnalyses.find(a => a.userId === user.id);
                    
                    return (
                      <div 
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                          selectedUserId === user.id ? "border-primary bg-primary/5" : "border-border"
                        )}
                        data-testid={`profile-card-${user.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {user.name}
                                {status?.isComplete ? (
                                  <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Complete
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Incomplete
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                status?.hasResume ? "bg-green-500/20" : "bg-muted"
                              )}>
                                <FileText className={cn("w-4 h-4", status?.hasResume ? "text-green-500" : "text-muted-foreground")} />
                              </div>
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                status?.hasPersonality ? "bg-green-500/20" : "bg-muted"
                              )}>
                                <Brain className={cn("w-4 h-4", status?.hasPersonality ? "text-green-500" : "text-muted-foreground")} />
                              </div>
                            </div>
                            {personality?.topThreeProfiles?.[0] && (
                              <Badge variant="secondary" className="hidden md:flex">
                                {personality.topThreeProfiles[0].profile}
                              </Badge>
                            )}
                            {resume?.assignedDealTeam && (
                              <Badge variant="outline" className="hidden md:flex">
                                {resume.assignedDealTeam}
                              </Badge>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {selectedUser ? getInitials(selectedUser.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div>{selectedUser?.name}</div>
                  <div className="text-sm font-normal text-muted-foreground">{selectedUser?.email}</div>
                </div>
              </DialogTitle>
              <DialogDescription>
                Complete onboarding profile and assessment results
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="resume" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="resume" className="flex items-center gap-2" data-testid="tab-resume-analysis">
                  <FileText className="w-4 h-4" />
                  Resume Analysis
                </TabsTrigger>
                <TabsTrigger value="personality" className="flex items-center gap-2" data-testid="tab-personality-profile">
                  <Brain className="w-4 h-4" />
                  Personality Profile
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resume" className="mt-4">
                {!selectedResume || selectedResume.status !== 'completed' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Resume analysis not completed yet</p>
                  </div>
                ) : (
                  <Tabs defaultValue="candidate" className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      <TabsTrigger value="candidate" className="text-xs" data-testid="subtab-candidate-profile">Candidate Profile</TabsTrigger>
                      <TabsTrigger value="experience" className="text-xs" data-testid="subtab-experience">Experience</TabsTrigger>
                      <TabsTrigger value="deployment" className="text-xs" data-testid="subtab-deployment-fit">Deployment Fit</TabsTrigger>
                      <TabsTrigger value="management" className="text-xs" data-testid="subtab-management-notes">Management Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="candidate" className="mt-4 space-y-4">
                      {selectedResume.aiAnalysis?.onboardingPlacement && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Target className="w-4 h-4 text-green-500" />
                              Onboarding Placement
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Deal Team</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.assignedDealTeam}</div>
                              </div>
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Primary Vertical</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.primaryVertical}</div>
                              </div>
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Primary Deal Phase</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.primaryDealPhase}</div>
                              </div>
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Secondary Vertical</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.secondaryVertical}</div>
                              </div>
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Secondary Deal Phase</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.secondaryDealPhase}</div>
                              </div>
                              <div className="p-3 bg-secondary/30 rounded-lg">
                                <div className="text-xs text-muted-foreground">Initial Seat</div>
                                <div className="font-medium">{selectedResume.aiAnalysis.onboardingPlacement.initialSeatRecommendation}</div>
                              </div>
                            </div>
                            {selectedResume.aiAnalysis.onboardingPlacement.topFiveInferredTags?.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-muted-foreground mb-2">Inferred Tags</div>
                                <div className="flex flex-wrap gap-1">
                                  {selectedResume.aiAnalysis.onboardingPlacement.topFiveInferredTags.map((tag, i) => (
                                    <Badge key={i} variant="outline">{tag}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedResume.aiAnalysis.onboardingPlacement.coverageGaps && (
                              <div className="mt-3">
                                <div className="text-xs text-muted-foreground mb-1">Coverage Gaps</div>
                                <p className="text-sm">{selectedResume.aiAnalysis.onboardingPlacement.coverageGaps}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {selectedResume.aiAnalysis && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Candidate Snapshot
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedResume.aiAnalysis.candidateSnapshot}
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>File: {selectedResume.fileName}</span>
                        {selectedResume.completedAt && (
                          <span>Completed on {format(new Date(selectedResume.completedAt), 'MMM d, yyyy \'at\' h:mm a')}</span>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="experience" className="mt-4 space-y-4">
                      {selectedResume.aiAnalysis && (
                        <>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Transaction Profile</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedResume.aiAnalysis.transactionProfile}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Evidence Anchors</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedResume.aiAnalysis.evidenceAnchors}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Role Elevation & Autonomy</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedResume.aiAnalysis.roleElevationAutonomy}
                              </p>
                            </CardContent>
                          </Card>

                          {selectedResume.aiAnalysis.resumeInferredTags && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Resume Inferred Tags</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {selectedResume.aiAnalysis.resumeInferredTags}
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="deployment" className="mt-4 space-y-4">
                      {selectedResume.aiAnalysis && (
                        <>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Deal Phase Fit
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedResume.aiAnalysis.dealPhaseFit}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                Deal Type Proficiency
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedResume.aiAnalysis.dealTypeProficiency}
                              </p>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="management" className="mt-4 space-y-4">
                      {selectedResume.aiAnalysis?.managerialNotes && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Managerial Notes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedResume.aiAnalysis.managerialNotes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>

              <TabsContent value="personality" className="mt-4">
                {!selectedPersonality || selectedPersonality.status !== 'completed' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Personality assessment not completed yet</p>
                  </div>
                ) : (
                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      <TabsTrigger value="profile" className="text-xs" data-testid="subtab-profile-analysis">Profile Analysis</TabsTrigger>
                      <TabsTrigger value="scores" className="text-xs" data-testid="subtab-raw-scores">Raw Scores</TabsTrigger>
                      <TabsTrigger value="deployment" className="text-xs" data-testid="subtab-personality-deployment">Deployment Fit</TabsTrigger>
                      <TabsTrigger value="management" className="text-xs" data-testid="subtab-personality-management">Management Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="mt-4 space-y-4">
                      {selectedPersonality.aiAnalysis && (
                        <>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Employee Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedPersonality.aiAnalysis.employeeSnapshot}
                              </p>
                            </CardContent>
                          </Card>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Primary Archetype</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{selectedPersonality.aiAnalysis.primaryArchetype}</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Secondary Traits</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{selectedPersonality.aiAnalysis.secondaryTraits}</p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Supporting Traits</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPersonality.aiAnalysis.supportingTraits}</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Low Signal Tags</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPersonality.aiAnalysis.lowSignalTags}</p>
                              </CardContent>
                            </Card>
                          </div>

                          {selectedPersonality.aiAnalysis.absentTraits && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Absent Traits</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {selectedPersonality.aiAnalysis.absentTraits}
                                </p>
                              </CardContent>
                            </Card>
                          )}

                          {selectedPersonality.aiAnalysis.deploymentTags && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Target className="w-4 h-4 text-green-500" />
                                  Final Deployment Tags
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  <div className="p-3 bg-secondary/30 rounded-lg">
                                    <div className="text-xs text-muted-foreground">Deal Team Status</div>
                                    <div className="font-medium">{selectedPersonality.aiAnalysis.deploymentTags.dealTeamStatus}</div>
                                  </div>
                                  <div className="p-3 bg-secondary/30 rounded-lg">
                                    <div className="text-xs text-muted-foreground">Primary Vertical</div>
                                    <div className="font-medium">{selectedPersonality.aiAnalysis.deploymentTags.primaryVertical}</div>
                                  </div>
                                  <div className="p-3 bg-secondary/30 rounded-lg">
                                    <div className="text-xs text-muted-foreground">Primary Deal Phase</div>
                                    <div className="font-medium">{selectedPersonality.aiAnalysis.deploymentTags.primaryDealPhase}</div>
                                  </div>
                                  <div className="p-3 bg-secondary/30 rounded-lg">
                                    <div className="text-xs text-muted-foreground">Secondary Vertical</div>
                                    <div className="font-medium">{selectedPersonality.aiAnalysis.deploymentTags.secondaryVertical}</div>
                                  </div>
                                  <div className="p-3 bg-secondary/30 rounded-lg">
                                    <div className="text-xs text-muted-foreground">Secondary Deal Phase</div>
                                    <div className="font-medium">{selectedPersonality.aiAnalysis.deploymentTags.secondaryDealPhase}</div>
                                  </div>
                                  {selectedPersonality.aiAnalysis.deploymentTags.riskFlag && (
                                    <div className="p-3 bg-amber-500/20 rounded-lg">
                                      <div className="text-xs text-muted-foreground">Risk Flag</div>
                                      <div className="font-medium text-amber-600">{selectedPersonality.aiAnalysis.deploymentTags.riskFlag}</div>
                                    </div>
                                  )}
                                </div>
                                {selectedPersonality.aiAnalysis.deploymentTags.topFiveArchetypes?.length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-xs text-muted-foreground mb-2">Top 5 Archetype Tags</div>
                                    <div className="flex flex-wrap gap-1">
                                      {selectedPersonality.aiAnalysis.deploymentTags.topFiveArchetypes.map((tag, i) => (
                                        <Badge key={i} variant={i === 0 ? "default" : "outline"}>{tag}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}

                      {selectedPersonality.completedAt && (
                        <p className="text-xs text-muted-foreground text-center">
                          Completed on {format(new Date(selectedPersonality.completedAt), 'MMM d, yyyy \'at\' h:mm a')}
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="scores" className="mt-4 space-y-4">
                      {selectedPersonality.topThreeProfiles && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-500" />
                              Top 3 Personality Profiles
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-2 flex-wrap">
                              {selectedPersonality.topThreeProfiles.map((p, i) => (
                                <Badge 
                                  key={p.profile} 
                                  variant={i === 0 ? "default" : "secondary"}
                                  className={i === 0 ? "bg-primary" : ""}
                                >
                                  {i + 1}. {p.profile} ({p.score})
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPersonality.allScores && selectedPersonality.allScores.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">All Profile Scores</CardTitle>
                            <CardDescription>Complete score distribution across all personality profiles</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {selectedPersonality.allScores
                                .sort((a, b) => b.score - a.score)
                                .map((s) => (
                                  <div key={s.profile} className="flex items-center justify-between">
                                    <span className="text-sm">{s.profile}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-primary rounded-full" 
                                          style={{ width: `${Math.min(s.score * 10, 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium w-8 text-right">{s.score}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPersonality.aiAnalysis?.scoreDistribution && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Score Distribution Analysis</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedPersonality.aiAnalysis.scoreDistribution}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="deployment" className="mt-4 space-y-4">
                      {selectedPersonality.aiAnalysis && (
                        <>
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Deal Phase Fit
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedPersonality.aiAnalysis.dealPhaseFit}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                Deal Type Proficiency
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {selectedPersonality.aiAnalysis.dealTypeProficiency}
                              </p>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="management" className="mt-4 space-y-4">
                      {selectedPersonality.aiAnalysis?.managerialNotes && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Managerial Notes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedPersonality.aiAnalysis.managerialNotes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
