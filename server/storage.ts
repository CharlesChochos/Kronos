import { eq, and, desc, gt } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import type { User, InsertUser, Deal, InsertDeal, Task, InsertTask, Meeting, InsertMeeting, Notification, InsertNotification, PasswordResetToken, AssistantConversation, InsertAssistantConversation, AssistantMessage, InsertAssistantMessage } from "@shared/schema";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserScore(id: string, score: number): Promise<void>;
  updateUserStats(id: string, activeDeals: number, completedTasks: number): Promise<void>;
  updateUserProfile(id: string, updates: { name?: string; email?: string; phone?: string; avatar?: string; role?: string }): Promise<User | undefined>;
  updateUserPassword(id: string, newPassword: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Deal operations
  getDeal(id: string): Promise<Deal | undefined>;
  getAllDeals(): Promise<Deal[]>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<void>;
  
  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getTasksByDeal(dealId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  
  // Meeting operations
  getMeeting(id: string): Promise<Meeting | undefined>;
  getAllMeetings(): Promise<Meeting[]>;
  getMeetingsByOrganizer(organizerId: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  
  // Notification operations
  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  
  // User preferences
  updateUserPreferences(id: string, preferences: any): Promise<void>;
  
  // Password reset token operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getValidPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  
  // Assistant conversation operations
  getAssistantConversation(id: string): Promise<AssistantConversation | undefined>;
  getAssistantConversationsByUser(userId: string): Promise<AssistantConversation[]>;
  createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation>;
  updateAssistantConversationTitle(id: string, title: string): Promise<AssistantConversation | undefined>;
  deleteAssistantConversation(id: string): Promise<void>;
  
  // Assistant message operations
  getAssistantMessages(conversationId: string): Promise<AssistantMessage[]>;
  createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(schema.users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUserScore(id: string, score: number): Promise<void> {
    await db.update(schema.users)
      .set({ score })
      .where(eq(schema.users.id, id));
  }

  async updateUserStats(id: string, activeDeals: number, completedTasks: number): Promise<void> {
    await db.update(schema.users)
      .set({ activeDeals, completedTasks })
      .where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async updateUserProfile(id: string, updates: { name?: string; email?: string; phone?: string; avatar?: string; role?: string }): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.id, id));
  }

  // Deal operations
  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id));
    return deal;
  }

  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(schema.deals);
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(schema.deals)
      .values(insertDeal)
      .returning();
    return deal;
  }

  async updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db.update(schema.deals)
      .set(updates)
      .where(eq(schema.deals.id, id))
      .returning();
    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(schema.deals).where(eq(schema.deals.id, id));
  }

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(schema.tasks);
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(eq(schema.tasks.assignedTo, userId));
  }

  async getTasksByDeal(dealId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(eq(schema.tasks.dealId, dealId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(schema.tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(schema.tasks)
      .set(updates)
      .where(eq(schema.tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  }
  
  // Meeting operations
  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id));
    return meeting;
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await db.select().from(schema.meetings).orderBy(desc(schema.meetings.scheduledFor));
  }

  async getMeetingsByOrganizer(organizerId: string): Promise<Meeting[]> {
    return await db.select().from(schema.meetings).where(eq(schema.meetings.organizerId, organizerId));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(schema.meetings)
      .values(insertMeeting)
      .returning();
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [meeting] = await db.update(schema.meetings)
      .set(updates)
      .where(eq(schema.meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(schema.meetings).where(eq(schema.meetings.id, id));
  }

  // Notification operations
  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
    return notification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(schema.notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.id, id));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }

  // User preferences
  async updateUserPreferences(id: string, preferences: any): Promise<void> {
    await db.update(schema.users)
      .set({ preferences })
      .where(eq(schema.users.id, id));
  }
  
  // Password reset token operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(schema.passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  }
  
  async getValidPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select()
      .from(schema.passwordResetTokens)
      .where(
        and(
          eq(schema.passwordResetTokens.token, token),
          eq(schema.passwordResetTokens.used, false),
          gt(schema.passwordResetTokens.expiresAt, new Date())
        )
      );
    return resetToken;
  }
  
  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(schema.passwordResetTokens)
      .set({ used: true })
      .where(eq(schema.passwordResetTokens.id, id));
  }
  
  // Assistant conversation operations
  async getAssistantConversation(id: string): Promise<AssistantConversation | undefined> {
    const [conversation] = await db.select().from(schema.assistantConversations).where(eq(schema.assistantConversations.id, id));
    return conversation;
  }
  
  async getAssistantConversationsByUser(userId: string): Promise<AssistantConversation[]> {
    return await db.select().from(schema.assistantConversations)
      .where(eq(schema.assistantConversations.userId, userId))
      .orderBy(desc(schema.assistantConversations.updatedAt));
  }
  
  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    const [created] = await db.insert(schema.assistantConversations)
      .values(conversation)
      .returning();
    return created;
  }
  
  async updateAssistantConversationTitle(id: string, title: string): Promise<AssistantConversation | undefined> {
    const [updated] = await db.update(schema.assistantConversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.assistantConversations.id, id))
      .returning();
    return updated;
  }
  
  async deleteAssistantConversation(id: string): Promise<void> {
    await db.delete(schema.assistantMessages).where(eq(schema.assistantMessages.conversationId, id));
    await db.delete(schema.assistantConversations).where(eq(schema.assistantConversations.id, id));
  }
  
  // Assistant message operations
  async getAssistantMessages(conversationId: string): Promise<AssistantMessage[]> {
    return await db.select().from(schema.assistantMessages)
      .where(eq(schema.assistantMessages.conversationId, conversationId))
      .orderBy(schema.assistantMessages.createdAt);
  }
  
  async createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage> {
    const [created] = await db.insert(schema.assistantMessages)
      .values(message)
      .returning();
    await db.update(schema.assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.assistantConversations.id, message.conversationId));
    return created;
  }
}

export const storage = new DatabaseStorage();
