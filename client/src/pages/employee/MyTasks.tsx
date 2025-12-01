import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  FileText, 
  MessageSquare, 
  BarChart,
  Check
} from "lucide-react";
import { TASKS } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function MyTasks() {
  return (
    <Layout role="Employee" pageTitle="My Tasks" userName="Emily Johnson">
      <div className="space-y-6">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">12</div>
                        <div className="text-xs text-muted-foreground">Pending Tasks</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">3</div>
                        <div className="text-xs text-muted-foreground">High Priority</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                        <Check className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">45</div>
                        <div className="text-xs text-muted-foreground">Completed This Month</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
                        <BarChart className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">8.5</div>
                        <div className="text-xs text-muted-foreground">Efficiency Score</div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Task Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Today */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Today</h3>
                    <Badge variant="secondary" className="text-xs">3</Badge>
                </div>
                
                {TASKS.slice(0, 3).map((task, i) => (
                    <Card key={task.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className={cn(
                                    "text-[10px] px-1.5 py-0.5 h-5",
                                    task.priority === 'High' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                    "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                )}>
                                    {task.priority}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check className="w-4 h-4" />
                                </Button>
                            </div>
                            
                            <div>
                                <h4 className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{task.dealName}</p>
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                {task.type === 'Document' && <FileText className="w-3 h-3" />}
                                {task.type === 'Meeting' && <Calendar className="w-3 h-3" />}
                                {task.type === 'Analysis' && <BarChart className="w-3 h-3" />}
                                <span>{task.type}</span>
                                <span className="ml-auto flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Due Today
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Column 2: Upcoming */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</h3>
                    <Badge variant="secondary" className="text-xs">2</Badge>
                </div>
                
                {TASKS.slice(3, 5).map((task, i) => (
                    <Card key={task.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group opacity-80 hover:opacity-100">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-secondary text-muted-foreground border-border">
                                    {task.priority}
                                </Badge>
                            </div>
                            
                            <div>
                                <h4 className="font-medium text-sm">{task.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{task.dealName}</p>
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{task.dueDate}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Column 3: Completed */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</h3>
                    <Badge variant="secondary" className="text-xs">1</Badge>
                </div>
                
                <Card className="bg-card/50 border-border border-dashed">
                    <CardContent className="p-4 space-y-3 opacity-60">
                         <div className="flex justify-between items-start">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-green-500/10 text-green-500 border-green-500/20">
                                    Done
                                </Badge>
                            </div>
                            
                            <div>
                                <h4 className="font-medium text-sm line-through">Client Onboarding Call</h4>
                                <p className="text-xs text-muted-foreground mt-1">Project Titan</p>
                            </div>
                    </CardContent>
                </Card>
            </div>
            
        </div>
      </div>
    </Layout>
  );
}
