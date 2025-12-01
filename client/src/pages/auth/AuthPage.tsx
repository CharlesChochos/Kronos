import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLogin, useSignup } from "@/lib/api";
import { toast } from "sonner";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberMe: z.boolean().default(false),
});

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  role: z.string().default("Associate"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");
  const loginMutation = useLogin();
  const signupMutation = useSignup();

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
      role: "Associate",
    },
  });

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    try {
      const user = await loginMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });
      
      toast.success("Welcome back!");
      
      // Route based on email pattern
      if (values.email.includes("admin") || values.email.includes("josh")) {
        setLocation("/ceo/dashboard");
      } else {
        setLocation("/employee/tasks");
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    }
  }

  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    try {
      const { confirmPassword, ...signupData } = values;
      const user = await signupMutation.mutateAsync(signupData);
      
      toast.success("Account created successfully!");
      
      // Default to employee view for new signups
      setLocation("/employee/tasks");
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20"></div>
      
      <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center p-3 shadow-inner shadow-primary/10 ring-1 ring-white/10">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display font-bold tracking-tight">OSReaper</CardTitle>
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
                            <Button variant="link" className="p-0 h-auto text-xs text-primary hover:underline" type="button">
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
    </div>
  );
}
