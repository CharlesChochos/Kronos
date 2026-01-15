import { useLocation } from 'wouter';
import { Home, Briefcase, CheckSquare, User, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/api';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { data: user } = useCurrentUser();
  
  const isAdmin = user?.accessLevel === 'admin';
  const basePath = isAdmin ? '/ceo' : '/employee';

  const navItems: NavItem[] = [
    { icon: Home, label: 'Home', path: `${basePath}/dashboard` },
    { icon: Lightbulb, label: 'Opportunities', path: `${basePath}/opportunities` },
    { icon: Briefcase, label: 'Deals', path: isAdmin ? '/ceo/deals' : '/employee/deals' },
    { icon: CheckSquare, label: 'Tasks', path: '/employee/tasks' },
    { icon: User, label: 'Profile', path: `${basePath}/dashboard` },
  ];

  const isActive = (path: string) => {
    if (path === location) return true;
    if (path.includes('/dashboard') && (location === '/ceo' || location === '/employee' || location === '/')) return true;
    return location.startsWith(path) && path !== `${basePath}/dashboard`;
  };

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className={cn("w-5 h-5", active && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <div className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
