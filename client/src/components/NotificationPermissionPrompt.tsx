import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/api';

export function NotificationPermissionPrompt() {
  const { data: user } = useCurrentUser();
  const { toast } = useToast();
  const hasSubscribed = useRef(false);
  const hasAttempted = useRef(false);
  const listenerAttached = useRef(false);

  const subscribeToNotifications = useCallback(async () => {
    if (hasSubscribed.current) return;
    
    try {
      console.log('[Push] Fetching VAPID public key...');
      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      if (!publicKey) {
        console.error('[Push] No VAPID public key available');
        return;
      }

      console.log('[Push] Waiting for service worker...');
      const registration = await navigator.serviceWorker.ready;
      
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[Push] Already subscribed, checking server...');
        const statusResponse = await fetch('/api/push/status', { credentials: 'include' });
        if (statusResponse.ok) {
          const { subscribed } = await statusResponse.json();
          if (subscribed) {
            console.log('[Push] Already subscribed on server');
            hasSubscribed.current = true;
            return;
          }
        }
        const success = await sendSubscriptionToServer(existingSubscription);
        if (success) hasSubscribed.current = true;
        return;
      }

      console.log('[Push] Subscribing to push...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const success = await sendSubscriptionToServer(subscription);
      if (success) hasSubscribed.current = true;
    } catch (error) {
      console.error('[Push] Subscription error:', error);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (hasAttempted.current) return;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('[Push] Notifications not supported in this browser');
      hasAttempted.current = true;
      return;
    }

    if (Notification.permission === 'denied') {
      console.log('[Push] Notifications previously denied by user');
      hasAttempted.current = true;
      return;
    }

    if (Notification.permission === 'granted') {
      hasAttempted.current = true;
      await subscribeToNotifications();
      return;
    }

    console.log('[Push] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission result:', permission);

    if (permission === 'granted') {
      hasAttempted.current = true;
      await subscribeToNotifications();
      toast({
        title: 'Notifications Enabled',
        description: "You'll receive alerts for messages, tasks, and mentions.",
      });
    } else if (permission === 'denied') {
      hasAttempted.current = true;
    }
  }, [toast, subscribeToNotifications]);

  useEffect(() => {
    if (!user || hasAttempted.current) return;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    if (Notification.permission === 'granted') {
      subscribeToNotifications();
      return;
    }

    if (Notification.permission === 'denied') {
      return;
    }

    if (listenerAttached.current) return;
    listenerAttached.current = true;

    const handleUserInteraction = () => {
      requestNotificationPermission();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [user, requestNotificationPermission, subscribeToNotifications]);

  return null;
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  console.log('[Push] Sending subscription to server...');
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Push] Server subscription failed:', response.status, errorData);
      return false;
    }

    const result = await response.json();
    console.log('[Push] Server subscription result:', result);
    return true;
  } catch (error) {
    console.error('[Push] Server subscription error:', error);
    return false;
  }
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
