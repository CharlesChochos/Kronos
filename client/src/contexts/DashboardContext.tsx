import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showResourcesSheet, setShowResourcesSheet] = useState(false);
  const [showNotificationsSheet, setShowNotificationsSheet] = useState(false);
  const [showCustomizeSheet, setShowCustomizeSheet] = useState(false);

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
