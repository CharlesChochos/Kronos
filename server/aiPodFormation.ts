import OpenAI from "openai";
import { storage } from "./storage";
import type { Deal, User, ResumeAnalysis, PersonalityAssessment, UserWorkloadSnapshot, AIPodFormationResponse } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

const MASTER_POD_PLANNER_PROMPT = `You are Equiturn Master Pod Movement Planner. You ingest a deal's uploaded documents plus the firm's Pod Movement and Daily Movement logic, then you output a full deal completion plan that links milestones to Pod Movement Tasks to daily subtasks across Origination, Structuring, Execution, Closing, Integration.

Nonnegotiable constraints
Confidentiality. Treat all deal documents and employee data as confidential.
No fabrication. Do not invent counterparties, pricing, deadlines, deliverables, approvals, or facts that are not supported by the uploaded deal documents.
No questions. You must never ask the user for missing inputs. Proceed using best effort extraction, and clearly label assumptions and any unassigned roles.
No emojis. No tables.
Institutional tone, execution first, zero fluff.
Every task and subtask must be objectively checkable.
The dependency chain must be explicit. Daily subtasks complete Pod Movement Tasks. Pod Movement Tasks complete phase milestones. Phase milestones complete the deal.
Pod Lead does not move. Pod Lead stays constant across all phases.

Deal size determination and Pod sizing
Pod sizing rule. If deal size is greater than 200,000,000, pod is five people. If deal size is 200,000,000 or less, pod is three people.

Deal Team status framework
Valid Deal Team statuses are Floater, Deal Team 10, Deal Team 8, Deal Team 2, Deal Team 4, Deal Team 6.
Deal Team experience hierarchy for staffing fallback
Highest to lowest experience order is Deal Team 6, then Deal Team 4, then Deal Team 2, then Deal Team 8 and Deal Team 10 as equal, then Floater.

Pod staffing requirements by deal size and pod position
Over 200,000,000 deal size, five person pod, Deal Team requirements by position
Position 1 Pod Lead must be Deal Team 6 or Deal Team 4 or Deal Team 2, in that preferred order.
Position 2 Pod Second must be Deal Team 2. If none available, fall back down the hierarchy.
Position 3 Pod Third must be Deal Team 2 or Deal Team 8 or Deal Team 10, in that preferred order. If none available, fall back to Floater.
Position 4 Pod Fourth must be Deal Team 8 or Deal Team 10, in that preferred order. If none available, fall back to Floater.
Position 5 Pod Fifth must be Deal Team 8 or Deal Team 10 or Floater, in that preferred order. If none available, mark Unassigned.

200,000,000 or less deal size, three person pod, Deal Team requirements by position
Position 1 Pod Lead must be Deal Team 2. If none available, fall back down the hierarchy.
Position 2 Pod Second must be Deal Team 8 or Deal Team 10, in that preferred order. If none available, fall back to Floater.
Position 3 Pod Third must be Floater. If none available, mark Unassigned.

Employee tag framework
Canonical tags that may appear in employee tagging are Politician, Rainmaker, Mayor, Creative, Deal Junkie, Closer, Grandmaster, Architect, Guru, Sherpa, Firefighter, Legal, Liaison, Auditor, Regulatory, Misfit.

Pod role mapping and tag requirements
Five person pod role map
Pod Lead role, required tags priority Grandmaster, Closer, Politician, Architect.
Origination Lead role, required tags priority Rainmaker, Politician, Mayor.
Structuring Lead role, required tags priority Architect, Guru, Regulatory or Auditor when applicable.
Execution Lead role, required tags priority Sherpa, Deal Junkie, Firefighter, Liaison.
Closing and Integration Lead role, required tags priority Legal, Closer, Firefighter, Liaison, Auditor.

Three person pod role map
Pod Lead role, required tags priority Grandmaster, Closer, Politician, Architect.
Structuring Lead role, required tags priority Architect, Guru, Regulatory or Auditor when applicable.
Execution Lead role, required tags priority Sherpa, Firefighter, Deal Junkie, Liaison.

CRITICAL: You must also consider:
1. Each employee's current workload (capacity score 0-100, lower is more available)
2. Chemistry and compatibility between team members based on their personality profiles
3. Whether they are already assigned to other deals at the same stage
4. Their strengths for the current deal stage

You must respond in valid JSON format with this exact structure:
{
  "podSize": number,
  "podMembers": [
    {
      "position": number,
      "role": string,
      "userId": string or null,
      "userName": string or null,
      "dealTeamStatus": string or null,
      "requiredTags": string[],
      "matchedTags": string[],
      "rationale": string
    }
  ],
  "milestones": [
    {
      "stage": string,
      "title": string,
      "description": string,
      "orderIndex": number
    }
  ],
  "podMovementTasks": [
    {
      "milestoneTitle": string,
      "title": string,
      "ownerRole": string,
      "definitionOfDone": string,
      "qualityGates": string,
      "escalationTriggers": string
    }
  ],
  "dailySubtasks": [
    {
      "parentTaskTitle": string,
      "title": string,
      "assignedRole": string,
      "frequency": "daily" | "weekly" | "monthly"
    }
  ],
  "formationRationale": string,
  "dataIntegrityNotes": string
}`;

async function buildUserRoster(usersWithProfiles: Array<{
  user: User;
  resumeAnalysis: ResumeAnalysis | null;
  personalityAssessment: PersonalityAssessment | null;
  workload: { activeTasks: number; pendingTasks: number; completedThisWeek: number };
}>): Promise<UserWorkloadSnapshot[]> {
  const rosterPromises = usersWithProfiles.map(async ({ user, resumeAnalysis, personalityAssessment, workload }) => {
    const dealTeamStatus = resumeAnalysis?.assignedDealTeam || 'Floater';
    
    const personalityTags: string[] = [];
    if (personalityAssessment?.aiAnalysis?.deploymentTags?.topFiveArchetypes) {
      personalityTags.push(...personalityAssessment.aiAnalysis.deploymentTags.topFiveArchetypes);
    }
    if (resumeAnalysis?.aiAnalysis?.onboardingPlacement?.topFiveInferredTags) {
      personalityTags.push(...resumeAnalysis.aiAnalysis.onboardingPlacement.topFiveInferredTags);
    }
    
    const uniqueTags = [...new Set(personalityTags)];
    
    const capacityScore = Math.min(100, (workload.activeTasks * 20) + (workload.pendingTasks * 10));
    
    const currentStages = await storage.getUserCurrentStageAssignments(user.id);
    
    return {
      userId: user.id,
      userName: user.name,
      dealTeamStatus,
      personalityTags: uniqueTags,
      activeTasks: workload.activeTasks,
      pendingTasks: workload.pendingTasks,
      completedThisWeek: workload.completedThisWeek,
      activeDeals: user.activeDeals || 0,
      capacityScore,
      currentStages
    };
  });
  
  return Promise.all(rosterPromises);
}

export async function formPodForDeal(
  deal: Deal,
  stage: string,
  existingPodLeadId?: string
): Promise<{ success: boolean; podId?: string; error?: string }> {
  try {
    console.log(`[AI Pod Formation] Starting pod formation for deal ${deal.id} at stage ${stage}`);
    
    const usersWithProfiles = await storage.getAllUsersWithProfiles();
    const userRoster = await buildUserRoster(usersWithProfiles);
    
    const dealDocuments = await storage.getDealContextUpdates(deal.id);
    const documentContents = dealDocuments
      .filter(d => d.updateType === 'document' && d.content)
      .map(d => ({ name: d.title, content: d.content || '' }));
    
    const dealValue = deal.value * 1000000;
    const podSize = dealValue > 200000000 ? 5 : 3;
    
    const prompt = `
DEAL INFORMATION:
Deal Name: ${deal.name}
Deal Type: ${deal.dealType}
Deal Value: $${dealValue.toLocaleString()} (${deal.value}M)
Client: ${deal.client}
Sector: ${deal.sector}
Current Stage: ${stage}
Description: ${deal.description || 'Not provided'}

POD SIZE DETERMINATION:
Based on deal value of $${dealValue.toLocaleString()}, the pod size is ${podSize} people.

${existingPodLeadId ? `EXISTING POD LEAD: The Pod Lead from previous stage must be maintained. Pod Lead User ID: ${existingPodLeadId}` : ''}

DEAL DOCUMENTS:
${documentContents.length > 0 ? documentContents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n') : 'No documents uploaded yet. Use standard phase ladder.'}

EMPLOYEE ROSTER:
${userRoster.map(u => `
User: ${u.userName} (ID: ${u.userId})
Deal Team Status: ${u.dealTeamStatus}
Personality Tags: ${u.personalityTags.join(', ') || 'None assessed'}
Current Workload: ${u.activeTasks} active tasks, ${u.pendingTasks} pending tasks
Capacity Score: ${u.capacityScore}/100 (lower is more available)
Active Deals: ${u.activeDeals}
Current Stage Assignments: ${u.currentStages.length > 0 ? u.currentStages.join(', ') : 'None'}
AVAILABILITY FOR ${stage}: ${u.currentStages.includes(stage) ? 'ALREADY ASSIGNED TO THIS STAGE - PREFER NOT TO ASSIGN' : 'Available'}
`).join('\n')}

Based on this information, form the optimal pod team and create the full deal completion plan.
Prioritize team members with lower capacity scores (more available) while still meeting Deal Team status requirements.
Consider personality tag compatibility for team chemistry.
`;

    console.log(`[AI Pod Formation] Calling OpenAI with ${userRoster.length} available users`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MASTER_POD_PLANNER_PROMPT },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 8000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    console.log(`[AI Pod Formation] Received AI response, parsing...`);
    
    const aiResponse: AIPodFormationResponse = JSON.parse(content);
    
    if (aiResponse.podSize !== podSize) {
      console.warn(`[AI Pod Formation] AI returned pod size ${aiResponse.podSize}, but business rule requires ${podSize}. Using deterministic value.`);
    }
    
    const aiLeadMember = aiResponse.podMembers.find(m => m.position === 1);
    let finalLeadUserId = existingPodLeadId || aiLeadMember?.userId || null;
    
    if (existingPodLeadId) {
      const existingLeadUser = userRoster.find(u => u.userId === existingPodLeadId);
      if (!existingLeadUser) {
        console.error(`[AI Pod Formation] CRITICAL: Existing pod lead ${existingPodLeadId} not found in active user roster. Cannot persist lead.`);
        throw new Error(`Pod lead ${existingPodLeadId} not found in active roster. The lead may be inactive or removed.`);
      }
      
      const leadInAIResponse = aiResponse.podMembers.find(m => m.userId === existingPodLeadId);
      if (!leadInAIResponse) {
        console.log(`[AI Pod Formation] Enforcing Pod Lead persistence - AI did not include existing lead ${existingPodLeadId}`);
        const evictedLead = aiResponse.podMembers.find(m => m.position === 1);
        if (evictedLead) {
          aiResponse.podMembers = aiResponse.podMembers.filter(m => m.position !== 1);
        }
        aiResponse.podMembers.unshift({
          position: 1,
          role: 'Pod Lead',
          userId: existingPodLeadId,
          userName: existingLeadUser.userName,
          dealTeamStatus: existingLeadUser.dealTeamStatus,
          requiredTags: ['Grandmaster', 'Closer', 'Politician', 'Architect'],
          matchedTags: existingLeadUser.personalityTags.filter(t => 
            ['Grandmaster', 'Closer', 'Politician', 'Architect'].includes(t)
          ),
          rationale: 'Pod Lead persisted from previous stage (Pod Lead does not move rule)'
        });
      }
    }
    
    if (finalLeadUserId) {
      const leadInFinalMembers = aiResponse.podMembers.find(m => m.userId === finalLeadUserId);
      if (!leadInFinalMembers) {
        console.error(`[AI Pod Formation] CRITICAL: Final lead ${finalLeadUserId} not in pod members list after normalization`);
        throw new Error(`Pod lead integrity check failed. Lead ${finalLeadUserId} not in final membership list.`);
      }
    }
    
    const membersWithIds = aiResponse.podMembers.filter(m => m.userId);
    if (membersWithIds.length < Math.min(podSize, 2)) {
      console.warn(`[AI Pod Formation] WARNING: Only ${membersWithIds.length} assignable members for a ${podSize}-person pod`);
    }
    
    const pod = await storage.createDealPod({
      dealId: deal.id,
      stage,
      podSize,
      leadUserId: finalLeadUserId,
      aiFormationRationale: aiResponse.formationRationale,
      aiRawResponse: content,
      status: 'active'
    });
    
    console.log(`[AI Pod Formation] Created pod ${pod.id} with ${aiResponse.podMembers.length} members (deterministic size: ${podSize})`);
    
    const addedUserIds = new Set<string>();
    for (const member of aiResponse.podMembers) {
      if (member.userId && !addedUserIds.has(member.userId)) {
        addedUserIds.add(member.userId);
        await storage.createPodMember({
          podId: pod.id,
          userId: member.userId,
          role: member.role,
          position: member.position,
          dealTeamStatus: member.dealTeamStatus,
          requiredTags: member.requiredTags,
          matchedTags: member.matchedTags,
          assignmentRationale: member.rationale,
          isLead: member.position === 1 || member.userId === finalLeadUserId
        });
      }
    }
    
    if (finalLeadUserId && !addedUserIds.has(finalLeadUserId)) {
      console.error(`[AI Pod Formation] CRITICAL: Lead ${finalLeadUserId} was not added to pod_members table`);
      throw new Error(`Pod lead integrity check failed. Lead was not persisted to membership table.`);
    }
    
    const milestoneMap: Record<string, string> = {};
    for (const milestone of aiResponse.milestones) {
      const created = await storage.createDealMilestone({
        dealId: deal.id,
        podId: pod.id,
        stage: milestone.stage,
        title: milestone.title,
        description: milestone.description,
        orderIndex: milestone.orderIndex
      });
      milestoneMap[milestone.title] = created.id;
    }
    
    console.log(`[AI Pod Formation] Created ${aiResponse.milestones.length} milestones`);
    
    const taskMap: Record<string, string> = {};
    for (const task of aiResponse.podMovementTasks) {
      const milestoneId = milestoneMap[task.milestoneTitle] || null;
      
      const assignedMember = aiResponse.podMembers.find(m => m.role === task.ownerRole);
      
      const created = await storage.createPodMovementTask({
        dealId: deal.id,
        milestoneId,
        podId: pod.id,
        title: task.title,
        ownerRole: task.ownerRole,
        assignedTo: assignedMember?.userId || null,
        definitionOfDone: task.definitionOfDone,
        qualityGates: task.qualityGates,
        escalationTriggers: task.escalationTriggers,
        status: 'pending'
      });
      taskMap[task.title] = created.id;
    }
    
    console.log(`[AI Pod Formation] Created ${aiResponse.podMovementTasks.length} pod movement tasks`);
    
    for (const subtask of aiResponse.dailySubtasks) {
      const assignedMember = aiResponse.podMembers.find(m => m.role === subtask.assignedRole);
      
      if (assignedMember?.userId) {
        const priority = subtask.frequency === 'daily' ? 'High' : 
                        subtask.frequency === 'weekly' ? 'Medium' : 'Low';
        
        await storage.createTask({
          title: subtask.title,
          description: `Part of: ${subtask.parentTaskTitle}\nFrequency: ${subtask.frequency}`,
          dealId: deal.id,
          dealStage: stage,
          assignedTo: assignedMember.userId,
          priority,
          type: 'Deal',
          status: 'Pending'
        });
      }
    }
    
    console.log(`[AI Pod Formation] Created ${aiResponse.dailySubtasks.length} daily subtasks`);
    
    const podMemberUserIds = aiResponse.podMembers
      .filter(m => m.userId)
      .map(m => m.userId as string);
    
    for (const userId of podMemberUserIds) {
      await storage.createNotification({
        userId,
        title: `Assigned to Deal: ${deal.name}`,
        message: `You have been assigned to the pod team for "${deal.name}" (${stage} stage). Check your tasks for new assignments.`,
        type: 'info',
        link: `/ceo/deals?id=${deal.id}`
      });
    }
    
    await storage.createDealContextUpdate({
      dealId: deal.id,
      updateType: 'status_change',
      title: `Pod team formed for ${stage} stage`,
      content: aiResponse.formationRationale,
      metadata: { podId: pod.id, stage, podSize: aiResponse.podSize }
    });
    
    console.log(`[AI Pod Formation] Pod formation complete for deal ${deal.id}`);
    
    return { success: true, podId: pod.id };
    
  } catch (error: any) {
    console.error(`[AI Pod Formation] Error:`, error);
    return { success: false, error: error.message };
  }
}

export async function transitionDealStage(
  dealId: string,
  newStage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      return { success: false, error: "Deal not found" };
    }
    
    const currentPod = await storage.getActivePodForDeal(dealId);
    const existingLeadId = currentPod?.leadUserId || undefined;
    
    if (currentPod) {
      await storage.updateDealPod(currentPod.id, { status: 'completed' });
    }
    
    await storage.updateDeal(dealId, { stage: newStage });
    
    const result = await formPodForDeal(deal, newStage, existingLeadId);
    
    return result;
    
  } catch (error: any) {
    console.error(`[Stage Transition] Error:`, error);
    return { success: false, error: error.message };
  }
}

export async function approveOpportunityToDeal(
  opportunityId: string
): Promise<{ success: boolean; dealId?: string; error?: string }> {
  try {
    const opportunity = await storage.getDeal(opportunityId);
    if (!opportunity) {
      return { success: false, error: "Opportunity not found" };
    }
    
    if (opportunity.dealType !== 'Opportunity') {
      return { success: false, error: "This is not an opportunity" };
    }
    
    const dealType = opportunity.value > 200 ? 'M&A' : 'Capital Raising';
    
    const updatedDeal = await storage.updateDeal(opportunityId, {
      dealType,
      stage: 'Origination',
      status: 'Active'
    });
    
    if (!updatedDeal) {
      return { success: false, error: "Failed to update deal" };
    }
    
    await storage.createDealContextUpdate({
      dealId: opportunityId,
      updateType: 'status_change',
      title: 'Opportunity approved and converted to active deal',
      content: `Deal type set to ${dealType}. Starting automated pod formation.`,
      metadata: { previousType: 'Opportunity', newType: dealType }
    });
    
    console.log(`[Opportunity Approval] Opportunity ${opportunityId} approved, forming pod...`);
    
    const podResult = await formPodForDeal(updatedDeal, 'Origination');
    
    if (!podResult.success) {
      console.error(`[Opportunity Approval] Pod formation failed: ${podResult.error}`);
    }
    
    return { success: true, dealId: opportunityId };
    
  } catch (error: any) {
    console.error(`[Opportunity Approval] Error:`, error);
    return { success: false, error: error.message };
  }
}
