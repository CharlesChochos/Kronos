// Google Calendar Integration with Per-User OAuth
import { google, Auth, calendar_v3 } from 'googleapis';
import { storage } from './storage';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getRedirectUri(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `${process.env.REPLIT_DEPLOYMENT_URL}/api/google-calendar/callback`;
  }
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
