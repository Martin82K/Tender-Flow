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
import { queryClient, resetAuthErrorCount } from "../services/queryClient";
import { logIncident, setIncidentContext } from "@/services/incidentLogger";
import { navigate } from "../shared/routing/router";
import { authSessionStore } from "@infra/auth/authSessionStore";
import {
  mfaService,
  type MfaLoginChallenge,
  type MfaStatus,
} from "@infra/auth/mfaService";
import { authDeviceService } from "@infra/auth/deviceService";

export type AuthLoginResult =
  | { status: "authenticated" }
  | { status: "mfa_required" }
  | { status: "failed" };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthLoginResult>;
  loginWithBiometric: () => Promise<AuthLoginResult>;
  loginWithPin: (pin: string) => Promise<AuthLoginResult>;
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
  canUsePin: boolean;
  hasSavedCredentials: boolean;
  pendingMfa: MfaLoginChallenge | null;
  verifyMfaLogin: (code: string) => Promise<AuthLoginResult>;
  refreshMfaStatus: () => Promise<MfaStatus>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const contextId = Math.floor(Math.random() * 100000);

const registerCurrentAuthDevice = async (): Promise<void> => {
  try {
    await authDeviceService.registerCurrentDevice();
  } catch (error) {
    console.warn("[AuthContext] Failed to register current auth device:", error);
    void logIncident({
      severity: "warning",
      source: "renderer",
      category: "auth",
      code: "AUTH_DEVICE_REGISTER_FAILED",
      message: "Failed to register current auth device",
      stack: error instanceof Error ? error.stack : null,
      context: {
        operation: "auth.device.register_current",
      },
    });
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  console.debug("[AuthContext] AuthProvider rendering. ContextID:", contextId);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [canUsePin, setCanUsePin] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [pendingMfa, setPendingMfa] = useState<MfaLoginChallenge | null>(null);
  const authEventRef = useRef(false);
  const lastHydratedTokenRef = useRef<string | null>(null);
  const biometricLoginAttemptedRef = useRef(false);
  const preferencesUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMfaRef = useRef<MfaLoginChallenge | null>(null);
  const pendingMfaContextRef = useRef<{
    email?: string;
    rememberMe?: boolean;
    refreshToken?: string;
  } | null>(null);
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
  const notifyDesktopAuthState = useCallback(
    async (authenticated: boolean, session?: any): Promise<boolean> => {
      if (!isDesktop) return true;
      const result = await platformAdapter.auth.setAuthenticated(
        authenticated,
        session
          ? {
              accessToken: session.access_token ?? null,
              expiresAt: typeof session.expires_at === "number" ? session.expires_at : null,
            }
          : undefined,
      );
      return result !== false;
    },
    [],
  );

  const setPendingMfaState = useCallback((challenge: MfaLoginChallenge | null) => {
    pendingMfaRef.current = challenge;
    setPendingMfa(challenge);
  }, []);

  const prepareMfaIfNeeded = useCallback(
    async (context?: { email?: string; rememberMe?: boolean; refreshToken?: string }): Promise<boolean> => {
      const challenge = await mfaService.getLoginChallenge();
      if (!challenge) {
        setPendingMfaState(null);
        pendingMfaContextRef.current = null;
        return false;
      }

      pendingMfaContextRef.current = context ?? pendingMfaContextRef.current;
      setPendingMfaState(challenge);
      setUser(null);
      await notifyDesktopAuthState(false);
      return true;
    },
    [notifyDesktopAuthState, setPendingMfaState],
  );

  const hydrateAuthenticatedSession = useCallback(
    async (session: any, options?: { saveDesktopCredentials?: boolean }): Promise<User | null> => {
      const currentUser = await authService.getUserFromSession(session, {
        onBackgroundRefresh: applyBackgroundUserRefresh,
      });

      if (!currentUser) return null;

      await notifyDesktopAuthState(true, session);
      setPendingMfaState(null);
      setUser(currentUser);
      void registerCurrentAuthDevice();

      if (isDesktop && options?.saveDesktopCredentials) {
        const context = pendingMfaContextRef.current;
        if (context?.rememberMe && session?.refresh_token) {
          await platformAdapter.session.saveCredentials({
            refreshToken: session.refresh_token,
            email: context.email || session.user?.email || "",
          });
          setHasSavedCredentials(true);
        }
      }

      pendingMfaContextRef.current = null;
      return currentUser;
    },
    [applyBackgroundUserRefresh, notifyDesktopAuthState, setPendingMfaState],
  );

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
        const [available, enabled, pinEnabled, credentials] = await Promise.all([
          platformAdapter.biometric.isAvailable(),
          platformAdapter.session.isBiometricEnabled(),
          platformAdapter.session.isPinEnabled(),
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
            setCanUsePin(pinEnabled);
            return;
          }
        }

        setCanUseBiometric(available && enabled);
        setCanUsePin(pinEnabled);
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
    const tryDesktopSessionRestore = async (): Promise<"success" | "mfa_required" | "cancelled" | "skipped" | "failed" | "hard_failed"> => {
      if (!isDesktop || biometricLoginAttemptedRef.current) return "skipped";

      const biometricEnabled = await platformAdapter.session.isBiometricEnabled();
      const pinEnabled = await platformAdapter.session.isPinEnabled();

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
      } else if (pinEnabled) {
        setCanUsePin(true);
        console.debug("[AuthContext] Auto-login: PIN unlock is enabled, waiting for explicit PIN entry");
        return "skipped";
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

        const mfaRequired = await prepareMfaIfNeeded({
          email: credentials.email,
          rememberMe: true,
          refreshToken: data.session.refresh_token,
        });

        if (mfaRequired) {
          setHasSavedCredentials(true);
          setCanUseBiometric(biometricEnabled);
          return "mfa_required";
        }

        const currentUser = await hydrateAuthenticatedSession(data.session);
        if (!currentUser) return "failed";

        if (data.session.refresh_token) {
          await platformAdapter.session.saveCredentials({
            refreshToken: data.session.refresh_token,
            email: credentials.email,
          });
        }

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
          // Nový / obnovený token → přechodné auth chyby z předchozího
          // tokenu již nejsou relevantní. Reset zabrání přesměrování na
          // login kvůli requestům, které se vypálily během obnovy.
          resetAuthErrorCount();
          const token = (session as any)?.access_token || null;
          if (
            (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
            token &&
            lastHydratedTokenRef.current === token &&
            !pendingMfaRef.current
          ) {
            return;
          }
          // Use session directly from callback - no extra API call needed!
          try {
            const mfaRequired = await prepareMfaIfNeeded({
              email: session.user?.email ?? undefined,
              rememberMe: undefined,
              refreshToken: session.refresh_token,
            });
            if (mfaRequired) {
              setIsLoading(false);
              if (token) lastHydratedTokenRef.current = null;
              return;
            }

            const currentUser = await hydrateAuthenticatedSession(session);
            if (currentUser) {
              setIsLoading(false);
              if (token) lastHydratedTokenRef.current = token;
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
        setPendingMfaState(null);
        pendingMfaContextRef.current = null;
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

        if (desktopRestoreStatus === "mfa_required") {
          setUser(null);
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

        const { data: activeSessionData } = await authSessionService.getSession();
        if (activeSessionData?.session) {
          const mfaRequired = await prepareMfaIfNeeded({
            email: activeSessionData.session.user?.email ?? undefined,
            refreshToken: activeSessionData.session.refresh_token,
          });
          if (mfaRequired) {
            console.debug("AuthContext: MFA verification required for active session");
            setUser(null);
            return;
          }
        }

        const currentUser = await authService.getCurrentUser({
          onBackgroundRefresh: applyBackgroundUserRefresh,
        });
        console.debug("AuthContext: User loaded", currentUser?.email);
        if (!authEventRef.current || currentUser) {
          setUser(currentUser);
        }
        if (currentUser) {
          await notifyDesktopAuthState(true);
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

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = true,
  ): Promise<AuthLoginResult> => {
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
                skin: "industrial",
                primaryColor: "#607AFB",
                backgroundColor: "#f5f6f8",
                uiScale: 1,
              },
            } as User);
          }, timeoutMs)
        ),
      ]);
      // If we got a real user (or fallback), allow navigation; auth events will refine user data.
      let activeSession: any = null;
      const { data } = await authSessionService.getSession();
      activeSession = data?.session ?? null;

      const mfaRequired = activeSession
        ? await prepareMfaIfNeeded({
            email,
            rememberMe,
            refreshToken: activeSession.refresh_token,
          })
        : false;

      if (mfaRequired) {
        return { status: "mfa_required" };
      }

      if (isDesktop) {
        await notifyDesktopAuthState(true, activeSession);
      }
      if (user?.id !== "pending") setUser(user);
      void registerCurrentAuthDevice();

      // Save session for biometric unlock (desktop only) - only if rememberMe is enabled
      if (isDesktop && rememberMe) {
        if (activeSession?.refresh_token) {
          try {
            await platformAdapter.session.saveCredentials({
              refreshToken: activeSession.refresh_token,
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
      return { status: "authenticated" };
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
  const loginWithBiometric = async (): Promise<AuthLoginResult> => {
    if (!isDesktop) {
      console.warn("[AuthContext] Biometric login only available on desktop");
      return { status: "failed" };
    }

    if (biometricLoginAttemptedRef.current) {
      console.debug("[AuthContext] Biometric login already in progress");
      return { status: "failed" };
    }

    biometricLoginAttemptedRef.current = true;

    try {
      // Check if biometric is enabled
      const biometricEnabled = await platformAdapter.session.isBiometricEnabled();
      if (!biometricEnabled) {
        console.debug("[AuthContext] Biometric not enabled");
        biometricLoginAttemptedRef.current = false;
        return { status: "failed" };
      }

      // Atomic biometric verification + credential retrieval in main process.
      // The biometric prompt runs server-side (main process) — renderer cannot bypass it.
      console.debug("[AuthContext] Requesting credentials with biometric verification...");
      const credentials = await platformAdapter.session.getCredentialsWithBiometric("Přihlášení do Tender Flow");
      if (!credentials) {
        console.debug("[AuthContext] Biometric authentication cancelled or no credentials");
        biometricLoginAttemptedRef.current = false;
        return { status: "failed" };
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
        return { status: "failed" };
      }

      const mfaRequired = await prepareMfaIfNeeded({
        email: credentials.email,
        rememberMe: true,
        refreshToken: data.session.refresh_token,
      });

      if (mfaRequired) {
        biometricLoginAttemptedRef.current = false;
        return { status: "mfa_required" };
      }

      const currentUser = await hydrateAuthenticatedSession(data.session);
      if (currentUser) {
        if (data.session.refresh_token) {
          await platformAdapter.session.saveCredentials({
            refreshToken: data.session.refresh_token,
            email: credentials.email,
          });
        }

        console.debug("[AuthContext] Biometric login successful:", currentUser.email);
        biometricLoginAttemptedRef.current = false;
        return { status: "authenticated" };
      }

      biometricLoginAttemptedRef.current = false;
      return { status: "failed" };
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
      return { status: "failed" };
    }
  };

  const loginWithPin = async (pin: string): Promise<AuthLoginResult> => {
    if (!isDesktop) {
      console.warn("[AuthContext] PIN login only available on desktop");
      return { status: "failed" };
    }

    const normalizedPin = pin.replace(/\D/g, "").slice(0, 12);
    if (normalizedPin.length < 6) {
      return { status: "failed" };
    }

    try {
      const pinEnabled = await platformAdapter.session.isPinEnabled();
      if (!pinEnabled) {
        setCanUsePin(false);
        return { status: "failed" };
      }

      const credentials = await platformAdapter.session.getCredentialsWithPin(normalizedPin);
      if (!credentials) {
        return { status: "failed" };
      }

      const { data, error } = await authSessionService.refreshSession(
        credentials.refreshToken,
      );

      if (error || !data.session) {
        void logIncident({
          severity: "error",
          source: "renderer",
          category: "auth",
          code: isInvalidRefreshError(error)
            ? "AUTH_PIN_INVALID_REFRESH_TOKEN"
            : "AUTH_PIN_REFRESH_FAILED",
          message: "PIN login: refresh failed",
          stack: error instanceof Error ? error.stack : null,
          context: {
            operation: "auth.pin.refresh_session",
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
        return { status: "failed" };
      }

      const mfaRequired = await prepareMfaIfNeeded({
        email: credentials.email,
        rememberMe: true,
        refreshToken: data.session.refresh_token,
      });

      if (mfaRequired) {
        return { status: "mfa_required" };
      }

      const currentUser = await hydrateAuthenticatedSession(data.session);
      if (!currentUser) return { status: "failed" };

      if (data.session.refresh_token) {
        await platformAdapter.session.saveCredentials({
          refreshToken: data.session.refresh_token,
          email: credentials.email,
        });
      }

      setHasSavedCredentials(true);
      setCanUsePin(true);
      return { status: "authenticated" };
    } catch (error) {
      console.error("[AuthContext] PIN login error");
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "auth",
        code: "AUTH_PIN_EXCEPTION",
        message: "PIN login exception",
        stack: error instanceof Error ? error.stack : null,
        context: {
          operation: "auth.pin.exception",
        },
      });
      if (isInvalidRefreshError(error)) {
        await authSessionService.invalidateAuthState({
          navigateToLogin: false,
          reason: "invalid_refresh_token",
        });
      }
      return { status: "failed" };
    }
  };

  const refreshMfaStatus = useCallback(async (): Promise<MfaStatus> => {
    const status = await mfaService.getStatus();
    const factor = status.verifiedFactors.find((item) => item.factorType === "totp") ??
      status.verifiedFactors[0] ??
      null;
    if (status.needsVerification && factor) {
      setPendingMfaState({
        factorId: factor.id,
        factorType: factor.factorType,
        friendlyName: factor.friendlyName,
      });
    } else if (!status.needsVerification) {
      setPendingMfaState(null);
    }
    return status;
  }, [setPendingMfaState]);

  const verifyMfaLogin = useCallback(async (code: string): Promise<AuthLoginResult> => {
    const challenge = pendingMfaRef.current ?? (await mfaService.getLoginChallenge());
    if (!challenge) {
      const { data } = await authSessionService.getSession();
      if (data?.session) {
        const currentUser = await hydrateAuthenticatedSession(data.session, {
          saveDesktopCredentials: true,
        });
        return currentUser ? { status: "authenticated" } : { status: "failed" };
      }
      return { status: "failed" };
    }

    await mfaService.verifyFactor({
      factorId: challenge.factorId,
      code,
    });

    const { data } = await authSessionService.getSession();
    if (!data?.session) return { status: "failed" };

    const currentUser = await hydrateAuthenticatedSession(data.session, {
      saveDesktopCredentials: true,
    });
    if (!currentUser) return { status: "failed" };

    return { status: "authenticated" };
  }, [hydrateAuthenticatedSession]);

  const register = async (
    name: string,
    email: string,
    password: string,
    legalAcceptance: LegalAcceptanceInput,
  ) => {
    try {
      const user = await authService.register(name, email, password, legalAcceptance);
      if (isDesktop) {
        const { data } = await authSessionService.getSession();
        await notifyDesktopAuthState(true, data?.session ?? null);
      }
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
    if (isDemoSession() || user?.role === "demo") {
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          preferences: {
            ...prev.preferences,
            ...preferences,
          },
        };
      });
      return;
    }

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
      await notifyDesktopAuthState(false);
      await authSessionService.invalidateAuthState({
        navigateToLogin: false,
        reason: "manual_logout",
      });
      setPendingMfaState(null);
      pendingMfaContextRef.current = null;
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
    setPendingMfaState(null);
    pendingMfaContextRef.current = null;
    startDemoSession();
    setUser(DEMO_USER);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithBiometric,
        loginWithPin,
        register,
        acceptLegalDocuments,
        updatePreferences,
        logout,
        loginAsDemo,
        isAuthenticated: !!user,
        isLoading,
        canUseBiometric,
        canUsePin,
        hasSavedCredentials,
        pendingMfa,
        verifyMfaLogin,
        refreshMfaStatus,
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
