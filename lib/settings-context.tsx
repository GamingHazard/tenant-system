"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  SettingsPayload,
  getAdminSettingsByUserId,
  fetchSettingsFromApi,
  fetchSettingsByIdFromApi,
  updateSettingsOnApi,
  convertPayloadToTenantPortalSettings,
  TenantPortalSettings,
  fetchSettingsByTenantId,
  fetchPaystackBanks,
  PaystackBank,
} from "@/lib/services/settings";
import { useAuth } from "@/lib/auth-context";

interface SettingsContextType {
  settings: SettingsPayload | null;
  settingsId: string | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateFieldAsync: (flatKey: string, value: any) => Promise<boolean>;
  clearError: () => void;
  paystackBanks: PaystackBank[] | null;
  isBanksLoaded: boolean;
  refreshBanks: (country?: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, token } = useAuth();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [paystackBanks, setPaystackBanks] = useState<PaystackBank[] | null>(
    null,
  );
  const [isBanksLoaded, setIsBanksLoaded] = useState(false);

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    // Always attempt to load system/settings payload so the app can render
    // UI that depends on settings (e.g. currency) even when no user is signed in.

    setIsLoading(true);
    setError(null);

    try {
      // If user has settingsId, use it directly; otherwise fall back to user ID lookup
      let apiSettings: SettingsPayload | null = null;

      if (user && user?.settingsId) {
        apiSettings = await fetchSettingsByIdFromApi(
          user.settingsId,
          token ? token : undefined,
        );
        setSettingsId(user.settingsId);
      } else if (user && user?.role === "tenant") {
        apiSettings = await fetchSettingsByTenantId(
          user.id,
          token ? token : undefined,
        );
        if (apiSettings?._id) {
          setSettingsId(apiSettings._id);
        }
      } else {
        apiSettings = await fetchSettingsFromApi(token ? token : undefined);
        if (apiSettings?._id) {
          setSettingsId(apiSettings._id);
        }
      }
      if (apiSettings) {
        setSettings(apiSettings);
      } else {
        setError("Failed to load settings from API");
        setSettings(null);
      }

      // Fetch Paystack banks in parallel (best-effort)
      (async () => {
        try {
          const country = apiSettings?.finance?.currency?.country || undefined;
          setIsBanksLoaded(false);
          const banks = await fetchPaystackBanks(
            token ? token : undefined,
            country,
          );
          setPaystackBanks(banks);
        } catch (e) {
          setPaystackBanks(null);
        } finally {
          setIsBanksLoaded(true);
        }
      })();
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch settings");
      setSettings(null);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [user, token]);

  // Trigger fetch on auth state change (login/restore/logout)
  useEffect(() => {
    if (authLoading) {
      return; // Wait for auth to finish loading
    }

    if (!hasFetched) {
      fetchSettings();
      return;
    }

    if (!user) {
      // User logged out
      setSettings(null);
      setSettingsId(null);
      setHasFetched(false);
    }
  }, [user, authLoading, hasFetched, fetchSettings]);

  // Listen for settings changes from other tabs/windows or from admin panel
  useEffect(() => {
    const handleSettingsChanged = () => {
      setHasFetched(false); // Force refetch
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "propman:system-settings-sync") {
        setHasFetched(false); // Force refetch
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("system-settings-changed", handleSettingsChanged);
      window.addEventListener("storage", handleStorageChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "system-settings-changed",
          handleSettingsChanged,
        );
        window.removeEventListener("storage", handleStorageChange);
      }
    };
  }, []);

  const isLoaded = !isLoading && hasFetched && settings !== null;

  const refreshBanks = useCallback(
    async (country?: string) => {
      setIsBanksLoaded(false);
      try {
        const banks = await fetchPaystackBanks(
          token ? token : undefined,
          country,
        );
        setPaystackBanks(banks);
      } catch (e) {
        setPaystackBanks(null);
      } finally {
        setIsBanksLoaded(true);
      }
    },
    [token],
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    setHasFetched(false); // Force re-fetch
    await fetchSettings();
  }, [fetchSettings]);

  // Update a single field async
  const updateFieldAsync = useCallback(
    async (flatKey: string, value: any): Promise<boolean> => {
      if (!settingsId) {
        setError("Settings ID not available");
        return false;
      }

      try {
        // Optimistically update local state
        // (optional: you can implement this if desired)

        // Call API to persist
        const result = await updateSettingsOnApi(settingsId, {
          [flatKey]: value,
        });

        if (!result) {
          throw new Error("Failed to update field on server");
        }

        // Sync context with updated data
        setSettings(result);
        return true;
      } catch (err) {
        console.error(`Error updating field ${flatKey}:`, err);
        setError(err instanceof Error ? err.message : "Field update failed");
        return false;
      }
    },
    [settingsId],
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: SettingsContextType = {
    settings,
    settingsId,
    isLoading,
    isLoaded,
    error,
    refresh,
    updateFieldAsync,
    clearError,
    paystackBanks,
    isBanksLoaded,
    refreshBanks,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
