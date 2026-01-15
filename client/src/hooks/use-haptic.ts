import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 30],
  warning: [30, 50, 30],
  error: [50, 30, 50, 30, 50],
  selection: 5,
};

export function useHaptic() {
  const vibrate = useCallback((pattern: HapticPattern = 'light') => {
    if ('vibrate' in navigator) {
      try {
        const vibrationPattern = HAPTIC_PATTERNS[pattern];
        navigator.vibrate(vibrationPattern);
      } catch (error) {
        // Silently fail - not all devices support vibration
      }
    }
  }, []);

  const vibrateOnClick = useCallback((pattern: HapticPattern = 'light') => {
    return () => vibrate(pattern);
  }, [vibrate]);

  const light = useCallback(() => vibrate('light'), [vibrate]);
  const medium = useCallback(() => vibrate('medium'), [vibrate]);
  const heavy = useCallback(() => vibrate('heavy'), [vibrate]);
  const success = useCallback(() => vibrate('success'), [vibrate]);
  const warning = useCallback(() => vibrate('warning'), [vibrate]);
  const error = useCallback(() => vibrate('error'), [vibrate]);
  const selection = useCallback(() => vibrate('selection'), [vibrate]);

  return {
    vibrate,
    vibrateOnClick,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  };
}

export function hapticFeedback(pattern: HapticPattern = 'light') {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(HAPTIC_PATTERNS[pattern]);
    } catch (error) {
      // Silently fail
    }
  }
}
