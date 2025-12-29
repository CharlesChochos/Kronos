import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useUserPreferences, useSaveUserPreferences } from '@/lib/api';
import type { UserPreferences } from '@shared/schema';

interface MessageNotification {
  id: string;
  senderName: string;
  senderAvatar?: string;
  preview: string;
  timestamp: Date;
}

interface DashboardContextType {
  showProfileSheet: boolean;
  setShowProfileSheet: (show: boolean) => void;
  showSettingsSheet: boolean;
  setShowSettingsSheet: (show: boolean) => void;
  showResourcesSheet: boolean;
  setShowResourcesSheet: (show: boolean) => void;
  showNotificationsSheet: boolean;
  setShowNotificationsSheet: (show: boolean) => void;
  showCustomizeSheet: boolean;
  setShowCustomizeSheet: (show: boolean) => void;
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
  addMessageNotification: (notification: MessageNotification) => void;
  clearUnreadMessages: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showResourcesSheet, setShowResourcesSheet] = useState(false);
  const [showNotificationsSheet, setShowNotificationsSheet] = useState(false);
  const [showCustomizeSheet, setShowCustomizeSheet] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [countInitialized, setCountInitialized] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  
  const queryClient = useQueryClient();
  const { data: userPrefs, isLoading: prefsLoading } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  
  // Load unread count from user preferences
  useEffect(() => {
    if (!prefsLoading && !countInitialized) {
      const savedCount = (userPrefs?.settings as any)?.unreadMessageCount;
      if (typeof savedCount === 'number') {
        setUnreadMessageCount(savedCount);
      }
      setCountInitialized(true);
    }
  }, [prefsLoading, userPrefs, countInitialized]);
  
  // Save unread count to database (debounced) - only save when count actually changes
  useEffect(() => {
    if (!countInitialized || prefsLoading) return;
    
    // Skip if we haven't initialized the previous count yet
    if (prevCountRef.current === null) {
      prevCountRef.current = unreadMessageCount;
      return;
    }
    
    // Skip if count hasn't changed
    if (prevCountRef.current === unreadMessageCount) return;
    
    const timeout = setTimeout(() => {
      const freshPrefs = queryClient.getQueryData<UserPreferences>(['user-preferences']) || userPrefs;
      const { id, userId, updatedAt, ...mutablePrefs } = (freshPrefs || {}) as any;
      const existingSettings = (freshPrefs?.settings as any) || {};
      saveUserPrefs.mutate({
        ...mutablePrefs,
        settings: {
          ...existingSettings,
          unreadMessageCount: unreadMessageCount,
        },
      });
      prevCountRef.current = unreadMessageCount;
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [unreadMessageCount, countInitialized, prefsLoading]);

  const addMessageNotification = useCallback((notification: MessageNotification) => {
    setUnreadMessageCount(prev => prev + 1);
    
    toast.custom((t) => (
      <div className="bg-card border border-border rounded-lg shadow-xl p-4 max-w-sm animate-in slide-in-from-top-5 duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
            {(notification.senderName || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground">{notification.senderName}</span>
              <span className="text-xs text-muted-foreground">now</span>
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{notification.preview}</p>
          </div>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-right',
    });
  }, []);

  const clearUnreadMessages = useCallback(() => {
    setUnreadMessageCount(0);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        showProfileSheet,
        setShowProfileSheet,
        showSettingsSheet,
        setShowSettingsSheet,
        showResourcesSheet,
        setShowResourcesSheet,
        showNotificationsSheet,
        setShowNotificationsSheet,
        showCustomizeSheet,
        setShowCustomizeSheet,
        unreadMessageCount,
        setUnreadMessageCount,
        addMessageNotification,
        clearUnreadMessages,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
