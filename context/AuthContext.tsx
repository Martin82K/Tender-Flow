import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { LegalAcceptanceInput, User } from "../types";
import { authService } from "../services/authService";
import {
  isDemoSession,
  DEMO_USER,
  endDemoSession,
  startDemoSession,
} from "../services/demoData";
import { isDesktop, platformAdapter } from "../services/platformAdapter";
import {
  authSessionService,
} from "../services/authSessionService";
import { queryClient } from "../services/queryClient";
import { logIncident, setIncidentContext } from "@/services/incidentLogger";
import { navigate } from "../shared/routing/router";
import { authSessionStore } from "@infra/auth/authSessionStore";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  register: (
    name: string,
    email: string,
    password: string,
    legalAcceptance: LegalAcceptanceInput,
  ) => Promise<void>;
  acceptLegalDocuments: (input: LegalAcceptanceInput) => Promise<void>;
  updatePreferences: (preferences: any) => Promise<void>;
  logout: () => Promise<void>;
  loginAsDemo: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  canUseBiometric: boolean;
  hasSavedCredentials: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const contextId = Math.floor(Math.random() * 100000);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  console.debug("[AuthContext] AuthProvider rendering. ContextID:", contextId);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const authEventRef = useRef(false);
  const lastHydratedTokenRef = useRef<string | null>(null);
  const biometricLoginAttemptedRef = useRef(false);
  const preferencesUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const applyBackgroundUserRefresh = useCallback((freshUser: User) => {
    setUser((prev) => {
      if (!prev || prev.id !== freshUser.id) return prev;
      return freshUser;
    });
  }, []);
  const isInvalidRefreshError = (error: unknown): boolean => {
    const message = String((error as any)?.message || "").toLowerCase();
    const status = Number((error as any)?.status || (error as any)?.code || 0);
    return (
      status === 400 ||
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found")
    );
  };

  useEffect(() => {
    setIncidentContext({
      user_id: user?.id ?? null,
      organization_id: user?.organizationId ?? null,
    });
  }, [user?.id, user?.organizationId]);

  // Check biometric availability and validate stored credentials on mount
  useEffect(() => {
    const checkBiometricAndValidateCredentials = async () => {
      if (!isDesktop) return;

      try {
        const [available, enabled, credentials] = await Promise.all([
          platformAdapter.biometric.isAvailable(),
          platformAdapter.session.isBiometricEnabled(),
          platformAdapter.session.getCredentials(),
        ]);

        // Early validation of stored credentials - clear if corrupted
        if (credentials) {
          const isValidToken = (token: unknown): boolean => {
            if (!token) return false;
            if (typeof token !== 'string') return false;
            const t = token.trim();
            return t.length >= 10 && t !== 'null' && t !== 'undefined';
          };

          if (!isValidToken(credentials.refreshToken)) {
            console.warn("[AuthContext] Invalid stored credentials detected on startup, clearing...");
            await platformAdapter.session.clearCredentials();
            setHasSavedCredentials(false);
            setCanUseBiometric(available && enabled);
            return;
          }
        }

        setCanUseBiometric(available && enabled);
        setHasSavedCredentials(!!credentials);

        console.debug("[AuthContext] Biometric check:", { available, enabled, hasCredentials: !!credentials });
      } catch (e) {
        console.warn("[AuthContext] Failed to check biometric availability:", e);
      }
    };

    checkBiometricAndValidateCredentials();
  }, []);

  useEffect(() => {
    console.debug("AuthContext: Initializing...");

    // Priority 0: Validate stored session before Supabase tries to use it.
    // A corrupted session can cause "Invalid value" header errors in fetch requests.
    const isInvalidToken = (token: unknown): boolean => {
      if (token === undefined || token === null) return false; // Not present is OK
      if (typeof token !== 'string') return true; // Must be string
      const t = token.trim();
      // Check for corrupted/placeholder values
      return t === '' || t === 'null' || t === 'undefined' || t.length < 10;
    };

    try {
      const raw = authSessionService.getStoredAuthSessionRaw();
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate the session object has the expected shape
        const accessToken = parsed?.access_token
          ?? parsed?.currentSession?.access_token
          ?? parsed?.session?.access_token
          ?? parsed?.data?.session?.access_token;
        const refreshToken = parsed?.refresh_token
          ?? parsed?.currentSession?.refresh_token
          ?? parsed?.session?.refresh_token
          ?? parsed?.data?.session?.refresh_token;

        if (isInvalidToken(accessToken) || isInvalidToken(refreshToken)) {
          console.warn('[AuthContext] Corrupted session token detected, clearing session');
          authSessionService.clearStoredSessionData();
        }
      }
    } catch (e) {
      // If we can't parse the session, it's corrupted - clear it
      console.warn('[AuthContext] Could not parse stored session, clearing:', e);
      try {
        authSessionService.clearStoredSessionData();
      } catch { /* ignore */ }
    }

    // Priority 1: Demo session (runtime-only, not restorable from localStorage)
    // Security: isDemoSession() is tracked in memory — manipulating localStorage
    // cannot activate demo mode. Only loginAsDemo() sets the runtime flag.
    if (isDemoSession()) {
      console.debug("AuthContext: Active demo session detected");
      setUser(DEMO_USER);
      setIsLoading(false);
      return;
    }

    // Clean up stale localStorage demo flag from previous sessions
    if (window.localStorage.getItem('demo_session')) {
      console.debug('[AuthContext] Stale demo_session localStorage flag found on init. Cleaning up.');
      endDemoSession();
    }

    // Priority 2: Desktop restore flow (single refresh attempt; no fallback retries)
    const tryDesktopSessionRestore = async (): Promise<"success" | "cancelled" | "skipped" | "failed" | "hard_failed"> => {
      if (!isDesktop || biometricLoginAttemptedRef.current) return "skipped";

      const biometricEnabled = await platformAdapter.session.isBiometricEnabled();

      // Use atomic biometric+credential retrieval when biometric is enabled.
      // This ensures the biometric check runs in the main process — the renderer
      // cannot skip it to access stored tokens directly.
      let credentials: { refreshToken: string; email: string } | null;
      if (biometricEnabled) {
        setCanUseBiometric(true);
        setHasSavedCredentials(true);
        console.debug("[AuthContext] Auto-login: Requesting credentials with biometric verification...");
        credentials = await platformAdapter.session.getCredentialsWithBiometric("Odemknout Tender Flow");
        if (!credentials) {
          console.debug("[AuthContext] Auto-login: Biometric cancelled or no credentials");
          return "cancelled";
        }
      } else {
        credentials = await platformAdapter.session.getCredentials();
      }

      if (!credentials) {
        console.debug("[AuthContext] Auto-login: No stored credentials");
        return "skipped";
      }

      if (typeof credentials.refreshToken !== "string" || credentials.refreshToken.length < 10) {
        console.warn("[AuthContext] Auto-login: Invalid refresh token format");
        void logIncident({
          severity: "error",
          source: "renderer",
          category: "auth",
          code: "AUTH_INVALID_REFRESH_TOKEN_FORMAT",
          message: "Auto-login: invalid refresh token format",
          context: {
            operation: "auth.auto_login.validate_token",
            reason: "invalid_refresh_token_format",
          },
        });
        await authSessionService.invalidateAuthState({
          navigateToLogin: false,
          reason: "invalid_refresh_token",
        });
        setHasSavedCredentials(false);
        return "hard_failed";
      }

      biometricLoginAttemptedRef.current = true;

      try {
        console.debug("[AuthContext] Auto-login: Refreshing session with stored token...");
        const { data, error } = await authSessionService.refreshSession(credentials.refreshToken);

        if (error || !data.session) {
          console.error("[AuthContext] Auto-login: Session refresh failed", error);
          void logIncident({
            severity: "error",
            source: "renderer",
            category: "auth",
            code: isInvalidRefreshError(error)
              ? "AUTH_INVALID_REFRESH_TOKEN"
              : "AUTH_REFRESH_FAILED",
            message: "Auto-login: session refresh failed",
            stack: error instanceof Error ? error.stack : null,
            context: {
              operation: "auth.auto_login.refresh_session",
              reason: isInvalidRefreshError(error) ? "invalid_refresh_token" : "refresh_failed",
            },
          });
          if (isInvalidRefreshError(error)) {
            await authSessionService.invalidateAuthState({
              navigateToLogin: false,
              reason: "invalid_refresh_token",
            });
            setHasSavedCredentials(false);
            return "hard_failed";
          } else {
            await platformAdapter.session.clearCredentials();
            setHasSavedCredentials(false);
          }
          return "failed";
        }

        await platformAdapter.session.saveCredentials({
          refreshToken: data.session.refresh_token,
          email: credentials.email,
        });

        const currentUser = await authService.getUserFromSession(data.session, {
          onBackgroundRefresh: applyBackgroundUserRefresh,
        });

        if (!currentUser) {
          return "failed";
        }

        setUser(currentUser);
        setHasSavedCredentials(true);
        setCanUseBiometric(biometricEnabled);
        console.debug("[AuthContext] Auto-login: Success!", currentUser.email);
        return "success";
      } catch (error) {
        console.error("[AuthContext] Auto-login error:", error);
        void logIncident({
          severity: "error",
          source: "renderer",
          category: "auth",
          code: "AUTH_AUTO_LOGIN_EXCEPTION",
          message: "Auto-login exception",
          stack: error instanceof Error ? error.stack : null,
          context: {
            operation: "auth.auto_login.exception",
          },
        });
        if (isInvalidRefreshError(error)) {
          await authSessionService.invalidateAuthState({
            navigateToLogin: false,
            reason: "invalid_refresh_token",
          });
          setHasSavedCredentials(false);
          return "hard_failed";
        }
        return "failed";
      } finally {
        biometricLoginAttemptedRef.current = false;
      }
    };

    // Listen for auth changes first (so INITIAL_SESSION can hydrate even if getCurrentUser hangs)
    authSessionStore.start();

    const unsubscribeAuthEvents = authSessionStore.subscribe(async ({ event, session }) => {
      console.debug("[AuthContext] Auth State Change:", event, session?.user?.email);
      authEventRef.current = true;
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "SESSION_SYNC"
      ) {
        if (session) {
          const token = (session as any)?.access_token || null;
          if (
            (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
            token &&
            lastHydratedTokenRef.current === token
          ) {
            return;
          }
          // Use session directly from callback - no extra API call needed!
          try {
            const currentUser = await authService.getUserFromSession(session, {
              onBackgroundRefresh: applyBackgroundUserRefresh,
            });
            if (currentUser) {
              setUser(currentUser);
              setIsLoading(false);
              if (token) lastHydratedTokenRef.current = token;
              // Notify main process about auth state
              if (isDesktop) {
                platformAdapter.auth.setAuthenticated(true);
              }
            } else {
              console.warn(
                "[AuthContext] Event but could not build user from session"
              );
            }
          } catch (err) {
            console.error("[AuthContext] Error hydrating user from session:", err);
            // If this was an INITIAL_SESSION and hydration failed, finish loading
            // to avoid an infinite loading screen
            if (event === "INITIAL_SESSION") {
              setIsLoading(false);
            }
          }
        } else if (event === "INITIAL_SESSION" || event === "SESSION_SYNC") {
          // No session on initial load - not authenticated
          setIsLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        console.debug("[AuthContext] Received SIGNED_OUT event from Supabase");
        void logIncident({
          severity: "warn",
          source: "renderer",
          category: "auth",
          code: "AUTH_SIGNED_OUT_EVENT",
          message: "Received SIGNED_OUT event from Supabase",
          context: {
            operation: "auth.on_auth_state_change",
          },
        });
        void authSessionService.invalidateAuthState({
          navigateToLogin: false,
          reason: "invalid_refresh_token",
        });
        setUser(null);
        setIsLoading(false);
      }
    });
    void authSessionStore.syncSession();

    // Best-effort active session load, but never block UI indefinitely.
    const initTimeoutMs = 8000;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setIsLoading(false);
      console.debug("AuthContext: Loading finished");
    };
    const timer = window.setTimeout(() => {
      console.warn(`[AuthContext] initAuth timed out (${initTimeoutMs}ms)`);
      finish();
    }, initTimeoutMs);

    (async () => {
      try {
        const desktopRestoreStatus = await tryDesktopSessionRestore();
        if (desktopRestoreStatus === "success") {
          window.clearTimeout(timer);
          return;
        }

        if (desktopRestoreStatus === "hard_failed") {
          setUser(null);
          return;
        }

        if (desktopRestoreStatus === "cancelled") {
          setUser(null);
          return;
        }

        const currentUser = await authService.getCurrentUser({
          onBackgroundRefresh: applyBackgroundUserRefresh,
        });
        console.debug("AuthContext: User loaded", currentUser?.email);
        if (!authEventRef.current || currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        if (!authEventRef.current) setUser(null);
      } finally {
        window.clearTimeout(timer);
        finish();
      }
    })();

    return () => {
      unsubscribeAuthEvents();
    };
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      authSessionService.setRememberMePreference(rememberMe);

      const timeoutMs = 10000;
      const user = await Promise.race([
        authService.login(email, password),
        new Promise<User>((resolve) =>
          setTimeout(() => {
            console.warn(
              `[AuthContext] login timed out (${timeoutMs}ms) - proceeding; auth event should hydrate`
            );
            resolve({
              id: "pending",
              name: "User",
              email,
              role: "user",
              preferences: {
                theme: "system",
                primaryColor: "#607AFB",
                backgroundColor: "#f5f6f8",
              },
            } as User);
          }, timeoutMs)
        ),
      ]);
      // If we got a real user (or fallback), allow navigation; auth events will refine user data.
      if (user?.id !== "pending") setUser(user);

      // Notify main process about auth state (enables IPC auth guard)
      if (isDesktop) {
        platformAdapter.auth.setAuthenticated(true);
      }

      // Save session for biometric unlock (desktop only) - only if rememberMe is enabled
      if (isDesktop && rememberMe) {
        const { data } = await authSessionService.getSession();
        if (data?.session?.refresh_token) {
          try {
            await platformAdapter.session.saveCredentials({
              refreshToken: data.session.refresh_token,
              email,
            });

            // Enable biometric by default on first login
            const biometricAvailable = await platformAdapter.biometric.isAvailable();
            if (biometricAvailable) {
              await platformAdapter.session.setBiometricEnabled(true);
              setCanUseBiometric(true);
            }
            setHasSavedCredentials(true);
          } catch (saveError) {
            console.error("[AuthContext] Failed to save credentials:", saveError);
          }
        } else {
          console.warn("[AuthContext] No refresh token found to save.");
        }
      } else if (isDesktop && !rememberMe) {
        await platformAdapter.session.clearCredentials();
        setHasSavedCredentials(false);
      }
    } catch (error) {
      console.error("Login failed", error);
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "auth",
        code: "AUTH_LOGIN_FAILED",
        message: "Login failed",
        stack: error instanceof Error ? error.stack : null,
        context: {
          operation: "auth.login",
        },
      });
      throw error;
    }
  };

  /**
   * Login using biometric authentication (Touch ID / Face ID / Windows Hello)
   * Uses stored refresh token to create a new session
   */
  const loginWithBiometric = async (): Promise<boolean> => {
    if (!isDesktop) {
      console.warn("[AuthContext] Biometric login only available on desktop");
      return false;
    }

    if (biometricLoginAttemptedRef.current) {
      console.debug("[AuthContext] Biometric login already in progress");
      return false;
    }

    biometricLoginAttemptedRef.current = true;

    try {
      // Check if biometric is enabled
      const biometricEnabled = await platformAdapter.session.isBiometricEnabled();
      if (!biometricEnabled) {
        console.debug("[AuthContext] Biometric not enabled");
        biometricLoginAttemptedRef.current = false;
        return false;
      }

      // Atomic biometric verification + credential retrieval in main process.
      // The biometric prompt runs server-side (main process) — renderer cannot bypass it.
      console.debug("[AuthContext] Requesting credentials with biometric verification...");
      const credentials = await platformAdapter.session.getCredentialsWithBiometric("Přihlášení do Tender Flow");
      if (!credentials) {
        console.debug("[AuthContext] Biometric authentication cancelled or no credentials");
        biometricLoginAttemptedRef.current = false;
        return false;
      }

      // Use refresh token to get new session
      console.debug("[AuthContext] Biometric verified, refreshing session...");
      const { data, error } = await authSessionService.refreshSession(
        credentials.refreshToken,
      );

      if (error || !data.session) {
        console.error("[AuthContext] Failed to refresh session:", error);
        void logIncident({
          severity: "error",
          source: "renderer",
          category: "auth",
          code: isInvalidRefreshError(error)
            ? "AUTH_BIOMETRIC_INVALID_REFRESH_TOKEN"
            : "AUTH_BIOMETRIC_REFRESH_FAILED",
          message: "Biometric login: refresh failed",
          stack: error instanceof Error ? error.stack : null,
          context: {
            operation: "auth.biometric.refresh_session",
          },
        });
        if (isInvalidRefreshError(error)) {
          await authSessionService.invalidateAuthState({
            navigateToLogin: false,
            reason: "invalid_refresh_token",
          });
        } else {
          await platformAdapter.session.clearCredentials();
        }
        setHasSavedCredentials(false);
        biometricLoginAttemptedRef.current = false;
        return false;
      }

      // Update stored credentials with new refresh token
      await platformAdapter.session.saveCredentials({
        refreshToken: data.session.refresh_token,
        email: credentials.email,
      });

      // Build user from session
      const currentUser = await authService.getUserFromSession(data.session, {
        onBackgroundRefresh: applyBackgroundUserRefresh,
      });
      if (currentUser) {
        setUser(currentUser);
        // Notify main process about auth state (enables IPC auth guard)
        platformAdapter.auth.setAuthenticated(true);
        console.debug("[AuthContext] Biometric login successful:", currentUser.email);
        biometricLoginAttemptedRef.current = false;
        return true;
      }

      biometricLoginAttemptedRef.current = false;
      return false;
    } catch (error) {
      console.error("[AuthContext] Biometric login error:", error);
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "auth",
        code: "AUTH_BIOMETRIC_EXCEPTION",
        message: "Biometric login exception",
        stack: error instanceof Error ? error.stack : null,
        context: {
          operation: "auth.biometric.exception",
        },
      });
      if (isInvalidRefreshError(error)) {
        await authSessionService.invalidateAuthState({
          navigateToLogin: false,
          reason: "invalid_refresh_token",
        });
      }
      biometricLoginAttemptedRef.current = false;
      return false;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    legalAcceptance: LegalAcceptanceInput,
  ) => {
    try {
      const user = await authService.register(name, email, password, legalAcceptance);
      setUser(user);
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const acceptLegalDocuments = async (input: LegalAcceptanceInput) => {
    try {
      const updatedUser = await authService.acceptLegalDocuments(input);
      setUser(updatedUser);
    } catch (error) {
      console.error("Legal acceptance update failed", error);
      const message = String((error as any)?.message || "").toLowerCase();
      const code = String((error as any)?.code || "");
      const isAuthExpired =
        code === "P0001" ||
        message.includes("not authenticated") ||
        message.includes("přihlášení vypršelo");

      if (isAuthExpired) {
        await authSessionService.invalidateAuthState({
          navigateToLogin: true,
          reason: "invalid_refresh_token",
        });
        setUser(null);
      }
      throw error;
    }
  };

  const updatePreferences = async (preferences: any) => {
    const queuedUpdate = preferencesUpdateQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const updatedUser = await authService.updateUserPreferences(preferences);
        setUser(updatedUser);
      });

    preferencesUpdateQueueRef.current = queuedUpdate;

    try {
      await queuedUpdate;
    } catch (error) {
      console.error("Failed to update preferences", error);
    }
  };

  const logout = async () => {
    try {
      if (isDemoSession()) {
        endDemoSession();
      } else {
        await authService.logout();
      }
    } catch (error) {
      console.error("Logout failed:", error);
      void logIncident({
        severity: "warn",
        source: "renderer",
        category: "auth",
        code: "AUTH_LOGOUT_FAILED",
        message: "Logout failed, continuing with local cleanup",
        stack: error instanceof Error ? error.stack : null,
        context: {
          operation: "auth.logout",
        },
      });
    } finally {
      // Notify main process before cleanup (disables IPC auth guard)
      if (isDesktop) {
        platformAdapter.auth.setAuthenticated(false);
      }
      await authSessionService.invalidateAuthState({
        navigateToLogin: false,
        reason: "manual_logout",
      });
      setUser(null);
      queryClient.clear();
      if (isDesktop) {
        navigate("/login", { replace: true });
      } else {
        window.location.href = "/";
      }
    }
  };

  const loginAsDemo = () => {
    startDemoSession();
    setUser(DEMO_USER);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithBiometric,
        register,
        acceptLegalDocuments,
        updatePreferences,
        logout,
        loginAsDemo,
        isAuthenticated: !!user,
        isLoading,
        canUseBiometric,
        hasSavedCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error(
      "[AuthContext] useAuth failed. Current ContextID:",
      contextId,
      "Context value:",
      context
    );
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
