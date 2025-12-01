
export type User = {
  id: string;
  name: string;
  role: 'CEO' | 'Associate' | 'Director' | 'Managing Director' | 'Analyst';
  email: string;
  avatar?: string;
  score: number;
  activeDeals: number;
  completedTasks: number;
};

export type Deal = {
  id: string;
  name: string;
  stage: 'Origination' | 'Structuring' | 'Diligence' | 'Legal' | 'Close';
  value: number; // in millions
  client: string;
  sector: string;
  lead: string;
  progress: number;
  status: 'Active' | 'On Hold' | 'Closed';
};

export type Task = {
  id: string;
  title: string;
  dealId?: string;
  dealName?: string;
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  type: 'Document' | 'Meeting' | 'Review' | 'Analysis';
};

export type MarketMetric = {
  name: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
};

// MOCK DATA

export const USERS: User[] = [
  { id: '1', name: 'Joshua Orlinsky', role: 'CEO', email: 'josh@equiturn.com', score: 9.8, activeDeals: 6, completedTasks: 45 },
  { id: '2', name: 'Emily Johnson', role: 'Associate', email: 'emily@equiturn.com', score: 8.5, activeDeals: 1, completedTasks: 12 },
  { id: '3', name: 'Michael Rodriguez', role: 'Director', email: 'michael@equiturn.com', score: 8.2, activeDeals: 2, completedTasks: 28 },
  { id: '4', name: 'Sarah Chen', role: 'Managing Director', email: 'sarah@equiturn.com', score: 9.1, activeDeals: 3, completedTasks: 56 },
  { id: '5', name: 'Alex Chen', role: 'Analyst', email: 'alex@equiturn.com', score: 7.4, activeDeals: 1, completedTasks: 8 },
];

export const DEALS: Deal[] = [
  { id: 'd1', name: 'Project Titan', stage: 'Structuring', value: 450, client: 'TechCorp Inc.', sector: 'Technology', lead: 'Sarah Chen', progress: 45, status: 'Active' },
  { id: 'd2', name: 'Project Gemini', stage: 'Diligence', value: 120, client: 'GreenEnergy Co.', sector: 'Energy', lead: 'Michael Rodriguez', progress: 60, status: 'Active' },
  { id: 'd3', name: 'Project Valkyrie', stage: 'Legal', value: 850, client: 'Global Logistics', sector: 'Industrials', lead: 'Sarah Chen', progress: 85, status: 'Active' },
  { id: 'd4', name: 'Project Chimera', stage: 'Origination', value: 200, client: 'BioLife Pharma', sector: 'Healthcare', lead: 'Emily Johnson', progress: 15, status: 'Active' },
  { id: 'd5', name: 'Project Hydra', stage: 'Close', value: 1200, client: 'Mega Retail', sector: 'Consumer', lead: 'Joshua Orlinsky', progress: 95, status: 'Active' },
];

export const TASKS: Task[] = [
  { id: 't1', title: 'Negotiate Term Sheet', dealId: 'd1', dealName: 'Project Titan', assignedTo: '4', priority: 'High', dueDate: '2025-12-02', status: 'In Progress', type: 'Meeting' },
  { id: 't2', title: 'Financial Model Review', dealId: 'd2', dealName: 'Project Gemini', assignedTo: '5', priority: 'High', dueDate: '2025-12-03', status: 'Pending', type: 'Analysis' },
  { id: 't3', title: 'Prepare Board Deck', dealId: 'd3', dealName: 'Project Valkyrie', assignedTo: '2', priority: 'Medium', dueDate: '2025-12-05', status: 'Pending', type: 'Document' },
  { id: 't4', title: 'Legal Due Diligence Call', dealId: 'd3', dealName: 'Project Valkyrie', assignedTo: '4', priority: 'High', dueDate: '2025-12-01', status: 'Completed', type: 'Meeting' },
  { id: 't5', title: 'Market Research Report', dealId: 'd4', dealName: 'Project Chimera', assignedTo: '5', priority: 'Low', dueDate: '2025-12-10', status: 'In Progress', type: 'Analysis' },
  { id: 't6', title: 'Sign Purchase Agreement', dealId: 'd5', dealName: 'Project Hydra', assignedTo: '1', priority: 'High', dueDate: '2025-12-01', status: 'Pending', type: 'Document' },
];

export const MARKET_DATA: MarketMetric[] = [
  { name: 'S&P 500', value: '6,812.63', change: '-0.53%', trend: 'down', description: 'Neutral market conditions' },
  { name: '10Y Treasury', value: '4.10%', change: '+0.08%', trend: 'up', description: 'Higher rates may impact deal financing' },
  { name: 'VIX', value: '17.39', change: '+6.36%', trend: 'up', description: 'Higher volatility may delay transactions' },
];
