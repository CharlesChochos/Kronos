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
  sector: text("sector").notNull(),
  lead: text("lead").notNull(),
  progress: integer("progress").default(0),
  status: text("status").notNull().default('Active'),
  description: text("description"),
  attachments: jsonb("attachments").default([]),
  podTeam: jsonb("pod_team").default([]).$type<PodTeamMember[]>(),
  taggedInvestors: jsonb("tagged_investors").default([]).$type<TaggedInvestor[]>(),
  auditTrail: jsonb("audit_trail").default([]).$type<AuditEntry[]>(),
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
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default('Pending'),
  type: text("type").notNull(),
  attachments: jsonb("attachments").default([]).$type<TaskAttachment[]>(),
  completedAt: timestamp("completed_at"),
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

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).$type<MessageAttachment[]>(),
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
  stage: text("stage").notNull(), // Origination, Due Diligence, Negotiation, etc.
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
