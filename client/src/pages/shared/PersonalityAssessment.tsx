import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePersonalityQuestions, usePersonalityAssessment, useSubmitPersonalityAssessment, useCurrentUser, type PersonalityScore, type AIAnalysis } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, Brain, Trophy, RefreshCw, ChevronLeft, ChevronRight, Loader2, Target, Briefcase, Users, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const PROFILE_COLORS: Record<string, string> = {
  'Politician': 'bg-purple-100 text-purple-800 border-purple-300',
  'Sherpa': 'bg-blue-100 text-blue-800 border-blue-300',
  'Deal Junkie': 'bg-red-100 text-red-800 border-red-300',
  'Closer': 'bg-green-100 text-green-800 border-green-300',
  'Architect': 'bg-slate-100 text-slate-800 border-slate-300',
  'Firefighter': 'bg-orange-100 text-orange-800 border-orange-300',
  'Guru': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Misfit': 'bg-pink-100 text-pink-800 border-pink-300',
  'Legal': 'bg-gray-100 text-gray-800 border-gray-300',
  'Rainmaker': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Creative': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Auditor': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Mayor': 'bg-amber-100 text-amber-800 border-amber-300',
  'Liaison': 'bg-teal-100 text-teal-800 border-teal-300',
  'Grandmaster': 'bg-violet-100 text-violet-800 border-violet-300',
  'Regulatory': 'bg-rose-100 text-rose-800 border-rose-300',
};

const DEAL_TEAM_OPTIONS = [
  { value: 'Floater', label: 'Floater - New/Rotating Member' },
  { value: 'Deal Team 10', label: 'Deal Team 10 - Entry Level' },
  { value: 'Deal Team 8', label: 'Deal Team 8 - Mid Level' },
  { value: 'Deal Team 6', label: 'Deal Team 6 - Senior' },
  { value: 'Deal Team 4', label: 'Deal Team 4 - Lead' },
  { value: 'Deal Team 2', label: 'Deal Team 2 - Principal' },
];

function AnalysisSection({ title, content, icon: Icon }: { title: string; content: string; icon?: any }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
    </div>
  );
}

export default function PersonalityAssessment() {
  const [location] = useLocation();
  const role: 'CEO' | 'Employee' = location.startsWith('/ceo') ? 'CEO' : 'Employee';
  
  const { data: currentUser } = useCurrentUser();
  const { data: questions = [], isLoading: questionsLoading } = usePersonalityQuestions();
  const { data: existingAssessment, isLoading: assessmentLoading, refetch } = usePersonalityAssessment();
  const submitAssessment = useSubmitPersonalityAssessment();
  
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B'>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [dealTeamStatus, setDealTeamStatus] = useState('Floater');
  
  const isLoading = questionsLoading || assessmentLoading;
  const isAnalyzing = existingAssessment?.status === 'analyzing';
  const hasCompletedAssessment = existingAssessment && existingAssessment.status === 'completed' && !isRetaking;
  
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        refetch();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, refetch]);
  
  const handleAnswer = (answer: 'A' | 'B') => {
    setAnswers(prev => ({ ...prev, [questions[currentQuestion].id]: answer }));
    
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 200);
    }
  };
  
  const handleSubmit = async () => {
    if (Object.keys(answers).length !== 25) {
      toast.error("Please answer all 25 questions");
      return;
    }
    
    try {
      await submitAssessment.mutateAsync({ answers, dealTeamStatus });
      toast.success("Assessment submitted! Analyzing your profile...");
      setShowResults(true);
      setIsRetaking(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const handleRetake = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    setIsRetaking(true);
  };
  
  const progress = (Object.keys(answers).length / 25) * 100;
  const currentQ = questions[currentQuestion];
  const canSubmit = Object.keys(answers).length === 25;
  
  if (isLoading) {
    return (
      <Layout role={role}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }
  
  if (isAnalyzing) {
    return (
      <Layout role={role}>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Analyzing Your Profile</h2>
              <p className="text-muted-foreground">
                Our AI is analyzing your responses to create your personalized deployment profile.
                This usually takes about 10-15 seconds...
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  if (hasCompletedAssessment || showResults) {
    const assessment = existingAssessment;
    const aiAnalysis = assessment?.aiAnalysis;
    const deploymentTags = aiAnalysis?.deploymentTags;
    
    return (
      <Layout role={role}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Deployment Profile</h1>
              <p className="text-muted-foreground">
                {assessment?.completedAt && `Completed on ${format(new Date(assessment.completedAt), 'MMMM d, yyyy')}`}
              </p>
            </div>
            <Button variant="outline" onClick={handleRetake} data-testid="button-retake-assessment">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retake Assessment
            </Button>
          </div>
          
          {deploymentTags && (
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Final Deployment Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Deal Team Status</p>
                    <Badge variant="secondary" className="text-sm">{deploymentTags.dealTeamStatus}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Primary Vertical</p>
                    <Badge className="text-sm bg-blue-600">{deploymentTags.primaryVertical}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Secondary Vertical</p>
                    <Badge variant="outline" className="text-sm">{deploymentTags.secondaryVertical}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Primary Phase</p>
                    <Badge className="text-sm bg-green-600">{deploymentTags.primaryDealPhase}</Badge>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Top 5 Archetypes</p>
                  <div className="flex flex-wrap gap-2">
                    {deploymentTags.topFiveArchetypes?.map((tag, idx) => (
                      <Badge 
                        key={idx}
                        className={cn("text-sm border", PROFILE_COLORS[tag] || 'bg-gray-100 text-gray-800')}
                      >
                        {idx + 1}. {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                {deploymentTags.riskFlag && deploymentTags.riskFlag !== 'No material coverage gaps' && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Risk Flag: {deploymentTags.riskFlag}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile Analysis</TabsTrigger>
              <TabsTrigger value="deployment">Deployment Fit</TabsTrigger>
              <TabsTrigger value="management">Management Notes</TabsTrigger>
              <TabsTrigger value="scores">Raw Scores</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {aiAnalysis?.employeeSnapshot && (
                    <AnalysisSection title="Employee Snapshot" content={aiAnalysis.employeeSnapshot} icon={Users} />
                  )}
                  <Separator />
                  {aiAnalysis?.primaryArchetype && (
                    <AnalysisSection title="Primary Archetype" content={aiAnalysis.primaryArchetype} icon={Trophy} />
                  )}
                  <Separator />
                  {aiAnalysis?.secondaryTraits && (
                    <AnalysisSection title="Secondary Traits" content={aiAnalysis.secondaryTraits} />
                  )}
                  <Separator />
                  {aiAnalysis?.supportingTraits && (
                    <AnalysisSection title="Supporting Traits" content={aiAnalysis.supportingTraits} />
                  )}
                  <Separator />
                  {aiAnalysis?.lowSignalTags && (
                    <AnalysisSection title="Low Signal Tags" content={aiAnalysis.lowSignalTags} />
                  )}
                  {aiAnalysis?.absentTraits && (
                    <>
                      <Separator />
                      <AnalysisSection title="Absent Traits" content={aiAnalysis.absentTraits} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="deployment" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {aiAnalysis?.dealPhaseFit && (
                    <AnalysisSection title="Deal Phase Fit" content={aiAnalysis.dealPhaseFit} icon={Target} />
                  )}
                  <Separator />
                  {aiAnalysis?.dealTypeProficiency && (
                    <AnalysisSection title="Deal Type Proficiency (Verticals)" content={aiAnalysis.dealTypeProficiency} icon={Briefcase} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="management" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {aiAnalysis?.managerialNotes && (
                    <AnalysisSection title="Managerial Notes" content={aiAnalysis.managerialNotes} icon={FileText} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="scores" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Score Distribution</CardTitle>
                  <CardDescription>Raw scores from your questionnaire answers</CardDescription>
                </CardHeader>
                <CardContent>
                  {aiAnalysis?.scoreDistribution ? (
                    <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                      {aiAnalysis.scoreDistribution}
                    </pre>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {assessment?.allScores?.map((score: PersonalityScore) => (
                        <div 
                          key={score.profile}
                          className={cn(
                            "p-2 rounded text-center text-sm border",
                            score.score > 0 ? PROFILE_COLORS[score.profile] : 'bg-gray-50 border-gray-200 text-gray-400'
                          )}
                        >
                          <div className="font-medium truncate">{score.profile}</div>
                          <div className="text-xs">{score.score}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {!aiAnalysis && assessment?.topThreeProfiles && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top 3 Profiles (Basic)</CardTitle>
                    <CardDescription>Based on raw scoring (AI analysis pending)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assessment.topThreeProfiles.map((profile: PersonalityScore, index: number) => (
                      <div 
                        key={profile.profile}
                        className={cn(
                          "p-3 rounded-lg border-2 flex items-center gap-3",
                          PROFILE_COLORS[profile.profile] || 'bg-gray-100 border-gray-300'
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0",
                          index === 0 ? "bg-yellow-400 text-yellow-900" :
                          index === 1 ? "bg-gray-300 text-gray-700" :
                          "bg-amber-600 text-amber-100"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <span className="font-semibold">{profile.profile}</span>
                          <span className="ml-2 text-sm opacity-70">Score: {profile.score}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout role={role}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Personality Assessment</h1>
          <p className="text-muted-foreground">
            Answer 25 questions to discover your work style and deployment profile
          </p>
        </div>
        
        {currentQuestion === 0 && Object.keys(answers).length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Before You Begin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dealTeam">What is your Deal Team status?</Label>
                <Select value={dealTeamStatus} onValueChange={setDealTeamStatus}>
                  <SelectTrigger id="dealTeam" data-testid="select-deal-team">
                    <SelectValue placeholder="Select your deal team" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_TEAM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This helps calibrate your deployment recommendations based on your experience level.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {currentQuestion + 1} of 25</span>
              <span>{Object.keys(answers).length} answered</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardHeader>
          <CardContent className="pt-6">
            {currentQ && (
              <div className="space-y-6">
                <h2 className="text-xl font-medium text-center" data-testid={`question-${currentQ.id}`}>
                  {currentQ.question}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleAnswer('A')}
                    className={cn(
                      "p-6 rounded-lg border-2 text-left transition-all hover:border-primary hover:bg-primary/5",
                      answers[currentQ.id] === 'A' ? "border-primary bg-primary/10" : "border-gray-200"
                    )}
                    data-testid={`answer-${currentQ.id}-A`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0",
                        answers[currentQ.id] === 'A' ? "bg-primary text-primary-foreground" : "bg-gray-100"
                      )}>
                        A
                      </div>
                      <span className="text-lg">{currentQ.optionA}</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleAnswer('B')}
                    className={cn(
                      "p-6 rounded-lg border-2 text-left transition-all hover:border-primary hover:bg-primary/5",
                      answers[currentQ.id] === 'B' ? "border-primary bg-primary/10" : "border-gray-200"
                    )}
                    data-testid={`answer-${currentQ.id}-B`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0",
                        answers[currentQ.id] === 'B' ? "bg-primary text-primary-foreground" : "bg-gray-100"
                      )}>
                        B
                      </div>
                      <span className="text-lg">{currentQ.optionB}</span>
                    </div>
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestion === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="flex gap-2">
                    {canSubmit ? (
                      <Button 
                        onClick={handleSubmit}
                        disabled={submitAssessment.isPending}
                        data-testid="button-submit-assessment"
                      >
                        {submitAssessment.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Complete Assessment
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setCurrentQuestion(prev => Math.min(24, prev + 1))}
                        disabled={currentQuestion === 24}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-1 justify-center">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestion(idx)}
                  className={cn(
                    "w-8 h-8 rounded text-sm font-medium transition-colors",
                    idx === currentQuestion ? "bg-primary text-primary-foreground" :
                    answers[q.id] ? "bg-green-100 text-green-800" : "bg-gray-100 hover:bg-gray-200"
                  )}
                  data-testid={`question-nav-${q.id}`}
                >
                  {q.id}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
