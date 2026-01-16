import { useEffect } from 'react';
import { useAppBadge } from '@/hooks/use-app-badge';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { applyUpdate } from '@/lib/pwa';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export function PWAFeatures() {
  useAppBadge();
  useBackgroundSync();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        console.log('[PWA] Service worker ready, features initialized');
      });
    }

    const handleUpdateAvailable = () => {
      toast('Update Available', {
        description: 'A new version of Kronos is ready. Tap to refresh.',
        duration: Infinity,
        icon: <RefreshCw className="w-4 h-4 text-blue-500" />,
        action: {
          label: 'Update Now',
          onClick: () => applyUpdate()
        },
        closeButton: true,
      });
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  return null;
}
