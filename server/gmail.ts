// Gmail integration for email scanning and deal extraction
// Using connection:conn_google-mail_01KC9QQFKBJTX5TG2CGSFSZ021

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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

export async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export type GmailLabel = {
  id: string;
  name: string;
  type: string;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: {
      mimeType: string;
      body?: { data?: string };
      parts?: any[];
    }[];
    body?: { data?: string };
    mimeType?: string;
  };
  internalDate: string;
};

export type ParsedEmail = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  snippet: string;
  attachments: { filename: string; mimeType: string; size: number }[];
};

export async function listLabels(): Promise<GmailLabel[]> {
  try {
    const gmail = await getUncachableGmailClient();
    const response = await gmail.users.labels.list({
      userId: 'me',
    });
    return (response.data.labels || []).map(label => ({
      id: label.id || '',
      name: label.name || '',
      type: label.type || 'user',
    }));
  } catch (error) {
    console.error('Error listing Gmail labels:', error);
    throw error;
  }
}

export async function getLabelByName(labelName: string): Promise<GmailLabel | null> {
  const labels = await listLabels();
  return labels.find(l => l.name.toLowerCase() === labelName.toLowerCase()) || null;
}

export async function listEmailsInLabel(labelId: string, maxResults: number = 50): Promise<{ id: string; threadId: string }[]> {
  try {
    const gmail = await getUncachableGmailClient();
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults,
    });
    return (response.data.messages || []).map(msg => ({
      id: msg.id || '',
      threadId: msg.threadId || '',
    }));
  } catch (error) {
    console.error('Error listing emails:', error);
    throw error;
  }
}

export async function getEmailById(messageId: string): Promise<GmailMessage | null> {
  try {
    const gmail = await getUncachableGmailClient();
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return response.data as GmailMessage;
  } catch (error) {
    console.error('Error getting email:', error);
    return null;
  }
}

export async function getThreadMessages(threadId: string): Promise<GmailMessage[]> {
  try {
    const gmail = await getUncachableGmailClient();
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });
    return (response.data.messages || []) as GmailMessage[];
  } catch (error) {
    console.error('Error getting thread:', error);
    return [];
  }
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractEmailBody(payload: GmailMessage['payload']): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith('multipart/') && part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            return decodeBase64Url(subpart.body.data);
          }
        }
      }
    }
  }
  
  return '';
}

function extractAttachments(payload: GmailMessage['payload']): { filename: string; mimeType: string; size: number }[] {
  const attachments: { filename: string; mimeType: string; size: number }[] = [];
  
  function scanParts(parts: any[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body?.size || 0,
        });
      }
      if (part.parts) {
        scanParts(part.parts);
      }
    }
  }
  
  scanParts(payload.parts);
  return attachments;
}

export function parseEmail(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers;
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: new Date(parseInt(message.internalDate)),
    body: extractEmailBody(message.payload),
    snippet: message.snippet,
    attachments: extractAttachments(message.payload),
  };
}

export async function scanDealFolder(folderName: string = 'Deals'): Promise<ParsedEmail[]> {
  const label = await getLabelByName(folderName);
  if (!label) {
    console.log(`Label "${folderName}" not found`);
    return [];
  }
  
  const messageIds = await listEmailsInLabel(label.id);
  const emails: ParsedEmail[] = [];
  
  for (const { id } of messageIds) {
    const message = await getEmailById(id);
    if (message) {
      emails.push(parseEmail(message));
    }
  }
  
  return emails;
}

export async function getThreadEmails(threadId: string): Promise<ParsedEmail[]> {
  const messages = await getThreadMessages(threadId);
  return messages.map(parseEmail);
}

export async function addLabelToMessage(messageId: string, labelId: string): Promise<void> {
  try {
    const gmail = await getUncachableGmailClient();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  } catch (error) {
    console.error('Error adding label:', error);
    throw error;
  }
}

export async function removeLabelFromMessage(messageId: string, labelId: string): Promise<void> {
  try {
    const gmail = await getUncachableGmailClient();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: [labelId],
      },
    });
  } catch (error) {
    console.error('Error removing label:', error);
    throw error;
  }
}
