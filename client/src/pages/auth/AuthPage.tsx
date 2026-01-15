import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLogin, useSignup } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, CheckCircle, Shield, Clock, Fingerprint } from "lucide-react";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isBiometricAvailable, hasStoredCredential, authenticateWithBiometric, getStoredUserId } from "@/lib/webauthn";
import { hapticFeedback } from "@/hooks/use-haptic";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberMe: z.boolean().default(false),
});

const JOB_TITLE_OPTIONS = [
  "Junior Analyst",
  "Analyst", 
  "Associate",
  "Senior Associate",
  "VP",
  "Other"
] as const;

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  jobTitle: z.string().min(1, { message: "Please select your job title" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");
  const [redirectPath, setRedirectPath] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  
  useEffect(() => {
    const checkBiometric = async () => {
      const available = await isBiometricAvailable();
      const hasCredential = hasStoredCredential();
      setBiometricAvailable(available && hasCredential);
    };
    checkBiometric();
  }, []);
  
  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    hapticFeedback('medium');
    
    try {
      const result = await authenticateWithBiometric();
      
      if (result.success) {
        const response = await fetch('/api/auth/biometric-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const user = await response.json();
          hapticFeedback('success');
          
          const firstName = user?.name?.split(' ')[0] || 'User';
          setWelcomeName(firstName);
          
          if (user?.accessLevel === 'admin') {
            setRedirectPath("/ceo/dashboard");
          } else {
            setRedirectPath("/employee/home");
          }
          
          sessionStorage.setItem('welcomePending', 'true');
          setShowWelcome(true);
        } else {
          const data = await response.json();
          hapticFeedback('error');
          if (data.code === 'SESSION_EXPIRED') {
            toast.error("Session expired. Please login with your password.");
          } else {
            toast.error("Biometric login failed. Please use your password.");
          }
        }
      } else {
        if (result.error !== 'Authentication cancelled') {
          hapticFeedback('error');
          toast.error(result.error || "Biometric authentication failed");
        }
      }
    } catch (error) {
      hapticFeedback('error');
      toast.error("Biometric login failed. Please use your password.");
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setForgotPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setForgotPasswordSent(true);
      } else {
        toast.error(data.error || "Failed to send reset email");
      }
    } catch (error) {
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const closeForgotPasswordDialog = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setForgotPasswordSent(false);
  };

  const handleTwoFactorVerify = async () => {
    if (twoFactorCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    
    setTwoFactorLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: twoFactorEmail, code: twoFactorCode }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.id) {
        const firstName = data.name?.split(' ')[0] || twoFactorEmail.split('@')[0];
        setWelcomeName(firstName);
        
        if (data.accessLevel === 'admin') {
          setRedirectPath("/ceo/dashboard");
        } else {
          setRedirectPath("/employee/home");
        }
        
        sessionStorage.setItem('welcomePending', 'true');
        setShowTwoFactor(false);
        setShowWelcome(true);
      } else {
        toast.error(data.error || "Invalid verification code");
        setTwoFactorCode("");
      }
    } catch (error) {
      toast.error("Failed to verify code. Please try again.");
      setTwoFactorCode("");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      jobTitle: "",
    },
  });

  useEffect(() => {
    if (showWelcome && redirectPath) {
      const timer = setTimeout(() => {
        sessionStorage.removeItem('welcomePending');
        setLocation(redirectPath);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [showWelcome, redirectPath, setLocation]);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    try {
      const user = await loginMutation.mutateAsync({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });
      
      if (user?.requiresTwoFactor) {
        setTwoFactorEmail(user.email);
        setShowTwoFactor(true);
        return;
      }
      
      const firstName = user?.name?.split(' ')[0] || values.email.split('@')[0];
      setWelcomeName(firstName);
      
      if (user?.accessLevel === 'admin') {
        setRedirectPath("/ceo/dashboard");
      } else {
        setRedirectPath("/employee/home");
      }
      
      sessionStorage.setItem('welcomePending', 'true');
      setShowWelcome(true);
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    }
  }

  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    try {
      const { confirmPassword, ...signupData } = values;
      const result = await signupMutation.mutateAsync(signupData);
      
      if (result?.pending) {
        setShowPendingApproval(true);
        return;
      }
      
      const firstName = (values.name || "").split(' ')[0] || "User";
      setWelcomeName(firstName);
      
      if (result?.accessLevel === 'admin') {
        setRedirectPath("/ceo/dashboard");
      } else {
        setRedirectPath("/employee/home");
      }
      
      sessionStorage.setItem('welcomePending', 'true');
      setShowWelcome(true);
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20"></div>
      
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-background to-background pointer-events-none"></div>
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: 0.1
              }}
              className="relative z-10"
            >
              <motion.div 
                className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center p-4 shadow-2xl shadow-primary/30 ring-2 ring-white/10"
                animate={{ 
                  boxShadow: [
                    "0 0 0 0 rgba(59, 130, 246, 0.4)",
                    "0 0 0 20px rgba(59, 130, 246, 0)",
                    "0 0 0 0 rgba(59, 130, 246, 0)"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
              >
                <motion.img 
                  src={logo} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-8 text-center relative z-10"
            >
              <motion.h1 
                className="text-3xl font-display font-bold tracking-tight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Welcome back, {welcomeName}!
              </motion.h1>
              <motion.p 
                className="text-muted-foreground mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                Preparing your dashboard...
              </motion.p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 relative z-10"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ 
                      y: [0, -8, 0],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center p-3 shadow-inner shadow-primary/10 ring-1 ring-white/10">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display font-bold tracking-tight">Kronos</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Enterprise Investment Banking Platform
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="name@equiturn.com" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50" 
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                            <FormLabel>Password</FormLabel>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs text-primary hover:underline" 
                              type="button"
                              onClick={() => setShowForgotPassword(true)}
                              data-testid="button-forgot-password"
                            >
                              Forgot password?
                            </Button>
                        </div>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50"
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 border border-border/50 bg-secondary/20">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Stay connected
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 shadow-lg shadow-primary/20 mt-2" 
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "Authenticating..." : "Sign In"}
                  </Button>
                  
                  {biometricAvailable && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 gap-2"
                        onClick={handleBiometricLogin}
                        disabled={biometricLoading}
                        data-testid="button-biometric-login"
                      >
                        <Fingerprint className="w-5 h-5" />
                        {biometricLoading ? "Authenticating..." : "Use Face ID / Fingerprint"}
                      </Button>
                    </>
                  )}
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Doe" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50" 
                            data-testid="input-fullname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="name@equiturn.com" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50" 
                            data-testid="input-email-signup"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50"
                            data-testid="input-password-signup"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            {...field} 
                            className="bg-secondary/50 border-border focus:ring-primary/50"
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger 
                              className="bg-secondary/50 border-border focus:ring-primary/50"
                              data-testid="select-job-title"
                            >
                              <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {JOB_TITLE_OPTIONS.map((title) => (
                              <SelectItem 
                                key={title} 
                                value={title}
                                data-testid={`option-job-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 shadow-lg shadow-primary/20 mt-2" 
                    disabled={signupMutation.isPending}
                    data-testid="button-signup"
                  >
                    {signupMutation.isPending ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center space-y-2 pt-4 pb-8 border-t border-border/50">
           <div className="flex gap-4 text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-4">
             <span>Secure</span>
             <span>•</span>
             <span>Compliant</span>
             <span>•</span>
             <span>Enterprise-Grade</span>
           </div>
        </CardFooter>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={closeForgotPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {forgotPasswordSent ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Check Your Email
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Reset Password
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {forgotPasswordSent 
                ? "If an account exists with this email, you will receive a password reset link shortly."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </DialogDescription>
          </DialogHeader>
          
          {!forgotPasswordSent ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@equiturn.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="bg-secondary/50 border-border"
                  data-testid="input-forgot-email"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={closeForgotPasswordDialog}
                  data-testid="button-cancel-forgot"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  data-testid="button-send-reset"
                >
                  {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <Button 
                className="w-full" 
                onClick={closeForgotPasswordDialog}
                data-testid="button-close-forgot"
              >
                Back to Login
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showTwoFactor} onOpenChange={(open) => !open && setShowTwoFactor(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to continue.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <InputOTP 
                maxLength={6} 
                value={twoFactorCode} 
                onChange={setTwoFactorCode}
                data-testid="input-2fa-code"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowTwoFactor(false);
                  setTwoFactorCode("");
                }}
                data-testid="button-cancel-2fa"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleTwoFactorVerify}
                disabled={twoFactorLoading || twoFactorCode.length !== 6}
                data-testid="button-verify-2fa"
              >
                {twoFactorLoading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingApproval} onOpenChange={setShowPendingApproval}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Account Pending Approval
            </DialogTitle>
            <DialogDescription>
              Your account has been created successfully!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Your account is pending approval from an administrator. You'll be able to sign in once your access has been approved.
              </p>
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => {
                setShowPendingApproval(false);
                setActiveTab("login");
                signupForm.reset();
              }}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
