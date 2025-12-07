// Google Calendar Integration using Replit Connectors
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// List upcoming events from Google Calendar
export async function listGoogleCalendarEvents(maxResults: number = 50, timeMin?: Date, timeMax?: Date) {
  const calendar = await getGoogleCalendarClient();
  
  const params: any = {
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

// Create an event in Google Calendar
export async function createGoogleCalendarEvent(event: {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  addMeetLink?: boolean;
}) {
  const calendar = await getGoogleCalendarClient();
  
  const eventData: any = {
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
    resource: eventData,
    conferenceDataVersion: event.addMeetLink ? 1 : 0,
    sendUpdates: event.attendees?.length ? 'all' : 'none',
  });
  
  return response.data;
}

// Update an event in Google Calendar
export async function updateGoogleCalendarEvent(eventId: string, updates: {
  summary?: string;
  description?: string;
  location?: string;
  start?: Date;
  end?: Date;
}) {
  const calendar = await getGoogleCalendarClient();
  
  // First get the existing event
  const existing = await calendar.events.get({
    calendarId: 'primary',
    eventId,
  });
  
  const eventData = { ...existing.data };
  
  if (updates.summary) eventData.summary = updates.summary;
  if (updates.description) eventData.description = updates.description;
  if (updates.location) eventData.location = updates.location;
  if (updates.start) {
    eventData.start = {
      dateTime: updates.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.end) {
    eventData.end = {
      dateTime: updates.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    resource: eventData,
  });
  
  return response.data;
}

// Delete an event from Google Calendar
export async function deleteGoogleCalendarEvent(eventId: string) {
  const calendar = await getGoogleCalendarClient();
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

// Check if Google Calendar is connected
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}
