import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import logo from "@assets/generated_images/abstract_minimalist_layer_icon_for_fintech_logo.png";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const token = new URLSearchParams(searchString).get('token');
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-reset-token?token=${token}`);
        const data = await response.json();
        setIsValidToken(data.valid);
      } catch (error) {
        setIsValidToken(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast.success("Password reset successfully!");
      } else {
        toast.error(data.error || "Failed to reset password");
      }
    } catch (error) {
      toast.error("Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-border/50 shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-border/50 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-xl">Invalid or Expired Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation('/auth')}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-border/50 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-xl">Password Reset Complete</CardTitle>
            <CardDescription>
              Your password has been reset successfully. You can now log in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation('/auth')}
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-border/50 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={logo} 
              alt="OSReaper Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              Reset Your Password
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">
              New Password
            </label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary/50 border-border"
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary/50 border-border"
              data-testid="input-confirm-new-password"
            />
          </div>
          <Button 
            className="w-full" 
            onClick={handleResetPassword}
            disabled={isLoading}
            data-testid="button-reset-password"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
