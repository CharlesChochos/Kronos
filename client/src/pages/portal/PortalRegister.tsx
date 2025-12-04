import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { usePortalInviteByToken, usePortalRegister } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Shield, FileText, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PortalRegister() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { data: invite, isLoading, error } = usePortalInviteByToken(token || null);
  const registerMutation = usePortalRegister();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    try {
      await registerMutation.mutateAsync({ token: token!, password, phone: phone || undefined });
      toast.success("Account created successfully!");
      setLocation("/portal");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }
  
  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-card/95 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid, has expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => setLocation("/portal/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const expiresAt = new Date(invite.expiresAt);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Kronos</h1>
          <p className="text-slate-400">Client Portal</p>
        </div>
        
        <Card className="bg-card/95 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Complete Your Registration</CardTitle>
            <CardDescription>
              {invite.inviterName} has invited you to access the client portal
              {invite.organization && ` for ${invite.organization}`}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{invite.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{invite.name}</span>
              </div>
              {invite.organization && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-medium">{invite.organization}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Access Level:</span>
                <Badge variant="secondary" className="capitalize">{invite.accessLevel}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-medium">{format(expiresAt, "MMM d, yyyy")}</span>
              </div>
            </div>
            
            {invite.dealNames.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">You'll have access to:</p>
                <div className="space-y-1">
                  {invite.dealNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
                <span className="text-xs text-muted-foreground">Documents</span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
                <span className="text-xs text-muted-foreground">Messages</span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
                <span className="text-xs text-muted-foreground">Secure</span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-phone"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
            
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <a href="/portal/login" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
