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
  videoLink?: string;
  videoPlatform?: string;
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
                ${data.videoLink ? `
                <div class="detail-row">
                  <span class="detail-label">Video:</span>
                  <span class="detail-value">
                    <a href="${data.videoLink}" style="color: #1a1a2e;">${
                      data.videoPlatform === 'zoom' ? 'Join Zoom Meeting' :
                      data.videoPlatform === 'google_meet' ? 'Join Google Meet' :
                      data.videoPlatform === 'teams' ? 'Join Microsoft Teams' : 'Join Video Call'
                    }</a>
                  </span>
                </div>
                ` : ''}
              </div>
              
              ${data.videoLink ? `
              <a href="${data.videoLink}" class="btn" style="color: white; text-decoration: none;">Join Video Meeting</a>
              ` : ''}
              
              <p>Please add this to your calendar and be prepared to join at the scheduled time.</p>
            </div>
            <div class="footer">
              <p>This invitation was sent via Kronos</p>
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
${data.videoLink ? `Video Conference: ${data.videoLink}` : ''}

Please add this to your calendar and be prepared to join at the scheduled time.

---
This invitation was sent via Kronos
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
              <h1>Kronos Notification</h1>
            </div>
            <div class="content">
              <div class="message">
                <p>${message}</p>
              </div>
            </div>
            <div class="footer">
              <p>Kronos - Investment Banking Operations Platform</p>
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

export interface PasswordResetEmailData {
  email: string;
  userName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .message { background: white; border-radius: 8px; padding: 25px; margin: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .warning { color: #666; font-size: 13px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <div class="message">
                <p>Hi ${data.userName},</p>
                <p>We received a request to reset your password for your Kronos account. Click the button below to create a new password:</p>
                <p style="text-align: center;">
                  <a href="${data.resetLink}" class="button">Reset Password</a>
                </p>
                <p class="warning">
                  <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Kronos - Investment Banking Operations Platform</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await client.emails.send({
      from: fromEmail,
      to: data.email,
      subject: 'Reset Your Kronos Password',
      html: emailHtml,
      text: `Hi ${data.userName}, We received a request to reset your password. Visit this link to reset it: ${data.resetLink}. This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface PortalInviteEmailData {
  to: string;
  recipientName: string;
  inviterName: string;
  organization?: string;
  message?: string;
  token: string;
  expiresAt: Date;
}

export async function sendPortalInviteEmail(data: PortalInviteEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    // Build the registration URL
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
    const registerUrl = `${baseUrl}/portal/register/${data.token}`;
    
    // Format expiration date
    const expiresDate = new Date(data.expiresAt);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedExpiry = `${months[expiresDate.getMonth()]} ${expiresDate.getDate()}, ${expiresDate.getFullYear()}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .message-box { background: white; border-radius: 8px; padding: 25px; margin: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .personal-message { background: #f0f4ff; border-left: 4px solid #1a1a2e; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
            .expiry { color: #666; font-size: 13px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Client Portal Invitation</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to Kronos</p>
            </div>
            <div class="content">
              <div class="message-box">
                <p>Hi ${data.recipientName},</p>
                <p><strong>${data.inviterName}</strong> has invited you to access the Kronos Client Portal${data.organization ? ` for <strong>${data.organization}</strong>` : ''}.</p>
                
                ${data.message ? `
                <div class="personal-message">
                  <p style="margin: 0; font-style: italic;">"${data.message}"</p>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">— ${data.inviterName}</p>
                </div>
                ` : ''}
                
                <p>Through the portal, you'll be able to:</p>
                <ul>
                  <li>View deal progress and updates</li>
                  <li>Access shared documents</li>
                  <li>Communicate with the team</li>
                </ul>
                
                <p style="text-align: center;">
                  <a href="${registerUrl}" class="button">Accept Invitation</a>
                </p>
                
                <p class="expiry">
                  <strong>Note:</strong> This invitation expires on ${formattedExpiry}. If you have any questions, please reach out to ${data.inviterName}.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Kronos - Investment Banking Operations Platform</p>
              <p>This is an automated message from Kronos.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Client Portal Invitation

Hi ${data.recipientName},

${data.inviterName} has invited you to access the Kronos Client Portal${data.organization ? ` for ${data.organization}` : ''}.

${data.message ? `Personal message from ${data.inviterName}: "${data.message}"` : ''}

Through the portal, you'll be able to:
- View deal progress and updates
- Access shared documents
- Communicate with the team

To accept this invitation, visit: ${registerUrl}

This invitation expires on ${formattedExpiry}.

---
Kronos - Investment Banking Operations Platform
    `.trim();

    const result = await client.emails.send({
      from: fromEmail,
      to: data.to,
      subject: `${data.inviterName} invited you to Kronos Client Portal`,
      html: emailHtml,
      text: emailText,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    console.log(`Successfully sent portal invite to: ${data.to}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send portal invite email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface UserInviteEmailData {
  email: string;
  userName: string;
  inviterName: string;
  accessLevel: string;
  jobTitle?: string;
  setupLink: string;
}

export async function sendUserInviteEmail(data: UserInviteEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const accessLevelDisplay = data.accessLevel === 'admin' ? 'Admin' : 'Standard';
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .message-box { background: white; border-radius: 8px; padding: 25px; margin: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .details { background: #f0f4ff; border-left: 4px solid #1a1a2e; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
            .expiry { color: #666; font-size: 13px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Kronos</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to join the team</p>
            </div>
            <div class="content">
              <div class="message-box">
                <p>Hi ${data.userName},</p>
                <p><strong>${data.inviterName}</strong> has invited you to join Kronos, our investment banking operations platform.</p>
                
                <div class="details">
                  <p style="margin: 0;"><strong>Your Account Details:</strong></p>
                  <p style="margin: 5px 0;">Access Level: <strong>${accessLevelDisplay}</strong></p>
                  ${data.jobTitle ? `<p style="margin: 5px 0;">Job Title: <strong>${data.jobTitle}</strong></p>` : ''}
                </div>
                
                <p>Click the button below to set up your password and activate your account:</p>
                
                <p style="text-align: center;">
                  <a href="${data.setupLink}" class="button">Set Up Your Account</a>
                </p>
                
                <p class="expiry">
                  <strong>Note:</strong> This invitation link expires in 24 hours. If you have any questions, please reach out to ${data.inviterName}.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Kronos - Investment Banking Operations Platform</p>
              <p>This is an automated message from Kronos.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Welcome to Kronos

Hi ${data.userName},

${data.inviterName} has invited you to join Kronos, our investment banking operations platform.

Your Account Details:
- Access Level: ${accessLevelDisplay}
${data.jobTitle ? `- Job Title: ${data.jobTitle}` : ''}

To set up your password and activate your account, visit: ${data.setupLink}

This invitation link expires in 24 hours.

---
Kronos - Investment Banking Operations Platform
    `.trim();

    const result = await client.emails.send({
      from: fromEmail,
      to: data.email,
      subject: `${data.inviterName} invited you to join Kronos`,
      html: emailHtml,
      text: emailText,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    console.log(`Successfully sent user invite to: ${data.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send user invite email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface ExternalWorkEmailData {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  taskTitle: string;
  message: string;
  attachments?: { filename: string; url: string }[];
}

export async function sendExternalWorkEmail(data: ExternalWorkEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const attachmentLinks = data.attachments && data.attachments.length > 0
      ? data.attachments.map(a => `<li><a href="${a.url}" style="color: #1a1a2e;">${a.filename}</a></li>`).join('')
      : '';
    
    const attachmentSection = attachmentLinks 
      ? `
        <div style="background: #f0f4ff; border-left: 4px solid #1a1a2e; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Attachments:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">${attachmentLinks}</ul>
        </div>
      `
      : '';
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
            .message-box { background: white; border-radius: 8px; padding: 25px; margin: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${data.taskTitle}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Work delivery from ${data.senderName}</p>
            </div>
            <div class="content">
              <div class="message-box">
                <p>Hi ${data.recipientName},</p>
                <p><strong>${data.senderName}</strong> has sent you completed work regarding: <strong>${data.taskTitle}</strong></p>
                
                ${data.message ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 0; white-space: pre-wrap;">${data.message}</p>
                </div>
                ` : ''}
                
                ${attachmentSection}
                
                <p style="color: #666; font-size: 13px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                  This email was sent from the Kronos platform. Please reply directly to this email if you have any questions.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Kronos - Investment Banking Operations Platform</p>
              <p>Equiturn &copy; ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const attachmentTextList = data.attachments && data.attachments.length > 0
      ? data.attachments.map(a => `- ${a.filename}: ${a.url}`).join('\n')
      : '';

    const emailText = `
${data.taskTitle}

Hi ${data.recipientName},

${data.senderName} has sent you completed work regarding: ${data.taskTitle}

${data.message ? `Message:\n${data.message}\n` : ''}
${attachmentTextList ? `\nAttachments:\n${attachmentTextList}` : ''}

---
Kronos - Investment Banking Operations Platform
    `.trim();

    const result = await client.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: `Work Delivery: ${data.taskTitle} from ${data.senderName}`,
      html: emailHtml,
      text: emailText,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    console.log(`Successfully sent external work email to: ${data.recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send external work email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
