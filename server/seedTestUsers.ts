import { storage } from "./storage";
import type { AIAnalysis, DeploymentTags, ResumeAIAnalysis, OnboardingPlacement } from "@shared/schema";

interface SeedUserProfile {
  name: string;
  email: string;
  role: string;
  jobTitle: string;
  dealTeamStatus: string;
  personalityArchetypes: string[];
  resumeInferredTags: string[];
  workload: { activeTasks: number; pendingTasks: number };
}

const testUsers: SeedUserProfile[] = [
  // === Pod Lead Candidates (Deal Team 6/4/2) ===
  {
    name: "Marcus Sterling",
    email: "marcus@equiturn.com",
    role: "Managing Director",
    jobTitle: "Senior Managing Director",
    dealTeamStatus: "Deal Team 6",
    personalityArchetypes: ["Grandmaster", "Closer", "Politician", "Architect", "Deal Junkie"],
    resumeInferredTags: ["Grandmaster", "Closer", "Strategic", "Leadership", "M&A Expert"],
    workload: { activeTasks: 2, pendingTasks: 1 }
  },
  {
    name: "Victoria Chase",
    email: "victoria@equiturn.com",
    role: "Managing Director",
    jobTitle: "Partner",
    dealTeamStatus: "Deal Team 6",
    personalityArchetypes: ["Closer", "Grandmaster", "Rainmaker", "Politician", "Mayor"],
    resumeInferredTags: ["Closer", "Negotiator", "Client Relations", "Deal Closer", "Executive"],
    workload: { activeTasks: 3, pendingTasks: 2 }
  },
  {
    name: "Jonathan Webb",
    email: "jonathan@equiturn.com",
    role: "Director",
    jobTitle: "Senior Director",
    dealTeamStatus: "Deal Team 4",
    personalityArchetypes: ["Politician", "Grandmaster", "Mayor", "Closer", "Architect"],
    resumeInferredTags: ["Politician", "Stakeholder Manager", "Board Relations", "Strategic", "Networker"],
    workload: { activeTasks: 1, pendingTasks: 0 }
  },
  {
    name: "Samantha Park",
    email: "samantha@equiturn.com",
    role: "Director",
    jobTitle: "Director",
    dealTeamStatus: "Deal Team 4",
    personalityArchetypes: ["Architect", "Grandmaster", "Guru", "Closer", "Regulatory"],
    resumeInferredTags: ["Architect", "Deal Structuring", "Financial Modeling", "Technical", "Process Design"],
    workload: { activeTasks: 4, pendingTasks: 3 }
  },
  {
    name: "David Huang",
    email: "david@equiturn.com",
    role: "Senior Associate",
    jobTitle: "Senior Associate",
    dealTeamStatus: "Deal Team 2",
    personalityArchetypes: ["Grandmaster", "Architect", "Guru", "Deal Junkie", "Closer"],
    resumeInferredTags: ["Grandmaster", "Analytical", "Due Diligence", "Financial Analysis", "Detail-Oriented"],
    workload: { activeTasks: 0, pendingTasks: 1 }
  },

  // === Pod Second Candidates (Deal Team 2/4 - Structuring/Guru roles) ===
  {
    name: "Elena Kowalski",
    email: "elena@equiturn.com",
    role: "Director",
    jobTitle: "Director - Structuring",
    dealTeamStatus: "Deal Team 4",
    personalityArchetypes: ["Guru", "Architect", "Regulatory", "Auditor", "Grandmaster"],
    resumeInferredTags: ["Guru", "Technical Expert", "Valuation", "Complex Structures", "Specialist"],
    workload: { activeTasks: 2, pendingTasks: 2 }
  },
  {
    name: "Robert Fitzgerald",
    email: "robert@equiturn.com",
    role: "Senior Associate",
    jobTitle: "Senior Associate",
    dealTeamStatus: "Deal Team 2",
    personalityArchetypes: ["Architect", "Regulatory", "Guru", "Auditor", "Legal"],
    resumeInferredTags: ["Architect", "Compliance", "Risk Assessment", "Documentation", "Process"],
    workload: { activeTasks: 1, pendingTasks: 1 }
  },
  {
    name: "Priya Sharma",
    email: "priya@equiturn.com",
    role: "Associate",
    jobTitle: "Associate",
    dealTeamStatus: "Deal Team 2",
    personalityArchetypes: ["Regulatory", "Auditor", "Guru", "Architect", "Legal"],
    resumeInferredTags: ["Regulatory", "SEC Filings", "Compliance Expert", "Documentation", "Detail-Oriented"],
    workload: { activeTasks: 0, pendingTasks: 0 }
  },
  {
    name: "James Morrison",
    email: "james@equiturn.com",
    role: "Director",
    jobTitle: "Director - Tax",
    dealTeamStatus: "Deal Team 4",
    personalityArchetypes: ["Auditor", "Regulatory", "Guru", "Architect", "Legal"],
    resumeInferredTags: ["Auditor", "Tax Specialist", "Financial Review", "Due Diligence", "Compliance"],
    workload: { activeTasks: 3, pendingTasks: 1 }
  },

  // === Pod Third/Fourth Candidates (Deal Team 8/10 - Execution roles) ===
  {
    name: "Amanda Torres",
    email: "amanda@equiturn.com",
    role: "Vice President",
    jobTitle: "Vice President",
    dealTeamStatus: "Deal Team 8",
    personalityArchetypes: ["Rainmaker", "Politician", "Mayor", "Closer", "Deal Junkie"],
    resumeInferredTags: ["Rainmaker", "Business Development", "Client Acquisition", "Revenue Growth", "Networker"],
    workload: { activeTasks: 2, pendingTasks: 0 }
  },
  {
    name: "Christopher Lee",
    email: "christopher@equiturn.com",
    role: "Associate",
    jobTitle: "Associate",
    dealTeamStatus: "Deal Team 10",
    personalityArchetypes: ["Mayor", "Politician", "Sherpa", "Rainmaker", "Liaison"],
    resumeInferredTags: ["Mayor", "Team Coordinator", "Cross-Functional", "Project Management", "Organizer"],
    workload: { activeTasks: 1, pendingTasks: 2 }
  },
  {
    name: "Nicole Williams",
    email: "nicole@equiturn.com",
    role: "Analyst",
    jobTitle: "Senior Analyst",
    dealTeamStatus: "Deal Team 10",
    personalityArchetypes: ["Sherpa", "Mayor", "Deal Junkie", "Firefighter", "Liaison"],
    resumeInferredTags: ["Sherpa", "Support Role", "Mentoring", "Knowledge Transfer", "Team Player"],
    workload: { activeTasks: 5, pendingTasks: 3 }
  },
  {
    name: "Brandon Carter",
    email: "brandon@equiturn.com",
    role: "Vice President",
    jobTitle: "Vice President",
    dealTeamStatus: "Deal Team 8",
    personalityArchetypes: ["Deal Junkie", "Closer", "Rainmaker", "Politician", "Mayor"],
    resumeInferredTags: ["Deal Junkie", "Transaction Volume", "Fast Paced", "Multi-Deal", "Execution"],
    workload: { activeTasks: 0, pendingTasks: 1 }
  },
  {
    name: "Michelle Nguyen",
    email: "michelle@equiturn.com",
    role: "Associate",
    jobTitle: "Associate",
    dealTeamStatus: "Deal Team 8",
    personalityArchetypes: ["Politician", "Mayor", "Rainmaker", "Liaison", "Deal Junkie"],
    resumeInferredTags: ["Politician", "Relationship Builder", "Stakeholder Management", "Communication", "Influence"],
    workload: { activeTasks: 2, pendingTasks: 2 }
  },

  // === Floaters & Specialists ===
  {
    name: "Gregory Stone",
    email: "gregory@equiturn.com",
    role: "Counsel",
    jobTitle: "General Counsel",
    dealTeamStatus: "Floater",
    personalityArchetypes: ["Legal", "Regulatory", "Auditor", "Guru", "Architect"],
    resumeInferredTags: ["Legal", "Contract Law", "M&A Legal", "Negotiation", "Risk Mitigation"],
    workload: { activeTasks: 3, pendingTasks: 2 }
  },
  {
    name: "Catherine Blake",
    email: "catherine@equiturn.com",
    role: "Vice President",
    jobTitle: "VP - Integration",
    dealTeamStatus: "Floater",
    personalityArchetypes: ["Liaison", "Mayor", "Sherpa", "Firefighter", "Politician"],
    resumeInferredTags: ["Liaison", "Cross-Team", "Communication", "Integration Specialist", "Coordinator"],
    workload: { activeTasks: 1, pendingTasks: 0 }
  },
  {
    name: "Derek Washington",
    email: "derek@equiturn.com",
    role: "Director",
    jobTitle: "Director - Special Situations",
    dealTeamStatus: "Floater",
    personalityArchetypes: ["Firefighter", "Deal Junkie", "Closer", "Architect", "Grandmaster"],
    resumeInferredTags: ["Firefighter", "Crisis Management", "Turnaround", "Problem Solver", "Urgent Response"],
    workload: { activeTasks: 4, pendingTasks: 4 }
  },
  {
    name: "Rachel Foster",
    email: "rachel@equiturn.com",
    role: "Analyst",
    jobTitle: "Analyst",
    dealTeamStatus: "Floater",
    personalityArchetypes: ["Misfit", "Creative", "Sherpa", "Deal Junkie", "Mayor"],
    resumeInferredTags: ["Misfit", "Unconventional", "Creative Problem Solving", "Fresh Perspective", "Innovative"],
    workload: { activeTasks: 0, pendingTasks: 0 }
  },
];

function buildDeploymentTags(profile: SeedUserProfile): DeploymentTags {
  const verticals = ["Technology", "Healthcare", "Energy", "Consumer", "Industrials", "Financial Services"];
  const phases = ["Origination", "Structuring", "Execution", "Closing", "Integration"];
  
  return {
    dealTeamStatus: profile.dealTeamStatus,
    primaryVertical: verticals[Math.floor(Math.random() * verticals.length)],
    secondaryVertical: verticals[Math.floor(Math.random() * verticals.length)],
    primaryDealPhase: phases[Math.floor(Math.random() * phases.length)],
    secondaryDealPhase: phases[Math.floor(Math.random() * phases.length)],
    topFiveArchetypes: profile.personalityArchetypes,
    riskFlag: null
  };
}

function buildAIAnalysis(profile: SeedUserProfile): AIAnalysis {
  return {
    employeeSnapshot: `${profile.name} is a ${profile.role} with strong ${profile.personalityArchetypes[0]} characteristics.`,
    scoreDistribution: "Balanced distribution across core competencies",
    primaryArchetype: profile.personalityArchetypes[0],
    secondaryTraits: profile.personalityArchetypes.slice(1, 3).join(", "),
    supportingTraits: profile.personalityArchetypes.slice(3).join(", "),
    lowSignalTags: "None identified",
    absentTraits: "Standard profile with expected trait coverage",
    dealPhaseFit: `Well-suited for ${profile.personalityArchetypes[0] === "Closer" ? "Closing" : profile.personalityArchetypes[0] === "Architect" ? "Structuring" : "Execution"} phases`,
    dealTypeProficiency: "M&A, Capital Raising, Strategic Advisory",
    managerialNotes: `Strong performer with ${profile.personalityArchetypes[0]} leadership style`,
    deploymentTags: buildDeploymentTags(profile),
    rawResponse: JSON.stringify({ seeded: true, profile: profile.name })
  };
}

function buildOnboardingPlacement(profile: SeedUserProfile): OnboardingPlacement {
  const phases = ["Origination", "Structuring", "Execution", "Closing", "Integration"];
  return {
    assignedDealTeam: profile.dealTeamStatus,
    primaryVertical: "Technology",
    secondaryVertical: "Healthcare",
    primaryDealPhase: phases[Math.floor(Math.random() * phases.length)],
    secondaryDealPhase: phases[Math.floor(Math.random() * phases.length)],
    initialSeatRecommendation: profile.dealTeamStatus === "Deal Team 6" ? "Pod Lead" : 
                                profile.dealTeamStatus === "Deal Team 4" ? "Structuring Lead" :
                                profile.dealTeamStatus === "Deal Team 2" ? "Execution Support" :
                                "Team Member",
    topFiveInferredTags: profile.resumeInferredTags,
    coverageGaps: "None identified"
  };
}

function buildResumeAIAnalysis(profile: SeedUserProfile): ResumeAIAnalysis {
  return {
    candidateSnapshot: `${profile.name} brings extensive experience as a ${profile.role}.`,
    evidenceAnchors: "Strong track record demonstrated through career progression",
    transactionProfile: "Diverse deal experience across multiple sectors",
    roleElevationAutonomy: profile.dealTeamStatus.includes("6") || profile.dealTeamStatus.includes("4") ? "High autonomy" : "Supervised",
    dealPhaseFit: "Well-rounded with particular strength in core phases",
    dealTypeProficiency: "M&A, Private Equity, Strategic Advisory",
    resumeInferredTags: profile.resumeInferredTags.join(", "),
    managerialNotes: `Recommended for ${profile.dealTeamStatus} based on experience level`,
    onboardingPlacement: buildOnboardingPlacement(profile),
    rawResponse: JSON.stringify({ seeded: true, profile: profile.name })
  };
}

export async function seedTestUsers() {
  console.log("=== Starting Test User Seeding ===");
  console.log(`Creating ${testUsers.length} test users with profiles...`);
  
  const createdUsers: Array<{ id: string; name: string; profile: SeedUserProfile }> = [];
  
  for (const profile of testUsers) {
    try {
      const existingUsers = await storage.getAllUsers();
      const existing = existingUsers.find(u => u.email === profile.email);
      
      if (existing) {
        console.log(`  [SKIP] User ${profile.name} already exists (${existing.id})`);
        createdUsers.push({ id: existing.id, name: profile.name, profile });
        continue;
      }
      
      const user = await storage.createUser({
        name: profile.name,
        email: profile.email,
        password: "testuser123",
        role: profile.role,
        jobTitle: profile.jobTitle,
        score: 80 + Math.floor(Math.random() * 20),
        activeDeals: profile.workload.activeTasks > 3 ? 2 : 1,
        completedTasks: Math.floor(Math.random() * 50),
      });
      
      console.log(`  [USER] Created ${profile.name} (${user.id})`);
      
      const personalityData = {
        userId: user.id,
        answers: {} as Record<number, 'A' | 'B'>,
        allScores: [],
        topThreeProfiles: [],
        aiAnalysis: buildAIAnalysis(profile),
        status: 'completed' as const,
        completedAt: new Date(),
      };
      
      await storage.createPersonalityAssessment(personalityData);
      console.log(`    [PERSONALITY] Added personality profile with archetypes: ${profile.personalityArchetypes.slice(0, 3).join(", ")}`);
      
      const resumeData = {
        userId: user.id,
        fileName: `${profile.name.replace(" ", "_")}_resume.pdf`,
        fileContent: `Seeded resume for ${profile.name}`,
        aiAnalysis: buildResumeAIAnalysis(profile),
        assignedDealTeam: profile.dealTeamStatus,
        status: 'completed' as const,
        completedAt: new Date(),
      };
      
      await storage.createResumeAnalysis(resumeData);
      console.log(`    [RESUME] Added resume analysis with Deal Team: ${profile.dealTeamStatus}`);
      
      for (let i = 0; i < profile.workload.activeTasks; i++) {
        await storage.createTask({
          title: `Active Task ${i + 1} for ${profile.name}`,
          description: "Seeded active task for workload testing",
          assignedTo: user.id,
          priority: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
          status: "In Progress",
          type: "General",
        });
      }
      
      for (let i = 0; i < profile.workload.pendingTasks; i++) {
        await storage.createTask({
          title: `Pending Task ${i + 1} for ${profile.name}`,
          description: "Seeded pending task for workload testing",
          assignedTo: user.id,
          priority: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
          status: "Pending",
          type: "General",
        });
      }
      
      if (profile.workload.activeTasks > 0 || profile.workload.pendingTasks > 0) {
        console.log(`    [TASKS] Created ${profile.workload.activeTasks} active + ${profile.workload.pendingTasks} pending tasks`);
      }
      
      createdUsers.push({ id: user.id, name: profile.name, profile });
      
    } catch (error) {
      console.error(`  [ERROR] Failed to create ${profile.name}:`, error);
    }
  }
  
  console.log("\n=== Seeding Complete ===");
  console.log(`Created ${createdUsers.length} users with full profiles`);
  
  console.log("\n--- Summary by Deal Team ---");
  const byTeam: Record<string, string[]> = {};
  for (const u of createdUsers) {
    const team = u.profile.dealTeamStatus;
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(u.name);
  }
  for (const [team, names] of Object.entries(byTeam)) {
    console.log(`  ${team}: ${names.join(", ")}`);
  }
  
  console.log("\n--- Summary by Primary Archetype ---");
  const byArchetype: Record<string, string[]> = {};
  for (const u of createdUsers) {
    const arch = u.profile.personalityArchetypes[0];
    if (!byArchetype[arch]) byArchetype[arch] = [];
    byArchetype[arch].push(u.name);
  }
  for (const [arch, names] of Object.entries(byArchetype)) {
    console.log(`  ${arch}: ${names.join(", ")}`);
  }
  
  return createdUsers;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedTestUsers()
    .then(() => {
      console.log("\nDone!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
