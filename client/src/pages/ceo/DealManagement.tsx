import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreVertical, ArrowRight, Calendar, DollarSign, Briefcase } from "lucide-react";
import { DEALS } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function DealManagement() {
  return (
    <Layout role="CEO" pageTitle="Deal Management" userName="Joshua Orlinsky">
      <div className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                    placeholder="Search deals by name, client, or sector..." 
                    className="pl-9 bg-card border-border"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="bg-card border-border gap-2">
                    <Filter className="w-4 h-4" /> Filter
                </Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    + New Deal
                </Button>
            </div>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEALS.map((deal) => (
                <Card key={deal.id} className="bg-card border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <Badge variant="outline" className={cn(
                                "border-0 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                deal.stage === 'Origination' ? "bg-blue-500/20 text-blue-400" :
                                deal.stage === 'Structuring' ? "bg-indigo-500/20 text-indigo-400" :
                                deal.stage === 'Diligence' ? "bg-orange-500/20 text-orange-400" :
                                deal.stage === 'Legal' ? "bg-purple-500/20 text-purple-400" :
                                "bg-green-500/20 text-green-400"
                            )}>
                                {deal.stage}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </div>
                        <CardTitle className="text-xl mt-2 group-hover:text-primary transition-colors">{deal.name}</CardTitle>
                        <CardDescription>{deal.client}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Value
                                </div>
                                <div className="font-mono font-bold text-lg">${deal.value}M</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" /> Sector
                                </div>
                                <div className="font-medium">{deal.sector}</div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-bold text-primary">{deal.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-500 ease-out" 
                                    style={{ width: `${deal.progress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                {deal.lead.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-xs text-muted-foreground">Lead: {deal.lead}</span>
                        </div>
                    </CardContent>
                    
                    <CardFooter className="pt-2">
                        <Button className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground transition-colors gap-2">
                            View Deal Room <ArrowRight className="w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      </div>
    </Layout>
  );
}
