import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('Associate'),
  score: integer("score").default(0),
  activeDeals: integer("active_deals").default(0),
  completedTasks: integer("completed_tasks").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
