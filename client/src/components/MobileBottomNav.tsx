import { useLocation } from 'wouter';
import { Home, Briefcase, CheckSquare, Lightbulb, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/api';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { data: user } = useCurrentUser();
  
  const isAdmin = user?.accessLevel === 'admin';
  const basePath = isAdmin ? '/ceo' : '/employee';

  const navItems: NavItem[] = isAdmin 
    ? [
        { icon: Home, label: 'Home', path: '/ceo/dashboard' },
        { icon: Lightbulb, label: 'Opportunities', path: '/ceo/opportunities' },
        { icon: Briefcase, label: 'Deals', path: '/ceo/deals' },
        { icon: MessageCircle, label: 'Messages', path: '/ceo/messages' },
        { icon: CheckSquare, label: 'Tasks', path: '/ceo/tasks' },
      ]
    : [
        { icon: Home, label: 'Home', path: '/employee/home' },
        { icon: Lightbulb, label: 'Opportunities', path: '/ceo/opportunities' },
        { icon: Briefcase, label: 'Deals', path: '/ceo/deals' },
        { icon: MessageCircle, label: 'Messages', path: '/employee/messages' },
        { icon: CheckSquare, label: 'Tasks', path: '/employee/tasks' },
      ];

  const isActive = (path: string) => {
    if (path === location) return true;
    if (path.includes('/dashboard') && (location === '/ceo' || location === '/employee' || location === '/')) return true;
    return location.startsWith(path) && path !== `${basePath}/dashboard`;
  };

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 dark:bg-card/95 backdrop-blur-lg border-t border-border/50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] min-h-[48px] py-2 rounded-lg transition-all duration-200 active:scale-95",
                active 
                  ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:text-muted-foreground dark:hover:text-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon 
                className={cn(
                  "transition-transform duration-200",
                  active ? "w-6 h-6" : "w-5 h-5"
                )} 
                strokeWidth={active ? 2.5 : 2}
              />
              <span 
                className={cn(
                  "text-[10px] leading-tight transition-all duration-200",
                  active ? "font-semibold" : "font-medium opacity-80"
                )}
              >
                {item.label}
              </span>
              {active && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
