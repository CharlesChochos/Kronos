import type { User } from "@shared/schema";

interface SlackInviteResult {
  success: boolean;
  error?: string;
}

export async function sendSlackInvite(user: User): Promise<SlackInviteResult> {
  const slackToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackToken) {
    console.log("[Slack] No SLACK_BOT_TOKEN configured, skipping invite");
    return { success: false, error: "Slack not configured" };
  }

  try {
    const response = await fetch("https://slack.com/api/admin.users.invite", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        team_id: process.env.SLACK_TEAM_ID,
        channel_ids: process.env.SLACK_DEFAULT_CHANNEL_ID || undefined,
        real_name: user.name,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`[Slack] Successfully sent invite to ${user.email}`);
      return { success: true };
    } else {
      if (data.error === "already_invited" || data.error === "already_in_team") {
        console.log(`[Slack] User ${user.email} already in workspace`);
        return { success: true };
      }
      console.error(`[Slack] Failed to invite ${user.email}: ${data.error}`);
      return { success: false, error: data.error };
    }
  } catch (error: any) {
    console.error(`[Slack] Error sending invite to ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSlackWelcomeMessage(user: User): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[Slack] No SLACK_WEBHOOK_URL configured, skipping welcome message");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `Welcome to OSReaper! 🎉`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*New team member joined!* 👋\n\n*${user.name}* has joined OSReaper as a *${user.role}*.\n\nEmail: ${user.email}`,
            },
          },
          {
            type: "divider",
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Joined via OSReaper Platform • ${new Date().toLocaleDateString()}`,
              },
            ],
          },
        ],
      }),
    });

    if (response.ok) {
      console.log(`[Slack] Sent welcome message for ${user.name}`);
    }
  } catch (error: any) {
    console.error(`[Slack] Error sending welcome message:`, error.message);
  }
}
