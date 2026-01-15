import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useBackgroundSync() {
  const queryClient = useQueryClient();

  const registerSync = useCallback(async (tag: string = 'sync-data') => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(tag);
        console.log('[BackgroundSync] Registered sync:', tag);
      } catch (error) {
        console.log('[BackgroundSync] Sync registration failed:', error);
      }
    }
  }, []);

  const registerPeriodicSync = useCallback(async (tag: string = 'refresh-notifications', minInterval: number = 60 * 60 * 1000) => {
    if ('serviceWorker' in navigator && 'PeriodicSyncManager' in (window as any)) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
        
        if (status.state === 'granted') {
          await (registration as any).periodicSync.register(tag, { minInterval });
          console.log('[BackgroundSync] Registered periodic sync:', tag);
        } else {
          console.log('[BackgroundSync] Periodic sync permission denied');
        }
      } catch (error) {
        console.log('[BackgroundSync] Periodic sync registration failed:', error);
      }
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SYNC_COMPLETE') {
          console.log('[BackgroundSync] Sync complete, invalidating queries');
          queryClient.invalidateQueries();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [queryClient]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[BackgroundSync] Back online, triggering sync');
      registerSync('sync-data');
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [registerSync]);

  useEffect(() => {
    registerPeriodicSync('refresh-notifications', 60 * 60 * 1000);
  }, [registerPeriodicSync]);

  return { registerSync, registerPeriodicSync };
}
