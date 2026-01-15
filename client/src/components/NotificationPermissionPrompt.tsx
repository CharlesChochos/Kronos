import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isMobile, isStandalone } from '@/lib/pwa';
import { apiRequest } from '@/lib/queryClient';

export function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    if (Notification.permission === 'granted') {
      return;
    }

    if (Notification.permission === 'denied') {
      return;
    }

    const wasDismissed = localStorage.getItem('notification-prompt-dismissed');
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 14) {
        return;
      }
    }

    setTimeout(() => {
      setShowPrompt(true);
    }, 5000);
  };

  const handleEnable = async () => {
    setIsSubscribing(true);
    
    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: 'Notifications Blocked',
          description: 'You can enable notifications in your browser settings.',
          variant: 'destructive'
        });
        setShowPrompt(false);
        return;
      }

      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      if (!publicKey) {
        console.error('[Push] No VAPID public key available');
        setShowPrompt(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON() }),
        headers: { 'Content-Type': 'application/json' }
      });

      toast({
        title: 'Notifications Enabled',
        description: "You'll receive alerts for messages, tasks, and assignments.",
      });

      setShowPrompt(false);
    } catch (error) {
      console.error('[Push] Subscription error:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable notifications. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Enable Notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get instant alerts when you receive messages, are assigned tasks, or mentioned by colleagues.
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleEnable} 
                disabled={isSubscribing}
                className="h-8"
                data-testid="button-enable-notifications"
              >
                {isSubscribing ? 'Enabling...' : 'Enable'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleDismiss}
                className="h-8"
                data-testid="button-dismiss-notifications"
              >
                Not now
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
