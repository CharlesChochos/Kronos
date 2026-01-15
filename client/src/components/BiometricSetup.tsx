import { useState, useEffect } from 'react';
import { Fingerprint, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { hapticFeedback } from '@/hooks/use-haptic';
import {
  isBiometricAvailable,
  hasStoredCredential,
  registerBiometric,
  removeStoredCredential,
} from '@/lib/webauthn';

interface BiometricSetupProps {
  userId: string;
  userName: string;
}

export function BiometricSetup({ userId, userName }: BiometricSetupProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    const available = await isBiometricAvailable();
    setIsAvailable(available);
    setIsEnabled(hasStoredCredential());
  };

  const handleEnable = async () => {
    setIsLoading(true);
    hapticFeedback('medium');
    
    try {
      const result = await registerBiometric(userId, userName);
      
      if (result.success) {
        setIsEnabled(true);
        hapticFeedback('success');
        toast({
          title: 'Biometric Login Enabled',
          description: 'You can now use Face ID or fingerprint to log in.',
        });
      } else {
        hapticFeedback('error');
        toast({
          title: 'Setup Failed',
          description: result.error || 'Unable to set up biometric login.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      hapticFeedback('error');
      toast({
        title: 'Setup Failed',
        description: 'An error occurred while setting up biometric login.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = () => {
    hapticFeedback('medium');
    removeStoredCredential();
    setIsEnabled(false);
    toast({
      title: 'Biometric Login Disabled',
      description: 'You will need to use your password to log in.',
    });
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <Card data-testid="card-biometric-setup">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="w-5 h-5" />
          Biometric Login
        </CardTitle>
        <CardDescription>
          Use Face ID or fingerprint for faster, more secure access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEnabled ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not set up</span>
              </>
            )}
          </div>
          
          {isEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisable}
              data-testid="button-disable-biometric"
            >
              Disable
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={isLoading}
              data-testid="button-enable-biometric"
            >
              {isLoading ? 'Setting up...' : 'Enable'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
