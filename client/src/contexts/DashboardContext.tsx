import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

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
  const [unreadMessageCount, setUnreadMessageCount] = useState(() => {
    const saved = localStorage.getItem('unreadMessageCount');
    return saved ? parseInt(saved, 10) : 2;
  });

  useEffect(() => {
    localStorage.setItem('unreadMessageCount', unreadMessageCount.toString());
  }, [unreadMessageCount]);

  const addMessageNotification = useCallback((notification: MessageNotification) => {
    setUnreadMessageCount(prev => prev + 1);
    
    toast.custom((t) => (
      <div className="bg-card border border-border rounded-lg shadow-xl p-4 max-w-sm animate-in slide-in-from-top-5 duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
            {notification.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}
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
