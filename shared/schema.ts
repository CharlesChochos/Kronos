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
  role: text("role").notNull().default('Associate'),
  jobTitle: text("job_title"),
  score: integer("score").default(0),
  activeDeals: integer("active_deals").default(0),
  completedTasks: integer("completed_tasks").default(0),
  preferences: jsonb("preferences").default({}),
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
};

// Audit Trail Entry type
export type AuditEntry = {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
};

// Deals table
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
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
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  priority: text("priority").notNull().default('Medium'),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default('Pending'),
  type: text("type").notNull(),
  attachments: jsonb("attachments").default([]).$type<TaskAttachment[]>(),
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

// Reaper Assistant Messages table
export const assistantMessages = pgTable("assistant_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => assistantConversations.id).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
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
