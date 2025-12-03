import { eq, and, desc, gt } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import type { User, InsertUser, Deal, InsertDeal, Task, InsertTask, Meeting, InsertMeeting, Notification, InsertNotification, PasswordResetToken, AssistantConversation, InsertAssistantConversation, AssistantMessage, InsertAssistantMessage, Conversation, InsertConversation, ConversationMember, InsertConversationMember, Message, InsertMessage, TimeEntry, InsertTimeEntry, TimeOffRequest, InsertTimeOffRequest, AuditLog, InsertAuditLog, Investor, InsertInvestor, InvestorInteraction, InsertInvestorInteraction, Okr, InsertOkr, Stakeholder, InsertStakeholder, Announcement, InsertAnnouncement, Poll, InsertPoll, MentorshipPairing, InsertMentorshipPairing, ClientPortalAccess, InsertClientPortalAccess, DocumentTemplate, InsertDocumentTemplate, InvestorMatch, InsertInvestorMatch, UserPreferences, InsertUserPreferences, DealTemplate, InsertDealTemplate, CalendarEvent, InsertCalendarEvent, TaskAttachmentRecord, InsertTaskAttachmentRecord } from "@shared/schema";
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
  
  // Chat conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  getConversationBetweenUsers(userId1: string, userId2: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMember(conversationId: string, userId: string): Promise<ConversationMember>;
  getConversationMembers(conversationId: string): Promise<ConversationMember[]>;
  
  // Chat message operations
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getUnreadMessageCount(userId: string): Promise<number>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  
  // Time Entry operations
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByUser(userId: string): Promise<TimeEntry[]>;
  getTimeEntriesByDeal(dealId: string): Promise<TimeEntry[]>;
  getAllTimeEntries(): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<void>;
  
  // Time Off Request operations
  getTimeOffRequest(id: string): Promise<TimeOffRequest | undefined>;
  getTimeOffRequestsByUser(userId: string): Promise<TimeOffRequest[]>;
  getAllTimeOffRequests(): Promise<TimeOffRequest[]>;
  createTimeOffRequest(request: InsertTimeOffRequest): Promise<TimeOffRequest>;
  updateTimeOffRequest(id: string, updates: Partial<InsertTimeOffRequest>): Promise<TimeOffRequest | undefined>;
  deleteTimeOffRequest(id: string): Promise<void>;
  
  // Audit Log operations
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Investor operations
  getInvestor(id: string): Promise<Investor | undefined>;
  getAllInvestors(): Promise<Investor[]>;
  createInvestor(investor: InsertInvestor): Promise<Investor>;
  updateInvestor(id: string, updates: Partial<InsertInvestor>): Promise<Investor | undefined>;
  deleteInvestor(id: string): Promise<void>;
  
  // Investor Interaction operations
  getInvestorInteractions(investorId: string): Promise<InvestorInteraction[]>;
  createInvestorInteraction(interaction: InsertInvestorInteraction): Promise<InvestorInteraction>;
  deleteInvestorInteraction(id: string): Promise<void>;
  
  // OKR operations
  getOkr(id: string): Promise<Okr | undefined>;
  getAllOkrs(): Promise<Okr[]>;
  createOkr(okr: InsertOkr): Promise<Okr>;
  updateOkr(id: string, updates: Partial<InsertOkr>): Promise<Okr | undefined>;
  deleteOkr(id: string): Promise<void>;
  
  // Stakeholder operations
  getStakeholder(id: string): Promise<Stakeholder | undefined>;
  getAllStakeholders(): Promise<Stakeholder[]>;
  createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder>;
  updateStakeholder(id: string, updates: Partial<InsertStakeholder>): Promise<Stakeholder | undefined>;
  deleteStakeholder(id: string): Promise<void>;
  
  // Announcement operations
  getAnnouncement(id: string): Promise<Announcement | undefined>;
  getAllAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<void>;
  
  // Poll operations
  getPoll(id: string): Promise<Poll | undefined>;
  getAllPolls(): Promise<Poll[]>;
  createPoll(poll: InsertPoll): Promise<Poll>;
  updatePoll(id: string, updates: Partial<InsertPoll>): Promise<Poll | undefined>;
  deletePoll(id: string): Promise<void>;
  
  // Mentorship Pairing operations
  getMentorshipPairing(id: string): Promise<MentorshipPairing | undefined>;
  getAllMentorshipPairings(): Promise<MentorshipPairing[]>;
  createMentorshipPairing(pairing: InsertMentorshipPairing): Promise<MentorshipPairing>;
  updateMentorshipPairing(id: string, updates: Partial<InsertMentorshipPairing>): Promise<MentorshipPairing | undefined>;
  deleteMentorshipPairing(id: string): Promise<void>;
  
  // Client Portal Access operations
  getClientPortalAccess(id: string): Promise<ClientPortalAccess | undefined>;
  getAllClientPortalAccess(): Promise<ClientPortalAccess[]>;
  getClientPortalAccessByDeal(dealId: string): Promise<ClientPortalAccess[]>;
  createClientPortalAccess(access: InsertClientPortalAccess): Promise<ClientPortalAccess>;
  updateClientPortalAccess(id: string, updates: Partial<InsertClientPortalAccess>): Promise<ClientPortalAccess | undefined>;
  deleteClientPortalAccess(id: string): Promise<void>;
  
  // Document Template operations
  getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined>;
  getAllDocumentTemplates(): Promise<DocumentTemplate[]>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: string): Promise<void>;
  
  // Investor Match operations
  getInvestorMatchesByDeal(dealId: string): Promise<InvestorMatch[]>;
  createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch>;
  deleteInvestorMatch(dealId: string, investorId: number): Promise<void>;
  deleteInvestorMatchesByDeal(dealId: string): Promise<void>;
  
  // User Preferences operations
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferencesRecord(userId: string, updates: Partial<InsertUserPreferences>): Promise<UserPreferences | undefined>;
  
  // Deal Template operations
  getDealTemplate(id: string): Promise<DealTemplate | undefined>;
  getAllDealTemplates(): Promise<DealTemplate[]>;
  createDealTemplate(template: InsertDealTemplate): Promise<DealTemplate>;
  updateDealTemplate(id: string, updates: Partial<InsertDealTemplate>): Promise<DealTemplate | undefined>;
  deleteDealTemplate(id: string): Promise<void>;
  
  // Calendar Event operations
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getAllCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEventsByDeal(dealId: string): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;
  
  // Task Attachment Record operations
  getTaskAttachmentRecords(taskId: string): Promise<TaskAttachmentRecord[]>;
  createTaskAttachmentRecord(attachment: InsertTaskAttachmentRecord): Promise<TaskAttachmentRecord>;
  deleteTaskAttachmentRecord(id: string): Promise<void>;
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
  
  // Chat conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    return conversation;
  }
  
  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    const memberships = await db.select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userId));
    
    if (memberships.length === 0) return [];
    
    const conversationIds = memberships.map(m => m.conversationId);
    const conversations: Conversation[] = [];
    
    for (const convId of conversationIds) {
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, convId));
      if (conv) conversations.push(conv);
    }
    
    return conversations.sort((a, b) => 
      (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
    );
  }
  
  async getConversationBetweenUsers(userId1: string, userId2: string): Promise<Conversation | undefined> {
    const user1Convs = await this.getConversationsByUser(userId1);
    
    for (const conv of user1Convs) {
      if (conv.isGroup) continue;
      const members = await this.getConversationMembers(conv.id);
      const memberIds = members.map(m => m.userId);
      if (memberIds.includes(userId2) && memberIds.length === 2) {
        return conv;
      }
    }
    return undefined;
  }
  
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(schema.conversations)
      .values(conversation)
      .returning();
    return created;
  }
  
  async addConversationMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const [member] = await db.insert(schema.conversationMembers)
      .values({ conversationId, userId })
      .returning();
    return member;
  }
  
  async getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
    return await db.select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, conversationId));
  }
  
  // Chat message operations
  async getMessages(conversationId: string): Promise<Message[]> {
    return await db.select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt);
  }
  
  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(schema.messages)
      .values(message)
      .returning();
    await db.update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.conversations.id, message.conversationId));
    return created;
  }
  
  async getUnreadMessageCount(userId: string): Promise<number> {
    const memberships = await db.select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userId));
    
    let unreadCount = 0;
    for (const membership of memberships) {
      const lastRead = membership.lastReadAt || new Date(0);
      const messages = await db.select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, membership.conversationId),
            gt(schema.messages.createdAt, lastRead)
          )
        );
      unreadCount += messages.filter(m => m.senderId !== userId).length;
    }
    return unreadCount;
  }
  
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db.update(schema.conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, userId)
        )
      );
  }
  
  // Time Entry operations
  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(schema.timeEntries).where(eq(schema.timeEntries.id, id));
    return entry;
  }
  
  async getTimeEntriesByUser(userId: string): Promise<TimeEntry[]> {
    return await db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.userId, userId))
      .orderBy(desc(schema.timeEntries.date));
  }
  
  async getTimeEntriesByDeal(dealId: string): Promise<TimeEntry[]> {
    return await db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.dealId, dealId))
      .orderBy(desc(schema.timeEntries.date));
  }
  
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    return await db.select().from(schema.timeEntries).orderBy(desc(schema.timeEntries.date));
  }
  
  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [created] = await db.insert(schema.timeEntries).values(entry).returning();
    return created;
  }
  
  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [updated] = await db.update(schema.timeEntries)
      .set(updates)
      .where(eq(schema.timeEntries.id, id))
      .returning();
    return updated;
  }
  
  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  }
  
  // Time Off Request operations
  async getTimeOffRequest(id: string): Promise<TimeOffRequest | undefined> {
    const [request] = await db.select().from(schema.timeOffRequests).where(eq(schema.timeOffRequests.id, id));
    return request;
  }
  
  async getTimeOffRequestsByUser(userId: string): Promise<TimeOffRequest[]> {
    return await db.select().from(schema.timeOffRequests)
      .where(eq(schema.timeOffRequests.userId, userId))
      .orderBy(desc(schema.timeOffRequests.startDate));
  }
  
  async getAllTimeOffRequests(): Promise<TimeOffRequest[]> {
    return await db.select().from(schema.timeOffRequests).orderBy(desc(schema.timeOffRequests.startDate));
  }
  
  async createTimeOffRequest(request: InsertTimeOffRequest): Promise<TimeOffRequest> {
    const [created] = await db.insert(schema.timeOffRequests).values(request).returning();
    return created;
  }
  
  async updateTimeOffRequest(id: string, updates: Partial<InsertTimeOffRequest>): Promise<TimeOffRequest | undefined> {
    const [updated] = await db.update(schema.timeOffRequests)
      .set(updates)
      .where(eq(schema.timeOffRequests.id, id))
      .returning();
    return updated;
  }
  
  async deleteTimeOffRequest(id: string): Promise<void> {
    await db.delete(schema.timeOffRequests).where(eq(schema.timeOffRequests.id, id));
  }
  
  // Audit Log operations
  async getAuditLogs(limit?: number): Promise<AuditLog[]> {
    const query = db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  
  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return await db.select().from(schema.auditLogs)
      .where(eq(schema.auditLogs.userId, userId))
      .orderBy(desc(schema.auditLogs.createdAt));
  }
  
  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db.select().from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entityType, entityType),
        eq(schema.auditLogs.entityId, entityId)
      ))
      .orderBy(desc(schema.auditLogs.createdAt));
  }
  
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(schema.auditLogs).values(log).returning();
    return created;
  }
  
  // Investor operations
  async getInvestor(id: string): Promise<Investor | undefined> {
    const [investor] = await db.select().from(schema.investors).where(eq(schema.investors.id, id));
    return investor;
  }
  
  async getAllInvestors(): Promise<Investor[]> {
    return await db.select().from(schema.investors).orderBy(schema.investors.name);
  }
  
  async createInvestor(investor: InsertInvestor): Promise<Investor> {
    const [created] = await db.insert(schema.investors).values(investor).returning();
    return created;
  }
  
  async updateInvestor(id: string, updates: Partial<InsertInvestor>): Promise<Investor | undefined> {
    const [updated] = await db.update(schema.investors)
      .set(updates)
      .where(eq(schema.investors.id, id))
      .returning();
    return updated;
  }
  
  async deleteInvestor(id: string): Promise<void> {
    await db.delete(schema.investorInteractions).where(eq(schema.investorInteractions.investorId, id));
    await db.delete(schema.investors).where(eq(schema.investors.id, id));
  }
  
  // Investor Interaction operations
  async getInvestorInteractions(investorId: string): Promise<InvestorInteraction[]> {
    return await db.select().from(schema.investorInteractions)
      .where(eq(schema.investorInteractions.investorId, investorId))
      .orderBy(desc(schema.investorInteractions.date));
  }
  
  async createInvestorInteraction(interaction: InsertInvestorInteraction): Promise<InvestorInteraction> {
    const [created] = await db.insert(schema.investorInteractions).values(interaction).returning();
    return created;
  }
  
  async deleteInvestorInteraction(id: string): Promise<void> {
    await db.delete(schema.investorInteractions).where(eq(schema.investorInteractions.id, id));
  }
  
  // OKR operations
  async getOkr(id: string): Promise<Okr | undefined> {
    const [okr] = await db.select().from(schema.okrs).where(eq(schema.okrs.id, id));
    return okr;
  }
  
  async getAllOkrs(): Promise<Okr[]> {
    return await db.select().from(schema.okrs).orderBy(desc(schema.okrs.createdAt));
  }
  
  async createOkr(okr: InsertOkr): Promise<Okr> {
    const [created] = await db.insert(schema.okrs).values(okr).returning();
    return created;
  }
  
  async updateOkr(id: string, updates: Partial<InsertOkr>): Promise<Okr | undefined> {
    const [updated] = await db.update(schema.okrs)
      .set(updates)
      .where(eq(schema.okrs.id, id))
      .returning();
    return updated;
  }
  
  async deleteOkr(id: string): Promise<void> {
    await db.delete(schema.okrs).where(eq(schema.okrs.id, id));
  }
  
  // Stakeholder operations
  async getStakeholder(id: string): Promise<Stakeholder | undefined> {
    const [stakeholder] = await db.select().from(schema.stakeholders).where(eq(schema.stakeholders.id, id));
    return stakeholder;
  }
  
  async getAllStakeholders(): Promise<Stakeholder[]> {
    return await db.select().from(schema.stakeholders).orderBy(schema.stakeholders.name);
  }
  
  async createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder> {
    const [created] = await db.insert(schema.stakeholders).values(stakeholder).returning();
    return created;
  }
  
  async updateStakeholder(id: string, updates: Partial<InsertStakeholder>): Promise<Stakeholder | undefined> {
    const [updated] = await db.update(schema.stakeholders)
      .set(updates)
      .where(eq(schema.stakeholders.id, id))
      .returning();
    return updated;
  }
  
  async deleteStakeholder(id: string): Promise<void> {
    await db.delete(schema.stakeholders).where(eq(schema.stakeholders.id, id));
  }
  
  // Announcement operations
  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
    return announcement;
  }
  
  async getAllAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(schema.announcements).orderBy(desc(schema.announcements.createdAt));
  }
  
  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(schema.announcements).values(announcement).returning();
    return created;
  }
  
  async updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [updated] = await db.update(schema.announcements)
      .set(updates)
      .where(eq(schema.announcements.id, id))
      .returning();
    return updated;
  }
  
  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  }
  
  // Poll operations
  async getPoll(id: string): Promise<Poll | undefined> {
    const [poll] = await db.select().from(schema.polls).where(eq(schema.polls.id, id));
    return poll;
  }
  
  async getAllPolls(): Promise<Poll[]> {
    return await db.select().from(schema.polls).orderBy(desc(schema.polls.createdAt));
  }
  
  async createPoll(poll: InsertPoll): Promise<Poll> {
    const [created] = await db.insert(schema.polls).values(poll).returning();
    return created;
  }
  
  async updatePoll(id: string, updates: Partial<InsertPoll>): Promise<Poll | undefined> {
    const [updated] = await db.update(schema.polls)
      .set(updates)
      .where(eq(schema.polls.id, id))
      .returning();
    return updated;
  }
  
  async deletePoll(id: string): Promise<void> {
    await db.delete(schema.polls).where(eq(schema.polls.id, id));
  }
  
  // Mentorship Pairing operations
  async getMentorshipPairing(id: string): Promise<MentorshipPairing | undefined> {
    const [pairing] = await db.select().from(schema.mentorshipPairings).where(eq(schema.mentorshipPairings.id, id));
    return pairing;
  }
  
  async getAllMentorshipPairings(): Promise<MentorshipPairing[]> {
    return await db.select().from(schema.mentorshipPairings).orderBy(desc(schema.mentorshipPairings.createdAt));
  }
  
  async createMentorshipPairing(pairing: InsertMentorshipPairing): Promise<MentorshipPairing> {
    const [created] = await db.insert(schema.mentorshipPairings).values(pairing).returning();
    return created;
  }
  
  async updateMentorshipPairing(id: string, updates: Partial<InsertMentorshipPairing>): Promise<MentorshipPairing | undefined> {
    const [updated] = await db.update(schema.mentorshipPairings)
      .set(updates)
      .where(eq(schema.mentorshipPairings.id, id))
      .returning();
    return updated;
  }
  
  async deleteMentorshipPairing(id: string): Promise<void> {
    await db.delete(schema.mentorshipPairings).where(eq(schema.mentorshipPairings.id, id));
  }
  
  // Client Portal Access operations
  async getClientPortalAccess(id: string): Promise<ClientPortalAccess | undefined> {
    const [access] = await db.select().from(schema.clientPortalAccess).where(eq(schema.clientPortalAccess.id, id));
    return access;
  }
  
  async getAllClientPortalAccess(): Promise<ClientPortalAccess[]> {
    return await db.select().from(schema.clientPortalAccess).orderBy(desc(schema.clientPortalAccess.createdAt));
  }
  
  async getClientPortalAccessByDeal(dealId: string): Promise<ClientPortalAccess[]> {
    return await db.select().from(schema.clientPortalAccess)
      .where(eq(schema.clientPortalAccess.dealId, dealId))
      .orderBy(desc(schema.clientPortalAccess.createdAt));
  }
  
  async createClientPortalAccess(access: InsertClientPortalAccess): Promise<ClientPortalAccess> {
    const [created] = await db.insert(schema.clientPortalAccess).values(access).returning();
    return created;
  }
  
  async updateClientPortalAccess(id: string, updates: Partial<InsertClientPortalAccess>): Promise<ClientPortalAccess | undefined> {
    const [updated] = await db.update(schema.clientPortalAccess)
      .set(updates)
      .where(eq(schema.clientPortalAccess.id, id))
      .returning();
    return updated;
  }
  
  async deleteClientPortalAccess(id: string): Promise<void> {
    await db.delete(schema.clientPortalAccess).where(eq(schema.clientPortalAccess.id, id));
  }
  
  // Document Template operations
  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
    return template;
  }
  
  async getAllDocumentTemplates(): Promise<DocumentTemplate[]> {
    return await db.select().from(schema.documentTemplates).orderBy(schema.documentTemplates.name);
  }
  
  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [created] = await db.insert(schema.documentTemplates).values(template).returning();
    return created;
  }
  
  async updateDocumentTemplate(id: string, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined> {
    const [updated] = await db.update(schema.documentTemplates)
      .set(updates)
      .where(eq(schema.documentTemplates.id, id))
      .returning();
    return updated;
  }
  
  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
  }
  
  // Investor Match operations
  async getInvestorMatchesByDeal(dealId: string): Promise<InvestorMatch[]> {
    return await db.select().from(schema.investorMatches)
      .where(eq(schema.investorMatches.dealId, dealId))
      .orderBy(desc(schema.investorMatches.matchedAt));
  }
  
  async createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch> {
    const [created] = await db.insert(schema.investorMatches).values(match).returning();
    return created;
  }
  
  async deleteInvestorMatch(dealId: string, investorId: number): Promise<void> {
    await db.delete(schema.investorMatches)
      .where(and(
        eq(schema.investorMatches.dealId, dealId),
        eq(schema.investorMatches.investorId, investorId)
      ));
  }
  
  async deleteInvestorMatchesByDeal(dealId: string): Promise<void> {
    await db.delete(schema.investorMatches).where(eq(schema.investorMatches.dealId, dealId));
  }
  
  // User Preferences operations
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId));
    return prefs;
  }
  
  async upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(prefs.userId);
    if (existing) {
      const [updated] = await db.update(schema.userPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(schema.userPreferences.userId, prefs.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schema.userPreferences).values(prefs).returning();
      return created;
    }
  }
  
  async updateUserPreferencesRecord(userId: string, updates: Partial<InsertUserPreferences>): Promise<UserPreferences | undefined> {
    const [updated] = await db.update(schema.userPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userPreferences.userId, userId))
      .returning();
    return updated;
  }
  
  // Deal Template operations
  async getDealTemplate(id: string): Promise<DealTemplate | undefined> {
    const [template] = await db.select().from(schema.dealTemplates).where(eq(schema.dealTemplates.id, id));
    return template;
  }
  
  async getAllDealTemplates(): Promise<DealTemplate[]> {
    return await db.select().from(schema.dealTemplates).orderBy(desc(schema.dealTemplates.usageCount));
  }
  
  async createDealTemplate(template: InsertDealTemplate): Promise<DealTemplate> {
    const [created] = await db.insert(schema.dealTemplates).values(template).returning();
    return created;
  }
  
  async updateDealTemplate(id: string, updates: Partial<InsertDealTemplate>): Promise<DealTemplate | undefined> {
    const [updated] = await db.update(schema.dealTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.dealTemplates.id, id))
      .returning();
    return updated;
  }
  
  async deleteDealTemplate(id: string): Promise<void> {
    await db.delete(schema.dealTemplates).where(eq(schema.dealTemplates.id, id));
  }
  
  // Calendar Event operations
  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id));
    return event;
  }
  
  async getAllCalendarEvents(): Promise<CalendarEvent[]> {
    return await db.select().from(schema.calendarEvents).orderBy(schema.calendarEvents.date);
  }
  
  async getCalendarEventsByDeal(dealId: string): Promise<CalendarEvent[]> {
    return await db.select().from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.dealId, dealId))
      .orderBy(schema.calendarEvents.date);
  }
  
  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [created] = await db.insert(schema.calendarEvents).values(event).returning();
    return created;
  }
  
  async updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [updated] = await db.update(schema.calendarEvents)
      .set(updates)
      .where(eq(schema.calendarEvents.id, id))
      .returning();
    return updated;
  }
  
  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, id));
  }
  
  // Task Attachment Record operations
  async getTaskAttachmentRecords(taskId: string): Promise<TaskAttachmentRecord[]> {
    return await db.select().from(schema.taskAttachmentsTable)
      .where(eq(schema.taskAttachmentsTable.taskId, taskId))
      .orderBy(desc(schema.taskAttachmentsTable.uploadedAt));
  }
  
  async createTaskAttachmentRecord(attachment: InsertTaskAttachmentRecord): Promise<TaskAttachmentRecord> {
    const [created] = await db.insert(schema.taskAttachmentsTable).values(attachment).returning();
    return created;
  }
  
  async deleteTaskAttachmentRecord(id: string): Promise<void> {
    await db.delete(schema.taskAttachmentsTable).where(eq(schema.taskAttachmentsTable.id, id));
  }
}

export const storage = new DatabaseStorage();
