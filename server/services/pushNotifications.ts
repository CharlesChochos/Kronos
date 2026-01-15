import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@kronos.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  actions?: { action: string; title: string }[];
}

export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not configured, skipping notification');
    return { success: false, sent: 0, failed: 0 };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    console.log(`[Push] No subscriptions found for user ${userId}`);
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
    tag: payload.tag,
    actions: payload.actions || []
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        notificationPayload
      );
      sent++;
    } catch (error: any) {
      console.error(`[Push] Failed to send to subscription ${sub.id}:`, error.message);
      failed++;
      
      if (error.statusCode === 404 || error.statusCode === 410) {
        console.log(`[Push] Removing expired subscription ${sub.id}`);
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return { success: true, sent, failed };
}

export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { success: true, totalSent, totalFailed };
}

export async function notifyNewMessage(
  recipientUserId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  await sendPushNotification(recipientUserId, {
    title: `New message from ${senderName}`,
    body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
    url: `/employee/chat?conversation=${conversationId}`,
    tag: `message-${conversationId}`,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
}

export async function notifyMention(
  recipientUserId: string,
  mentionerName: string,
  context: string,
  url: string
): Promise<void> {
  await sendPushNotification(recipientUserId, {
    title: `${mentionerName} mentioned you`,
    body: context,
    url,
    tag: 'mention',
    actions: [
      { action: 'view', title: 'View' }
    ]
  });
}

export async function notifyTaskAssignment(
  recipientUserId: string,
  assignerName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  await sendPushNotification(recipientUserId, {
    title: 'New Task Assigned',
    body: `${assignerName} assigned you: ${taskTitle}`,
    url: `/employee/tasks`,
    tag: `task-${taskId}`,
    actions: [
      { action: 'view', title: 'View Task' }
    ]
  });
}

export async function notifyDealAssignment(
  recipientUserId: string,
  assignerName: string,
  dealName: string,
  dealId: string
): Promise<void> {
  await sendPushNotification(recipientUserId, {
    title: 'Added to Deal Team',
    body: `${assignerName} added you to the deal: ${dealName}`,
    url: `/employee/deals?deal=${dealId}`,
    tag: `deal-${dealId}`,
    actions: [
      { action: 'view', title: 'View Deal' }
    ]
  });
}

export async function notifyDealUpdate(
  recipientUserId: string,
  dealName: string,
  updateType: string,
  dealId: string
): Promise<void> {
  await sendPushNotification(recipientUserId, {
    title: `Deal Update: ${dealName}`,
    body: updateType,
    url: `/employee/deals?deal=${dealId}`,
    tag: `deal-update-${dealId}`
  });
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
