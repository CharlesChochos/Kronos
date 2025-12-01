import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Users, 
  MoreHorizontal,
  Calendar,
  BarChart2,
  UserPlus
} from "lucide-react";
import { USERS, DEALS } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function TeamAssignment() {
  return (
    <Layout role="CEO" pageTitle="Team Assignment" userName="Joshua Orlinsky">
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Left: Filters */}
        <div className="col-span-12 md:col-span-3 space-y-6">
             <Card className="bg-card border-border h-full">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="secondary" className="w-full justify-start bg-accent text-accent-foreground hover:bg-accent/90">
                        <Users className="w-4 h-4 mr-2" /> All Teams
                    </Button>
                    <Button variant="ghost" className="w-full justify-start hover:bg-secondary/50">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Available
                    </Button>
                    <Button variant="ghost" className="w-full justify-start hover:bg-secondary/50">
                         <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Busy
                    </Button>
                    
                    <div className="pt-4 border-t border-border">
                        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Assignment Tools</h4>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-xs h-9">Assign Member</Button>
                            <Button variant="outline" className="w-full justify-start text-xs h-9">Reassign Tasks</Button>
                            <Button variant="outline" className="w-full justify-start text-xs h-9">Workload Analysis</Button>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase">Active Deals</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {DEALS.map(deal => (
                                <div key={deal.id} className="p-3 rounded bg-secondary/30 border border-border/50 text-xs">
                                    <div className="font-medium mb-1">{deal.name}</div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>{deal.stage}</span>
                                        <span>${deal.value}M</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
             </Card>
        </div>

        {/* Main: Drag and Drop Area (Visual Mockup) */}
        <div className="col-span-12 md:col-span-9">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">Dynamic POD formation with behavioral tag matching</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm"><BarChart2 className="w-4 h-4 mr-2" /> Export Report</Button>
                    <Button size="sm" className="bg-primary text-primary-foreground"><UserPlus className="w-4 h-4 mr-2" /> Bulk Assignment</Button>
                </div>
            </div>
            
            <Card className="bg-card border-border h-[calc(100%-3rem)] flex flex-col">
                <div className="p-4 border-b border-border bg-secondary/10 grid grid-cols-5 gap-4">
                    <div className="col-span-1 font-medium text-xs text-muted-foreground uppercase">Filter Personnel</div>
                    <select className="bg-card border border-border rounded text-xs p-1"><option>Behavioral Tag</option></select>
                    <select className="bg-card border border-border rounded text-xs p-1"><option>Tier Level</option></select>
                    <select className="bg-card border border-border rounded text-xs p-1"><option>Availability</option></select>
                    <select className="bg-card border border-border rounded text-xs p-1"><option>Specialization</option></select>
                </div>
                
                <div className="flex-1 p-8 flex items-center justify-center border-2 border-dashed border-border/50 m-4 rounded-lg bg-secondary/5">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">Select a Deal</h3>
                        <p className="text-muted-foreground text-sm mt-1">Choose a deal from the sidebar to start building your team</p>
                    </div>
                </div>
            </Card>
        </div>
      </div>
    </Layout>
  );
}
