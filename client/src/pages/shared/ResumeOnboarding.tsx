import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useResumeAnalysis, useUploadResume, type ResumeAIAnalysis, type OnboardingPlacement } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, FileText, Loader2, Target, Briefcase, Users, AlertTriangle, CheckCircle2, RefreshCw, ChevronRight } from "lucide-react";
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

export default function ResumeOnboarding() {
  const [location, navigate] = useLocation();
  const role: 'CEO' | 'Employee' = location.startsWith('/ceo') ? 'CEO' : 'Employee';
  
  const { data: existingAnalysis, isLoading, refetch } = useResumeAnalysis();
  const uploadResume = useUploadResume();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const isAnalyzing = existingAnalysis?.status === 'analyzing';
  const hasCompletedAnalysis = existingAnalysis && existingAnalysis.status === 'completed';
  
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        refetch();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, refetch]);
  
  const handleFileSelect = async (file: File) => {
    if (!file) return;
    
    const validTypes = ['application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error("Please upload a PDF or TXT file");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    
    try {
      await uploadResume.mutateAsync(file);
      toast.success("Resume uploaded! Analyzing...");
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };
  
  const handleRetake = () => {
    fileInputRef.current?.click();
  };
  
  const handleContinueToAssessment = () => {
    const basePath = role === 'CEO' ? '/ceo' : '/employee';
    navigate(`${basePath}/personality-assessment`);
  };
  
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
              <h2 className="text-xl font-semibold mb-2">Analyzing Your Resume</h2>
              <p className="text-muted-foreground">
                Our AI is reviewing your experience to determine your Deal Team placement.
                This usually takes about 15-20 seconds...
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  if (hasCompletedAnalysis) {
    const aiAnalysis = existingAnalysis.aiAnalysis;
    const placement = aiAnalysis?.onboardingPlacement;
    
    return (
      <Layout role={role}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Onboarding Placement</h1>
              <p className="text-muted-foreground">
                {existingAnalysis.completedAt && `Analyzed on ${format(new Date(existingAnalysis.completedAt), 'MMMM d, yyyy')}`}
                {existingAnalysis.fileName && ` - ${existingAnalysis.fileName}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetake} data-testid="button-reupload-resume">
                <RefreshCw className="h-4 w-4 mr-2" />
                Upload New Resume
              </Button>
              <Button onClick={handleContinueToAssessment} data-testid="button-continue-assessment">
                Continue to Assessment
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleInputChange}
            className="hidden"
          />
          
          {placement && (
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Final Onboarding Placement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Assigned Deal Team</p>
                    <Badge variant="secondary" className="text-sm font-semibold">{placement.assignedDealTeam}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Primary Vertical</p>
                    <Badge className="text-sm bg-blue-600">{placement.primaryVertical}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Secondary Vertical</p>
                    <Badge variant="outline" className="text-sm">{placement.secondaryVertical}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Initial Seat</p>
                    <Badge className="text-sm bg-green-600">{placement.initialSeatRecommendation}</Badge>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Deal Phases</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="text-sm bg-emerald-600">Primary: {placement.primaryDealPhase}</Badge>
                      <Badge variant="outline" className="text-sm">Secondary: {placement.secondaryDealPhase}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Resume Inferred Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {placement.topFiveInferredTags?.map((tag, idx) => (
                        <Badge 
                          key={idx}
                          className={cn("text-sm border", PROFILE_COLORS[tag] || 'bg-gray-100 text-gray-800')}
                        >
                          {idx + 1}. {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {placement.coverageGaps && placement.coverageGaps !== 'No material gaps observed' && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Coverage Gaps: {placement.coverageGaps}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Candidate Profile</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="deployment">Deployment Fit</TabsTrigger>
              <TabsTrigger value="management">Management Notes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {aiAnalysis?.candidateSnapshot && (
                    <AnalysisSection title="Candidate Snapshot" content={aiAnalysis.candidateSnapshot} icon={Users} />
                  )}
                  <Separator />
                  {aiAnalysis?.evidenceAnchors && (
                    <AnalysisSection title="Evidence Anchors" content={aiAnalysis.evidenceAnchors} icon={FileText} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="experience" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {aiAnalysis?.transactionProfile && (
                    <AnalysisSection title="Transaction Profile" content={aiAnalysis.transactionProfile} icon={Briefcase} />
                  )}
                  <Separator />
                  {aiAnalysis?.roleElevationAutonomy && (
                    <AnalysisSection title="Role Elevation & Autonomy" content={aiAnalysis.roleElevationAutonomy} />
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
                    <AnalysisSection title="Deal Type Proficiency" content={aiAnalysis.dealTypeProficiency} icon={Briefcase} />
                  )}
                  <Separator />
                  {aiAnalysis?.resumeInferredTags && (
                    <AnalysisSection title="Resume Inferred Tags" content={aiAnalysis.resumeInferredTags} />
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
          </Tabs>
          
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Ready for Personality Assessment?</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete the 25-question assessment to refine your deployment profile with behavioral insights.
                  </p>
                </div>
                <Button onClick={handleContinueToAssessment} size="lg">
                  Take Assessment
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout role={role}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Resume Onboarding</h1>
          <p className="text-muted-foreground">
            Upload your resume to get your initial Deal Team placement and deployment profile
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Your Resume</CardTitle>
            <CardDescription>
              Our AI will analyze your experience to assign you to the appropriate Deal Team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                dragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50",
                uploadResume.isPending && "pointer-events-none opacity-50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-resume"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                onChange={handleInputChange}
                className="hidden"
                data-testid="input-resume-file"
              />
              
              {uploadResume.isPending ? (
                <div className="space-y-3">
                  <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                  <p className="text-sm font-medium">Uploading...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">Drop your resume here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Supports PDF and TXT files up to 10MB</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <h4 className="font-medium mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                AI analyzes your transaction and deal experience
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Assigns you to a Deal Team (Floater, DT10, DT8, DT6, DT4, or DT2)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Identifies your vertical fit and deal phase strengths
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Recommends your initial seat on live mandates
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
