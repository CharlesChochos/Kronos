import { forwardRef, ComponentPropsWithoutRef } from 'react';
import { Button } from '@/components/ui/button';
import { hapticFeedback } from '@/hooks/use-haptic';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticButtonProps extends ComponentPropsWithoutRef<typeof Button> {
  haptic?: HapticPattern;
}

export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ haptic = 'light', onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      hapticFeedback(haptic);
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);

HapticButton.displayName = 'HapticButton';
