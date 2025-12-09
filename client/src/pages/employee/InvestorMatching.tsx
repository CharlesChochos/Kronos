import { useState, useCallback, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Check, 
  X, 
  Building2,
  Target,
  Mail,
  Phone,
  Globe,
  Heart,
  Users
} from "lucide-react";
import { useCurrentUser, useDeals, useUpdateDeal, useInvestorMatches, useCreateInvestorMatch, useDeleteInvestorMatch, useStakeholders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import type { TaggedInvestor } from "@shared/schema";
import { Link } from "wouter";

type InvestorData = {
  id: string;
  numericId: number;
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

export default function InvestorMatching() {
  const { data: currentUser } = useCurrentUser();
  const { data: allDeals = [], isLoading } = useDeals();
  const { data: stakeholders = [], isLoading: stakeholdersLoading } = useStakeholders();
  const updateDeal = useUpdateDeal();
  
  const deals = allDeals.filter(deal => {
    if (!currentUser?.id && !currentUser?.email && !currentUser?.name) return false;
    const podTeam = (deal as any).podTeam || [];
    return podTeam.some((member: any) => 
      (currentUser.id && member.userId === currentUser.id) ||
      (currentUser.email && member.email === currentUser.email) ||
      (currentUser.name && member.name === currentUser.name)
    );
  });
  
  const [dealCategory, setDealCategory] = useState<'Investment Banking' | 'Asset Management'>('Investment Banking');
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [showContactModal, setShowContactModal] = useState<InvestorData | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const { data: investorMatches = [] } = useInvestorMatches(selectedDeal || null);
  const createMatch = useCreateInvestorMatch();
  const deleteMatch = useDeleteInvestorMatch();
  
  const [rejectedInvestors, setRejectedInvestors] = useState<string[]>([]);
  
  // Convert stakeholders (type='investor') to InvestorData format
  // Use stakeholder's actual database ID for stable identification
  const INVESTORS: InvestorData[] = useMemo(() => {
    return stakeholders
      .filter(s => s.type === 'investor')
      .map((s, index) => ({
        id: s.id,
        numericId: index + 1,
        name: s.name,
        type: s.title || 'Investor',
        focus: s.location || 'Diversified',
        checkSize: s.notes?.match(/Check size: ([^|,]+)/)?.[1] || 'Flexible',
        matchScore: s.isFavorite ? 95 : 80,
        tags: s.notes?.match(/Tags: (.+)/)?.[1]?.split(', ') || [],
        email: s.email || '',
        phone: s.phone || '',
        website: s.website || '',
      }));
  }, [stakeholders]);
  
  const matchedInvestors = useMemo(() => {
    const matchedIds = investorMatches
      .filter(m => m.status === 'matched')
      .map(m => m.investorId);
    return INVESTORS.filter(inv => matchedIds.includes(inv.id));
  }, [investorMatches, INVESTORS]);
  
  useEffect(() => {
    if (selectedDeal) {
      const rejectedIds = investorMatches
        .filter(m => m.status === 'rejected')
        .map(m => m.investorId);
      setRejectedInvestors(rejectedIds);
    } else {
      setRejectedInvestors([]);
    }
  }, [selectedDeal, investorMatches]);
  
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  
  // Filter deals by category (with fallback for missing dealType)
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const dealType = (deal as any).dealType || 'Investment Banking';
      if (dealCategory === 'Investment Banking') {
        // Investment Banking includes M&A, Capital Raising, Debt Financing, IPO, etc.
        return ['Investment Banking', 'M&A', 'Capital Raising', 'Debt Financing', 'IPO', 'Restructuring', 'Advisory'].includes(dealType);
      }
      return dealType === dealCategory;
    });
  }, [deals, dealCategory]);

  // Set initial deal once data loads or when deals/category changes
  useEffect(() => {
    if (filteredDeals.length > 0) {
      setSelectedDeal(filteredDeals[0].id);
    } else {
      setSelectedDeal('');
    }
  }, [filteredDeals.length, dealCategory]);

  const availableInvestors = INVESTORS.filter(inv => 
    !matchedInvestors.some(m => m.id === inv.id) && 
    !rejectedInvestors.includes(inv.id)
  );
  const currentInvestor = availableInvestors[0];
  const currentDeal = deals.find(d => d.id === selectedDeal);

  const addInvestorToTaggedList = async (investor: InvestorData) => {
    if (!selectedDeal) return;
    
    const latestDeal = deals.find(d => d.id === selectedDeal);
    if (!latestDeal) return;
    
    const existingTagged = latestDeal.taggedInvestors || [];
    
    const alreadyExists = existingTagged.some(
      (inv) => inv.name === investor.name && inv.firm === investor.name
    );
    
    if (alreadyExists) {
      return;
    }
    
    const newTaggedInvestor: TaggedInvestor = {
      id: crypto.randomUUID(),
      name: investor.name,
      firm: investor.name,
      type: investor.type,
      status: 'Contacted',
      notes: `Check size: ${investor.checkSize}, Focus: ${investor.focus}`,
      email: investor.email,
      phone: investor.phone,
      website: investor.website,
    };
    
    try {
      await updateDeal.mutateAsync({
        id: selectedDeal,
        taggedInvestors: [...existingTagged, newTaggedInvestor],
      });
    } catch (error) {
      console.error('Failed to add investor to deal:', error);
    }
  };

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!currentInvestor || isAnimating || !selectedDeal) return;
    
    setIsAnimating(true);
    
    try {
      if (direction === 'right') {
        await createMatch.mutateAsync({
          dealId: selectedDeal,
          investorId: currentInvestor.id,
          status: 'matched',
        });
        await addInvestorToTaggedList(currentInvestor);
        toast.success(`Matched with ${currentInvestor.name}! Added to deal.`);
      } else {
        await createMatch.mutateAsync({
          dealId: selectedDeal,
          investorId: currentInvestor.id,
          status: 'rejected',
        });
        toast.info(`Passed on ${currentInvestor.name}`);
      }
    } catch (error) {
      console.error('Failed to save match:', error);
      toast.error('Failed to save decision');
    }
    
    x.set(0);
    setIsAnimating(false);
  }, [currentInvestor, isAnimating, selectedDeal, createMatch]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      handleSwipe('right');
    } else if (info.offset.x < -threshold) {
      handleSwipe('left');
    }
  };

  const handleContact = (investor: typeof INVESTORS[0]) => {
    setShowContactModal(investor);
  };

  const handleSendEmail = () => {
    if (showContactModal) {
      const dealName = deals.find(d => d.id === selectedDeal)?.name || 'Investment Opportunity';
      window.open(`mailto:${showContactModal.email}?subject=Investment Opportunity - ${dealName}`);
      toast.success("Opening email client...");
      setShowContactModal(null);
    }
  };

  const handleCallPhone = () => {
    if (showContactModal) {
      window.open(`tel:${showContactModal.phone}`);
      toast.info("Initiating call...");
    }
  };

  const handleVisitWebsite = () => {
    if (showContactModal) {
      window.open(`https://${showContactModal.website}`, '_blank');
      toast.info("Opening website...");
    }
  };

  const resetMatches = async () => {
    if (!selectedDeal) return;
    try {
      const res = await fetch(`/api/investor-matches/${selectedDeal}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to reset matches');
      setRejectedInvestors([]);
      toast.info("Matches reset");
    } catch (error) {
      console.error('Failed to reset matches:', error);
      toast.error("Failed to reset matches");
    }
  };

  if (isLoading) {
    return (
      <Layout role="Employee" pageTitle="Investor Match Deck" userName={currentUser?.name || ""}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout role="Employee" pageTitle="Investor Match Deck" userName={currentUser?.name || ""}>
      <div className="space-y-6">
        {/* Category and Deal Selector */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="w-48">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deal Type</label>
              <select 
                  className="w-full bg-card border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  value={dealCategory}
                  onChange={(e) => setDealCategory(e.target.value as 'Investment Banking' | 'Asset Management')}
                  data-testid="select-deal-category"
              >
                  <option value="Investment Banking">Investment Banking</option>
                  <option value="Asset Management">Asset Management</option>
              </select>
            </div>
            <div className="flex-1 max-w-md">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Deal to Match</label>
              <select 
                  className="w-full bg-card border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  value={selectedDeal}
                  onChange={(e) => setSelectedDeal(e.target.value)}
                  data-testid="select-deal"
              >
                  {filteredDeals.length === 0 && (
                    <option value="">No {dealCategory} deals available</option>
                  )}
                  {filteredDeals.map(deal => (
                      <option key={deal.id} value={deal.id}>{deal.name} - ${deal.value}M ({deal.sector})</option>
                  ))}
              </select>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetMatches}>
            Reset All
          </Button>
        </div>

        {/* Tinder-style Match Interface */}
        <div className="flex flex-col items-center justify-center py-6">
            {currentInvestor ? (
              <div className="relative w-full max-w-lg aspect-[3/4] md:aspect-[4/3]">
                  {/* Background cards for stack effect */}
                  {availableInvestors.length > 2 && (
                    <motion.div 
                      className="absolute top-4 left-4 right-4 bottom-[-16px] bg-card/30 rounded-2xl border border-border z-0"
                      initial={{ scale: 0.92 }}
                      animate={{ scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  {availableInvestors.length > 1 && (
                    <motion.div 
                      className="absolute top-2 left-2 right-2 bottom-[-8px] bg-card/60 rounded-2xl border border-border z-10"
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  
                  {/* Main Draggable Card */}
                  <motion.div
                    className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={handleDragEnd}
                    style={{ x, rotate, opacity }}
                    whileTap={{ scale: 1.02 }}
                    data-testid="swipe-card"
                  >
                    {/* Like/Nope Indicators */}
                    <motion.div 
                      className="absolute top-8 right-8 z-30 bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xl rotate-12 border-4 border-green-400"
                      style={{ opacity: likeOpacity }}
                    >
                      <Heart className="w-6 h-6 inline mr-2" />
                      MATCH
                    </motion.div>
                    <motion.div 
                      className="absolute top-8 left-8 z-30 bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xl -rotate-12 border-4 border-red-400"
                      style={{ opacity: nopeOpacity }}
                    >
                      PASS
                    </motion.div>
                    
                    <Card className="h-full bg-card border-border shadow-2xl flex flex-col items-center justify-center text-center p-8 hover:shadow-primary/10 transition-all">
                      <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-inner">
                          <Building2 className="w-10 h-10 text-primary" />
                      </div>
                      
                      <h2 className="text-3xl font-display font-bold mb-2">{currentInvestor.name}</h2>
                      <Badge variant="secondary" className="mb-4">{currentInvestor.type}</Badge>
                      
                      <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
                          <div className="text-center">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Focus</div>
                              <div className="font-medium text-sm line-clamp-2 max-h-10 overflow-hidden" title={currentInvestor.focus}>
                                {currentInvestor.focus.split(',').slice(0, 3).join(', ')}{currentInvestor.focus.split(',').length > 3 ? '...' : ''}
                              </div>
                          </div>
                          <div className="text-center">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Check Size</div>
                              <div className="font-medium text-sm">{currentInvestor.checkSize}</div>
                          </div>
                      </div>

                      <div className="flex gap-2 mb-8">
                          {currentInvestor.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="bg-secondary/30">{tag}</Badge>
                          ))}
                      </div>

                      <div className="w-full bg-secondary/30 rounded-full h-12 flex items-center px-4 mb-6 relative overflow-hidden">
                           <div 
                             className={cn(
                               "absolute left-0 top-0 h-full border-r-2",
                               currentInvestor.matchScore >= 90 ? "bg-green-500/10 border-green-500" :
                               currentInvestor.matchScore >= 80 ? "bg-yellow-500/10 border-yellow-500" :
                               "bg-orange-500/10 border-orange-500"
                             )} 
                             style={{ width: `${currentInvestor.matchScore}%` }}
                           ></div>
                           <div className="relative z-10 flex justify-between w-full items-center">
                              <span className={cn(
                                "text-xs font-bold",
                                currentInvestor.matchScore >= 90 ? "text-green-500" :
                                currentInvestor.matchScore >= 80 ? "text-yellow-500" :
                                "text-orange-500"
                              )}>
                                {currentInvestor.matchScore}% MATCH SCORE
                              </span>
                              <Target className={cn(
                                "w-4 h-4",
                                currentInvestor.matchScore >= 90 ? "text-green-500" :
                                currentInvestor.matchScore >= 80 ? "text-yellow-500" :
                                "text-orange-500"
                              )} />
                           </div>
                      </div>

                      <p className="text-xs text-muted-foreground mb-4">Drag card to swipe or use buttons below</p>

                      <div className="flex items-center gap-8 w-full max-w-xs mt-auto">
                          <Button 
                            size="lg" 
                            variant="outline" 
                            className="flex-1 rounded-full h-14 border-2 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500"
                            onClick={() => handleSwipe('left')}
                            disabled={isAnimating}
                            data-testid="button-reject"
                          >
                              <X className="w-6 h-6" />
                          </Button>
                          <Button 
                            size="lg" 
                            className="flex-1 rounded-full h-14 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
                            onClick={() => handleSwipe('right')}
                            disabled={isAnimating}
                            data-testid="button-approve"
                          >
                              <Check className="w-6 h-6" />
                          </Button>
                      </div>
                      
                      <div className="flex justify-between w-full max-w-xs mt-4 text-[10px] text-muted-foreground uppercase tracking-widest">
                          <span>Pass</span>
                          <span>Match</span>
                      </div>
                    </Card>
                  </motion.div>
              </div>
            ) : INVESTORS.length === 0 ? (
              <Card className="w-full max-w-lg p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Investors Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Investors need to be added to the Stakeholder Directory before matching.
                </p>
              </Card>
            ) : (
              <Card className="w-full max-w-lg p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground mb-4">You've reviewed all available investors for this deal.</p>
                <Button onClick={resetMatches}>Review Again</Button>
              </Card>
            )}
        </div>
        
        {/* Matched List */}
        <Card className="bg-card border-border mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Matched Investors ({matchedInvestors.length})</CardTitle>
                {matchedInvestors.length > 0 && (
                  <Badge variant="secondary">{matchedInvestors.length} matches</Badge>
                )}
            </CardHeader>
            <CardContent>
                {matchedInvestors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No matches yet. Swipe right on investors you want to connect with.
                  </div>
                ) : (
                  <div className="space-y-2">
                      {matchedInvestors.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/10 hover:bg-secondary/20 transition-colors">
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
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleContact(inv)}
                                    data-testid={`button-contact-${inv.id}`}
                                  >
                                    Contact
                                  </Button>
                              </div>
                          </div>
                      ))}
                  </div>
                )}
            </CardContent>
        </Card>
      </div>

      {/* Contact Modal */}
      <Dialog open={!!showContactModal} onOpenChange={() => setShowContactModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Contact {showContactModal?.name}</DialogTitle>
          </DialogHeader>
          {showContactModal && (
            <div className="space-y-4 py-4">
              <button 
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors text-left"
                onClick={handleSendEmail}
                data-testid="button-contact-email"
              >
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium truncate">{showContactModal.email}</div>
                </div>
              </button>
              <button 
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors text-left"
                onClick={handleCallPhone}
                data-testid="button-contact-phone"
              >
                <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="font-medium">{showContactModal.phone}</div>
                </div>
              </button>
              <button 
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors text-left"
                onClick={handleVisitWebsite}
                data-testid="button-contact-website"
              >
                <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Website</div>
                  <div className="font-medium">{showContactModal.website}</div>
                </div>
              </button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactModal(null)}>Close</Button>
            <Button onClick={handleSendEmail}>
              <Mail className="w-4 h-4 mr-2" /> Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
