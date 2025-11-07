import { useState, useEffect } from 'react';

const TOOLTIP_PREFERENCE_KEY = 'badge-tooltips-dismissed';

export const useTooltipPreference = () => {
  const [tooltipsEnabled, setTooltipsEnabled] = useState<boolean>(() => {
    // Check localStorage on initial load
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOOLTIP_PREFERENCE_KEY);
      return stored !== 'true'; // Return true if NOT dismissed (enabled by default)
    }
    return true;
  });

  const dismissTooltips = () => {
    localStorage.setItem(TOOLTIP_PREFERENCE_KEY, 'true');
    setTooltipsEnabled(false);
  };

  const enableTooltips = () => {
    localStorage.removeItem(TOOLTIP_PREFERENCE_KEY);
    setTooltipsEnabled(true);
  };

  useEffect(() => {
    // Sync with localStorage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOOLTIP_PREFERENCE_KEY) {
        setTooltipsEnabled(e.newValue !== 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    tooltipsEnabled,
    dismissTooltips,
    enableTooltips,
  };
};
