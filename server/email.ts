// Resend email service integration
// Uses Replit Connectors for secure API key management

import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export interface MeetingInviteData {
  title: string;
  description?: string;
  scheduledFor: Date;
  location?: string;
  attendeeEmails: string[];
  organizerName: string;
  localDate?: string;
  localTime?: string;
  organizerTimezone?: string;
}

export async function sendMeetingInvite(data: MeetingInviteData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    let formattedDate: string;
    let formattedTime: string;
    
    // Use the original local date/time strings if provided (preserves organizer's intent)
    if (data.localDate && data.localTime) {
      // Parse the date string (YYYY-MM-DD format)
      const [year, month, day] = data.localDate.split('-').map(Number);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Create a date object to get the day of week
      const dateObj = new Date(year, month - 1, day);
      formattedDate = `${weekdays[dateObj.getDay()]}, ${months[month - 1]} ${day}, ${year}`;
      
      // Parse and format time (HH:MM format)
      const [hours, mins] = data.localTime.split(':').map(Number);
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      formattedTime = `${hour12}:${mins.toString().padStart(2, '0')} ${ampm}`;
      
      // Add timezone if available
      if (data.organizerTimezone) {
        formattedTime += ` (${data.organizerTimezone})`;
      }
    } else {
      // Fallback: format from UTC timestamp
      const meetingDate = new Date(data.scheduledFor);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      formattedDate = `${weekdays[meetingDate.getUTCDay()]}, ${months[meetingDate.getUTCMonth()]} ${meetingDate.getUTCDate()}, ${meetingDate.getUTCFullYear()}`;
      
      const hours = meetingDate.getUTCHours();
      const minutes = meetingDate.getUTCMinutes();
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      formattedTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm} UTC`;
    }
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .meeting-details { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .detail-row { display: flex; margin: 12px 0; }
            .detail-label { font-weight: 600; width: 100px; color: #666; }
            .detail-value { color: #1a1a2e; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .btn { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Meeting Invitation</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to a meeting</p>
            </div>
            <div class="content">
              <p>Hi,</p>
              <p><strong>${data.organizerName}</strong> has invited you to the following meeting:</p>
              
              <div class="meeting-details">
                <h2 style="margin: 0 0 15px 0; color: #1a1a2e;">${data.title}</h2>
                ${data.description ? `<p style="color: #666; margin-bottom: 20px;">${data.description}</p>` : ''}
                
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${formattedTime}</span>
                </div>
                ${data.location ? `
                <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${data.location}</span>
                </div>
                ` : ''}
              </div>
              
              <p>Please add this to your calendar and be prepared to join at the scheduled time.</p>
            </div>
            <div class="footer">
              <p>This invitation was sent via OSReaper</p>
              <p>Investment Banking Operations Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Meeting Invitation

You've been invited to a meeting by ${data.organizerName}.

Title: ${data.title}
${data.description ? `Description: ${data.description}` : ''}
Date: ${formattedDate}
Time: ${formattedTime}
${data.location ? `Location: ${data.location}` : ''}

Please add this to your calendar and be prepared to join at the scheduled time.

---
This invitation was sent via OSReaper
Investment Banking Operations Platform
    `.trim();

    const results = await Promise.all(
      data.attendeeEmails.map(email =>
        client.emails.send({
          from: fromEmail,
          to: email,
          subject: `Meeting Invitation: ${data.title}`,
          html: emailHtml,
          text: emailText,
        })
      )
    );

    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      console.error('Some emails failed to send:', failed);
      return { success: false, error: `Failed to send ${failed.length} of ${results.length} emails` };
    }

    console.log(`Successfully sent ${results.length} meeting invites for: ${data.title}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send meeting invite:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .message { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>OSReaper Notification</h1>
            </div>
            <div class="content">
              <div class="message">
                <p>${message}</p>
              </div>
            </div>
            <div class="footer">
              <p>OSReaper - Investment Banking Operations Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await client.emails.send({
      from: fromEmail,
      to,
      subject,
      html: emailHtml,
      text: message,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
