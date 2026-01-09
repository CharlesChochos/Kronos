import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  avatar: text("avatar"),
  role: text("role").notNull().default('Employee'), // Legacy field - kept for compatibility
  accessLevel: text("access_level").notNull().default('standard'), // admin or standard
  jobTitle: text("job_title"),
  status: text("status").notNull().default('pending'), // pending, active, suspended
  score: integer("score").default(0),
  activeDeals: integer("active_deals").default(0),
  completedTasks: integer("completed_tasks").default(0),
  preferences: jsonb("preferences").default({}),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  // External user fields (for Client Portal access)
  isExternal: boolean("is_external").default(false),
  externalOrganization: text("external_organization"), // Company/org name for external users
  invitedBy: varchar("invited_by"), // User ID who invited this external user
  // Asset Management access flag (for standard users who need AM visibility)
  hasAssetManagementAccess: boolean("has_asset_management_access").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Password Reset Tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Pod Team Member type
export type PodTeamMember = {
  userId?: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  slack?: string;
};

// Investor type
export type TaggedInvestor = {
  id: string;
  name: string;
  firm: string;
  type: string; // e.g., 'PE', 'VC', 'Strategic', 'Family Office'
  status: string; // e.g., 'Contacted', 'Interested', 'Passed', 'In DD'
  notes?: string;
  email?: string;
  phone?: string;
  website?: string;
};

// Audit Trail Entry type
export type AuditEntry = {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
};

// Deal Types: 'M&A', 'Capital Raising', 'Asset Management', 'Opportunity'
// Opportunity deals are pending approval before becoming active deals

// Deals table
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  dealType: text("deal_type").notNull().default('M&A'), // M&A, Capital Raising, Asset Management, Opportunity
  stage: text("stage").notNull().default('Origination'),
  value: integer("value").notNull(), // in millions
  client: text("client").notNull(),
  clientContactName: text("client_contact_name"),
  clientContactEmail: text("client_contact_email"),
  clientContactPhone: text("client_contact_phone"),
  clientContactRole: text("client_contact_role"),
  sector: text("sector").notNull(),
  lead: text("lead").notNull(),
  progress: integer("progress").default(0),
  status: text("status").notNull().default('Active'),
  description: text("description"),
  attachments: jsonb("attachments").default([]),
  podTeam: jsonb("pod_team").default([]).$type<PodTeamMember[]>(),
  taggedInvestors: jsonb("tagged_investors").default([]).$type<TaggedInvestor[]>(),
  auditTrail: jsonb("audit_trail").default([]).$type<AuditEntry[]>(),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  archivedReason: text("archived_reason"),
  archivedNotes: text("archived_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Task Attachment type
export type TaskAttachment = {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
};

// AI Task Plan type - for grouping AI-generated tasks
export type AiTaskPlanData = {
  memo: string;
  rationale: string;
  dealSummary: string;
  stageObjectives: string[];
};

// AI Task Plans table - stores AI-generated work plans
export const aiTaskPlans = pgTable("ai_task_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => deals.id),
  stage: text("stage").notNull(),
  assigneeId: varchar("assignee_id").notNull().references(() => users.id),
  memo: text("memo").notNull(),
  rationale: text("rationale"),
  dealSummary: text("deal_summary"),
  stageObjectives: jsonb("stage_objectives").default([]).$type<string[]>(),
  isActive: boolean("is_active").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
  archivedAt: timestamp("archived_at"),
});

export const insertAiTaskPlanSchema = createInsertSchema(aiTaskPlans).omit({
  id: true,
  generatedAt: true,
});

export type InsertAiTaskPlan = z.infer<typeof insertAiTaskPlanSchema>;
export type AiTaskPlan = typeof aiTaskPlans.$inferSelect;

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  dealId: varchar("deal_id").references(() => deals.id),
  dealStage: text("deal_stage"), // Stage this task belongs to
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  priority: text("priority").notNull().default('Medium'),
  dueDate: text("due_date"), // Optional - tasks without due dates are valid
  status: text("status").notNull().default('Pending'),
  type: text("type").default('General'), // Optional with default
  cadence: text("cadence"), // memo, daily, weekly, monthly - for AI-generated tasks
  aiPlanId: varchar("ai_plan_id").references(() => aiTaskPlans.id), // Links to AI task plan
  attachments: jsonb("attachments").default([]).$type<TaskAttachment[]>(),
  startedAt: timestamp("started_at"), // When task moved to In Progress
  completedAt: timestamp("completed_at"),
  durationMinutes: integer("duration_minutes"), // Actual time taken to complete
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Meetings table
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  duration: integer("duration").notNull().default(60), // in minutes
  location: text("location"),
  videoPlatform: text("video_platform"), // zoom, google_meet, teams, or null
  videoLink: text("video_link"), // auto-generated placeholder link
  organizerId: varchar("organizer_id").references(() => users.id),
  participants: jsonb("participants").default([]), // array of email strings
  dealId: varchar("deal_id").references(() => deals.id),
  status: text("status").notNull().default('scheduled'), // scheduled, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default('info'), // info, success, warning, error
  read: boolean("read").default(false),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Conversations table for chat
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  isGroup: boolean("is_group").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Conversation Members table
export const conversationMembers = pgTable("conversation_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadAt: timestamp("last_read_at"),
});

export const insertConversationMemberSchema = createInsertSchema(conversationMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertConversationMember = z.infer<typeof insertConversationMemberSchema>;
export type ConversationMember = typeof conversationMembers.$inferSelect;

// Message Attachment type
export type MessageAttachment = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
};

// Message Reaction type
export type MessageReaction = {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: string;
};

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).$type<MessageAttachment[]>(),
  reactions: jsonb("reactions").default([]).$type<MessageReaction[]>(),
  replyToMessageId: varchar("reply_to_message_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Reaper Assistant Conversations table
export const assistantConversations = pgTable("assistant_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").default('New Conversation'),
  isShared: boolean("is_shared").default(false),
  sharedWith: text("shared_with").array(), // Array of user IDs who can access
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssistantConversationSchema = createInsertSchema(assistantConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAssistantConversation = z.infer<typeof insertAssistantConversationSchema>;
export type AssistantConversation = typeof assistantConversations.$inferSelect;

// Assistant Message Attachment type
export type AssistantAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

// Assistant Message Mention type
export type AssistantMention = {
  userId: string;
  userName: string;
  notified: boolean;
};

// Reaper Assistant Messages table
export const assistantMessages = pgTable("assistant_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => assistantConversations.id).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).$type<AssistantAttachment[]>(),
  mentions: jsonb("mentions").default([]).$type<AssistantMention[]>(), // @ mentions in the message
  context: jsonb("context").default({}), // stores any context used for the response
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssistantMessageSchema = createInsertSchema(assistantMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;
export type AssistantMessage = typeof assistantMessages.$inferSelect;

// Time Entries table (for Time Tracking)
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id),
  taskId: varchar("task_id").references(() => tasks.id),
  description: text("description"),
  hours: integer("hours").notNull().default(0), // stored as minutes for precision
  date: text("date").notNull(), // YYYY-MM-DD format
  category: text("category").notNull().default('General'), // Meetings, Research, Document Review, Client Calls, etc.
  billable: boolean("billable").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// Time Off Requests table (for Vacation Calendar)
export const timeOffRequests = pgTable("time_off_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull().default('Vacation'), // Vacation, Sick, Personal, WFH
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  status: text("status").notNull().default('Pending'), // Pending, Approved, Denied
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;

// Audit Logs table (for Audit Trail)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, VIEW, LOGIN, LOGOUT, etc.
  entityType: text("entity_type").notNull(), // Deal, Task, Document, User, etc.
  entityId: varchar("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Investors table (for Investor CRM)
export const investors = pgTable("investors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  firm: text("firm").notNull(),
  type: text("type").notNull().default('PE'), // PE, VC, Strategic, Family Office, Sovereign Wealth, Hedge Fund
  email: text("email"),
  phone: text("phone"),
  linkedIn: text("linkedin"),
  location: text("location"),
  sectors: jsonb("sectors").default([]).$type<string[]>(), // Array of sector interests
  minDealSize: integer("min_deal_size"), // Minimum deal size in millions
  maxDealSize: integer("max_deal_size"), // Maximum deal size in millions
  status: text("status").notNull().default('Active'), // Active, Warm, Cold, Inactive
  relationshipScore: integer("relationship_score").default(50), // 0-100
  dealsParticipated: integer("deals_participated").default(0),
  notes: text("notes"),
  lastContactDate: text("last_contact_date"), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  createdAt: true,
});

export type InsertInvestor = z.infer<typeof insertInvestorSchema>;
export type Investor = typeof investors.$inferSelect;

// Investor Interactions table (for tracking touchpoints)
export const investorInteractions = pgTable("investor_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  investorId: varchar("investor_id").references(() => investors.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id),
  type: text("type").notNull().default('Call'), // Call, Email, Meeting, Conference, Introduction
  date: text("date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  outcome: text("outcome"), // Positive, Neutral, Negative
  followUpDate: text("follow_up_date"), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvestorInteractionSchema = createInsertSchema(investorInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertInvestorInteraction = z.infer<typeof insertInvestorInteractionSchema>;
export type InvestorInteraction = typeof investorInteractions.$inferSelect;

// Sessions table (for PostgreSQL session storage)
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Key Result type for OKRs
export type KeyResult = {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
};

// OKRs table (Objectives and Key Results)
export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objective: text("objective").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name").notNull(),
  quarter: text("quarter").notNull(), // Q1, Q2, Q3, Q4
  year: integer("year").notNull(),
  keyResults: jsonb("key_results").default([]).$type<KeyResult[]>(),
  status: text("status").notNull().default('on-track'), // on-track, at-risk, behind, completed
  overallProgress: integer("overall_progress").default(0),
  type: text("type").notNull().default('individual'), // individual, team
  teamName: text("team_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOkrSchema = createInsertSchema(okrs).omit({
  id: true,
  createdAt: true,
});

export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type Okr = typeof okrs.$inferSelect;

// Stakeholders table
export const stakeholders = pgTable("stakeholders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  type: text("type").notNull().default('other'), // investor, advisor, legal, banker, consultant, client, other
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  website: text("website"),
  location: text("location"),
  focus: text("focus"), // Sector interest for investors (Technology, Healthcare, Consumer, etc.)
  notes: text("notes"),
  deals: jsonb("deals").default([]).$type<string[]>(),
  isFavorite: boolean("is_favorite").default(false),
  lastContact: text("last_contact"), // ISO date string
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStakeholderSchema = createInsertSchema(stakeholders).omit({
  id: true,
  createdAt: true,
});

export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type Stakeholder = typeof stakeholders.$inferSelect;

// Announcement Reaction type
export type AnnouncementReaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

// Announcement Comment type
export type AnnouncementComment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

// Announcements table
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default('general'), // deal-closed, milestone, team-update, celebration, general
  dealId: varchar("deal_id").references(() => deals.id),
  dealName: text("deal_name"),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  authorName: text("author_name").notNull(),
  isPinned: boolean("is_pinned").default(false),
  reactions: jsonb("reactions").default([]).$type<AnnouncementReaction[]>(),
  comments: jsonb("comments").default([]).$type<AnnouncementComment[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// Poll Option type
export type PollOption = {
  id: string;
  text: string;
  votes: string[]; // array of user IDs who voted
};

// Polls table
export const polls = pgTable("polls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  options: jsonb("options").default([]).$type<PollOption[]>(),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  creatorName: text("creator_name").notNull(),
  expiresAt: text("expires_at").notNull(), // ISO date string
  isAnonymous: boolean("is_anonymous").default(false),
  allowMultiple: boolean("allow_multiple").default(false),
  status: text("status").notNull().default('active'), // active, closed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPollSchema = createInsertSchema(polls).omit({
  id: true,
  createdAt: true,
});

export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof polls.$inferSelect;

// Mentorship Pairings table
export const mentorshipPairings = pgTable("mentorship_pairings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").references(() => users.id).notNull(),
  mentorName: text("mentor_name").notNull(),
  menteeId: varchar("mentee_id").references(() => users.id).notNull(),
  menteeName: text("mentee_name").notNull(),
  focusAreas: jsonb("focus_areas").default([]).$type<string[]>(),
  goals: jsonb("goals").default([]).$type<string[]>(),
  status: text("status").notNull().default('active'), // active, completed, paused
  startDate: text("start_date").notNull(), // ISO date string
  endDate: text("end_date"),
  meetingFrequency: text("meeting_frequency").default('Weekly'), // Weekly, Bi-weekly, Monthly
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMentorshipPairingSchema = createInsertSchema(mentorshipPairings).omit({
  id: true,
  createdAt: true,
});

export type InsertMentorshipPairing = z.infer<typeof insertMentorshipPairingSchema>;
export type MentorshipPairing = typeof mentorshipPairings.$inferSelect;

// Client Portal Access table
export const clientPortalAccess = pgTable("client_portal_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  accessLevel: text("access_level").notNull().default('view'), // view, comment, edit
  isActive: boolean("is_active").default(true),
  lastAccess: text("last_access"), // ISO date string
  invitedBy: varchar("invited_by").references(() => users.id),
  accessToken: text("access_token"),
  expiresAt: text("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientPortalAccessSchema = createInsertSchema(clientPortalAccess).omit({
  id: true,
  createdAt: true,
});

export type InsertClientPortalAccess = z.infer<typeof insertClientPortalAccessSchema>;
export type ClientPortalAccess = typeof clientPortalAccess.$inferSelect;

// Document Templates table
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default('General'), // Legal, Deal, Analysis, Governance, General
  complexity: text("complexity").notNull().default('Medium'), // Low, Medium, High
  content: text("content"), // Template content/structure
  lastUsed: text("last_used"), // ISO date string
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  isDefault: boolean("is_default").default(false), // System default templates
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// Investor Matches table - tracks matched/rejected investors per deal
export const investorMatches = pgTable("investor_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  investorId: varchar("investor_id").notNull(), // Stakeholder ID (type='investor')
  status: text("status").notNull().default('matched'), // matched, rejected
  matchedBy: varchar("matched_by").references(() => users.id),
  matchedAt: timestamp("matched_at").defaultNow(),
});

export const insertInvestorMatchSchema = createInsertSchema(investorMatches).omit({
  id: true,
  matchedAt: true,
});

export type InsertInvestorMatch = z.infer<typeof insertInvestorMatchSchema>;
export type InvestorMatch = typeof investorMatches.$inferSelect;

// User Preferences table - stores dashboard widgets, sidebar state, theme, etc.
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  dashboardWidgets: jsonb("dashboard_widgets").default([]), // Widget configuration array
  sidebarCollapsed: boolean("sidebar_collapsed").default(false),
  theme: text("theme").default('system'), // light, dark, system
  complianceDefaults: jsonb("compliance_defaults").default({ sec: false, finra: false, legal: true }),
  marketSymbols: jsonb("market_symbols").default(['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY']),
  settings: jsonb("settings").default({}), // General settings (notifications, display, account preferences)
  hasSeenWelcome: boolean("has_seen_welcome").default(false), // Track if user has seen welcome modal
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// Deal Template Task type
export type DealTemplateTask = {
  title: string;
  type: string;
  priority: string;
};

// Deal Templates table - workflow templates for creating deals
export const dealTemplates = pgTable("deal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sector: text("sector").notNull().default('All'),
  dealType: text("deal_type").notNull().default('M&A'), // M&A, Capital Raising, Divestiture, etc.
  stages: jsonb("stages").default([]).$type<string[]>(),
  defaultTasks: jsonb("default_tasks").default([]).$type<DealTemplateTask[]>(),
  estimatedDuration: integer("estimated_duration").default(90), // in days
  checklistItems: jsonb("checklist_items").default([]).$type<string[]>(),
  isFavorite: boolean("is_favorite").default(false),
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealTemplateSchema = createInsertSchema(dealTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealTemplate = z.infer<typeof insertDealTemplateSchema>;
export type DealTemplate = typeof dealTemplates.$inferSelect;

// Calendar Events table - for capital raising calendar and other events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull().default('deadline'), // deadline, meeting, milestone, filing, call, followup, presentation
  date: text("date").notNull(), // ISO date string
  time: text("time"), // HH:MM format
  description: text("description"),
  dealId: varchar("deal_id").references(() => deals.id),
  dealName: text("deal_name"),
  location: text("location"),
  participants: jsonb("participants").default([]).$type<string[]>(),
  isAllDay: boolean("is_all_day").default(false),
  color: text("color"), // Hex color for calendar display
  investor: text("investor"), // For capital raising events - investor name
  status: text("status").default('scheduled'), // scheduled, completed, pending
  notes: text("notes"), // Additional notes
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  googleCalendarEventId: text("google_calendar_event_id"), // For Google Calendar sync
  googleCalendarSyncedAt: timestamp("google_calendar_synced_at"), // Last sync timestamp
  syncSource: text("sync_source").default('platform'), // 'platform' or 'google' - where event originated
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  googleCalendarSyncedAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Task Attachments table - metadata for uploaded files (DB table)
export const taskAttachmentsTable = pgTable("task_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"), // in bytes
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertTaskAttachmentRecordSchema = createInsertSchema(taskAttachmentsTable).omit({
  id: true,
  uploadedAt: true,
});

export type InsertTaskAttachmentRecord = z.infer<typeof insertTaskAttachmentRecordSchema>;
export type TaskAttachmentRecord = typeof taskAttachmentsTable.$inferSelect;

// Audit Logs table - tracks important actions for compliance
export const auditLogsTable = pgTable("audit_logs_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  action: text("action").notNull(), // user_approved, user_suspended, role_changed, deal_created, deal_updated, etc.
  entityType: text("entity_type").notNull(), // user, deal, task, meeting, etc.
  entityId: varchar("entity_id"),
  entityName: text("entity_name"),
  details: jsonb("details").default({}), // Additional context like old/new values
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogTableSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLogTable = z.infer<typeof insertAuditLogTableSchema>;
export type AuditLogTable = typeof auditLogsTable.$inferSelect;

// Database-backed Investors table (replacing static investors.ts)
export const investorsTable = pgTable("investors_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  firm: text("firm").notNull(),
  type: text("type").notNull(), // PE, VC, Strategic, Family Office, Hedge Fund, etc.
  focus: text("focus").default('Multi-sector'), // Technology, Healthcare, Consumer, etc.
  aum: text("aum"), // Assets Under Management
  checkSize: text("check_size"), // Typical investment size range
  preferredStage: text("preferred_stage"), // Growth, Late Stage, Buyout, etc.
  location: text("location"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  linkedIn: text("linkedin"),
  notes: text("notes"),
  tags: jsonb("tags").default([]).$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvestorTableSchema = createInsertSchema(investorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvestorTable = z.infer<typeof insertInvestorTableSchema>;
export type InvestorTable = typeof investorsTable.$inferSelect;

// Documents table - persistent storage for generated and uploaded documents
export const documentsTable = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // teaser, cim, nda, loi, term_sheet, sba, sba_addendum, uploaded, etc.
  category: text("category").default('general'), // deal_document, compliance, template, etc.
  filename: text("filename").notNull(),
  originalName: text("original_name"),
  mimeType: text("mime_type"),
  size: integer("size"), // in bytes
  content: text("content"), // For generated documents, store the content
  dealId: varchar("deal_id").references(() => deals.id),
  dealName: text("deal_name"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploaderName: text("uploader_name"),
  tags: jsonb("tags").default([]).$type<string[]>(),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentTableSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentTable = z.infer<typeof insertDocumentTableSchema>;
export type DocumentTable = typeof documentsTable.$inferSelect;

// Client Portal Invites table - for inviting external users to access the portal
export const clientPortalInvites = pgTable("client_portal_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name").notNull(),
  organization: text("organization"), // Client/investor company name
  token: text("token").notNull().unique(), // Secure invite token
  dealIds: jsonb("deal_ids").default([]).$type<string[]>(), // Deals they'll have access to
  accessLevel: text("access_level").notNull().default('view'), // view, comment, edit
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  inviterName: text("inviter_name").notNull(),
  message: text("message"), // Optional personal message in invite email
  status: text("status").notNull().default('pending'), // pending, accepted, expired, revoked
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  userId: varchar("user_id").references(() => users.id), // Set when invite is accepted and user is created
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientPortalInviteSchema = createInsertSchema(clientPortalInvites).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  userId: true,
});

export type InsertClientPortalInvite = z.infer<typeof insertClientPortalInviteSchema>;
export type ClientPortalInvite = typeof clientPortalInvites.$inferSelect;

// Client Portal Messages table - for communication between external clients and internal team
export const clientPortalMessages = pgTable("client_portal_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderName: text("sender_name").notNull(),
  isExternal: boolean("is_external").default(false), // True if sent by external client
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).$type<{ filename: string; url: string; size: number }[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientPortalMessageSchema = createInsertSchema(clientPortalMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertClientPortalMessage = z.infer<typeof insertClientPortalMessageSchema>;
export type ClientPortalMessage = typeof clientPortalMessages.$inferSelect;

// Client Portal Updates table - progress updates visible to external clients
export const clientPortalUpdates = pgTable("client_portal_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default('update'), // update, milestone, document, meeting
  authorId: varchar("author_id").references(() => users.id).notNull(),
  authorName: text("author_name").notNull(),
  isPublic: boolean("is_public").default(true), // Whether visible to external clients
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientPortalUpdateSchema = createInsertSchema(clientPortalUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertClientPortalUpdate = z.infer<typeof insertClientPortalUpdateSchema>;
export type ClientPortalUpdate = typeof clientPortalUpdates.$inferSelect;

// Deal Fees table - tracks different fee types per deal
export const dealFees = pgTable("deal_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  feeType: text("fee_type").notNull(), // engagement, monthly, success, transaction, spread
  amount: integer("amount"), // Fixed amount in dollars (for engagement, monthly)
  percentage: integer("percentage"), // Percentage x100 (e.g., 250 = 2.5%) for success, transaction, spread
  currency: text("currency").default('USD'),
  description: text("description"),
  billingFrequency: text("billing_frequency"), // one-time, monthly, on-close
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealFeeSchema = createInsertSchema(dealFees).omit({
  id: true,
  createdAt: true,
});

export type InsertDealFee = z.infer<typeof insertDealFeeSchema>;
export type DealFee = typeof dealFees.$inferSelect;

// Stage Documents table - documents attached to specific deal stages
export const stageDocuments = pgTable("stage_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  stage: text("stage").notNull(), // Origination, Structuring, Diligence, Legal, Close
  documentId: varchar("document_id").references(() => documentsTable.id),
  title: text("title").notNull(),
  filename: text("filename"),
  url: text("url"),
  mimeType: text("mime_type"),
  size: integer("size"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploaderName: text("uploader_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStageDocumentSchema = createInsertSchema(stageDocuments).omit({
  id: true,
  createdAt: true,
});

export type InsertStageDocument = z.infer<typeof insertStageDocumentSchema>;
export type StageDocument = typeof stageDocuments.$inferSelect;

// Stage Pod Members table - pod team assignments per deal stage (leader may change)
export const stagePodMembers = pgTable("stage_pod_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  stage: text("stage").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  role: text("role").notNull(), // Lead, Analyst, Associate, Director, etc.
  email: text("email"),
  phone: text("phone"),
  isLead: boolean("is_lead").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStagePodMemberSchema = createInsertSchema(stagePodMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertStagePodMember = z.infer<typeof insertStagePodMemberSchema>;
export type StagePodMember = typeof stagePodMembers.$inferSelect;

// Stage Voice Notes table - voice recordings attached to stages
export const stageVoiceNotes = pgTable("stage_voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  stage: text("stage").notNull(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  url: text("url"),
  duration: integer("duration"), // in seconds
  transcript: text("transcript"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  recorderName: text("recorder_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStageVoiceNoteSchema = createInsertSchema(stageVoiceNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertStageVoiceNote = z.infer<typeof insertStageVoiceNoteSchema>;
export type StageVoiceNote = typeof stageVoiceNotes.$inferSelect;

// Task Comments table - comments on tasks for discussion
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// Deal Notes table - comments/notes on deals for discussion
export const dealNotes = pgTable("deal_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealNoteSchema = createInsertSchema(dealNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealNote = z.infer<typeof insertDealNoteSchema>;
export type DealNote = typeof dealNotes.$inferSelect;

// Custom Sectors table - user-defined sectors for deals
export const customSectors = pgTable("custom_sectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomSectorSchema = createInsertSchema(customSectors).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomSector = z.infer<typeof insertCustomSectorSchema>;
export type CustomSector = typeof customSectors.$inferSelect;

// Google Calendar Tokens table - per-user OAuth tokens for Google Calendar
export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  tokenType: text("token_type").default('Bearer'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGoogleCalendarTokenSchema = createInsertSchema(googleCalendarTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGoogleCalendarToken = z.infer<typeof insertGoogleCalendarTokenSchema>;
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;

// Form Field Type - includes new types for tables and rich content
export type FormFieldType = 'text' | 'email' | 'single_select' | 'multi_select' | 'date' | 'number' | 'attachment' | 'heading' | 'textarea' | 'table' | 'content';

export type FormFieldOption = {
  id: string;
  label: string;
};

// Branching condition - show field when another field has specific value
export type FormBranchCondition = {
  fieldId: string;       // The field to check
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;         // The value to match
};

// Table cell for static table data
export type FormTableCell = {
  value: string;
};

// Table column definition
export type FormTableColumn = {
  id: string;
  header: string;
};

// Content block for rich text (markdown-like)
export type FormContentBlock = {
  type: 'paragraph' | 'heading' | 'list' | 'link';
  text?: string;
  items?: string[];      // For list type
  url?: string;          // For link type
  linkText?: string;     // For link type
};

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  description?: string;            // Help text below label
  placeholder?: string;            // Placeholder text for input fields
  required: boolean;
  options?: FormFieldOption[];     // For single_select and multi_select
  order: number;
  // Branching support
  showWhen?: FormBranchCondition;  // Only show this field when condition is met
  branchFields?: FormField[];      // Nested fields to show based on this field's value (legacy)
  // Table support
  tableColumns?: FormTableColumn[];  // Column definitions for table type
  tableRows?: FormTableCell[][];     // Row data for table type
  // Rich content support
  contentBlocks?: FormContentBlock[];  // For content type
};

// Forms table - stores form definitions
export const forms = pgTable("forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  fields: jsonb("fields").default([]).$type<FormField[]>(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  shareToken: text("share_token").unique(), // Unique token for public access
  status: text("status").notNull().default('draft'), // draft, published
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFormSchema = createInsertSchema(forms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof forms.$inferSelect;

// Form Submission Response type
export type FormSubmissionResponse = {
  fieldId: string;
  fieldLabel: string;
  fieldType: FormFieldType;
  value: string | string[] | null; // string for most, array for multi_select
};

// Form Submissions table - stores submitted form responses
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => forms.id).notNull(),
  formTitle: text("form_title").notNull(), // Snapshot of form title at submission time
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  submitterId: varchar("submitter_id").references(() => users.id), // If submitter is a platform user
  responses: jsonb("responses").default([]).$type<FormSubmissionResponse[]>(),
  taskId: varchar("task_id").references(() => tasks.id), // Created task for Dimitra
  status: text("status").notNull().default('pending'), // pending, reviewed, completed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

// Form Invitations table - tracks who forms are shared with
export const formInvitations = pgTable("form_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => forms.id).notNull(),
  email: text("email").notNull(),
  userId: varchar("user_id").references(() => users.id), // If invitee is a platform user
  message: text("message"), // Custom message for the invitation
  status: text("status").notNull().default('pending'), // pending, completed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormInvitationSchema = createInsertSchema(formInvitations).omit({
  id: true,
  createdAt: true,
});

export type InsertFormInvitation = z.infer<typeof insertFormInvitationSchema>;
export type FormInvitation = typeof formInvitations.$inferSelect;

// Pending form upload tokens - tracks presigned uploads for cleanup
export const pendingFormUploads = pgTable("pending_form_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareToken: text("share_token").notNull(),
  objectPath: text("object_path").notNull(),
  filename: text("filename").notNull(),
  maxSize: integer("max_size").notNull().default(10485760), // 10MB default
  confirmedAt: timestamp("confirmed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPendingFormUploadSchema = createInsertSchema(pendingFormUploads).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

export type InsertPendingFormUpload = z.infer<typeof insertPendingFormUploadSchema>;
export type PendingFormUpload = typeof pendingFormUploads.$inferSelect;

// ================================
// HR Task Templates
// ================================

// Template Task type - defines tasks within a section
export type TemplateTask = {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string; // User ID for default assignee
  relativeDueDays?: number; // Days after template application
  position: number;
};

// Template Section type - groups tasks
export type TemplateSection = {
  id: string;
  title: string;
  position: number;
  tasks: TemplateTask[];
};

// Task Templates table - reusable task templates for HR
export const taskTemplates = pgTable("task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default('HR'), // HR, Onboarding, General
  sections: jsonb("sections").default([]).$type<TemplateSection[]>(),
  isArchived: boolean("is_archived").default(false),
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;
export type TaskTemplate = typeof taskTemplates.$inferSelect;

// Task Template Usage Log - tracks when templates are applied
export const taskTemplateUsage = pgTable("task_template_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => taskTemplates.id).notNull(),
  templateName: text("template_name").notNull(), // Snapshot at time of use
  appliedBy: varchar("applied_by").references(() => users.id).notNull(),
  contextType: text("context_type"), // e.g., 'onboarding', 'project'
  contextName: text("context_name"), // e.g., 'New Hire: John Smith'
  tasksCreated: integer("tasks_created").default(0),
  startDate: text("start_date").notNull(), // ISO date string for due date calculation
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskTemplateUsageSchema = createInsertSchema(taskTemplateUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskTemplateUsage = z.infer<typeof insertTaskTemplateUsageSchema>;
export type TaskTemplateUsage = typeof taskTemplateUsage.$inferSelect;

// ================================
// PERSONALITY ASSESSMENT SYSTEM
// ================================

// Personality Profile types - the 16 personality archetypes (canonical Equiturn tags)
export const PERSONALITY_PROFILES = [
  'Politician', 'Rainmaker', 'Mayor', 'Creative', 'Deal Junkie', 'Closer',
  'Grandmaster', 'Architect', 'Guru', 'Sherpa', 'Firefighter', 'Legal',
  'Liaison', 'Auditor', 'Regulatory', 'Misfit'
] as const;

export type PersonalityProfileType = typeof PERSONALITY_PROFILES[number];

// Individual personality score
export type PersonalityScore = {
  profile: string;
  score: number;
};

// AI-generated deployment profile structure
export type DeploymentTags = {
  dealTeamStatus: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  topFiveArchetypes: string[];
  riskFlag: string | null;
};

export type AIAnalysis = {
  employeeSnapshot: string;
  scoreDistribution: string;
  primaryArchetype: string;
  secondaryTraits: string;
  supportingTraits: string;
  lowSignalTags: string;
  absentTraits: string;
  dealPhaseFit: string;
  dealTypeProficiency: string;
  managerialNotes: string;
  deploymentTags: DeploymentTags;
  rawResponse: string; // Full AI response for reference
};

// Personality Assessment Responses table - stores user's questionnaire answers and AI analysis
export const personalityAssessments = pgTable("personality_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  answers: jsonb("answers").notNull().$type<Record<number, 'A' | 'B'>>(), // Question number -> answer
  allScores: jsonb("all_scores").default([]).$type<PersonalityScore[]>(), // All profile scores (raw calculation)
  topThreeProfiles: jsonb("top_three_profiles").default([]).$type<PersonalityScore[]>(), // Top 3 profiles
  aiAnalysis: jsonb("ai_analysis").$type<AIAnalysis | null>(), // Full AI-generated deployment profile
  status: text("status").notNull().default('pending'), // pending, analyzing, completed, failed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPersonalityAssessmentSchema = createInsertSchema(personalityAssessments).omit({
  id: true,
  createdAt: true,
});

export type InsertPersonalityAssessment = z.infer<typeof insertPersonalityAssessmentSchema>;
export type PersonalityAssessment = typeof personalityAssessments.$inferSelect;

// Resume Analysis types for onboarding placement
export type OnboardingPlacement = {
  assignedDealTeam: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  initialSeatRecommendation: string;
  topFiveInferredTags: string[];
  coverageGaps: string;
};

export type ResumeAIAnalysis = {
  candidateSnapshot: string;
  evidenceAnchors: string;
  transactionProfile: string;
  roleElevationAutonomy: string;
  dealPhaseFit: string;
  dealTypeProficiency: string;
  resumeInferredTags: string;
  managerialNotes: string;
  onboardingPlacement: OnboardingPlacement;
  rawResponse: string;
};

// Resume Analysis table - stores AI-analyzed resume for Deal Team placement
export const resumeAnalyses = pgTable("resume_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  fileContent: text("file_content"), // Extracted text content from resume
  aiAnalysis: jsonb("ai_analysis").$type<ResumeAIAnalysis | null>(),
  assignedDealTeam: text("assigned_deal_team"), // Extracted for quick access
  status: text("status").notNull().default('pending'), // pending, analyzing, completed, failed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalyses).omit({
  id: true,
  createdAt: true,
});

export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;
export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;

// ================================
// AUTOMATED DEAL PIPELINE SYSTEM
// ================================

// Deal stages for pod formation
export const DEAL_STAGES = [
  'Origination', 'Structuring', 'Execution', 'Closing', 'Integration'
] as const;

export type DealStageType = typeof DEAL_STAGES[number];

// Pod roles based on deal size
export const POD_ROLES_LARGE = ['Pod Lead', 'Origination Lead', 'Structuring Lead', 'Execution Lead', 'Closing Lead'] as const;
export const POD_ROLES_SMALL = ['Pod Lead', 'Structuring Lead', 'Execution Lead'] as const;

// Deal Pods table - tracks pod teams per deal and stage
export const dealPods = pgTable("deal_pods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  stage: text("stage").notNull(), // Current stage this pod was formed for
  podSize: integer("pod_size").notNull(), // 3 or 5 based on deal value
  leadUserId: varchar("lead_user_id").references(() => users.id), // Pod lead stays constant
  aiFormationRationale: text("ai_formation_rationale"), // Why AI chose this team
  aiRawResponse: text("ai_raw_response"), // Full AI response for reference
  status: text("status").notNull().default('active'), // active, completed, disbanded
  formedAt: timestamp("formed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealPodSchema = createInsertSchema(dealPods).omit({
  id: true,
  createdAt: true,
  formedAt: true,
});

export type InsertDealPod = z.infer<typeof insertDealPodSchema>;
export type DealPod = typeof dealPods.$inferSelect;

// Pod Members table - individual pod member assignments
export const podMembers = pgTable("pod_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  podId: varchar("pod_id").references(() => dealPods.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // Pod Lead, Origination Lead, Structuring Lead, etc.
  position: integer("position").notNull(), // 1-5 based on hierarchy
  dealTeamStatus: text("deal_team_status"), // User's Deal Team at time of assignment
  requiredTags: jsonb("required_tags").default([]).$type<string[]>(), // Tags required for this role
  matchedTags: jsonb("matched_tags").default([]).$type<string[]>(), // User's matching tags
  assignmentRationale: text("assignment_rationale"), // Why AI chose this person
  isLead: boolean("is_lead").default(false),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const insertPodMemberSchema = createInsertSchema(podMembers).omit({
  id: true,
  assignedAt: true,
});

export type InsertPodMember = z.infer<typeof insertPodMemberSchema>;
export type PodMember = typeof podMembers.$inferSelect;

// Deal Milestones table - phase milestones for deals
export const dealMilestones = pgTable("deal_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  podId: varchar("pod_id").references(() => dealPods.id),
  stage: text("stage").notNull(), // Which deal stage this milestone belongs to
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealMilestoneSchema = createInsertSchema(dealMilestones).omit({
  id: true,
  createdAt: true,
});

export type InsertDealMilestone = z.infer<typeof insertDealMilestoneSchema>;
export type DealMilestone = typeof dealMilestones.$inferSelect;

// Pod Movement Tasks table - tasks that complete milestones
export const podMovementTasks = pgTable("pod_movement_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  milestoneId: varchar("milestone_id").references(() => dealMilestones.id),
  podId: varchar("pod_id").references(() => dealPods.id),
  title: text("title").notNull(),
  ownerRole: text("owner_role"), // Which pod role owns this task
  assignedTo: varchar("assigned_to").references(() => users.id),
  dependencies: jsonb("dependencies").default([]).$type<string[]>(), // IDs of dependent tasks
  definitionOfDone: text("definition_of_done"),
  qualityGates: text("quality_gates"),
  escalationTriggers: text("escalation_triggers"),
  status: text("status").notNull().default('pending'), // pending, in_progress, completed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPodMovementTaskSchema = createInsertSchema(podMovementTasks).omit({
  id: true,
  createdAt: true,
});

export type InsertPodMovementTask = z.infer<typeof insertPodMovementTaskSchema>;
export type PodMovementTask = typeof podMovementTasks.$inferSelect;

// Deal Context Updates table - tracks all updates/docs for AI learning
export const dealContextUpdates = pgTable("deal_context_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  updateType: text("update_type").notNull(), // document, note, status_change, task_complete, communication
  title: text("title").notNull(),
  content: text("content"), // Text content for AI ingestion
  documentId: varchar("document_id"), // Reference to documents table if applicable
  metadata: jsonb("metadata").default({}), // Additional structured data
  indexedForAI: boolean("indexed_for_ai").default(false), // Whether AI has processed this
  indexedAt: timestamp("indexed_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealContextUpdateSchema = createInsertSchema(dealContextUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertDealContextUpdate = z.infer<typeof insertDealContextUpdateSchema>;
export type DealContextUpdate = typeof dealContextUpdates.$inferSelect;

// User Workload Snapshot - for tracking capacity
export type UserWorkloadSnapshot = {
  userId: string;
  userName: string;
  dealTeamStatus: string;
  personalityTags: string[];
  activeTasks: number;
  pendingTasks: number;
  completedThisWeek: number;
  activeDeals: number;
  capacityScore: number; // 0-100, lower = more available
  currentStages: { dealId: string; dealName: string; stage: string }[];
};

// AI Pod Formation Request type
export type AIPodFormationRequest = {
  dealId: string;
  dealName: string;
  dealValue: number;
  dealType: string;
  sector: string;
  client: string;
  stage: string;
  dealDocuments: { name: string; content: string }[];
  availableUsers: UserWorkloadSnapshot[];
  existingPodLeadId?: string; // For stage transitions, keep the same lead
};

// AI Pod Formation Response type
export type AIPodFormationResponse = {
  podSize: number;
  podMembers: {
    position: number;
    role: string;
    userId: string | null;
    userName: string | null;
    dealTeamStatus: string | null;
    requiredTags: string[];
    matchedTags: string[];
    rationale: string;
  }[];
  milestones: {
    stage: string;
    title: string;
    description: string;
    orderIndex: number;
  }[];
  podMovementTasks: {
    milestoneTitle: string;
    title: string;
    ownerRole: string;
    definitionOfDone: string;
    qualityGates: string;
    escalationTriggers: string;
  }[];
  dailySubtasks: {
    parentTaskTitle: string;
    title: string;
    assignedRole: string;
    frequency: 'daily' | 'weekly' | 'monthly';
  }[];
  formationRationale: string;
  dataIntegrityNotes: string;
};

// AI Document Analysis table - tracks AI analysis jobs for deals
export const aiDocumentAnalyses = pgTable("ai_document_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default('pending'), // pending, processing, completed, failed
  selectedDocuments: jsonb("selected_documents").default([]).$type<string[]>(), // Array of document URLs/paths
  extractedText: text("extracted_text"), // Concatenated text from all documents
  summary: text("summary"), // AI-generated summary
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertAiDocumentAnalysisSchema = createInsertSchema(aiDocumentAnalyses).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertAiDocumentAnalysis = z.infer<typeof insertAiDocumentAnalysisSchema>;
export type AiDocumentAnalysis = typeof aiDocumentAnalyses.$inferSelect;

// Job titles that are NOT eligible for deal work (support roles)
export const NON_DEAL_ELIGIBLE_JOB_TITLES = [
  'AI Engineer',
  'Head of Human Resources',
  'HR Manager',
  'HR Specialist',
  'Software Engineer',
  'IT Support',
  'Office Manager',
  'Administrative Assistant',
  'Receptionist',
];

// Helper function to check if a user is eligible for deal work
export function isDealEligibleUser(user: User): boolean {
  // External users are not eligible
  if (user.isExternal) return false;
  
  // Check if job title is in the non-eligible list (case-insensitive)
  if (user.jobTitle) {
    const normalizedJobTitle = user.jobTitle.trim().toLowerCase();
    const isNonEligible = NON_DEAL_ELIGIBLE_JOB_TITLES.some(
      title => normalizedJobTitle === title.toLowerCase()
    );
    if (isNonEligible) return false;
  }
  
  return true;
}
