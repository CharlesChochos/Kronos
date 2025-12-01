import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Filter, 
  UserPlus, 
  Check, 
  X, 
  Briefcase, 
  Building2,
  TrendingUp,
  Target
} from "lucide-react";
import { DEALS } from "@/lib/mockData";
import { useState } from "react";
import { cn } from "@/lib/utils";

const INVESTORS = [
  { id: 1, name: "Ironclad PE", type: "Private Equity", focus: "Industrials", checkSize: "$50M - $200M", matchScore: 95, tags: ["Buyout", "Growth"] },
  { id: 2, name: "Horizon Legacy", type: "Family Office", focus: "Healthcare", checkSize: "$10M - $50M", matchScore: 88, tags: ["Long-term", "Minority"] },
  { id: 3, name: "Quantum Strategic", type: "Strategic", focus: "Technology", checkSize: "$100M+", matchScore: 92, tags: ["M&A", "Synergy"] },
  { id: 4, name: "Bedrock Industries", type: "Strategic", focus: "Industrials", checkSize: "$500M+", matchScore: 75, tags: ["Consolidation"] },
];

export default function InvestorMatching() {
  const [selectedDeal, setSelectedDeal] = useState(DEALS[0].id);
  
  return (
    <Layout role="CEO" pageTitle="Investor Match Deck" userName="Joshua Orlinsky">
      <div className="space-y-6">
        {/* Deal Selector */}
        <div className="w-full max-w-md">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Deal to Match</label>
            <select 
                className="w-full bg-card border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                value={selectedDeal}
                onChange={(e) => setSelectedDeal(e.target.value)}
            >
                {DEALS.map(deal => (
                    <option key={deal.id} value={deal.id}>{deal.name}</option>
                ))}
            </select>
        </div>

        {/* Tinder-style Match Interface */}
        <div className="flex flex-col items-center justify-center py-10">
            <div className="relative w-full max-w-lg aspect-[3/4] md:aspect-[4/3]">
                {/* Background cards for stack effect */}
                <div className="absolute top-4 left-4 right-4 bottom-[-16px] bg-card/30 rounded-2xl border border-border z-0 scale-95"></div>
                <div className="absolute top-2 left-2 right-2 bottom-[-8px] bg-card/60 rounded-2xl border border-border z-10 scale-[0.98]"></div>
                
                {/* Main Card */}
                <Card className="absolute inset-0 bg-card border-border shadow-2xl z-20 flex flex-col items-center justify-center text-center p-8 hover:shadow-primary/10 transition-all">
                    <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-inner">
                        <Building2 className="w-10 h-10 text-primary" />
                    </div>
                    
                    <h2 className="text-3xl font-display font-bold mb-2">{INVESTORS[0].name}</h2>
                    <Badge variant="secondary" className="mb-4">{INVESTORS[0].type}</Badge>
                    
                    <div className="grid grid-cols-2 gap-8 w-full max-w-xs mb-8">
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Focus</div>
                            <div className="font-medium text-lg">{INVESTORS[0].focus}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Check Size</div>
                            <div className="font-medium text-lg">{INVESTORS[0].checkSize}</div>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-8">
                        {INVESTORS[0].tags.map(tag => (
                            <Badge key={tag} variant="outline" className="bg-secondary/30">{tag}</Badge>
                        ))}
                    </div>

                    <div className="w-full bg-secondary/30 rounded-full h-12 flex items-center px-4 mb-6 relative overflow-hidden">
                         <div className="absolute left-0 top-0 h-full bg-green-500/10 w-[95%] border-r-2 border-green-500"></div>
                         <div className="relative z-10 flex justify-between w-full items-center">
                            <span className="text-xs font-bold text-green-500">95% MATCH SCORE</span>
                            <Target className="w-4 h-4 text-green-500" />
                         </div>
                    </div>

                    <div className="flex items-center gap-8 w-full max-w-xs mt-auto">
                        <Button size="lg" variant="outline" className="flex-1 rounded-full h-14 border-2 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500">
                            <X className="w-6 h-6" />
                        </Button>
                        <Button size="lg" className="flex-1 rounded-full h-14 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20">
                            <Check className="w-6 h-6" />
                        </Button>
                    </div>
                    
                    <div className="flex justify-between w-full max-w-xs mt-4 text-[10px] text-muted-foreground uppercase tracking-widest">
                        <span>Swipe Left: No</span>
                        <span>Swipe Right: Yes</span>
                    </div>
                </Card>
            </div>
        </div>
        
        {/* Matched List */}
        <Card className="bg-card border-border mt-8">
            <CardHeader>
                <CardTitle className="text-lg">Matched Investors for {DEALS.find(d => d.id === selectedDeal)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {INVESTORS.slice(1).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center font-bold text-primary">
                                    {inv.name[0]}
                                </div>
                                <div>
                                    <div className="font-medium">{inv.name}</div>
                                    <div className="text-xs text-muted-foreground">{inv.type} • {inv.focus}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{inv.matchScore}% Match</Badge>
                                <Button size="sm" variant="outline">Contact</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
