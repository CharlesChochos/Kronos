import { eq, and, desc, gt, lt, or, ilike, count, isNull, not } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import type { User, InsertUser, Deal, InsertDeal, Task, InsertTask, Meeting, InsertMeeting, Notification, InsertNotification, PasswordResetToken, AssistantConversation, InsertAssistantConversation, AssistantMessage, InsertAssistantMessage, Conversation, InsertConversation, ConversationMember, InsertConversationMember, Message, InsertMessage, TimeEntry, InsertTimeEntry, TimeOffRequest, InsertTimeOffRequest, AuditLog, InsertAuditLog, Investor, InsertInvestor, InvestorInteraction, InsertInvestorInteraction, Okr, InsertOkr, Stakeholder, InsertStakeholder, Announcement, InsertAnnouncement, Poll, InsertPoll, MentorshipPairing, InsertMentorshipPairing, ClientPortalAccess, InsertClientPortalAccess, DocumentTemplate, InsertDocumentTemplate, InvestorMatch, InsertInvestorMatch, UserPreferences, InsertUserPreferences, DealTemplate, InsertDealTemplate, CalendarEvent, InsertCalendarEvent, TaskAttachmentRecord, InsertTaskAttachmentRecord, ClientPortalInvite, InsertClientPortalInvite, ClientPortalMessage, InsertClientPortalMessage, ClientPortalUpdate, InsertClientPortalUpdate, DealFee, InsertDealFee, StageDocument, InsertStageDocument, StagePodMember, InsertStagePodMember, StageVoiceNote, InsertStageVoiceNote, TaskComment, InsertTaskComment, DealNote, InsertDealNote } from "@shared/schema";
import bcrypt from "bcryptjs";

// Always prefer PRODUCTION_DATABASE_URL if set, otherwise use DATABASE_URL
// This ensures both dev and production use the same database when PRODUCTION_DATABASE_URL is configured
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!;

// Debug logging for database connection
console.log(`[Storage] PRODUCTION_DATABASE_URL exists: ${!!process.env.PRODUCTION_DATABASE_URL}`);
console.log(`[Storage] DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
console.log(`[Storage] Using PRODUCTION_DATABASE_URL: ${!!process.env.PRODUCTION_DATABASE_URL}`);

const sql = neon(databaseUrl);
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
  getDealsListing(): Promise<Array<Pick<Deal, 'id' | 'name' | 'dealType' | 'stage' | 'value' | 'client' | 'clientContactName' | 'clientContactEmail' | 'sector' | 'lead' | 'progress' | 'status' | 'description' | 'createdAt' | 'podTeam' | 'archivedAt'> & { attachmentCount: number }>>;
  getArchivedDeals(): Promise<Deal[]>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined>;
  appendDealAttachments(id: string, newAttachments: any[]): Promise<Deal | undefined>;
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
  updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;
  addConversationMember(conversationId: string, userId: string): Promise<ConversationMember>;
  getConversationMembers(conversationId: string): Promise<ConversationMember[]>;
  
  // Chat message operations
  getMessages(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  deleteConversationMessages(conversationId: string): Promise<void>;
  deleteConversationMembers(conversationId: string): Promise<void>;
  
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
  getStakeholdersPaginated(options: {
    page: number;
    pageSize: number;
    search?: string;
    type?: string;
  }): Promise<{ stakeholders: Stakeholder[]; total: number }>;
  getStakeholderStats(): Promise<{ total: number; typeCounts: Record<string, number>; favoriteCount: number }>;
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
  
  // User Status Management operations
  updateUserStatus(id: string, status: string): Promise<User | undefined>;
  updateUserAccessLevel(id: string, accessLevel: string): Promise<User | undefined>;
  getUsersByStatus(status: string): Promise<User[]>;
  updateUserTwoFactor(id: string, enabled: boolean, secret?: string): Promise<User | undefined>;
  
  // Audit Log Table operations (new compliance logs)
  getAuditLogTableEntries(limit?: number): Promise<schema.AuditLogTable[]>;
  createAuditLogTableEntry(log: schema.InsertAuditLogTable): Promise<schema.AuditLogTable>;
  
  // Database-backed Investors operations
  getInvestorFromTable(id: string): Promise<schema.InvestorTable | undefined>;
  getAllInvestorsFromTable(): Promise<schema.InvestorTable[]>;
  createInvestorInTable(investor: schema.InsertInvestorTable): Promise<schema.InvestorTable>;
  updateInvestorInTable(id: string, updates: Partial<schema.InsertInvestorTable>): Promise<schema.InvestorTable | undefined>;
  deleteInvestorFromTable(id: string): Promise<void>;
  
  // Document Table operations
  getDocument(id: string): Promise<schema.DocumentTable | undefined>;
  getAllDocuments(): Promise<schema.DocumentTable[]>;
  getDocumentsList(): Promise<Omit<schema.DocumentTable, 'fileData'>[]>; // Lightweight version without file data
  getDocumentsByDeal(dealId: string): Promise<schema.DocumentTable[]>;
  getDocumentsByUser(userId: string): Promise<schema.DocumentTable[]>;
  createDocument(doc: schema.InsertDocumentTable): Promise<schema.DocumentTable>;
  updateDocument(id: string, updates: Partial<schema.InsertDocumentTable>): Promise<schema.DocumentTable | undefined>;
  deleteDocument(id: string): Promise<void>;
  
  // Client Portal Invite operations
  getClientPortalInvite(id: string): Promise<ClientPortalInvite | undefined>;
  getClientPortalInviteByToken(token: string): Promise<ClientPortalInvite | undefined>;
  getClientPortalInvitesByInviter(inviterId: string): Promise<ClientPortalInvite[]>;
  getAllClientPortalInvites(): Promise<ClientPortalInvite[]>;
  createClientPortalInvite(invite: InsertClientPortalInvite): Promise<ClientPortalInvite>;
  updateClientPortalInvite(id: string, updates: Partial<InsertClientPortalInvite & { acceptedAt?: Date; userId?: string; status?: string }>): Promise<ClientPortalInvite | undefined>;
  deleteClientPortalInvite(id: string): Promise<void>;
  
  // Client Portal Message operations
  getClientPortalMessagesByDeal(dealId: string): Promise<ClientPortalMessage[]>;
  createClientPortalMessage(message: InsertClientPortalMessage): Promise<ClientPortalMessage>;
  
  // Client Portal Update operations
  getClientPortalUpdatesByDeal(dealId: string): Promise<ClientPortalUpdate[]>;
  createClientPortalUpdate(update: InsertClientPortalUpdate): Promise<ClientPortalUpdate>;
  
  // External User operations
  getExternalUsers(): Promise<User[]>;
  createExternalUser(user: InsertUser & { isExternal: boolean; externalOrganization?: string; invitedBy?: string }): Promise<User>;
  getExternalUserDeals(userId: string): Promise<Deal[]>;
  
  // Deal Fee operations
  getDealFees(dealId: string): Promise<DealFee[]>;
  createDealFee(fee: InsertDealFee): Promise<DealFee>;
  updateDealFee(id: string, updates: Partial<InsertDealFee>): Promise<DealFee | undefined>;
  deleteDealFee(id: string): Promise<void>;
  getAllDealFees(): Promise<DealFee[]>;
  
  // Stage Document operations
  getStageDocuments(dealId: string, stage?: string): Promise<StageDocument[]>;
  createStageDocument(doc: InsertStageDocument): Promise<StageDocument>;
  deleteStageDocument(id: string): Promise<void>;
  
  // Stage Pod Member operations
  getStagePodMembers(dealId: string, stage?: string): Promise<StagePodMember[]>;
  createStagePodMember(member: InsertStagePodMember): Promise<StagePodMember>;
  updateStagePodMember(id: string, updates: Partial<InsertStagePodMember>): Promise<StagePodMember | undefined>;
  deleteStagePodMember(id: string): Promise<void>;
  
  // Stage Voice Note operations
  getStageVoiceNotes(dealId: string, stage?: string): Promise<StageVoiceNote[]>;
  createStageVoiceNote(note: InsertStageVoiceNote): Promise<StageVoiceNote>;
  deleteStageVoiceNote(id: string): Promise<void>;
  
  // Task Comment operations
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: string, content: string): Promise<TaskComment | undefined>;
  deleteTaskComment(id: string): Promise<void>;
  
  // Deal Notes operations
  getDealNotes(dealId: string): Promise<DealNote[]>;
  createDealNote(note: InsertDealNote): Promise<DealNote>;
  updateDealNote(id: string, content: string): Promise<DealNote | undefined>;
  deleteDealNote(id: string): Promise<void>;
  
  // User search for autocomplete
  searchUsers(query: string): Promise<User[]>;
  
  // Custom Sector operations
  getAllCustomSectors(): Promise<schema.CustomSector[]>;
  createCustomSector(sector: schema.InsertCustomSector): Promise<schema.CustomSector>;
  
  // Pending form upload operations
  createPendingFormUpload(upload: schema.InsertPendingFormUpload): Promise<schema.PendingFormUpload>;
  getPendingFormUpload(shareToken: string, objectPath: string): Promise<schema.PendingFormUpload | undefined>;
  confirmAndDeletePendingFormUpload(shareToken: string, objectPath: string): Promise<boolean>;
  getExpiredPendingUploads(): Promise<schema.PendingFormUpload[]>;
  deletePendingFormUpload(id: string): Promise<void>;
  
  // Task Template operations
  getTaskTemplate(id: string): Promise<schema.TaskTemplate | undefined>;
  getAllTaskTemplates(): Promise<schema.TaskTemplate[]>;
  createTaskTemplate(template: schema.InsertTaskTemplate): Promise<schema.TaskTemplate>;
  updateTaskTemplate(id: string, updates: Partial<schema.InsertTaskTemplate>): Promise<schema.TaskTemplate | undefined>;
  deleteTaskTemplate(id: string): Promise<void>;
  incrementTaskTemplateUsage(id: string): Promise<void>;
  
  // Task Template Usage operations
  createTaskTemplateUsage(usage: schema.InsertTaskTemplateUsage): Promise<schema.TaskTemplateUsage>;
  getTaskTemplateUsageByTemplate(templateId: string): Promise<schema.TaskTemplateUsage[]>;
  
  // Personality Assessment operations
  getPersonalityAssessment(userId: string): Promise<schema.PersonalityAssessment | undefined>;
  createPersonalityAssessment(assessment: schema.InsertPersonalityAssessment): Promise<schema.PersonalityAssessment>;
  updatePersonalityAssessment(id: string, updates: Partial<schema.InsertPersonalityAssessment>): Promise<schema.PersonalityAssessment | undefined>;
  
  // Resume Analysis operations
  getResumeAnalysis(userId: string): Promise<schema.ResumeAnalysis | undefined>;
  createResumeAnalysis(analysis: schema.InsertResumeAnalysis): Promise<schema.ResumeAnalysis>;
  updateResumeAnalysis(id: string, updates: Partial<schema.InsertResumeAnalysis>): Promise<schema.ResumeAnalysis | undefined>;
  
  // AI Task Plan operations
  getAiTaskPlan(id: string): Promise<schema.AiTaskPlan | undefined>;
  getActiveAiTaskPlan(dealId: string, stage: string, assigneeId: string): Promise<schema.AiTaskPlan | undefined>;
  getAiTaskPlansByDeal(dealId: string): Promise<schema.AiTaskPlan[]>;
  createAiTaskPlan(plan: schema.InsertAiTaskPlan): Promise<schema.AiTaskPlan>;
  archiveAiTaskPlan(id: string): Promise<void>;
  bulkCreateTasks(tasks: InsertTask[]): Promise<Task[]>;
  getTasksByAiPlan(aiPlanId: string): Promise<Task[]>;
  
  // AI Document Analysis operations
  getAiDocumentAnalysis(id: string): Promise<schema.AiDocumentAnalysis | undefined>;
  getAiDocumentAnalysesByDeal(dealId: string): Promise<schema.AiDocumentAnalysis[]>;
  getLatestAiDocumentAnalysis(dealId: string): Promise<schema.AiDocumentAnalysis | undefined>;
  createAiDocumentAnalysis(analysis: schema.InsertAiDocumentAnalysis): Promise<schema.AiDocumentAnalysis>;
  updateAiDocumentAnalysis(id: string, updates: Partial<schema.InsertAiDocumentAnalysis & { completedAt?: Date }>): Promise<schema.AiDocumentAnalysis | undefined>;
  
  // Deal Committee Review operations
  getDealCommitteeReview(id: string): Promise<schema.DealCommitteeReview | undefined>;
  getDealCommitteeReviewByDeal(dealId: string): Promise<schema.DealCommitteeReview | undefined>;
  getDealCommitteeReviewsByUser(userId: string): Promise<schema.DealCommitteeReview[]>;
  getPendingCommitteeReviewsForUser(userId: string): Promise<schema.DealCommitteeReview[]>;
  getAllDealCommitteeReviews(): Promise<schema.DealCommitteeReview[]>;
  createDealCommitteeReview(review: schema.InsertDealCommitteeReview): Promise<schema.DealCommitteeReview>;
  updateDealCommitteeReview(id: string, updates: Partial<schema.InsertDealCommitteeReview>): Promise<schema.DealCommitteeReview | undefined>;
  
  // Deal Committee Member operations
  getDealCommitteeMembers(reviewId: string): Promise<schema.DealCommitteeMember[]>;
  getDealCommitteeMember(id: string): Promise<schema.DealCommitteeMember | undefined>;
  createDealCommitteeMember(member: schema.InsertDealCommitteeMember): Promise<schema.DealCommitteeMember>;
  updateDealCommitteeMember(id: string, updates: Partial<schema.InsertDealCommitteeMember>): Promise<schema.DealCommitteeMember | undefined>;
  deleteDealCommitteeMember(id: string): Promise<void>;
  
  // Deal Committee Comment operations
  getDealCommitteeComments(reviewId: string): Promise<schema.DealCommitteeComment[]>;
  createDealCommitteeComment(comment: schema.InsertDealCommitteeComment): Promise<schema.DealCommitteeComment>;
  deleteDealCommitteeComment(id: string): Promise<void>;
  
  // Push Subscription operations
  getPushSubscriptionByEndpoint(endpoint: string): Promise<schema.PushSubscription | undefined>;
  getUserPushSubscriptions(userId: string): Promise<schema.PushSubscription[]>;
  createPushSubscription(subscription: schema.InsertPushSubscription): Promise<schema.PushSubscription>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
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

  async getDealsListing(): Promise<Array<Pick<Deal, 'id' | 'name' | 'dealType' | 'stage' | 'value' | 'client' | 'clientContactName' | 'clientContactEmail' | 'sector' | 'lead' | 'progress' | 'status' | 'description' | 'createdAt' | 'podTeam' | 'archivedAt'> & { attachmentCount: number }>> {
    // Return essential fields for listing - includes podTeam for filtering
    // COMPLETELY EXCLUDES attachments column from SELECT to prevent 64MB database response limit
    // attachmentCount is set to 0 for now - full attachments are fetched only when viewing deal details
    // Also excludes archived deals (archivedAt is not null)
    const results = await db.select({
      id: schema.deals.id,
      name: schema.deals.name,
      dealType: schema.deals.dealType,
      stage: schema.deals.stage,
      value: schema.deals.value,
      client: schema.deals.client,
      clientContactName: schema.deals.clientContactName,
      clientContactEmail: schema.deals.clientContactEmail,
      sector: schema.deals.sector,
      lead: schema.deals.lead,
      progress: schema.deals.progress,
      status: schema.deals.status,
      description: schema.deals.description,
      createdAt: schema.deals.createdAt,
      podTeam: schema.deals.podTeam,
      archivedAt: schema.deals.archivedAt,
    }).from(schema.deals).where(isNull(schema.deals.archivedAt));
    
    // Return results with attachmentCount set to 0 (full attachments loaded on detail view)
    return results.map(deal => ({
      ...deal,
      attachmentCount: 0,
    }));
  }

  async getArchivedDeals(): Promise<Deal[]> {
    return await db.select().from(schema.deals).where(
      not(isNull(schema.deals.archivedAt))
    );
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

  async appendDealAttachments(id: string, newAttachments: any[]): Promise<Deal | undefined> {
    // Use raw SQL with JSONB concatenation operator for atomic append
    // This prevents race conditions by doing read-modify-write in a single atomic operation
    await sql`
      UPDATE deals 
      SET attachments = COALESCE(attachments, '[]'::jsonb) || ${JSON.stringify(newAttachments)}::jsonb
      WHERE id = ${id}
    `;
    // Reload and return the authoritative deal record to ensure consistency
    const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id));
    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    // First, get all tasks for this deal to delete their related records
    const dealTasks = await db.select({ id: schema.tasks.id }).from(schema.tasks).where(eq(schema.tasks.dealId, id));
    const taskIds = dealTasks.map(t => t.id);
    
    // Clear time entries referencing these tasks (set taskId to null to avoid FK violation)
    for (const taskId of taskIds) {
      await db.update(schema.timeEntries).set({ taskId: null }).where(eq(schema.timeEntries.taskId, taskId));
    }
    
    // Delete task-related records first (they reference tasks)
    for (const taskId of taskIds) {
      await db.delete(schema.taskComments).where(eq(schema.taskComments.taskId, taskId));
      await db.delete(schema.taskAttachmentsTable).where(eq(schema.taskAttachmentsTable.taskId, taskId));
    }
    
    // Get all deal pods for this deal to delete their related records
    const dealPodsList = await db.select({ id: schema.dealPods.id }).from(schema.dealPods).where(eq(schema.dealPods.dealId, id));
    const podIds = dealPodsList.map(p => p.id);
    
    // Delete records that reference dealPods first
    for (const podId of podIds) {
      await db.delete(schema.podMembers).where(eq(schema.podMembers.podId, podId));
    }
    
    // Delete podMovementTasks FIRST (references dealMilestones via milestone_id FK)
    await db.delete(schema.podMovementTasks).where(eq(schema.podMovementTasks.dealId, id));
    
    // Delete dealMilestones (references dealPods and deals)
    await db.delete(schema.dealMilestones).where(eq(schema.dealMilestones.dealId, id));
    
    // Delete dealContextUpdates (references deals)
    await db.delete(schema.dealContextUpdates).where(eq(schema.dealContextUpdates.dealId, id));
    
    // Now delete deal pods
    await db.delete(schema.dealPods).where(eq(schema.dealPods.dealId, id));
    
    // Delete all deal-related records (foreign key constraints)
    // First delete tasks (they reference aiPlanId)
    await db.delete(schema.tasks).where(eq(schema.tasks.dealId, id));
    // Then delete AI task plans for this deal
    await db.delete(schema.aiTaskPlans).where(eq(schema.aiTaskPlans.dealId, id));
    await db.delete(schema.meetings).where(eq(schema.meetings.dealId, id));
    await db.delete(schema.dealFees).where(eq(schema.dealFees.dealId, id));
    await db.delete(schema.stageDocuments).where(eq(schema.stageDocuments.dealId, id));
    await db.delete(schema.stagePodMembers).where(eq(schema.stagePodMembers.dealId, id));
    await db.delete(schema.stageVoiceNotes).where(eq(schema.stageVoiceNotes.dealId, id));
    await db.delete(schema.investorMatches).where(eq(schema.investorMatches.dealId, id));
    await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.dealId, id));
    await db.delete(schema.clientPortalMessages).where(eq(schema.clientPortalMessages.dealId, id));
    await db.delete(schema.clientPortalUpdates).where(eq(schema.clientPortalUpdates.dealId, id));
    await db.delete(schema.clientPortalAccess).where(eq(schema.clientPortalAccess.dealId, id));
    await db.delete(schema.documentsTable).where(eq(schema.documentsTable.dealId, id));
    await db.delete(schema.dealNotes).where(eq(schema.dealNotes.dealId, id));
    await db.delete(schema.aiDocumentAnalyses).where(eq(schema.aiDocumentAnalyses.dealId, id));
    
    // Delete committee review related records
    const committeeReviews = await db.select({ id: schema.dealCommitteeReviews.id })
      .from(schema.dealCommitteeReviews)
      .where(eq(schema.dealCommitteeReviews.dealId, id));
    for (const review of committeeReviews) {
      await db.delete(schema.dealCommitteeComments).where(eq(schema.dealCommitteeComments.reviewId, review.id));
      await db.delete(schema.dealCommitteeMembers).where(eq(schema.dealCommitteeMembers.reviewId, review.id));
    }
    await db.delete(schema.dealCommitteeReviews).where(eq(schema.dealCommitteeReviews.dealId, id));
    
    // Set dealId to null for related records with nullable FK
    await db.update(schema.investorInteractions).set({ dealId: null }).where(eq(schema.investorInteractions.dealId, id));
    await db.update(schema.timeEntries).set({ dealId: null }).where(eq(schema.timeEntries.dealId, id));
    await db.update(schema.announcements).set({ dealId: null }).where(eq(schema.announcements.dealId, id));
    
    // Now delete the deal
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

  async getTasksByDealAndUser(dealId: string, userId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(
      and(
        eq(schema.tasks.dealId, dealId),
        eq(schema.tasks.assignedTo, userId)
      )
    );
  }

  async getUserPodMemberships(userId: string): Promise<schema.PodMember[]> {
    return await db.select().from(schema.podMembers)
      .where(eq(schema.podMembers.userId, userId));
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
    // Delete related records first to avoid foreign key constraint violations
    await db.delete(schema.taskComments).where(eq(schema.taskComments.taskId, id));
    await db.delete(schema.taskAttachmentsTable).where(eq(schema.taskAttachmentsTable.taskId, id));
    await db.update(schema.timeEntries).set({ taskId: null }).where(eq(schema.timeEntries.taskId, id));
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

  async updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.conversations.id, id))
      .returning();
    return updated;
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
  
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, id));
    return message;
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
  
  async deleteMessage(id: string): Promise<void> {
    await db.delete(schema.messages).where(eq(schema.messages.id, id));
  }
  
  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await db.update(schema.messages)
      .set(updates as any)
      .where(eq(schema.messages.id, id))
      .returning();
    return updated;
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
  
  async deleteConversation(id: string): Promise<void> {
    await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
  }
  
  async deleteConversationMessages(conversationId: string): Promise<void> {
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));
  }
  
  async deleteConversationMembers(conversationId: string): Promise<void> {
    await db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, conversationId));
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
  
  async getStakeholdersPaginated(options: {
    page: number;
    pageSize: number;
    search?: string;
    type?: string;
  }): Promise<{ stakeholders: Stakeholder[]; total: number }> {
    const { page, pageSize, search, type } = options;
    const offset = (page - 1) * pageSize;
    
    // Build conditions array
    const conditions = [];
    
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(schema.stakeholders.name, searchLower),
          ilike(schema.stakeholders.company, searchLower),
          ilike(schema.stakeholders.location, searchLower)
        )
      );
    }
    
    if (type && type !== 'all') {
      conditions.push(eq(schema.stakeholders.type, type));
    }
    
    // Get total count
    const countQuery = conditions.length > 0
      ? db.select({ count: count() }).from(schema.stakeholders).where(and(...conditions))
      : db.select({ count: count() }).from(schema.stakeholders);
    
    const [{ count: total }] = await countQuery;
    
    // Get paginated results
    const dataQuery = conditions.length > 0
      ? db.select().from(schema.stakeholders)
          .where(and(...conditions))
          .orderBy(schema.stakeholders.name)
          .limit(pageSize)
          .offset(offset)
      : db.select().from(schema.stakeholders)
          .orderBy(schema.stakeholders.name)
          .limit(pageSize)
          .offset(offset);
    
    const stakeholders = await dataQuery;
    
    return { stakeholders, total: Number(total) };
  }
  
  async getStakeholderStats(): Promise<{ total: number; typeCounts: Record<string, number>; favoriteCount: number }> {
    // Get total count
    const [{ count: total }] = await db.select({ count: count() }).from(schema.stakeholders);
    
    // Get count by type
    const typeResults = await db
      .select({ type: schema.stakeholders.type, count: count() })
      .from(schema.stakeholders)
      .groupBy(schema.stakeholders.type);
    
    const typeCounts: Record<string, number> = {};
    for (const row of typeResults) {
      typeCounts[row.type] = Number(row.count);
    }
    
    // Get favorite count
    const [{ count: favoriteCount }] = await db
      .select({ count: count() })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.isFavorite, true));
    
    return { total: Number(total), typeCounts, favoriteCount: Number(favoriteCount) };
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
    try {
      const [result] = await db.insert(schema.userPreferences)
        .values(prefs)
        .onConflictDoUpdate({
          target: schema.userPreferences.userId,
          set: { ...prefs, updatedAt: new Date() }
        })
        .returning();
      return result;
    } catch (error) {
      console.error('Upsert user preferences error:', error);
      const existing = await this.getUserPreferences(prefs.userId);
      if (existing) {
        const [updated] = await db.update(schema.userPreferences)
          .set({ ...prefs, updatedAt: new Date() })
          .where(eq(schema.userPreferences.userId, prefs.userId))
          .returning();
        return updated;
      }
      throw error;
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
  
  // User Status Management operations
  async updateUserStatus(id: string, status: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set({ status })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }
  
  async getUsersByStatus(status: string): Promise<User[]> {
    return await db.select().from(schema.users)
      .where(eq(schema.users.status, status))
      .orderBy(desc(schema.users.createdAt));
  }
  
  async updateUserAccessLevel(id: string, accessLevel: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set({ accessLevel })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }
  
  async updateUserTwoFactor(id: string, enabled: boolean, secret?: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set({ twoFactorEnabled: enabled, twoFactorSecret: secret || null })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }
  
  // Audit Log Table operations
  async getAuditLogTableEntries(limit: number = 100): Promise<schema.AuditLogTable[]> {
    return await db.select().from(schema.auditLogsTable)
      .orderBy(desc(schema.auditLogsTable.createdAt))
      .limit(limit);
  }
  
  async createAuditLogTableEntry(log: schema.InsertAuditLogTable): Promise<schema.AuditLogTable> {
    const [created] = await db.insert(schema.auditLogsTable).values(log).returning();
    return created;
  }
  
  // Database-backed Investors operations
  async getInvestorFromTable(id: string): Promise<schema.InvestorTable | undefined> {
    const [investor] = await db.select().from(schema.investorsTable).where(eq(schema.investorsTable.id, id));
    return investor;
  }
  
  async getAllInvestorsFromTable(): Promise<schema.InvestorTable[]> {
    return await db.select().from(schema.investorsTable)
      .where(eq(schema.investorsTable.isActive, true))
      .orderBy(schema.investorsTable.name);
  }
  
  async createInvestorInTable(investor: schema.InsertInvestorTable): Promise<schema.InvestorTable> {
    const [created] = await db.insert(schema.investorsTable).values(investor).returning();
    return created;
  }
  
  async updateInvestorInTable(id: string, updates: Partial<schema.InsertInvestorTable>): Promise<schema.InvestorTable | undefined> {
    const [updated] = await db.update(schema.investorsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.investorsTable.id, id))
      .returning();
    return updated;
  }
  
  async deleteInvestorFromTable(id: string): Promise<void> {
    await db.update(schema.investorsTable)
      .set({ isActive: false })
      .where(eq(schema.investorsTable.id, id));
  }
  
  // Document Table operations
  async getDocument(id: string): Promise<schema.DocumentTable | undefined> {
    const [doc] = await db.select().from(schema.documentsTable).where(eq(schema.documentsTable.id, id));
    return doc;
  }
  
  async getAllDocuments(): Promise<schema.DocumentTable[]> {
    return await db.select().from(schema.documentsTable)
      .where(eq(schema.documentsTable.isArchived, false))
      .orderBy(desc(schema.documentsTable.createdAt));
  }
  
  async getDocumentsList(): Promise<Omit<schema.DocumentTable, 'fileData'>[]> {
    // Lightweight version that excludes file data to avoid 507 errors
    return await db.select({
      id: schema.documentsTable.id,
      filename: schema.documentsTable.filename,
      category: schema.documentsTable.category,
      dealId: schema.documentsTable.dealId,
      tags: schema.documentsTable.tags,
      uploadedBy: schema.documentsTable.uploadedBy,
      isArchived: schema.documentsTable.isArchived,
      createdAt: schema.documentsTable.createdAt,
      updatedAt: schema.documentsTable.updatedAt,
    }).from(schema.documentsTable)
      .where(eq(schema.documentsTable.isArchived, false))
      .orderBy(desc(schema.documentsTable.createdAt));
  }
  
  async getDocumentsByDeal(dealId: string): Promise<schema.DocumentTable[]> {
    return await db.select().from(schema.documentsTable)
      .where(and(eq(schema.documentsTable.dealId, dealId), eq(schema.documentsTable.isArchived, false)))
      .orderBy(desc(schema.documentsTable.createdAt));
  }
  
  async getDocumentsByUser(userId: string): Promise<schema.DocumentTable[]> {
    return await db.select().from(schema.documentsTable)
      .where(and(eq(schema.documentsTable.uploadedBy, userId), eq(schema.documentsTable.isArchived, false)))
      .orderBy(desc(schema.documentsTable.createdAt));
  }
  
  async createDocument(doc: schema.InsertDocumentTable): Promise<schema.DocumentTable> {
    const [created] = await db.insert(schema.documentsTable).values(doc).returning();
    return created;
  }
  
  async updateDocument(id: string, updates: Partial<schema.InsertDocumentTable>): Promise<schema.DocumentTable | undefined> {
    const [updated] = await db.update(schema.documentsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.documentsTable.id, id))
      .returning();
    return updated;
  }
  
  async deleteDocument(id: string): Promise<void> {
    await db.update(schema.documentsTable)
      .set({ isArchived: true })
      .where(eq(schema.documentsTable.id, id));
  }
  
  // Client Portal Invite operations
  async getClientPortalInvite(id: string): Promise<ClientPortalInvite | undefined> {
    const [invite] = await db.select().from(schema.clientPortalInvites).where(eq(schema.clientPortalInvites.id, id));
    return invite;
  }
  
  async getClientPortalInviteByToken(token: string): Promise<ClientPortalInvite | undefined> {
    const [invite] = await db.select().from(schema.clientPortalInvites)
      .where(and(
        eq(schema.clientPortalInvites.token, token),
        eq(schema.clientPortalInvites.status, 'pending'),
        gt(schema.clientPortalInvites.expiresAt, new Date())
      ));
    return invite;
  }
  
  async getClientPortalInvitesByInviter(inviterId: string): Promise<ClientPortalInvite[]> {
    return await db.select().from(schema.clientPortalInvites)
      .where(eq(schema.clientPortalInvites.invitedBy, inviterId))
      .orderBy(desc(schema.clientPortalInvites.createdAt));
  }
  
  async getAllClientPortalInvites(): Promise<ClientPortalInvite[]> {
    return await db.select().from(schema.clientPortalInvites)
      .orderBy(desc(schema.clientPortalInvites.createdAt));
  }
  
  async createClientPortalInvite(invite: InsertClientPortalInvite): Promise<ClientPortalInvite> {
    const [created] = await db.insert(schema.clientPortalInvites).values(invite).returning();
    return created;
  }
  
  async updateClientPortalInvite(id: string, updates: Partial<InsertClientPortalInvite & { acceptedAt?: Date; userId?: string; status?: string }>): Promise<ClientPortalInvite | undefined> {
    const [updated] = await db.update(schema.clientPortalInvites)
      .set(updates)
      .where(eq(schema.clientPortalInvites.id, id))
      .returning();
    return updated;
  }
  
  async deleteClientPortalInvite(id: string): Promise<void> {
    await db.delete(schema.clientPortalInvites).where(eq(schema.clientPortalInvites.id, id));
  }
  
  // Client Portal Message operations
  async getClientPortalMessagesByDeal(dealId: string): Promise<ClientPortalMessage[]> {
    return await db.select().from(schema.clientPortalMessages)
      .where(eq(schema.clientPortalMessages.dealId, dealId))
      .orderBy(schema.clientPortalMessages.createdAt);
  }
  
  async createClientPortalMessage(message: InsertClientPortalMessage): Promise<ClientPortalMessage> {
    const [created] = await db.insert(schema.clientPortalMessages).values(message).returning();
    return created;
  }
  
  // Client Portal Update operations
  async getClientPortalUpdatesByDeal(dealId: string): Promise<ClientPortalUpdate[]> {
    return await db.select().from(schema.clientPortalUpdates)
      .where(eq(schema.clientPortalUpdates.dealId, dealId))
      .orderBy(desc(schema.clientPortalUpdates.createdAt));
  }
  
  async createClientPortalUpdate(update: InsertClientPortalUpdate): Promise<ClientPortalUpdate> {
    const [created] = await db.insert(schema.clientPortalUpdates).values(update).returning();
    return created;
  }
  
  // External User operations
  async getExternalUsers(): Promise<User[]> {
    return await db.select().from(schema.users)
      .where(eq(schema.users.isExternal, true))
      .orderBy(desc(schema.users.createdAt));
  }
  
  async createExternalUser(user: InsertUser & { isExternal: boolean; externalOrganization?: string; invitedBy?: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [created] = await db.insert(schema.users)
      .values({ ...user, password: hashedPassword, role: 'External', status: 'active' })
      .returning();
    return created;
  }
  
  async getExternalUserDeals(userId: string): Promise<Deal[]> {
    // Get deals from portal invites for this user
    const invites = await db.select().from(schema.clientPortalInvites)
      .where(and(
        eq(schema.clientPortalInvites.userId, userId),
        eq(schema.clientPortalInvites.status, 'accepted')
      ));
    
    if (invites.length === 0) return [];
    
    // Collect all deal IDs from invites
    const dealIds = new Set<string>();
    for (const invite of invites) {
      const ids = invite.dealIds as string[] || [];
      ids.forEach(id => dealIds.add(id));
    }
    
    // Fetch deals
    const deals: Deal[] = [];
    for (const dealId of dealIds) {
      const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
      if (deal) deals.push(deal);
    }
    
    return deals;
  }
  
  // Deal Fee operations
  async getDealFees(dealId: string): Promise<DealFee[]> {
    return await db.select().from(schema.dealFees)
      .where(eq(schema.dealFees.dealId, dealId))
      .orderBy(schema.dealFees.createdAt);
  }
  
  async createDealFee(fee: InsertDealFee): Promise<DealFee> {
    const [created] = await db.insert(schema.dealFees).values(fee).returning();
    return created;
  }
  
  async updateDealFee(id: string, updates: Partial<InsertDealFee>): Promise<DealFee | undefined> {
    const [updated] = await db.update(schema.dealFees)
      .set(updates)
      .where(eq(schema.dealFees.id, id))
      .returning();
    return updated;
  }
  
  async deleteDealFee(id: string): Promise<void> {
    await db.delete(schema.dealFees).where(eq(schema.dealFees.id, id));
  }
  
  async getAllDealFees(): Promise<DealFee[]> {
    return await db.select().from(schema.dealFees).orderBy(desc(schema.dealFees.createdAt));
  }
  
  // Stage Document operations
  async getStageDocuments(dealId: string, stage?: string): Promise<StageDocument[]> {
    if (stage) {
      return await db.select().from(schema.stageDocuments)
        .where(and(
          eq(schema.stageDocuments.dealId, dealId),
          eq(schema.stageDocuments.stage, stage)
        ))
        .orderBy(desc(schema.stageDocuments.createdAt));
    }
    return await db.select().from(schema.stageDocuments)
      .where(eq(schema.stageDocuments.dealId, dealId))
      .orderBy(desc(schema.stageDocuments.createdAt));
  }
  
  async createStageDocument(doc: InsertStageDocument): Promise<StageDocument> {
    const [created] = await db.insert(schema.stageDocuments).values(doc).returning();
    return created;
  }
  
  async deleteStageDocument(id: string): Promise<void> {
    await db.delete(schema.stageDocuments).where(eq(schema.stageDocuments.id, id));
  }
  
  // Stage Pod Member operations
  async getStagePodMembers(dealId: string, stage?: string): Promise<StagePodMember[]> {
    if (stage) {
      return await db.select().from(schema.stagePodMembers)
        .where(and(
          eq(schema.stagePodMembers.dealId, dealId),
          eq(schema.stagePodMembers.stage, stage)
        ))
        .orderBy(schema.stagePodMembers.createdAt);
    }
    return await db.select().from(schema.stagePodMembers)
      .where(eq(schema.stagePodMembers.dealId, dealId))
      .orderBy(schema.stagePodMembers.createdAt);
  }
  
  async createStagePodMember(member: InsertStagePodMember): Promise<StagePodMember> {
    const [created] = await db.insert(schema.stagePodMembers).values(member).returning();
    return created;
  }
  
  async updateStagePodMember(id: string, updates: Partial<InsertStagePodMember>): Promise<StagePodMember | undefined> {
    const [updated] = await db.update(schema.stagePodMembers)
      .set(updates)
      .where(eq(schema.stagePodMembers.id, id))
      .returning();
    return updated;
  }
  
  async deleteStagePodMember(id: string): Promise<void> {
    await db.delete(schema.stagePodMembers).where(eq(schema.stagePodMembers.id, id));
  }
  
  // Stage Voice Note operations
  async getStageVoiceNotes(dealId: string, stage?: string): Promise<StageVoiceNote[]> {
    if (stage) {
      return await db.select().from(schema.stageVoiceNotes)
        .where(and(
          eq(schema.stageVoiceNotes.dealId, dealId),
          eq(schema.stageVoiceNotes.stage, stage)
        ))
        .orderBy(desc(schema.stageVoiceNotes.createdAt));
    }
    return await db.select().from(schema.stageVoiceNotes)
      .where(eq(schema.stageVoiceNotes.dealId, dealId))
      .orderBy(desc(schema.stageVoiceNotes.createdAt));
  }
  
  async createStageVoiceNote(note: InsertStageVoiceNote): Promise<StageVoiceNote> {
    const [created] = await db.insert(schema.stageVoiceNotes).values(note).returning();
    return created;
  }
  
  async deleteStageVoiceNote(id: string): Promise<void> {
    await db.delete(schema.stageVoiceNotes).where(eq(schema.stageVoiceNotes.id, id));
  }
  
  // Task Comment operations
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db.select().from(schema.taskComments)
      .where(eq(schema.taskComments.taskId, taskId))
      .orderBy(schema.taskComments.createdAt);
  }
  
  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [created] = await db.insert(schema.taskComments).values(comment).returning();
    return created;
  }
  
  async updateTaskComment(id: string, content: string): Promise<TaskComment | undefined> {
    const [updated] = await db.update(schema.taskComments)
      .set({ content, updatedAt: new Date() })
      .where(eq(schema.taskComments.id, id))
      .returning();
    return updated;
  }
  
  async deleteTaskComment(id: string): Promise<void> {
    await db.delete(schema.taskComments).where(eq(schema.taskComments.id, id));
  }
  
  // Deal Notes operations
  async getDealNotes(dealId: string): Promise<DealNote[]> {
    return await db.select().from(schema.dealNotes)
      .where(eq(schema.dealNotes.dealId, dealId))
      .orderBy(desc(schema.dealNotes.createdAt));
  }
  
  async createDealNote(note: InsertDealNote): Promise<DealNote> {
    const [created] = await db.insert(schema.dealNotes).values(note).returning();
    return created;
  }
  
  async updateDealNote(id: string, content: string): Promise<DealNote | undefined> {
    const [updated] = await db.update(schema.dealNotes)
      .set({ content, updatedAt: new Date() })
      .where(eq(schema.dealNotes.id, id))
      .returning();
    return updated;
  }
  
  async deleteDealNote(id: string): Promise<void> {
    await db.delete(schema.dealNotes).where(eq(schema.dealNotes.id, id));
  }
  
  // User search for autocomplete
  async searchUsers(query: string): Promise<User[]> {
    const allUsers = await db.select().from(schema.users)
      .where(eq(schema.users.status, 'active'));
    
    const lowerQuery = query.toLowerCase();
    return allUsers.filter(user => 
      user.name.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery)
    );
  }
  
  // Custom Sector operations
  async getAllCustomSectors(): Promise<schema.CustomSector[]> {
    return await db.select().from(schema.customSectors).orderBy(schema.customSectors.name);
  }
  
  async createCustomSector(sector: schema.InsertCustomSector): Promise<schema.CustomSector> {
    const [created] = await db.insert(schema.customSectors).values(sector).returning();
    return created;
  }

  // Google Calendar Token operations
  async getGoogleCalendarToken(userId: string): Promise<schema.GoogleCalendarToken | undefined> {
    const [token] = await db.select().from(schema.googleCalendarTokens).where(eq(schema.googleCalendarTokens.userId, userId));
    return token;
  }

  async saveGoogleCalendarToken(token: schema.InsertGoogleCalendarToken): Promise<schema.GoogleCalendarToken> {
    const existing = await this.getGoogleCalendarToken(token.userId);
    if (existing) {
      const [updated] = await db
        .update(schema.googleCalendarTokens)
        .set({ ...token, updatedAt: new Date() })
        .where(eq(schema.googleCalendarTokens.userId, token.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(schema.googleCalendarTokens).values(token).returning();
    return created;
  }

  async deleteGoogleCalendarToken(userId: string): Promise<void> {
    await db.delete(schema.googleCalendarTokens).where(eq(schema.googleCalendarTokens.userId, userId));
  }

  // Forms operations
  async getForm(id: string): Promise<schema.Form | undefined> {
    const [form] = await db.select().from(schema.forms).where(eq(schema.forms.id, id));
    return form;
  }

  async getFormByShareToken(shareToken: string): Promise<schema.Form | undefined> {
    const [form] = await db.select().from(schema.forms).where(eq(schema.forms.shareToken, shareToken));
    return form;
  }

  async getFormsByCreator(createdBy: string): Promise<schema.Form[]> {
    return await db.select().from(schema.forms)
      .where(eq(schema.forms.createdBy, createdBy))
      .orderBy(schema.forms.createdAt);
  }

  async createForm(form: schema.InsertForm): Promise<schema.Form> {
    const [created] = await db.insert(schema.forms).values(form).returning();
    return created;
  }

  async updateForm(id: string, updates: Partial<schema.InsertForm>): Promise<schema.Form | undefined> {
    const [updated] = await db.update(schema.forms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.forms.id, id))
      .returning();
    return updated;
  }

  async deleteForm(id: string): Promise<void> {
    // Delete related records first
    await db.delete(schema.formInvitations).where(eq(schema.formInvitations.formId, id));
    await db.delete(schema.formSubmissions).where(eq(schema.formSubmissions.formId, id));
    await db.delete(schema.forms).where(eq(schema.forms.id, id));
  }

  // Form Submissions operations
  async getFormSubmission(id: string): Promise<schema.FormSubmission | undefined> {
    const [submission] = await db.select().from(schema.formSubmissions).where(eq(schema.formSubmissions.id, id));
    return submission;
  }

  async getFormSubmissions(formId: string): Promise<schema.FormSubmission[]> {
    return await db.select().from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.formId, formId))
      .orderBy(schema.formSubmissions.createdAt);
  }

  async createFormSubmission(submission: schema.InsertFormSubmission): Promise<schema.FormSubmission> {
    const [created] = await db.insert(schema.formSubmissions).values(submission).returning();
    return created;
  }

  async updateFormSubmission(id: string, updates: Partial<schema.InsertFormSubmission>): Promise<schema.FormSubmission | undefined> {
    const [updated] = await db.update(schema.formSubmissions)
      .set(updates)
      .where(eq(schema.formSubmissions.id, id))
      .returning();
    return updated;
  }

  // Form Invitations operations
  async getFormInvitations(formId: string): Promise<schema.FormInvitation[]> {
    return await db.select().from(schema.formInvitations)
      .where(eq(schema.formInvitations.formId, formId))
      .orderBy(schema.formInvitations.createdAt);
  }

  async createFormInvitation(invitation: schema.InsertFormInvitation): Promise<schema.FormInvitation> {
    const [created] = await db.insert(schema.formInvitations).values(invitation).returning();
    return created;
  }

  async updateFormInvitation(id: string, updates: Partial<schema.InsertFormInvitation>): Promise<schema.FormInvitation | undefined> {
    const [updated] = await db.update(schema.formInvitations)
      .set(updates)
      .where(eq(schema.formInvitations.id, id))
      .returning();
    return updated;
  }

  // Pending form upload operations
  async createPendingFormUpload(upload: schema.InsertPendingFormUpload): Promise<schema.PendingFormUpload> {
    const [created] = await db.insert(schema.pendingFormUploads).values(upload).returning();
    return created;
  }

  async getPendingFormUpload(shareToken: string, objectPath: string): Promise<schema.PendingFormUpload | undefined> {
    const [record] = await db.select().from(schema.pendingFormUploads)
      .where(
        and(
          eq(schema.pendingFormUploads.shareToken, shareToken),
          eq(schema.pendingFormUploads.objectPath, objectPath),
          gt(schema.pendingFormUploads.expiresAt, new Date()),
          isNull(schema.pendingFormUploads.confirmedAt)
        )
      );
    return record;
  }

  async confirmAndDeletePendingFormUpload(shareToken: string, objectPath: string): Promise<boolean> {
    const deleted = await db.delete(schema.pendingFormUploads)
      .where(
        and(
          eq(schema.pendingFormUploads.shareToken, shareToken),
          eq(schema.pendingFormUploads.objectPath, objectPath),
          gt(schema.pendingFormUploads.expiresAt, new Date()),
          isNull(schema.pendingFormUploads.confirmedAt)
        )
      )
      .returning();
    return deleted.length > 0;
  }

  async getExpiredPendingUploads(): Promise<schema.PendingFormUpload[]> {
    return await db.select().from(schema.pendingFormUploads)
      .where(
        and(
          lt(schema.pendingFormUploads.expiresAt, new Date()),
          isNull(schema.pendingFormUploads.confirmedAt)
        )
      );
  }

  async deletePendingFormUpload(id: string): Promise<void> {
    await db.delete(schema.pendingFormUploads).where(eq(schema.pendingFormUploads.id, id));
  }

  // Task Template operations
  async getTaskTemplate(id: string): Promise<schema.TaskTemplate | undefined> {
    const [template] = await db.select().from(schema.taskTemplates).where(eq(schema.taskTemplates.id, id));
    return template;
  }

  async getAllTaskTemplates(): Promise<schema.TaskTemplate[]> {
    return await db.select().from(schema.taskTemplates)
      .where(eq(schema.taskTemplates.isArchived, false))
      .orderBy(desc(schema.taskTemplates.createdAt));
  }

  async createTaskTemplate(template: schema.InsertTaskTemplate): Promise<schema.TaskTemplate> {
    const [created] = await db.insert(schema.taskTemplates).values(template).returning();
    return created;
  }

  async updateTaskTemplate(id: string, updates: Partial<schema.InsertTaskTemplate>): Promise<schema.TaskTemplate | undefined> {
    const [updated] = await db.update(schema.taskTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.taskTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteTaskTemplate(id: string): Promise<void> {
    await db.delete(schema.taskTemplates).where(eq(schema.taskTemplates.id, id));
  }

  async incrementTaskTemplateUsage(id: string): Promise<void> {
    const template = await this.getTaskTemplate(id);
    if (template) {
      await db.update(schema.taskTemplates)
        .set({ usageCount: (template.usageCount || 0) + 1 })
        .where(eq(schema.taskTemplates.id, id));
    }
  }

  // Task Template Usage operations
  async createTaskTemplateUsage(usage: schema.InsertTaskTemplateUsage): Promise<schema.TaskTemplateUsage> {
    const [created] = await db.insert(schema.taskTemplateUsage).values(usage).returning();
    return created;
  }

  async getTaskTemplateUsageByTemplate(templateId: string): Promise<schema.TaskTemplateUsage[]> {
    return await db.select().from(schema.taskTemplateUsage)
      .where(eq(schema.taskTemplateUsage.templateId, templateId))
      .orderBy(desc(schema.taskTemplateUsage.createdAt));
  }

  // Personality Assessment operations
  async getPersonalityAssessment(userId: string): Promise<schema.PersonalityAssessment | undefined> {
    const [assessment] = await db.select().from(schema.personalityAssessments)
      .where(eq(schema.personalityAssessments.userId, userId))
      .orderBy(desc(schema.personalityAssessments.createdAt))
      .limit(1);
    return assessment;
  }

  async createPersonalityAssessment(assessment: schema.InsertPersonalityAssessment): Promise<schema.PersonalityAssessment> {
    const [created] = await db.insert(schema.personalityAssessments).values(assessment).returning();
    return created;
  }

  async updatePersonalityAssessment(id: string, updates: Partial<schema.InsertPersonalityAssessment>): Promise<schema.PersonalityAssessment | undefined> {
    const [updated] = await db.update(schema.personalityAssessments)
      .set(updates)
      .where(eq(schema.personalityAssessments.id, id))
      .returning();
    return updated;
  }

  // Resume Analysis operations
  async getResumeAnalysis(userId: string): Promise<schema.ResumeAnalysis | undefined> {
    const [analysis] = await db.select().from(schema.resumeAnalyses)
      .where(eq(schema.resumeAnalyses.userId, userId))
      .orderBy(desc(schema.resumeAnalyses.createdAt))
      .limit(1);
    return analysis;
  }

  async createResumeAnalysis(analysis: schema.InsertResumeAnalysis): Promise<schema.ResumeAnalysis> {
    const [created] = await db.insert(schema.resumeAnalyses).values(analysis).returning();
    return created;
  }

  async updateResumeAnalysis(id: string, updates: Partial<schema.InsertResumeAnalysis>): Promise<schema.ResumeAnalysis | undefined> {
    const [updated] = await db.update(schema.resumeAnalyses)
      .set(updates)
      .where(eq(schema.resumeAnalyses.id, id))
      .returning();
    return updated;
  }

  // ================================
  // DEAL POD OPERATIONS
  // ================================

  async getDealPod(id: string): Promise<schema.DealPod | undefined> {
    const [pod] = await db.select().from(schema.dealPods)
      .where(eq(schema.dealPods.id, id));
    return pod;
  }

  async getDealPodsByDeal(dealId: string): Promise<schema.DealPod[]> {
    return await db.select().from(schema.dealPods)
      .where(eq(schema.dealPods.dealId, dealId))
      .orderBy(desc(schema.dealPods.createdAt));
  }

  async getActivePodForDeal(dealId: string): Promise<schema.DealPod | undefined> {
    const [pod] = await db.select().from(schema.dealPods)
      .where(and(
        eq(schema.dealPods.dealId, dealId),
        eq(schema.dealPods.status, 'active')
      ))
      .orderBy(desc(schema.dealPods.createdAt))
      .limit(1);
    return pod;
  }

  async createDealPod(pod: schema.InsertDealPod): Promise<schema.DealPod> {
    const [created] = await db.insert(schema.dealPods).values(pod).returning();
    return created;
  }

  async updateDealPod(id: string, updates: Partial<schema.InsertDealPod>): Promise<schema.DealPod | undefined> {
    const [updated] = await db.update(schema.dealPods)
      .set(updates)
      .where(eq(schema.dealPods.id, id))
      .returning();
    return updated;
  }

  // ================================
  // POD MEMBER OPERATIONS
  // ================================

  async getPodMembers(podId: string): Promise<schema.PodMember[]> {
    return await db.select().from(schema.podMembers)
      .where(eq(schema.podMembers.podId, podId))
      .orderBy(schema.podMembers.position);
  }

  async createPodMember(member: schema.InsertPodMember): Promise<schema.PodMember> {
    const [created] = await db.insert(schema.podMembers).values(member).returning();
    return created;
  }

  async getPodMembersByUser(userId: string): Promise<schema.PodMember[]> {
    return await db.select().from(schema.podMembers)
      .where(eq(schema.podMembers.userId, userId));
  }

  async getUserCurrentStageAssignments(userId: string): Promise<string[]> {
    const activePodMemberships = await db.select({
      stage: schema.dealPods.stage
    })
    .from(schema.podMembers)
    .innerJoin(schema.dealPods, eq(schema.podMembers.podId, schema.dealPods.id))
    .where(and(
      eq(schema.podMembers.userId, userId),
      eq(schema.dealPods.status, 'active')
    ));
    
    return [...new Set(activePodMemberships.map(m => m.stage))];
  }

  // ================================
  // DEAL MILESTONE OPERATIONS
  // ================================

  async getDealMilestones(dealId: string): Promise<schema.DealMilestone[]> {
    return await db.select().from(schema.dealMilestones)
      .where(eq(schema.dealMilestones.dealId, dealId))
      .orderBy(schema.dealMilestones.orderIndex);
  }

  async getDealMilestonesByStage(dealId: string, stage: string): Promise<schema.DealMilestone[]> {
    return await db.select().from(schema.dealMilestones)
      .where(and(
        eq(schema.dealMilestones.dealId, dealId),
        eq(schema.dealMilestones.stage, stage)
      ))
      .orderBy(schema.dealMilestones.orderIndex);
  }

  async createDealMilestone(milestone: schema.InsertDealMilestone): Promise<schema.DealMilestone> {
    const [created] = await db.insert(schema.dealMilestones).values(milestone).returning();
    return created;
  }

  async updateDealMilestone(id: string, updates: Partial<schema.InsertDealMilestone>): Promise<schema.DealMilestone | undefined> {
    const [updated] = await db.update(schema.dealMilestones)
      .set(updates)
      .where(eq(schema.dealMilestones.id, id))
      .returning();
    return updated;
  }

  // ================================
  // POD MOVEMENT TASK OPERATIONS
  // ================================

  async getPodMovementTasks(dealId: string): Promise<schema.PodMovementTask[]> {
    return await db.select().from(schema.podMovementTasks)
      .where(eq(schema.podMovementTasks.dealId, dealId));
  }

  async getPodMovementTasksByMilestone(milestoneId: string): Promise<schema.PodMovementTask[]> {
    return await db.select().from(schema.podMovementTasks)
      .where(eq(schema.podMovementTasks.milestoneId, milestoneId));
  }

  async createPodMovementTask(task: schema.InsertPodMovementTask): Promise<schema.PodMovementTask> {
    const [created] = await db.insert(schema.podMovementTasks).values(task).returning();
    return created;
  }

  async updatePodMovementTask(id: string, updates: Partial<schema.InsertPodMovementTask>): Promise<schema.PodMovementTask | undefined> {
    const [updated] = await db.update(schema.podMovementTasks)
      .set(updates)
      .where(eq(schema.podMovementTasks.id, id))
      .returning();
    return updated;
  }

  // ================================
  // DEAL CONTEXT UPDATE OPERATIONS
  // ================================

  async getDealContextUpdates(dealId: string): Promise<schema.DealContextUpdate[]> {
    return await db.select().from(schema.dealContextUpdates)
      .where(eq(schema.dealContextUpdates.dealId, dealId))
      .orderBy(desc(schema.dealContextUpdates.createdAt));
  }

  async createDealContextUpdate(update: schema.InsertDealContextUpdate): Promise<schema.DealContextUpdate> {
    const [created] = await db.insert(schema.dealContextUpdates).values(update).returning();
    return created;
  }

  async markDealContextIndexed(id: string): Promise<void> {
    await db.update(schema.dealContextUpdates)
      .set({ indexedForAI: true, indexedAt: new Date() })
      .where(eq(schema.dealContextUpdates.id, id));
  }

  async getUnindexedDealContext(dealId: string): Promise<schema.DealContextUpdate[]> {
    return await db.select().from(schema.dealContextUpdates)
      .where(and(
        eq(schema.dealContextUpdates.dealId, dealId),
        eq(schema.dealContextUpdates.indexedForAI, false)
      ))
      .orderBy(schema.dealContextUpdates.createdAt);
  }

  // ================================
  // WORKLOAD TRACKING
  // ================================

  async getUserWorkload(userId: string): Promise<{ activeTasks: number; pendingTasks: number; completedThisWeek: number }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const allTasks = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.assignedTo, userId));

    const activeTasks = allTasks.filter(t => t.status === 'In Progress').length;
    const pendingTasks = allTasks.filter(t => t.status === 'Pending').length;
    const completedThisWeek = allTasks.filter(t => 
      t.status === 'Completed' && 
      t.completedAt && 
      new Date(t.completedAt) >= oneWeekAgo
    ).length;

    return { activeTasks, pendingTasks, completedThisWeek };
  }

  async getAllUsersWithProfiles(): Promise<Array<{
    user: schema.User;
    resumeAnalysis: schema.ResumeAnalysis | null;
    personalityAssessment: schema.PersonalityAssessment | null;
    workload: { activeTasks: number; pendingTasks: number; completedThisWeek: number };
  }>> {
    const users = await this.getAllUsers();
    const results = [];

    for (const user of users) {
      // Skip external users and non-deal-eligible users (HR, AI Engineer, etc.)
      if (!schema.isDealEligibleUser(user)) continue;

      const resumeAnalysis = await this.getResumeAnalysis(user.id);
      const personalityAssessment = await this.getPersonalityAssessment(user.id);
      const workload = await this.getUserWorkload(user.id);

      results.push({
        user,
        resumeAnalysis: resumeAnalysis || null,
        personalityAssessment: personalityAssessment || null,
        workload
      });
    }

    return results;
  }

  async getAllResumeAnalyses(): Promise<schema.ResumeAnalysis[]> {
    return await db.select().from(schema.resumeAnalyses)
      .where(eq(schema.resumeAnalyses.status, 'completed'));
  }

  async getAllPersonalityAssessments(): Promise<schema.PersonalityAssessment[]> {
    return await db.select().from(schema.personalityAssessments)
      .where(eq(schema.personalityAssessments.status, 'completed'));
  }

  // ================================
  // AI TASK PLAN OPERATIONS
  // ================================

  async getAiTaskPlan(id: string): Promise<schema.AiTaskPlan | undefined> {
    const [plan] = await db.select().from(schema.aiTaskPlans)
      .where(eq(schema.aiTaskPlans.id, id));
    return plan;
  }

  async getActiveAiTaskPlan(dealId: string, stage: string, assigneeId: string): Promise<schema.AiTaskPlan | undefined> {
    const [plan] = await db.select().from(schema.aiTaskPlans)
      .where(and(
        eq(schema.aiTaskPlans.dealId, dealId),
        eq(schema.aiTaskPlans.stage, stage),
        eq(schema.aiTaskPlans.assigneeId, assigneeId),
        eq(schema.aiTaskPlans.isActive, true)
      ));
    return plan;
  }

  async getAiTaskPlansByDeal(dealId: string): Promise<schema.AiTaskPlan[]> {
    return await db.select().from(schema.aiTaskPlans)
      .where(eq(schema.aiTaskPlans.dealId, dealId))
      .orderBy(desc(schema.aiTaskPlans.generatedAt));
  }

  async createAiTaskPlan(plan: schema.InsertAiTaskPlan): Promise<schema.AiTaskPlan> {
    const [created] = await db.insert(schema.aiTaskPlans).values(plan).returning();
    return created;
  }

  async archiveAiTaskPlan(id: string): Promise<void> {
    await db.update(schema.aiTaskPlans)
      .set({ isActive: false, archivedAt: new Date() })
      .where(eq(schema.aiTaskPlans.id, id));
  }

  async bulkCreateTasks(tasks: InsertTask[]): Promise<Task[]> {
    if (tasks.length === 0) return [];
    const created = await db.insert(schema.tasks).values(tasks).returning();
    return created;
  }

  async getTasksByAiPlan(aiPlanId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks)
      .where(eq(schema.tasks.aiPlanId, aiPlanId))
      .orderBy(schema.tasks.createdAt);
  }

  // ================================
  // AI DOCUMENT ANALYSIS OPERATIONS
  // ================================

  async getAiDocumentAnalysis(id: string): Promise<schema.AiDocumentAnalysis | undefined> {
    const [analysis] = await db.select().from(schema.aiDocumentAnalyses)
      .where(eq(schema.aiDocumentAnalyses.id, id));
    return analysis;
  }

  async getAiDocumentAnalysesByDeal(dealId: string): Promise<schema.AiDocumentAnalysis[]> {
    return await db.select().from(schema.aiDocumentAnalyses)
      .where(eq(schema.aiDocumentAnalyses.dealId, dealId))
      .orderBy(desc(schema.aiDocumentAnalyses.createdAt));
  }

  async getLatestAiDocumentAnalysis(dealId: string): Promise<schema.AiDocumentAnalysis | undefined> {
    const [analysis] = await db.select().from(schema.aiDocumentAnalyses)
      .where(eq(schema.aiDocumentAnalyses.dealId, dealId))
      .orderBy(desc(schema.aiDocumentAnalyses.createdAt))
      .limit(1);
    return analysis;
  }

  async createAiDocumentAnalysis(analysis: schema.InsertAiDocumentAnalysis): Promise<schema.AiDocumentAnalysis> {
    const [created] = await db.insert(schema.aiDocumentAnalyses).values(analysis).returning();
    return created;
  }

  async updateAiDocumentAnalysis(id: string, updates: Partial<schema.InsertAiDocumentAnalysis & { completedAt?: Date }>): Promise<schema.AiDocumentAnalysis | undefined> {
    const [updated] = await db.update(schema.aiDocumentAnalyses)
      .set(updates)
      .where(eq(schema.aiDocumentAnalyses.id, id))
      .returning();
    return updated;
  }

  // ================================
  // DEAL COMMITTEE REVIEW OPERATIONS
  // ================================

  async getDealCommitteeReview(id: string): Promise<schema.DealCommitteeReview | undefined> {
    const [review] = await db.select().from(schema.dealCommitteeReviews)
      .where(eq(schema.dealCommitteeReviews.id, id));
    return review;
  }

  async getDealCommitteeReviewByDeal(dealId: string): Promise<schema.DealCommitteeReview | undefined> {
    const [review] = await db.select().from(schema.dealCommitteeReviews)
      .where(and(
        eq(schema.dealCommitteeReviews.dealId, dealId),
        eq(schema.dealCommitteeReviews.status, 'pending')
      ));
    return review;
  }

  async getDealCommitteeReviewsByUser(userId: string): Promise<schema.DealCommitteeReview[]> {
    return await db.select().from(schema.dealCommitteeReviews)
      .where(eq(schema.dealCommitteeReviews.requestedBy, userId))
      .orderBy(desc(schema.dealCommitteeReviews.createdAt));
  }

  async getPendingCommitteeReviewsForUser(userId: string): Promise<schema.DealCommitteeReview[]> {
    // Get reviews where this user is a committee member with pending vote
    const memberReviews = await db.select({
      reviewId: schema.dealCommitteeMembers.reviewId
    }).from(schema.dealCommitteeMembers)
      .where(and(
        eq(schema.dealCommitteeMembers.userId, userId),
        isNull(schema.dealCommitteeMembers.vote)
      ));
    
    const reviewIds = memberReviews.map(m => m.reviewId);
    if (reviewIds.length === 0) return [];
    
    const reviews: schema.DealCommitteeReview[] = [];
    for (const reviewId of reviewIds) {
      const [review] = await db.select().from(schema.dealCommitteeReviews)
        .where(and(
          eq(schema.dealCommitteeReviews.id, reviewId),
          eq(schema.dealCommitteeReviews.status, 'pending')
        ));
      if (review) reviews.push(review);
    }
    return reviews;
  }

  async getAllDealCommitteeReviews(): Promise<schema.DealCommitteeReview[]> {
    return await db.select().from(schema.dealCommitteeReviews)
      .orderBy(desc(schema.dealCommitteeReviews.createdAt));
  }

  async createDealCommitteeReview(review: schema.InsertDealCommitteeReview): Promise<schema.DealCommitteeReview> {
    const [created] = await db.insert(schema.dealCommitteeReviews).values(review).returning();
    return created;
  }

  async updateDealCommitteeReview(id: string, updates: Partial<schema.InsertDealCommitteeReview>): Promise<schema.DealCommitteeReview | undefined> {
    const [updated] = await db.update(schema.dealCommitteeReviews)
      .set(updates)
      .where(eq(schema.dealCommitteeReviews.id, id))
      .returning();
    return updated;
  }

  // ================================
  // DEAL COMMITTEE MEMBER OPERATIONS
  // ================================

  async getDealCommitteeMembers(reviewId: string): Promise<schema.DealCommitteeMember[]> {
    return await db.select().from(schema.dealCommitteeMembers)
      .where(eq(schema.dealCommitteeMembers.reviewId, reviewId))
      .orderBy(schema.dealCommitteeMembers.createdAt);
  }

  async getDealCommitteeMember(id: string): Promise<schema.DealCommitteeMember | undefined> {
    const [member] = await db.select().from(schema.dealCommitteeMembers)
      .where(eq(schema.dealCommitteeMembers.id, id));
    return member;
  }

  async createDealCommitteeMember(member: schema.InsertDealCommitteeMember): Promise<schema.DealCommitteeMember> {
    const [created] = await db.insert(schema.dealCommitteeMembers).values(member).returning();
    return created;
  }

  async updateDealCommitteeMember(id: string, updates: Partial<schema.InsertDealCommitteeMember>): Promise<schema.DealCommitteeMember | undefined> {
    const [updated] = await db.update(schema.dealCommitteeMembers)
      .set(updates)
      .where(eq(schema.dealCommitteeMembers.id, id))
      .returning();
    return updated;
  }

  async deleteDealCommitteeMember(id: string): Promise<void> {
    await db.delete(schema.dealCommitteeMembers).where(eq(schema.dealCommitteeMembers.id, id));
  }

  // ================================
  // DEAL COMMITTEE COMMENT OPERATIONS
  // ================================

  async getDealCommitteeComments(reviewId: string): Promise<schema.DealCommitteeComment[]> {
    return await db.select().from(schema.dealCommitteeComments)
      .where(eq(schema.dealCommitteeComments.reviewId, reviewId))
      .orderBy(schema.dealCommitteeComments.createdAt);
  }

  async createDealCommitteeComment(comment: schema.InsertDealCommitteeComment): Promise<schema.DealCommitteeComment> {
    const [created] = await db.insert(schema.dealCommitteeComments).values(comment).returning();
    return created;
  }

  async deleteDealCommitteeComment(id: string): Promise<void> {
    await db.delete(schema.dealCommitteeComments).where(eq(schema.dealCommitteeComments.id, id));
  }

  // ================================
  // PUSH SUBSCRIPTION OPERATIONS
  // ================================

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<schema.PushSubscription | undefined> {
    const [subscription] = await db.select().from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));
    return subscription;
  }

  async getUserPushSubscriptions(userId: string): Promise<schema.PushSubscription[]> {
    return await db.select().from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
  }

  async createPushSubscription(subscription: schema.InsertPushSubscription): Promise<schema.PushSubscription> {
    const [created] = await db.insert(schema.pushSubscriptions).values(subscription).returning();
    return created;
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint));
  }
}

export const storage = new DatabaseStorage();
