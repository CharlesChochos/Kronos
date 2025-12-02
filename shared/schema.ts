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
  role: text("role").notNull().default('Associate'),
  score: integer("score").default(0),
  activeDeals: integer("active_deals").default(0),
  completedTasks: integer("completed_tasks").default(0),
  preferences: jsonb("preferences").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

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

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  dealId: varchar("deal_id").references(() => deals.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  priority: text("priority").notNull().default('Medium'),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default('Pending'),
  type: text("type").notNull(),
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
