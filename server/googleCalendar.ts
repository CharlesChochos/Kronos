// Google Calendar Integration with Per-User OAuth
import { google, Auth, calendar_v3 } from 'googleapis';
import { storage } from './storage';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getRedirectUri(): string {
  // In production, use the configured production URL
  if (process.env.PRODUCTION_URL) {
    return `${process.env.PRODUCTION_URL}/api/google-calendar/callback`;
  }
  // Fallback to Replit deployment URL if available
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `${process.env.REPLIT_DEPLOYMENT_URL}/api/google-calendar/callback`;
  }
  // In development, use the dev domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/google-calendar/callback`;
  }
  return 'http://localhost:5000/api/google-calendar/callback';
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

// Session-based OAuth state storage (in-memory for simplicity)
const pendingOAuthStates = new Map<string, { userId: string; expiresAt: number }>();

export function isGoogleOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function getOAuth2Client(): Auth.OAuth2Client {
  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getAuthUrl(userId: string): { url: string; state: string } {
  const oauth2Client = getOAuth2Client();
  
  // Generate a secure random state token
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store the state with the userId for validation on callback
  pendingOAuthStates.set(state, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
  });
  
  // Clean up expired states
  for (const [key, value] of pendingOAuthStates.entries()) {
    if (value.expiresAt < Date.now()) {
      pendingOAuthStates.delete(key);
    }
  }
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
  
  return { url, state };
}

export function validateOAuthState(state: string, authenticatedUserId: string): boolean {
  const pending = pendingOAuthStates.get(state);
  if (!pending) {
    return false;
  }
  
  // Check if expired
  if (pending.expiresAt < Date.now()) {
    pendingOAuthStates.delete(state);
    return false;
  }
  
  // Validate that the state belongs to the authenticated user
  if (pending.userId !== authenticatedUserId) {
    return false;
  }
  
  // State is valid, remove it (single use)
  pendingOAuthStates.delete(state);
  return true;
}

export async function handleOAuthCallback(code: string, userId: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  await storage.saveGoogleCalendarToken({
    userId,
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: tokens.scope || SCOPES.join(' '),
    tokenType: tokens.token_type || 'Bearer',
  });
}

async function getAuthenticatedClient(userId: string): Promise<calendar_v3.Calendar | null> {
  const tokenRecord = await storage.getGoogleCalendarToken(userId);
  if (!tokenRecord) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken || undefined,
    expiry_date: tokenRecord.expiresAt ? tokenRecord.expiresAt.getTime() : undefined,
  });

  // Check if token is expired or will expire soon (within 5 minutes)
  const tokenExpiresSoon = tokenRecord.expiresAt && 
    (tokenRecord.expiresAt.getTime() - 5 * 60 * 1000) < Date.now();

  if (tokenExpiresSoon) {
    if (tokenRecord.refreshToken) {
      try {
        // Use getAccessToken which handles refresh automatically
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Save the new tokens
        await storage.saveGoogleCalendarToken({
          userId,
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || tokenRecord.refreshToken,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
          scope: credentials.scope || tokenRecord.scope || undefined,
          tokenType: credentials.token_type || 'Bearer',
        });
        
        oauth2Client.setCredentials(credentials);
      } catch (error: any) {
        console.error('Failed to refresh Google Calendar token:', error.message);
        // Token refresh failed - user needs to re-authenticate
        await storage.deleteGoogleCalendarToken(userId);
        return null;
      }
    } else {
      // No refresh token available - user needs to re-authenticate
      console.log('No refresh token available for user:', userId);
      await storage.deleteGoogleCalendarToken(userId);
      return null;
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function isUserConnected(userId: string): Promise<boolean> {
  const token = await storage.getGoogleCalendarToken(userId);
  return !!token;
}

export async function disconnectUser(userId: string): Promise<void> {
  await storage.deleteGoogleCalendarToken(userId);
}

export async function listUserCalendarEvents(
  userId: string,
  maxResults: number = 50,
  timeMin?: Date,
  timeMax?: Date
) {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: 'primary',
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };

  if (timeMin) {
    params.timeMin = timeMin.toISOString();
  } else {
    params.timeMin = new Date().toISOString();
  }

  if (timeMax) {
    params.timeMax = timeMax.toISOString();
  }

  const response = await calendar.events.list(params);
  return response.data.items || [];
}

export async function createUserCalendarEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    addMeetLink?: boolean;
  }
) {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  const eventData: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  if (event.attendees && event.attendees.length > 0) {
    eventData.attendees = event.attendees.map(email => ({ email }));
  }

  if (event.addMeetLink) {
    eventData.conferenceData = {
      createRequest: {
        requestId: `kronos-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventData,
    conferenceDataVersion: event.addMeetLink ? 1 : 0,
    sendUpdates: event.attendees?.length ? 'all' : 'none',
  });

  return response.data;
}

export async function deleteUserCalendarEvent(userId: string, eventId: string): Promise<void> {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

export async function updateUserCalendarEvent(
  userId: string,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    location?: string;
    start?: Date;
    end?: Date;
    attendees?: string[];
  }
) {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  const eventData: calendar_v3.Schema$Event = {};

  if (event.summary !== undefined) eventData.summary = event.summary;
  if (event.description !== undefined) eventData.description = event.description;
  if (event.location !== undefined) eventData.location = event.location;
  
  if (event.start) {
    eventData.start = {
      dateTime: event.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  
  if (event.end) {
    eventData.end = {
      dateTime: event.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  if (event.attendees && event.attendees.length > 0) {
    eventData.attendees = event.attendees.map(email => ({ email }));
  }

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: eventData,
    sendUpdates: event.attendees?.length ? 'all' : 'none',
  });

  return response.data;
}

// Sync platform calendar event to Google Calendar
export async function syncEventToGoogle(
  userId: string,
  platformEvent: {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    date: string;
    time?: string | null;
    isAllDay?: boolean | null;
    participants?: string[] | null;
    googleCalendarEventId?: string | null;
  }
): Promise<{ googleEventId: string; action: 'created' | 'updated' }> {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  // Build start and end times
  let startDateTime: Date;
  let endDateTime: Date;
  
  if (platformEvent.time) {
    const [hours, minutes] = platformEvent.time.split(':').map(Number);
    startDateTime = new Date(platformEvent.date);
    startDateTime.setHours(hours, minutes, 0, 0);
    endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1); // Default 1 hour duration
  } else {
    startDateTime = new Date(platformEvent.date);
    startDateTime.setHours(9, 0, 0, 0);
    endDateTime = new Date(startDateTime);
    endDateTime.setHours(10, 0, 0, 0);
  }

  const eventData: calendar_v3.Schema$Event = {
    summary: platformEvent.title,
    description: platformEvent.description || undefined,
    location: platformEvent.location || undefined,
    start: platformEvent.isAllDay ? {
      date: platformEvent.date,
    } : {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: platformEvent.isAllDay ? {
      date: platformEvent.date,
    } : {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    extendedProperties: {
      private: {
        kronosPlatformEventId: platformEvent.id,
      }
    }
  };

  if (platformEvent.participants && platformEvent.participants.length > 0) {
    // Filter for email-like participants
    const emailParticipants = platformEvent.participants.filter(p => p.includes('@'));
    if (emailParticipants.length > 0) {
      eventData.attendees = emailParticipants.map(email => ({ email }));
    }
  }

  // Check if we should update or create
  if (platformEvent.googleCalendarEventId) {
    try {
      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId: platformEvent.googleCalendarEventId,
        requestBody: eventData,
        sendUpdates: 'none',
      });
      return { googleEventId: response.data.id!, action: 'updated' };
    } catch (error: any) {
      // If event doesn't exist in Google, create a new one
      if (error.code === 404 || error.code === 410) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData,
        });
        return { googleEventId: response.data.id!, action: 'created' };
      }
      throw error;
    }
  } else {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData,
    });
    return { googleEventId: response.data.id!, action: 'created' };
  }
}

// Sync events from Google Calendar back to the platform
export async function syncEventsFromGoogle(
  userId: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getAuthenticatedClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected');
  }

  const now = new Date();
  const defaultTimeMin = timeMin || new Date(now.getFullYear(), now.getMonth(), 1); // First of current month
  const defaultTimeMax = timeMax || new Date(now.getFullYear(), now.getMonth() + 3, 0); // End of 3 months from now

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: defaultTimeMin.toISOString(),
    timeMax: defaultTimeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });

  return response.data.items || [];
}
