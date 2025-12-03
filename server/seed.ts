import { storage } from "./storage";

async function seed() {
  try {
    console.log("Seeding database...");

    // Create users
    const users = await Promise.all([
      storage.createUser({
        name: "Joshua Orlinsky",
        email: "josh@equiturn.com",
        password: "password123",
        role: "CEO",
        score: 98,
        activeDeals: 6,
        completedTasks: 45,
      }),
      storage.createUser({
        name: "Emily Johnson",
        email: "emily@equiturn.com",
        password: "password123",
        role: "Associate",
        score: 85,
        activeDeals: 1,
        completedTasks: 12,
      }),
      storage.createUser({
        name: "Michael Rodriguez",
        email: "michael@equiturn.com",
        password: "password123",
        role: "Director",
        score: 82,
        activeDeals: 2,
        completedTasks: 28,
      }),
      storage.createUser({
        name: "Sarah Chen",
        email: "sarah@equiturn.com",
        password: "password123",
        role: "Managing Director",
        score: 91,
        activeDeals: 3,
        completedTasks: 56,
      }),
      storage.createUser({
        name: "Alex Chen",
        email: "alex@equiturn.com",
        password: "password123",
        role: "Analyst",
        score: 74,
        activeDeals: 1,
        completedTasks: 8,
      }),
    ]);

    console.log(`Created ${users.length} users`);

    // Create deals
    const deals = await Promise.all([
      storage.createDeal({
        name: "Project Titan",
        stage: "Structuring",
        value: 450,
        client: "TechCorp Inc.",
        sector: "Technology",
        lead: "Sarah Chen",
        progress: 45,
        status: "Active",
      }),
      storage.createDeal({
        name: "Project Gemini",
        stage: "Diligence",
        value: 120,
        client: "GreenEnergy Co.",
        sector: "Energy",
        lead: "Michael Rodriguez",
        progress: 60,
        status: "Active",
      }),
      storage.createDeal({
        name: "Project Valkyrie",
        stage: "Legal",
        value: 850,
        client: "Global Logistics",
        sector: "Industrials",
        lead: "Sarah Chen",
        progress: 85,
        status: "Active",
      }),
      storage.createDeal({
        name: "Project Chimera",
        stage: "Origination",
        value: 200,
        client: "BioLife Pharma",
        sector: "Healthcare",
        lead: "Emily Johnson",
        progress: 15,
        status: "Active",
      }),
      storage.createDeal({
        name: "Project Hydra",
        stage: "Close",
        value: 1200,
        client: "Mega Retail",
        sector: "Consumer",
        lead: "Joshua Orlinsky",
        progress: 95,
        status: "Active",
      }),
    ]);

    console.log(`Created ${deals.length} deals`);

    // Create tasks
    const tasks = await Promise.all([
      storage.createTask({
        title: "Negotiate Term Sheet",
        dealId: deals[0].id,
        assignedTo: users[3].id,
        priority: "High",
        dueDate: "2025-12-02",
        status: "In Progress",
        type: "Meeting",
      }),
      storage.createTask({
        title: "Financial Model Review",
        dealId: deals[1].id,
        assignedTo: users[4].id,
        priority: "High",
        dueDate: "2025-12-03",
        status: "Pending",
        type: "Analysis",
      }),
      storage.createTask({
        title: "Prepare Board Deck",
        dealId: deals[2].id,
        assignedTo: users[1].id,
        priority: "Medium",
        dueDate: "2025-12-05",
        status: "Pending",
        type: "Document",
      }),
      storage.createTask({
        title: "Legal Due Diligence Call",
        dealId: deals[2].id,
        assignedTo: users[3].id,
        priority: "High",
        dueDate: "2025-12-01",
        status: "Completed",
        type: "Meeting",
      }),
      storage.createTask({
        title: "Market Research Report",
        dealId: deals[3].id,
        assignedTo: users[4].id,
        priority: "Low",
        dueDate: "2025-12-10",
        status: "In Progress",
        type: "Analysis",
      }),
      storage.createTask({
        title: "Sign Purchase Agreement",
        dealId: deals[4].id,
        assignedTo: users[0].id,
        priority: "High",
        dueDate: "2025-12-01",
        status: "Pending",
        type: "Document",
      }),
    ]);

    console.log(`Created ${tasks.length} tasks`);

    // Create document templates
    const documentTemplates = await Promise.all([
      storage.createDocumentTemplate({
        name: "Term Sheet",
        description: "Standard term sheet template for initial deal terms",
        category: "Legal",
        complexity: "Medium",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Letter of Intent",
        description: "LOI template for preliminary offers and expressions of interest",
        category: "Legal",
        complexity: "Medium",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Due Diligence Request",
        description: "Comprehensive information request checklist",
        category: "Analysis",
        complexity: "Medium",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Purchase Agreement",
        description: "Legal document for acquisition transactions",
        category: "Legal",
        complexity: "High",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "NDA",
        description: "Non-disclosure agreement for confidential information",
        category: "Legal",
        complexity: "Low",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Board Resolution",
        description: "Corporate governance and approval template",
        category: "Governance",
        complexity: "Medium",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "M&A Deal Template",
        description: "Complete template for mergers and acquisitions including due diligence, valuation, and integration planning",
        category: "Deal",
        complexity: "High",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "IPO Roadshow Template",
        description: "Investor presentation and roadshow materials for initial public offerings",
        category: "Deal",
        complexity: "High",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Private Placement Memo",
        description: "Confidential information memorandum for private capital raising",
        category: "Deal",
        complexity: "High",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Debt Financing Template",
        description: "Credit facility and bond issuance documentation templates",
        category: "Deal",
        complexity: "High",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Valuation Report",
        description: "Comprehensive business valuation report template with DCF and comps analysis",
        category: "Analysis",
        complexity: "Medium",
        isDefault: true,
      }),
      storage.createDocumentTemplate({
        name: "Investment Committee Memo",
        description: "Presentation format for investment committee approval",
        category: "Governance",
        complexity: "Medium",
        isDefault: true,
      }),
    ]);

    console.log(`Created ${documentTemplates.length} document templates`);
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
