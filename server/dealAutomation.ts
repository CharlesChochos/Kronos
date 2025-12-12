// Deal Automation Service - AI-powered deal extraction and team assignment
import OpenAI from "openai";
import { db } from "./storage";
import { 
  deals, 
  tasks, 
  users, 
  milestones, 
  personalityProfiles,
  emailDeals,
  dealAiContext,
  aiTaskSuggestions,
  notifications,
  type Deal,
  type User,
  type Task,
  type PersonalityProfile,
  type InsertDeal,
  type InsertTask,
  type InsertMilestone,
  type PodTeamMember
} from "@shared/schema";
import { eq, and, ne, sql, count, desc } from "drizzle-orm";
import { scanDealFolder, getThreadEmails, type ParsedEmail } from "./gmail";

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

// Standard milestones by deal stage
const STAGE_MILESTONES: Record<string, { title: string; description: string }[]> = {
  'Origination': [
    { title: 'Initial Client Meeting', description: 'Schedule and conduct initial meeting with client to understand needs' },
    { title: 'Preliminary Information Request', description: 'Send information request list to client' },
    { title: 'Market Assessment', description: 'Conduct preliminary market and sector analysis' },
    { title: 'Engagement Letter', description: 'Prepare and send engagement letter for signing' },
  ],
  'Structuring': [
    { title: 'Financial Model Development', description: 'Build comprehensive financial model for the deal' },
    { title: 'Valuation Analysis', description: 'Complete valuation analysis using multiple methodologies' },
    { title: 'Deal Structure Proposal', description: 'Develop and present optimal deal structure' },
    { title: 'Marketing Materials', description: 'Create teaser and CIM documents' },
  ],
  'Diligence': [
    { title: 'Data Room Setup', description: 'Organize and populate virtual data room' },
    { title: 'Due Diligence Checklist', description: 'Complete all due diligence items' },
    { title: 'Management Presentations', description: 'Coordinate management presentation sessions' },
    { title: 'Buyer/Investor Outreach', description: 'Contact and qualify potential buyers/investors' },
  ],
  'Legal': [
    { title: 'LOI/Term Sheet', description: 'Review and negotiate letter of intent' },
    { title: 'Legal Documentation', description: 'Coordinate preparation of definitive agreements' },
    { title: 'Regulatory Filings', description: 'Prepare and submit required regulatory filings' },
    { title: 'Final Negotiations', description: 'Support final negotiation sessions' },
  ],
  'Close': [
    { title: 'Closing Checklist', description: 'Complete all closing requirements' },
    { title: 'Funds Transfer', description: 'Coordinate fund flow and closing mechanics' },
    { title: 'Post-Closing Items', description: 'Handle post-closing deliverables' },
    { title: 'Deal Wrap-Up', description: 'Complete deal file and lessons learned' },
  ],
};

export type ExtractedDealInfo = {
  name: string;
  dealType: 'M&A' | 'Capital Raising' | 'Asset Management';
  client: string;
  sector: string;
  estimatedValue: number;
  description: string;
  clientContactName?: string;
  clientContactEmail?: string;
  confidence: number;
  relatedEmails: string[];
};

export async function extractDealFromEmails(emails: ParsedEmail[]): Promise<ExtractedDealInfo | null> {
  if (emails.length === 0) return null;

  const emailContent = emails.map(e => 
    `From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date.toISOString()}\n\n${e.body.substring(0, 2000)}`
  ).join('\n\n---\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an investment banking deal analyst. Extract deal information from emails.
Return a JSON object with these fields:
- name: Deal name/project name (string)
- dealType: One of "M&A", "Capital Raising", or "Asset Management"
- client: Client company name (string)
- sector: Industry sector like Technology, Healthcare, Consumer, Financial Services, Energy, Real Estate, Manufacturing, etc.
- estimatedValue: Deal value in millions USD (number, estimate if not explicit)
- description: Brief deal description (string)
- clientContactName: Primary contact name if mentioned (string or null)
- clientContactEmail: Contact email if mentioned (string or null)
- confidence: How confident you are in the extraction, 0-100 (number)
- isDeal: Boolean indicating if this actually appears to be a deal (vs spam/unrelated)

Only extract if the emails appear to describe an actual investment banking deal opportunity.`
        },
        {
          role: 'user',
          content: emailContent
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    if (!result.isDeal || result.confidence < 50) {
      return null;
    }

    return {
      name: result.name || 'Unknown Deal',
      dealType: result.dealType || 'M&A',
      client: result.client || 'Unknown Client',
      sector: result.sector || 'Other',
      estimatedValue: result.estimatedValue || 0,
      description: result.description || '',
      clientContactName: result.clientContactName,
      clientContactEmail: result.clientContactEmail,
      confidence: result.confidence,
      relatedEmails: emails.map(e => e.id),
    };
  } catch (error) {
    console.error('Error extracting deal from emails:', error);
    return null;
  }
}

export async function getUserWorkload(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(
      eq(tasks.assignedTo, userId),
      ne(tasks.status, 'Completed')
    ));
  return result[0]?.count || 0;
}

export async function getActiveDealsCount(userId: string): Promise<number> {
  const allDeals = await db.select().from(deals).where(eq(deals.status, 'Active'));
  return allDeals.filter(d => 
    d.lead === userId || 
    (d.podTeam as PodTeamMember[])?.some(m => m.userId === userId)
  ).length;
}

export async function selectOptimalTeam(
  dealInfo: ExtractedDealInfo, 
  stage: string = 'Origination'
): Promise<{ lead: PodTeamMember; members: PodTeamMember[] }> {
  const activeUsers = await db
    .select()
    .from(users)
    .where(eq(users.status, 'active'));

  const profiles = await db.select().from(personalityProfiles);
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  type UserScore = {
    user: typeof activeUsers[0];
    profile: typeof profiles[0] | undefined;
    workload: number;
    dealCount: number;
    score: number;
  };

  const userScores: UserScore[] = [];

  for (const user of activeUsers) {
    const profile = profileMap.get(user.id);
    const workload = await getUserWorkload(user.id);
    const dealCount = await getActiveDealsCount(user.id);
    
    let score = 100;
    
    score -= workload * 10;
    score -= dealCount * 15;
    
    if (profile) {
      if (profile.preferredDealTypes?.includes(dealInfo.dealType)) score += 20;
      if (profile.preferredSectors?.includes(dealInfo.sector)) score += 15;
      
      const capacity = profile.workloadCapacity || 5;
      if (dealCount >= capacity) score -= 50;
      
      if (profile.experienceLevel === 'senior' || profile.experienceLevel === 'expert') score += 10;
    }
    
    userScores.push({ user, profile, workload, dealCount, score });
  }

  userScores.sort((a, b) => b.score - a.score);

  const eligibleLeads = userScores.filter(u => 
    u.profile?.experienceLevel === 'senior' || 
    u.profile?.experienceLevel === 'expert' ||
    u.profile?.leadershipStyle
  );

  const selectedLead = eligibleLeads[0] || userScores[0];
  
  const teamMembers = userScores
    .filter(u => u.user.id !== selectedLead?.user.id)
    .slice(0, 2);

  const lead: PodTeamMember = selectedLead ? {
    userId: selectedLead.user.id,
    name: selectedLead.user.name,
    role: 'Lead',
    email: selectedLead.user.email,
    phone: selectedLead.user.phone || undefined,
  } : { name: 'Unassigned', role: 'Lead' };

  const members: PodTeamMember[] = teamMembers.map(m => ({
    userId: m.user.id,
    name: m.user.name,
    role: m.profile?.experienceLevel === 'junior' ? 'Analyst' : 'Associate',
    email: m.user.email,
    phone: m.user.phone || undefined,
  }));

  return { lead, members };
}

export async function createDealFromEmail(
  extractedInfo: ExtractedDealInfo,
  createAsOpportunity: boolean = true
): Promise<string> {
  const team = await selectOptimalTeam(extractedInfo);
  
  const dealType = createAsOpportunity ? 'Opportunity' : extractedInfo.dealType;
  
  const [newDeal] = await db.insert(deals).values({
    name: extractedInfo.name,
    dealType,
    stage: 'Origination',
    value: extractedInfo.estimatedValue,
    client: extractedInfo.client,
    sector: extractedInfo.sector,
    lead: team.lead.name,
    description: extractedInfo.description,
    clientContactName: extractedInfo.clientContactName,
    clientContactEmail: extractedInfo.clientContactEmail,
    podTeam: [team.lead, ...team.members],
    progress: 0,
    status: 'Active',
  }).returning();

  return newDeal.id;
}

export async function createMilestonesForDeal(dealId: string, stage: string = 'Origination'): Promise<void> {
  const stageMilestones = STAGE_MILESTONES[stage] || [];
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  
  for (let i = 0; i < stageMilestones.length; i++) {
    const milestone = stageMilestones[i];
    const milestoneDue = new Date(dueDate);
    milestoneDue.setDate(milestoneDue.getDate() + (i * 7));
    
    await db.insert(milestones).values({
      dealId,
      title: milestone.title,
      description: milestone.description,
      stage,
      order: i,
      status: 'pending',
      dueDate: milestoneDue.toISOString().split('T')[0],
    });
  }
}

export async function createTasksFromMilestone(
  milestoneId: string,
  dealId: string,
  podTeam: PodTeamMember[]
): Promise<void> {
  const [milestone] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  if (!milestone) return;

  const teamWithCapacity: { member: PodTeamMember; workload: number }[] = [];
  
  for (const member of podTeam) {
    if (member.userId) {
      const workload = await getUserWorkload(member.userId);
      teamWithCapacity.push({ member, workload });
    }
  }

  teamWithCapacity.sort((a, b) => a.workload - b.workload);

  const taskTemplates = generateTaskTemplates(milestone.title, milestone.stage);

  for (let i = 0; i < taskTemplates.length; i++) {
    const template = taskTemplates[i];
    const assignee = teamWithCapacity[i % teamWithCapacity.length];
    
    const dueDate = milestone.dueDate 
      ? new Date(milestone.dueDate)
      : new Date();
    dueDate.setDate(dueDate.getDate() - Math.floor((taskTemplates.length - i) / 2));

    await db.insert(tasks).values({
      title: template.title,
      description: template.description,
      dealId,
      dealStage: milestone.stage,
      assignedTo: assignee?.member.userId,
      priority: template.priority as 'Low' | 'Medium' | 'High',
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'Pending',
      type: template.type,
    });
  }
}

function generateTaskTemplates(milestoneName: string, stage: string): { 
  title: string; 
  description: string; 
  priority: string; 
  type: string;
}[] {
  const templates: { title: string; description: string; priority: string; type: string; }[] = [];
  
  if (milestoneName.includes('Meeting')) {
    templates.push(
      { title: 'Schedule meeting', description: 'Coordinate calendars and send invites', priority: 'High', type: 'Coordination' },
      { title: 'Prepare meeting agenda', description: 'Draft agenda and key discussion points', priority: 'Medium', type: 'Documentation' },
      { title: 'Send meeting materials', description: 'Distribute pre-read materials to participants', priority: 'Medium', type: 'Communication' },
    );
  } else if (milestoneName.includes('Financial Model') || milestoneName.includes('Valuation')) {
    templates.push(
      { title: 'Gather financial data', description: 'Collect historical financials and projections', priority: 'High', type: 'Analysis' },
      { title: 'Build model structure', description: 'Create model framework and assumptions', priority: 'High', type: 'Analysis' },
      { title: 'Run sensitivity analysis', description: 'Test key assumptions and scenarios', priority: 'Medium', type: 'Analysis' },
      { title: 'Quality check model', description: 'Review formulas and cross-check calculations', priority: 'High', type: 'Review' },
    );
  } else if (milestoneName.includes('Document') || milestoneName.includes('Materials')) {
    templates.push(
      { title: 'Draft initial content', description: 'Create first draft of document', priority: 'High', type: 'Documentation' },
      { title: 'Internal review', description: 'Circulate for team feedback', priority: 'Medium', type: 'Review' },
      { title: 'Incorporate feedback', description: 'Address comments and revise', priority: 'Medium', type: 'Documentation' },
      { title: 'Final formatting', description: 'Polish layout and design', priority: 'Low', type: 'Documentation' },
    );
  } else if (milestoneName.includes('Due Diligence') || milestoneName.includes('Diligence')) {
    templates.push(
      { title: 'Create DD checklist', description: 'Compile comprehensive due diligence items', priority: 'High', type: 'Analysis' },
      { title: 'Request information', description: 'Send information requests to relevant parties', priority: 'High', type: 'Communication' },
      { title: 'Review received materials', description: 'Analyze submitted documents', priority: 'Medium', type: 'Analysis' },
      { title: 'Summarize findings', description: 'Document key observations and issues', priority: 'Medium', type: 'Documentation' },
    );
  } else {
    templates.push(
      { title: `Complete ${milestoneName}`, description: `Execute ${milestoneName} requirements`, priority: 'High', type: 'General' },
      { title: `Review ${milestoneName}`, description: `Quality check and approval`, priority: 'Medium', type: 'Review' },
    );
  }

  return templates;
}

export async function sendDealMemo(dealId: string): Promise<void> {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!deal) return;

  const podTeam = deal.podTeam as PodTeamMember[];
  
  for (const member of podTeam) {
    if (member.userId) {
      await db.insert(notifications).values({
        userId: member.userId,
        title: `New Deal Assignment: ${deal.name}`,
        message: `You have been assigned to the ${deal.name} deal as ${member.role}. Client: ${deal.client}. Sector: ${deal.sector}. Value: $${deal.value}M.`,
        type: 'info',
        link: `/ceo/deals?dealId=${dealId}`,
      });
    }
  }
}

export async function addDealContext(
  dealId: string, 
  contextType: string, 
  content: string,
  sourceId?: string
): Promise<void> {
  let summary = content.substring(0, 500);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Summarize this deal-related content in 2-3 sentences for quick reference.' },
        { role: 'user', content: content.substring(0, 4000) }
      ],
      max_tokens: 150,
    });
    summary = response.choices[0].message.content || summary;
  } catch (error) {
    console.error('Error summarizing context:', error);
  }

  await db.insert(dealAiContext).values({
    dealId,
    contextType,
    content,
    summary,
    sourceId,
    processedAt: new Date(),
  });
}

export async function generateTaskSuggestions(dealId: string): Promise<void> {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!deal) return;

  const dealTasks = await db.select().from(tasks).where(eq(tasks.dealId, dealId));
  const context = await db.select().from(dealAiContext).where(eq(dealAiContext.dealId, dealId));
  const podTeam = deal.podTeam as PodTeamMember[];

  const teamWorkloads: Record<string, number> = {};
  for (const member of podTeam) {
    if (member.userId) {
      teamWorkloads[member.userId] = await getUserWorkload(member.userId);
    }
  }

  const prompt = `Analyze this deal and suggest task optimizations:

Deal: ${deal.name}
Type: ${deal.dealType}
Stage: ${deal.stage}
Client: ${deal.client}

Current Tasks (${dealTasks.length}):
${dealTasks.map(t => `- ${t.title} (${t.status}, assigned to: ${t.assignedTo || 'unassigned'}, due: ${t.dueDate || 'no date'})`).join('\n')}

Team Workloads:
${Object.entries(teamWorkloads).map(([id, count]) => `- User ${id}: ${count} active tasks`).join('\n')}

Recent Context:
${context.slice(-5).map(c => c.summary || c.content.substring(0, 200)).join('\n')}

Suggest up to 3 task adjustments. For each, provide:
- suggestionType: "reassign" | "reschedule" | "reprioritize" | "new_task"
- title: Brief title
- description: What to do
- reasoning: Why this helps
- priority: "low" | "medium" | "high"
- suggestedChanges: Object with specific changes (taskId, newAssignee, newDueDate, newPriority, etc.)

Return JSON array of suggestions.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an investment banking operations optimizer. Suggest task adjustments to improve efficiency and balance workload.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions":[]}');
    const suggestions = result.suggestions || result;

    for (const suggestion of (Array.isArray(suggestions) ? suggestions : [suggestions])) {
      if (!suggestion.title) continue;
      
      await db.insert(aiTaskSuggestions).values({
        dealId,
        suggestionType: suggestion.suggestionType || 'modify',
        title: suggestion.title,
        description: suggestion.description || '',
        reasoning: suggestion.reasoning,
        suggestedChanges: suggestion.suggestedChanges || {},
        priority: suggestion.priority || 'medium',
        status: 'pending',
      });
    }
  } catch (error) {
    console.error('Error generating task suggestions:', error);
  }
}

export async function processEmailFolder(folderName: string = 'Deals'): Promise<{
  processed: number;
  created: number;
  errors: number;
}> {
  const stats = { processed: 0, created: 0, errors: 0 };

  try {
    const emails = await scanDealFolder(folderName);
    const threadGroups = new Map<string, ParsedEmail[]>();
    
    for (const email of emails) {
      const existing = threadGroups.get(email.threadId) || [];
      existing.push(email);
      threadGroups.set(email.threadId, existing);
    }

    for (const [threadId, threadEmails] of Array.from(threadGroups.entries())) {
      stats.processed++;
      
      const existingEmailDeal = await db
        .select()
        .from(emailDeals)
        .where(eq(emailDeals.threadId, threadId))
        .limit(1);

      if (existingEmailDeal.length > 0) continue;

      try {
        const extracted = await extractDealFromEmails(threadEmails);
        
        if (extracted) {
          const dealId = await createDealFromEmail(extracted, true);
          
          await db.insert(emailDeals).values({
            emailId: threadEmails[0].id,
            threadId,
            subject: threadEmails[0].subject,
            sender: threadEmails[0].from,
            receivedAt: threadEmails[0].date,
            extractedData: extracted,
            dealId,
            status: 'processed',
          });

          await createMilestonesForDeal(dealId, 'Origination');
          
          for (const email of threadEmails) {
            await addDealContext(dealId, 'email', email.body, email.id);
          }
          
          await sendDealMemo(dealId);
          
          stats.created++;
        } else {
          await db.insert(emailDeals).values({
            emailId: threadEmails[0].id,
            threadId,
            subject: threadEmails[0].subject,
            sender: threadEmails[0].from,
            receivedAt: threadEmails[0].date,
            status: 'ignored',
            processingNotes: 'Not identified as a deal',
          });
        }
      } catch (error: any) {
        stats.errors++;
        await db.insert(emailDeals).values({
          emailId: threadEmails[0].id,
          threadId,
          subject: threadEmails[0].subject,
          sender: threadEmails[0].from,
          receivedAt: threadEmails[0].date,
          status: 'error',
          processingNotes: error.message,
        });
      }
    }
  } catch (error) {
    console.error('Error processing email folder:', error);
    stats.errors++;
  }

  return stats;
}
