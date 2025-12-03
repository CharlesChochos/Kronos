export type InvestorData = {
  id: number;
  name: string;
  type: string;
  focus: string;
  checkSize: string;
  matchScore: number;
  tags: string[];
  email: string;
  phone: string;
  website: string;
};

export const SHARED_INVESTORS: InvestorData[] = [
  { id: 1, name: "Ironclad PE", type: "Private Equity", focus: "Industrials", checkSize: "$50M - $200M", matchScore: 95, tags: ["Buyout", "Growth"], email: "deals@ironcladpe.com", phone: "+1 212-555-0101", website: "ironcladpe.com" },
  { id: 2, name: "Horizon Legacy", type: "Family Office", focus: "Healthcare", checkSize: "$10M - $50M", matchScore: 88, tags: ["Long-term", "Minority"], email: "investments@horizonlegacy.com", phone: "+1 415-555-0102", website: "horizonlegacy.com" },
  { id: 3, name: "Quantum Strategic", type: "Strategic", focus: "Technology", checkSize: "$100M+", matchScore: 92, tags: ["M&A", "Synergy"], email: "bd@quantumstrategic.com", phone: "+1 650-555-0103", website: "quantumstrategic.com" },
  { id: 4, name: "Bedrock Industries", type: "Strategic", focus: "Industrials", checkSize: "$500M+", matchScore: 75, tags: ["Consolidation"], email: "corp@bedrockindustries.com", phone: "+1 312-555-0104", website: "bedrockindustries.com" },
  { id: 5, name: "Apex Ventures", type: "Venture Capital", focus: "Technology", checkSize: "$5M - $25M", matchScore: 82, tags: ["Early Stage", "Growth"], email: "pitch@apexvc.com", phone: "+1 628-555-0105", website: "apexventures.com" },
  { id: 6, name: "Sterling Capital", type: "Private Equity", focus: "Consumer", checkSize: "$75M - $300M", matchScore: 79, tags: ["Buyout", "Carve-out"], email: "deals@sterlingcap.com", phone: "+1 617-555-0106", website: "sterlingcapital.com" },
  { id: 7, name: "Sequoia Capital", type: "Venture Capital", focus: "Technology", checkSize: "$10M - $100M", matchScore: 91, tags: ["Growth", "Tech"], email: "invest@sequoia.com", phone: "+1 650-555-0107", website: "sequoiacap.com" },
  { id: 8, name: "Blackstone Group", type: "Private Equity", focus: "Diversified", checkSize: "$500M+", matchScore: 85, tags: ["Large Cap", "Buyout"], email: "deals@blackstone.com", phone: "+1 212-555-0108", website: "blackstone.com" },
  { id: 9, name: "Tiger Global", type: "Hedge Fund", focus: "Technology", checkSize: "$25M - $500M", matchScore: 87, tags: ["Growth", "Late Stage"], email: "investments@tigerglobal.com", phone: "+1 212-555-0109", website: "tigerglobal.com" },
  { id: 10, name: "Wellington Management", type: "Asset Manager", focus: "Healthcare", checkSize: "$50M - $200M", matchScore: 78, tags: ["Public Markets", "Growth"], email: "private@wellington.com", phone: "+1 617-555-0110", website: "wellington.com" },
];
