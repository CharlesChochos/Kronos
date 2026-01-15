import { useState, useRef, useCallback, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticFeedback } from '@/hooks/use-haptic';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0) {
      e.preventDefault();
      const resistance = 0.4;
      const newDistance = Math.min(diff * resistance, threshold * 1.5);
      setPullDistance(newDistance);
      
      if (newDistance >= threshold && pullDistance < threshold) {
        hapticFeedback('medium');
      }
    }
  }, [disabled, isRefreshing, threshold, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      hapticFeedback('success');
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
        hapticFeedback('error');
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: pullDistance > 0 ? 'none' : 'auto' }}
    >
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity duration-200 z-50',
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: Math.max(pullDistance - 40, 8),
        }}
      >
        <div className="bg-background border rounded-full p-2 shadow-lg">
          <RefreshCw
            className={cn(
              'w-5 h-5 text-primary transition-transform',
              isRefreshing && 'animate-spin'
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
      
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${isRefreshing ? threshold / 2 : pullDistance}px)`,
          transitionDuration: isPulling.current ? '0ms' : '200ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}
