import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePersonalityQuestions, usePersonalityAssessment, useSubmitPersonalityAssessment, useCurrentUser, type PersonalityScore } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Brain, Trophy, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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
};

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  'Politician': 'Skilled at navigating relationships and building consensus',
  'Sherpa': 'Guides others through complex terrain with patience',
  'Deal Junkie': 'Thrives on action and closing deals',
  'Closer': 'Focused on getting results and finishing strong',
  'Architect': 'Designs systems and thinks strategically',
  'Firefighter': 'Excels in crisis situations and urgent tasks',
  'Guru': 'Deep thinker who provides wisdom and guidance',
  'Misfit': 'Creative problem solver who thinks differently',
  'Legal': 'Detail-oriented with focus on compliance',
  'Rainmaker': 'Generates opportunities and drives growth',
  'Creative': 'Innovative thinker with fresh perspectives',
  'Auditor': 'Meticulous attention to accuracy and detail',
  'Mayor': 'Natural connector who builds community',
  'Liaison': 'Bridges gaps between people and teams',
  'Grandmaster': 'Strategic thinker with long-term vision',
};

export default function PersonalityAssessment() {
  const [location] = useLocation();
  const role: 'CEO' | 'Employee' = location.startsWith('/ceo') ? 'CEO' : 'Employee';
  
  const { data: currentUser } = useCurrentUser();
  const { data: questions = [], isLoading: questionsLoading } = usePersonalityQuestions();
  const { data: existingAssessment, isLoading: assessmentLoading } = usePersonalityAssessment();
  const submitAssessment = useSubmitPersonalityAssessment();
  
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B'>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  
  const isLoading = questionsLoading || assessmentLoading;
  const hasCompletedAssessment = existingAssessment && existingAssessment.status === 'completed' && !isRetaking;
  
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
      await submitAssessment.mutateAsync(answers);
      toast.success("Assessment completed!");
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
  
  if (hasCompletedAssessment || showResults) {
    const assessment = showResults ? null : existingAssessment;
    const topProfiles = assessment?.topThreeProfiles || [];
    
    return (
      <Layout role={role}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Personality Profile</h1>
              <p className="text-muted-foreground">
                {assessment?.completedAt && `Completed on ${format(new Date(assessment.completedAt), 'MMMM d, yyyy')}`}
              </p>
            </div>
            <Button variant="outline" onClick={handleRetake} data-testid="button-retake-assessment">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retake Assessment
            </Button>
          </div>
          
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Your Top 3 Personality Profiles</CardTitle>
              <CardDescription>
                These profiles represent your strongest work style characteristics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProfiles.map((profile: PersonalityScore, index: number) => (
                <div 
                  key={profile.profile}
                  className={cn(
                    "p-4 rounded-lg border-2 flex items-start gap-4",
                    PROFILE_COLORS[profile.profile] || 'bg-gray-100 border-gray-300'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                    index === 0 ? "bg-yellow-400 text-yellow-900" :
                    index === 1 ? "bg-gray-300 text-gray-700" :
                    "bg-amber-600 text-amber-100"
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{profile.profile}</h3>
                      <Badge variant="secondary" className="text-xs">
                        Score: {profile.score}
                      </Badge>
                    </div>
                    <p className="text-sm opacity-80">
                      {PROFILE_DESCRIPTIONS[profile.profile] || 'A unique work style profile'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          
          {assessment?.allScores && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">All Profile Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {assessment.allScores.map((score: PersonalityScore) => (
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
              </CardContent>
            </Card>
          )}
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
            Answer 25 questions to discover your work style profile
          </p>
        </div>
        
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Calculating...
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
