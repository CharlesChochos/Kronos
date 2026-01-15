import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

export function useAppBadge() {
  const { data: notifications } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n: any) => !n.read)?.length || 0;

  const setBadge = useCallback(async (count: number) => {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.log('[Badge] Unable to set app badge:', error);
      }
    }
  }, []);

  const clearBadge = useCallback(async () => {
    if ('clearAppBadge' in navigator) {
      try {
        await (navigator as any).clearAppBadge();
      } catch (error) {
        console.log('[Badge] Unable to clear app badge:', error);
      }
    }
  }, []);

  useEffect(() => {
    setBadge(unreadCount);
  }, [unreadCount, setBadge]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setBadge(unreadCount);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [unreadCount, setBadge]);

  return { unreadCount, setBadge, clearBadge };
}
