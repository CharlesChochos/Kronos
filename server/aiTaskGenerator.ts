import OpenAI from "openai";
import { storage } from "./storage";
import type { Deal, User, Task, InsertTask, StagePodMember, StageDocument, DealNote } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const DEAL_STAGES = [
  'Origination',
  'Engagement', 
  'Due Diligence',
  'Valuation',
  'Negotiation',
  'Closing',
  'Integration'
];

const STAGE_OBJECTIVES: Record<string, string[]> = {
  'Origination': [
    'Identify and qualify potential opportunities',
    'Conduct initial market research and competitive analysis',
    'Prepare preliminary materials for client engagement',
    'Develop initial valuation hypotheses',
    'Assess strategic fit and deal feasibility'
  ],
  'Engagement': [
    'Finalize engagement letter and fee structure',
    'Establish communication protocols with client',
    'Build detailed project timeline and milestones',
    'Assemble internal deal team and assign responsibilities',
    'Conduct kick-off meeting with all stakeholders'
  ],
  'Due Diligence': [
    'Create comprehensive data room structure',
    'Conduct financial due diligence and analysis',
    'Perform legal and regulatory compliance review',
    'Assess operational and commercial risks',
    'Prepare management presentations and Q&A materials',
    'Coordinate third-party advisor reviews'
  ],
  'Valuation': [
    'Build detailed financial models (DCF, LBO, comparables)',
    'Conduct sensitivity and scenario analyses',
    'Benchmark against market transactions',
    'Prepare valuation presentation for stakeholders',
    'Defend valuation assumptions and methodology'
  ],
  'Negotiation': [
    'Develop negotiation strategy and key terms',
    'Prepare term sheet and deal structure options',
    'Manage multiple bidder dynamics if applicable',
    'Navigate key deal points and trade-offs',
    'Coordinate with legal counsel on documentation'
  ],
  'Closing': [
    'Finalize all transaction documentation',
    'Coordinate signing and closing logistics',
    'Manage regulatory and third-party approvals',
    'Prepare funds flow and closing checklist',
    'Execute final conditions precedent'
  ],
  'Integration': [
    'Support post-closing integration planning',
    'Monitor earnout and contingent payment terms',
    'Manage transition services agreements',
    'Conduct post-mortem and lessons learned',
    'Maintain client relationship for future opportunities'
  ]
};

interface AiTaskGenerationRequest {
  dealId: string;
  stage: string;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: string;
}

interface GeneratedTaskPlan {
  memo: string;
  rationale: string;
  dealSummary: string;
  stageObjectives: string[];
  dailyTasks: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    estimatedMinutes: number;
  }[];
  weeklyTasks: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    estimatedMinutes: number;
  }[];
  monthlyTasks: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    estimatedMinutes: number;
  }[];
}

const AI_TASK_GENERATOR_PROMPT = `You are an expert investment banking task planner. Your job is to analyze a deal's context (description, documents, notes, stage) and generate a personalized work plan with specific, actionable tasks for a team member assigned to a particular deal stage.

CRITICAL RULES:
1. All tasks must be SPECIFIC to the deal context provided - do not generate generic tasks
2. Tasks must be objectively verifiable and actionable
3. Consider the deal's sector, value, client, and any documents/notes provided
4. Daily tasks = immediate actions (1-3 days)
5. Weekly tasks = short-term deliverables (within the week)
6. Monthly tasks = milestone-based work (over the coming month)
7. Priority: High = blocking/urgent, Medium = important but flexible, Low = nice to have
8. The memo should give the team member a clear understanding of their role and objectives

You must respond in valid JSON format with this exact structure:
{
  "memo": "A 2-3 paragraph memo explaining the team member's role, key priorities, and success criteria for this stage of the deal",
  "rationale": "Brief explanation of why these specific tasks were chosen based on the deal context",
  "dealSummary": "One paragraph summary of the deal for context",
  "stageObjectives": ["Array of 3-5 key objectives for this stage"],
  "dailyTasks": [
    {
      "title": "Specific task title",
      "description": "Detailed description with clear deliverable",
      "priority": "High|Medium|Low",
      "estimatedMinutes": number
    }
  ],
  "weeklyTasks": [...same structure...],
  "monthlyTasks": [...same structure...]
}

Generate 2-4 daily tasks, 2-3 weekly tasks, and 1-2 monthly tasks based on the deal context.`;

async function buildDealContext(dealId: string): Promise<{
  deal: Deal;
  documents: StageDocument[];
  notes: DealNote[];
  existingTasks: Task[];
  teamMembers: StagePodMember[];
}> {
  const deal = await storage.getDeal(dealId);
  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const [documents, notes, existingTasks, teamMembers] = await Promise.all([
    storage.getStageDocuments(dealId),
    storage.getDealNotes(dealId),
    storage.getTasksByDeal(dealId),
    storage.getStagePodMembers(dealId)
  ]);

  return { deal, documents, notes, existingTasks, teamMembers };
}

function formatDealContextForPrompt(context: {
  deal: Deal;
  documents: StageDocument[];
  notes: DealNote[];
  existingTasks: Task[];
  teamMembers: StagePodMember[];
}, stage: string, assigneeName: string, assigneeRole: string): string {
  const { deal, documents, notes, existingTasks, teamMembers } = context;
  
  const stageDocuments = documents.filter(d => d.stage === stage);
  const stageTeam = teamMembers.filter(m => m.stage === stage);
  const stageTasks = existingTasks.filter(t => t.dealStage === stage);
  
  let prompt = `DEAL INFORMATION:
Name: ${deal.name}
Type: ${deal.dealType}
Client: ${deal.client}
Sector: ${deal.sector}
Value: $${deal.value}M
Current Stage: ${stage}
Lead: ${deal.lead}
Status: ${deal.status}
Progress: ${deal.progress}%

DEAL DESCRIPTION:
${deal.description || 'No description provided'}

STAGE OBJECTIVES (${stage}):
${(STAGE_OBJECTIVES[stage] || []).map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

TEAM MEMBER CONTEXT:
Assignee: ${assigneeName}
Role in this stage: ${assigneeRole}

OTHER TEAM MEMBERS ON THIS STAGE:
${stageTeam.length > 0 ? stageTeam.map(m => `- ${m.userName || 'Unknown'} (${m.role})`).join('\n') : 'None assigned yet'}
`;

  if (notes.length > 0) {
    const recentNotes = notes.slice(0, 5);
    prompt += `\nRECENT DEAL NOTES (${recentNotes.length} of ${notes.length}):
${recentNotes.map(n => `- ${n.content?.substring(0, 200)}${(n.content?.length || 0) > 200 ? '...' : ''}`).join('\n')}
`;
  }

  if (stageDocuments.length > 0) {
    prompt += `\nSTAGE DOCUMENTS (${stage}):
${stageDocuments.map(d => `- ${d.name} (${d.category || 'Uncategorized'})`).join('\n')}
`;
  }

  if (stageTasks.length > 0) {
    prompt += `\nEXISTING TASKS FOR THIS STAGE:
${stageTasks.map(t => `- ${t.title} [${t.status}]`).join('\n')}
`;
  }

  return prompt;
}

function calculateDueDates(cadence: 'daily' | 'weekly' | 'monthly', index: number): string {
  const now = new Date();
  let dueDate: Date;

  switch (cadence) {
    case 'daily':
      // Daily tasks: first one due today, subsequent ones staggered over next few days
      dueDate = new Date(now);
      dueDate.setDate(now.getDate() + index); // index 0 = today, 1 = tomorrow, etc.
      break;
    case 'weekly':
      // Weekly tasks: due at end of this week (Sunday) or following weeks
      dueDate = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7; // Days until end of this week (0 if already Sunday)
      // If today is Sunday, first weekly task is still due today (index 0), otherwise due this Sunday
      dueDate.setDate(now.getDate() + daysUntilSunday + (index * 7)); // index 0 = this Sunday, 1 = next Sunday
      break;
    case 'monthly':
      // Monthly tasks: due at end of this month or following months
      dueDate = new Date(now);
      dueDate.setMonth(now.getMonth() + index + 1, 0); // Last day of current month (index 0) or future months
      break;
  }

  return dueDate.toISOString().split('T')[0];
}

export async function generateAiTasksForAssignment(
  request: AiTaskGenerationRequest
): Promise<{ planId: string; tasksCreated: number }> {
  const { dealId, stage, assigneeId, assigneeName, assigneeRole } = request;

  const existingPlan = await storage.getActiveAiTaskPlan(dealId, stage, assigneeId);
  if (existingPlan) {
    await storage.archiveAiTaskPlan(existingPlan.id);
  }

  const context = await buildDealContext(dealId);
  const formattedContext = formatDealContextForPrompt(context, stage, assigneeName, assigneeRole);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AI_TASK_GENERATOR_PROMPT },
      { role: "user", content: formattedContext }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("No response from AI");
  }

  let taskPlan: GeneratedTaskPlan;
  try {
    taskPlan = JSON.parse(responseContent);
  } catch (e) {
    console.error("Failed to parse AI response:", responseContent);
    throw new Error("Invalid AI response format");
  }

  const plan = await storage.createAiTaskPlan({
    dealId,
    stage,
    assigneeId,
    memo: taskPlan.memo,
    rationale: taskPlan.rationale,
    dealSummary: taskPlan.dealSummary,
    stageObjectives: taskPlan.stageObjectives,
    isActive: true
  });

  const tasksToCreate: InsertTask[] = [];

  const memoTask: InsertTask = {
    title: `[MEMO] ${stage} Work Plan - ${context.deal.name}`,
    description: taskPlan.memo,
    dealId,
    dealStage: stage,
    assignedTo: assigneeId,
    priority: 'High',
    status: 'Pending',
    type: 'Planning',
    cadence: 'memo',
    aiPlanId: plan.id
  };
  tasksToCreate.push(memoTask);

  taskPlan.dailyTasks?.forEach((task, index) => {
    tasksToCreate.push({
      title: task.title,
      description: task.description,
      dealId,
      dealStage: stage,
      assignedTo: assigneeId,
      priority: task.priority || 'Medium',
      status: 'Pending',
      type: 'Analysis',
      cadence: 'daily',
      aiPlanId: plan.id,
      dueDate: calculateDueDates('daily', index)
    });
  });

  taskPlan.weeklyTasks?.forEach((task, index) => {
    tasksToCreate.push({
      title: task.title,
      description: task.description,
      dealId,
      dealStage: stage,
      assignedTo: assigneeId,
      priority: task.priority || 'Medium',
      status: 'Pending',
      type: 'Deliverable',
      cadence: 'weekly',
      aiPlanId: plan.id,
      dueDate: calculateDueDates('weekly', index)
    });
  });

  taskPlan.monthlyTasks?.forEach((task, index) => {
    tasksToCreate.push({
      title: task.title,
      description: task.description,
      dealId,
      dealStage: stage,
      assignedTo: assigneeId,
      priority: task.priority || 'Low',
      status: 'Pending',
      type: 'Milestone',
      cadence: 'monthly',
      aiPlanId: plan.id,
      dueDate: calculateDueDates('monthly', index)
    });
  });

  await storage.bulkCreateTasks(tasksToCreate);

  console.log(`[AI Task Generator] Created ${tasksToCreate.length} tasks for ${assigneeName} on ${context.deal.name} (${stage})`);

  return { planId: plan.id, tasksCreated: tasksToCreate.length };
}

export async function regenerateAiTasks(
  dealId: string,
  stage: string,
  assigneeId: string
): Promise<{ planId: string; tasksCreated: number }> {
  const user = await storage.getUser(assigneeId);
  if (!user) {
    throw new Error(`User not found: ${assigneeId}`);
  }

  const stagePodMembers = await storage.getStagePodMembers(dealId, stage);
  const memberInfo = stagePodMembers.find(m => m.userId === assigneeId);
  
  return generateAiTasksForAssignment({
    dealId,
    stage,
    assigneeId,
    assigneeName: user.name,
    assigneeRole: memberInfo?.role || 'Team Member'
  });
}

export async function getAiTaskPlanWithTasks(planId: string): Promise<{
  plan: any;
  tasks: Task[];
} | null> {
  const plan = await storage.getAiTaskPlan(planId);
  if (!plan) return null;

  const tasks = await storage.getTasksByAiPlan(planId);
  return { plan, tasks };
}
