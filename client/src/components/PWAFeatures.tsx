import { useEffect } from 'react';
import { useAppBadge } from '@/hooks/use-app-badge';
import { useBackgroundSync } from '@/hooks/use-background-sync';

export function PWAFeatures() {
  useAppBadge();
  useBackgroundSync();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        console.log('[PWA] Service worker ready, features initialized');
      });
    }
  }, []);

  return null;
}
