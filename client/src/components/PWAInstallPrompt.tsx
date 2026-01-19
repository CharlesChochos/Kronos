import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { promptInstall, canInstall, isStandalone, isMobile, isIOS } from '@/lib/pwa';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    const wasDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    const handleInstallReady = () => {
      if (isMobile()) {
        setShowPrompt(true);
      }
    };

    const handleInstalled = () => {
      setShowPrompt(false);
      setShowIOSInstructions(false);
    };

    if (canInstall() && isMobile()) {
      setShowPrompt(true);
    }

    window.addEventListener('pwainstallready', handleInstallReady);
    window.addEventListener('pwainstalled', handleInstalled);

    if (isIOS() && isMobile() && !isStandalone()) {
      setTimeout(() => {
        setShowIOSInstructions(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('pwainstallready', handleInstallReady);
      window.removeEventListener('pwainstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (dismissed || isStandalone()) {
    return null;
  }

  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Install Kronos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Tap the <span className="inline-flex items-center px-1 py-0.5 bg-muted rounded text-[10px]">Share</span> button, 
                then select <span className="font-medium">"Add to Home Screen"</span>
              </p>
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

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Download className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install Kronos App</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get quick access from your home screen with offline support
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleInstall} className="h-8">
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8">
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
