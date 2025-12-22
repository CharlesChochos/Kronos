import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  Users, 
  FileText, 
  Brain, 
  ArrowRight, 
  ArrowLeft,
  Rocket,
  CheckCircle2
} from "lucide-react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const steps = [
  {
    icon: Rocket,
    title: "Welcome to Kronos",
    description: "Your intelligent M&A deal management platform. We're excited to have you on board!",
    details: [
      "Streamlined deal pipeline management",
      "AI-powered team formation and task assignment",
      "Real-time collaboration and document handling"
    ]
  },
  {
    icon: Users,
    title: "Join Your Team",
    description: "Kronos automatically matches you with optimal deal teams based on your skills, experience, and personality.",
    details: [
      "AI analyzes your resume to understand your strengths",
      "Personality assessment helps optimize team chemistry",
      "Smart workload balancing across deals"
    ]
  },
  {
    icon: Briefcase,
    title: "Manage Deals",
    description: "Track deals through every stage from origination to close, with full visibility into tasks, milestones, and deadlines.",
    details: [
      "Visual deal pipeline with stage tracking",
      "Automated task creation and assignment",
      "Investor matching and CRM integration"
    ]
  },
  {
    icon: Brain,
    title: "Complete Your Onboarding",
    description: "To get the most out of Kronos, complete your profile by uploading your resume and taking a quick personality assessment.",
    details: [
      "Upload your resume for AI analysis",
      "Complete the personality assessment",
      "Get matched to deals that fit your profile"
    ],
    isOnboardingStep: true
  }
];

export function WelcomeModal({ isOpen, onClose, userName }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  
  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleSkip = () => {
    onClose();
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-[520px] p-0 overflow-hidden"
        data-testid="welcome-modal"
      >
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-2xl font-semibold mb-2" data-testid="welcome-step-title">
              {currentStep === 0 && userName 
                ? `Welcome to Kronos, ${userName}!`
                : step.title
              }
            </h2>
            
            <p className="text-muted-foreground mb-6" data-testid="welcome-step-description">
              {step.description}
            </p>
            
            <div className="w-full space-y-3 text-left">
              {step.details.map((detail, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{detail}</span>
                </div>
              ))}
            </div>
            
            {step.isOnboardingStep && (
              <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 w-full">
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Your profile is not yet complete. Complete onboarding to get matched to deals!
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`welcome-step-indicator-${index}`}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button 
                  variant="outline" 
                  onClick={handleBack}
                  data-testid="welcome-back-button"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              {!isLastStep && (
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  data-testid="welcome-skip-button"
                >
                  Skip
                </Button>
              )}
              
              <Button 
                onClick={handleNext}
                data-testid="welcome-next-button"
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Rocket className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
