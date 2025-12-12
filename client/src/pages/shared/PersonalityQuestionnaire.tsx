import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePersonalityProfile, useSavePersonalityProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle, ChevronLeft, ChevronRight, Loader2, Pencil, ArrowRight } from "lucide-react";

interface Props {
  role: "CEO" | "Employee";
}

const STEPS = [
  { id: "work-style", title: "Work Style" },
  { id: "communication", title: "Communication" },
  { id: "decision-making", title: "Decision Making" },
  { id: "strengths", title: "Strengths" },
  { id: "preferences", title: "Preferences" },
  { id: "availability", title: "Availability" },
];

const DEAL_TYPES = ["M&A", "Capital Raising", "Asset Management"];
const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Consumer", 
  "Industrial", "Energy", "Real Estate", "Media & Entertainment"
];
const STRENGTHS = [
  "Financial Modeling", "Due Diligence", "Negotiation", "Client Relations",
  "Research & Analysis", "Presentations", "Project Management", "Legal/Compliance"
];

const getDefaultAnswers = () => ({
  workStyle: "",
  communicationStyle: "",
  riskTolerance: "",
  decisionMaking: "",
  strengths: [] as string[],
  preferredDealTypes: [] as string[],
  preferredSectors: [] as string[],
  experienceLevel: "",
  leadershipStyle: "",
  workloadCapacity: 5,
  availability: "full-time",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export default function PersonalityQuestionnaire({ role }: Props) {
  const [, setLocation] = useLocation();
  const { data: existingProfile, isLoading } = usePersonalityProfile();
  const saveProfile = useSavePersonalityProfile();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>(getDefaultAnswers());
  
  useEffect(() => {
    if (existingProfile) {
      setAnswers({
        workStyle: existingProfile.workStyle || "",
        communicationStyle: existingProfile.communicationStyle || "",
        riskTolerance: existingProfile.riskTolerance || "",
        decisionMaking: existingProfile.decisionMaking || "",
        strengths: existingProfile.strengths || [],
        preferredDealTypes: existingProfile.preferredDealTypes || [],
        preferredSectors: existingProfile.preferredSectors || [],
        experienceLevel: existingProfile.experienceLevel || "",
        leadershipStyle: existingProfile.leadershipStyle || "",
        workloadCapacity: existingProfile.workloadCapacity || 5,
        availability: existingProfile.availability || "full-time",
        timezone: existingProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [existingProfile]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const updateAnswer = (key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = (key: string, value: string) => {
    setAnswers(prev => {
      const arr = prev[key] || [];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter((v: string) => v !== value) };
      }
      return { ...prev, [key]: [...arr, value] };
    });
  };

  const handleSubmit = async () => {
    try {
      await saveProfile.mutateAsync({
        ...answers,
        rawResponses: answers,
      });
      toast.success("Profile saved successfully!");
      setIsEditing(false);
      setJustCompleted(true);
    } catch (error) {
      toast.error("Failed to save profile");
    }
  };
  
  const goToDashboard = () => {
    if (role === "CEO") {
      setLocation("/ceo/dashboard");
    } else {
      setLocation("/employee/home");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((existingProfile?.completedAt || justCompleted) && !isEditing) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4" data-testid="questionnaire-completed">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>{justCompleted ? "Welcome to Kronos!" : "Profile Complete"}</CardTitle>
            <CardDescription>
              {justCompleted 
                ? "Your profile has been saved. You're all set to start working on deals!"
                : "Your personality profile has been saved and will be used for optimal team matching."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Work Style</span>
                <span className="font-medium capitalize">{answers.workStyle || existingProfile?.workStyle}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Communication Style</span>
                <span className="font-medium capitalize">{answers.communicationStyle || existingProfile?.communicationStyle}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Experience Level</span>
                <span className="font-medium capitalize">{answers.experienceLevel || existingProfile?.experienceLevel}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Preferred Deal Types</span>
                <span className="font-medium">{(answers.preferredDealTypes?.length > 0 ? answers.preferredDealTypes : existingProfile?.preferredDealTypes)?.join(", ") || "Not set"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Key Strengths</span>
                <span className="font-medium">{(answers.strengths?.length > 0 ? answers.strengths : existingProfile?.strengths)?.slice(0, 3).join(", ") || "Not set"}</span>
              </div>
            </div>
            {justCompleted ? (
              <Button 
                onClick={goToDashboard}
                className="w-full"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  setCurrentStep(0);
                  setIsEditing(true);
                }} 
                variant="outline" 
                className="w-full"
                data-testid="button-update-profile"
              >
                <Pencil className="h-4 w-4 mr-2" /> Update Profile
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4" data-testid="questionnaire-form">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Personality & Work Profile</h1>
        <p className="text-muted-foreground">
          Complete this questionnaire to help us match you with optimal deal teams.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span className="text-muted-foreground">{STEPS[currentStep].title}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <div className="space-y-6" data-testid="step-work-style">
              <div className="space-y-3">
                <Label>How do you prefer to work?</Label>
                <RadioGroup 
                  value={answers.workStyle} 
                  onValueChange={(v) => updateAnswer("workStyle", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="independent" id="ws-independent" data-testid="radio-work-independent" />
                    <Label htmlFor="ws-independent" className="flex-1 cursor-pointer">
                      <div className="font-medium">Independent</div>
                      <div className="text-sm text-muted-foreground">I work best alone with clear objectives</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="collaborative" id="ws-collaborative" data-testid="radio-work-collaborative" />
                    <Label htmlFor="ws-collaborative" className="flex-1 cursor-pointer">
                      <div className="font-medium">Collaborative</div>
                      <div className="text-sm text-muted-foreground">I thrive when working closely with others</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="flexible" id="ws-flexible" data-testid="radio-work-flexible" />
                    <Label htmlFor="ws-flexible" className="flex-1 cursor-pointer">
                      <div className="font-medium">Flexible</div>
                      <div className="text-sm text-muted-foreground">I adapt my style based on the task</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6" data-testid="step-communication">
              <div className="space-y-3">
                <Label>What is your preferred communication style?</Label>
                <RadioGroup 
                  value={answers.communicationStyle} 
                  onValueChange={(v) => updateAnswer("communicationStyle", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="direct" id="cs-direct" data-testid="radio-comm-direct" />
                    <Label htmlFor="cs-direct" className="flex-1 cursor-pointer">
                      <div className="font-medium">Direct</div>
                      <div className="text-sm text-muted-foreground">Straightforward and to the point</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="diplomatic" id="cs-diplomatic" data-testid="radio-comm-diplomatic" />
                    <Label htmlFor="cs-diplomatic" className="flex-1 cursor-pointer">
                      <div className="font-medium">Diplomatic</div>
                      <div className="text-sm text-muted-foreground">Tactful and considerate of others</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="analytical" id="cs-analytical" data-testid="radio-comm-analytical" />
                    <Label htmlFor="cs-analytical" className="flex-1 cursor-pointer">
                      <div className="font-medium">Analytical</div>
                      <div className="text-sm text-muted-foreground">Data-driven with supporting evidence</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-decision-making">
              <div className="space-y-3">
                <Label>How do you approach risk?</Label>
                <RadioGroup 
                  value={answers.riskTolerance} 
                  onValueChange={(v) => updateAnswer("riskTolerance", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="conservative" id="rt-conservative" data-testid="radio-risk-conservative" />
                    <Label htmlFor="rt-conservative" className="flex-1 cursor-pointer">
                      <div className="font-medium">Conservative</div>
                      <div className="text-sm text-muted-foreground">Prefer proven approaches with minimal risk</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="moderate" id="rt-moderate" data-testid="radio-risk-moderate" />
                    <Label htmlFor="rt-moderate" className="flex-1 cursor-pointer">
                      <div className="font-medium">Moderate</div>
                      <div className="text-sm text-muted-foreground">Balanced approach to calculated risks</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="aggressive" id="rt-aggressive" data-testid="radio-risk-aggressive" />
                    <Label htmlFor="rt-aggressive" className="flex-1 cursor-pointer">
                      <div className="font-medium">Aggressive</div>
                      <div className="text-sm text-muted-foreground">Comfortable with higher risk for higher reward</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>How do you make decisions?</Label>
                <RadioGroup 
                  value={answers.decisionMaking} 
                  onValueChange={(v) => updateAnswer("decisionMaking", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="intuitive" id="dm-intuitive" data-testid="radio-decision-intuitive" />
                    <Label htmlFor="dm-intuitive" className="flex-1 cursor-pointer">
                      <div className="font-medium">Intuitive</div>
                      <div className="text-sm text-muted-foreground">Trust experience and gut feeling</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="analytical" id="dm-analytical" data-testid="radio-decision-analytical" />
                    <Label htmlFor="dm-analytical" className="flex-1 cursor-pointer">
                      <div className="font-medium">Analytical</div>
                      <div className="text-sm text-muted-foreground">Data-driven with thorough analysis</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="consensus" id="dm-consensus" data-testid="radio-decision-consensus" />
                    <Label htmlFor="dm-consensus" className="flex-1 cursor-pointer">
                      <div className="font-medium">Consensus-Based</div>
                      <div className="text-sm text-muted-foreground">Gather input before deciding</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-strengths">
              <div className="space-y-3">
                <Label>Select your key strengths (choose up to 4)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {STRENGTHS.map((strength) => (
                    <div
                      key={strength}
                      className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        answers.strengths?.includes(strength) ? "bg-primary/10 border-primary" : "hover:bg-accent"
                      }`}
                      onClick={() => {
                        if (answers.strengths?.length < 4 || answers.strengths?.includes(strength)) {
                          toggleArrayValue("strengths", strength);
                        }
                      }}
                    >
                      <Checkbox 
                        checked={answers.strengths?.includes(strength)} 
                        data-testid={`checkbox-strength-${strength.toLowerCase().replace(/[^a-z]/g, '-')}`}
                      />
                      <span className="text-sm">{strength}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>What is your experience level?</Label>
                <RadioGroup 
                  value={answers.experienceLevel} 
                  onValueChange={(v) => updateAnswer("experienceLevel", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="junior" id="exp-junior" data-testid="radio-exp-junior" />
                    <Label htmlFor="exp-junior" className="flex-1 cursor-pointer">
                      <div className="font-medium">Junior (0-2 years)</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="mid" id="exp-mid" data-testid="radio-exp-mid" />
                    <Label htmlFor="exp-mid" className="flex-1 cursor-pointer">
                      <div className="font-medium">Mid-Level (2-5 years)</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="senior" id="exp-senior" data-testid="radio-exp-senior" />
                    <Label htmlFor="exp-senior" className="flex-1 cursor-pointer">
                      <div className="font-medium">Senior (5+ years)</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6" data-testid="step-preferences">
              <div className="space-y-3">
                <Label>Preferred deal types (select all that apply)</Label>
                <div className="flex flex-wrap gap-2">
                  {DEAL_TYPES.map((type) => (
                    <div
                      key={type}
                      className={`px-4 py-2 border rounded-full cursor-pointer transition-colors ${
                        answers.preferredDealTypes?.includes(type) 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-accent"
                      }`}
                      onClick={() => toggleArrayValue("preferredDealTypes", type)}
                      data-testid={`chip-deal-type-${type.toLowerCase().replace(/[^a-z]/g, '-')}`}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Preferred sectors (select all that apply)</Label>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((sector) => (
                    <div
                      key={sector}
                      className={`px-4 py-2 border rounded-full cursor-pointer transition-colors ${
                        answers.preferredSectors?.includes(sector) 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-accent"
                      }`}
                      onClick={() => toggleArrayValue("preferredSectors", sector)}
                      data-testid={`chip-sector-${sector.toLowerCase().replace(/[^a-z]/g, '-')}`}
                    >
                      {sector}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6" data-testid="step-availability">
              <div className="space-y-3">
                <Label>What is your current availability?</Label>
                <RadioGroup 
                  value={answers.availability} 
                  onValueChange={(v) => updateAnswer("availability", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="full-time" id="av-full" data-testid="radio-avail-full" />
                    <Label htmlFor="av-full" className="flex-1 cursor-pointer">
                      <div className="font-medium">Full-Time</div>
                      <div className="text-sm text-muted-foreground">Available for any deal assignment</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="part-time" id="av-part" data-testid="radio-avail-part" />
                    <Label htmlFor="av-part" className="flex-1 cursor-pointer">
                      <div className="font-medium">Part-Time</div>
                      <div className="text-sm text-muted-foreground">Limited availability</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="on-leave" id="av-leave" data-testid="radio-avail-leave" />
                    <Label htmlFor="av-leave" className="flex-1 cursor-pointer">
                      <div className="font-medium">On Leave</div>
                      <div className="text-sm text-muted-foreground">Currently unavailable</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>What is your leadership style?</Label>
                <RadioGroup 
                  value={answers.leadershipStyle} 
                  onValueChange={(v) => updateAnswer("leadershipStyle", v)}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="hands-on" id="ls-hands" data-testid="radio-lead-hands" />
                    <Label htmlFor="ls-hands" className="flex-1 cursor-pointer">
                      <div className="font-medium">Hands-On</div>
                      <div className="text-sm text-muted-foreground">Actively involved in all details</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="delegating" id="ls-deleg" data-testid="radio-lead-delegating" />
                    <Label htmlFor="ls-deleg" className="flex-1 cursor-pointer">
                      <div className="font-medium">Delegating</div>
                      <div className="text-sm text-muted-foreground">Trust team to handle execution</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value="coaching" id="ls-coach" data-testid="radio-lead-coaching" />
                    <Label htmlFor="ls-coach" className="flex-1 cursor-pointer">
                      <div className="font-medium">Coaching</div>
                      <div className="text-sm text-muted-foreground">Focus on developing team members</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                data-testid="button-next"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={saveProfile.isPending}
                data-testid="button-submit"
              >
                {saveProfile.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Complete Profile"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
