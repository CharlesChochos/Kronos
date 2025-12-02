import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Search,
  Star,
  Award,
  TrendingUp,
  BookOpen,
  Target,
  Briefcase,
  Filter
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { cn } from "@/lib/utils";

type Skill = {
  name: string;
  category: 'Technical' | 'Industry' | 'Deal' | 'Soft Skills';
  level: 1 | 2 | 3 | 4 | 5;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  skills: Skill[];
  certifications: string[];
  yearsExperience: number;
};

type SkillMatrixProps = {
  role: 'CEO' | 'Employee';
};

const skillCategories = ['Technical', 'Industry', 'Deal', 'Soft Skills'] as const;

const demoMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Managing Director',
    yearsExperience: 12,
    certifications: ['CFA', 'Series 79'],
    skills: [
      { name: 'M&A Advisory', category: 'Deal', level: 5 },
      { name: 'Financial Modeling', category: 'Technical', level: 5 },
      { name: 'Healthcare', category: 'Industry', level: 4 },
      { name: 'Technology', category: 'Industry', level: 5 },
      { name: 'Leadership', category: 'Soft Skills', level: 5 },
      { name: 'Client Relations', category: 'Soft Skills', level: 5 },
    ]
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Director',
    yearsExperience: 8,
    certifications: ['CPA', 'Series 79'],
    skills: [
      { name: 'M&A Advisory', category: 'Deal', level: 4 },
      { name: 'Financial Modeling', category: 'Technical', level: 5 },
      { name: 'Technology', category: 'Industry', level: 5 },
      { name: 'Fintech', category: 'Industry', level: 4 },
      { name: 'Due Diligence', category: 'Deal', level: 4 },
      { name: 'Presentation', category: 'Soft Skills', level: 4 },
    ]
  },
  {
    id: '3',
    name: 'Emily Davis',
    role: 'Associate',
    yearsExperience: 4,
    certifications: ['Series 79'],
    skills: [
      { name: 'Financial Modeling', category: 'Technical', level: 4 },
      { name: 'Valuation', category: 'Technical', level: 4 },
      { name: 'Consumer', category: 'Industry', level: 3 },
      { name: 'Retail', category: 'Industry', level: 3 },
      { name: 'Research', category: 'Deal', level: 4 },
      { name: 'Communication', category: 'Soft Skills', level: 4 },
    ]
  },
  {
    id: '4',
    name: 'James Wilson',
    role: 'Analyst',
    yearsExperience: 2,
    certifications: ['Series 79'],
    skills: [
      { name: 'Financial Modeling', category: 'Technical', level: 3 },
      { name: 'Valuation', category: 'Technical', level: 3 },
      { name: 'Technology', category: 'Industry', level: 3 },
      { name: 'Data Analysis', category: 'Technical', level: 4 },
      { name: 'Research', category: 'Deal', level: 3 },
      { name: 'Teamwork', category: 'Soft Skills', level: 4 },
    ]
  },
];

const allSkills = [
  'M&A Advisory', 'Financial Modeling', 'Valuation', 'Due Diligence', 'Research',
  'Capital Raising', 'IPO', 'Debt Financing', 'Data Analysis', 'Python',
  'Healthcare', 'Technology', 'Fintech', 'Consumer', 'Retail', 'Manufacturing',
  'Energy', 'Real Estate', 'Financial Services', 'Media',
  'Leadership', 'Client Relations', 'Presentation', 'Communication', 'Teamwork',
  'Negotiation', 'Problem Solving', 'Time Management'
];

export default function SkillMatrix({ role }: SkillMatrixProps) {
  const { data: currentUser } = useCurrentUser();
  
  const [members] = useState<TeamMember[]>(demoMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!member.name.toLowerCase().includes(query) &&
            !member.skills.some(s => s.name.toLowerCase().includes(query))) {
          return false;
        }
      }
      return true;
    });
  }, [members, searchQuery]);

  const skillGaps = useMemo(() => {
    const skillCounts: Record<string, number> = {};
    members.forEach(m => {
      m.skills.forEach(s => {
        if (s.level >= 4) {
          skillCounts[s.name] = (skillCounts[s.name] || 0) + 1;
        }
      });
    });
    return allSkills
      .filter(skill => !skillCounts[skill] || skillCounts[skill] < 2)
      .slice(0, 5);
  }, [members]);

  const teamStrengths = useMemo(() => {
    const skillCounts: Record<string, { count: number; avgLevel: number }> = {};
    members.forEach(m => {
      m.skills.forEach(s => {
        if (!skillCounts[s.name]) {
          skillCounts[s.name] = { count: 0, avgLevel: 0 };
        }
        skillCounts[s.name].count++;
        skillCounts[s.name].avgLevel += s.level;
      });
    });
    return Object.entries(skillCounts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgLevel: Math.round(data.avgLevel / data.count * 10) / 10,
      }))
      .sort((a, b) => b.avgLevel - a.avgLevel)
      .slice(0, 5);
  }, [members]);

  const renderSkillLevel = (level: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star 
            key={i} 
            className={cn(
              "w-3 h-3",
              i <= level ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
            )} 
          />
        ))}
      </div>
    );
  };

  return (
    <Layout role={role} pageTitle="Skill Matrix" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Skill Matrix
            </h1>
            <p className="text-muted-foreground">Team expertise and skill inventory</p>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or skill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40" data-testid="select-category">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {skillCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Team Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {filteredMembers.map(member => (
                    <div 
                      key={member.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors",
                        selectedMember?.id === member.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setSelectedMember(member)}
                      data-testid={`member-card-${member.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{member.name}</h4>
                              <p className="text-sm text-muted-foreground">{member.role}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{member.yearsExperience}y exp</Badge>
                              {member.certifications.map(cert => (
                                <Badge key={cert} variant="outline" className="text-xs">{cert}</Badge>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2">
                            {member.skills
                              .filter(s => filterCategory === 'all' || s.category === filterCategory)
                              .slice(0, 6)
                              .map(skill => (
                              <div key={skill.name} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50">
                                <span className="text-xs">{skill.name}</span>
                                {renderSkillLevel(skill.level)}
                              </div>
                            ))}
                            {member.skills.length > 6 && (
                              <Badge variant="secondary" className="text-xs">
                                +{member.skills.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Strengths */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-green-500" />
                  Team Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamStrengths.map((skill, idx) => (
                    <div key={skill.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{skill.name}</span>
                        <span className="text-muted-foreground">{skill.count} experts</span>
                      </div>
                      <Progress value={skill.avgLevel * 20} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Skill Gaps */}
            <Card className="bg-yellow-500/5 border-yellow-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-yellow-500">
                  <Target className="w-4 h-4" />
                  Skill Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {skillGaps.map(skill => (
                    <div key={skill} className="flex items-center justify-between p-2 rounded bg-yellow-500/10">
                      <span className="text-sm">{skill}</span>
                      <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/50">
                        Needs Coverage
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Member Details */}
            {selectedMember && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {selectedMember.name}'s Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {skillCategories.map(category => {
                      const categorySkills = selectedMember.skills.filter(s => s.category === category);
                      if (categorySkills.length === 0) return null;
                      
                      return (
                        <div key={category}>
                          <h5 className="text-xs font-medium text-muted-foreground uppercase mb-2">{category}</h5>
                          <div className="space-y-2">
                            {categorySkills.map(skill => (
                              <div key={skill.name} className="flex items-center justify-between">
                                <span className="text-sm">{skill.name}</span>
                                {renderSkillLevel(skill.level)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
