import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { User } from "../types";
import { authService } from "../services/authService";
import {
  isDemoSession,
  DEMO_USER,
  endDemoSession,
  startDemoSession,
} from "../services/demoData";
import { isDesktop, platformAdapter } from "../services/platformAdapter";
import { supabase } from "../services/supabase";
import { navigate } from "../components/routing/router";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updatePreferences: (preferences: any) => Promise<void>;
  logout: () => void;
  loginAsDemo: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  canUseBiometric: boolean;
  hasSavedCredentials: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const contextId = Math.floor(Math.random() * 100000);
console.log("[AuthContext] Module evaluated. ContextID:", contextId);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  console.log("[AuthContext] AuthProvider rendering. ContextID:", contextId);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const authEventRef = useRef(false);
  const lastHydratedTokenRef = useRef<string | null>(null);
  const biometricLoginAttemptedRef = useRef(false);

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

        console.log("[AuthContext] Biometric check:", { available, enabled, hasCredentials: !!credentials });
      } catch (e) {
        console.warn("[AuthContext] Failed to check biometric availability:", e);
      }
    };

    checkBiometricAndValidateCredentials();
  }, []);

  useEffect(() => {
    console.log("AuthContext: Initializing...");

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
      const raw = window.localStorage.getItem('crm-auth-token');
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
          window.localStorage.removeItem('crm-auth-token');
          window.localStorage.removeItem('crm-user-cache');
        }
      }
    } catch (e) {
      // If we can't parse the session, it's corrupted - clear it
      console.warn('[AuthContext] Could not parse stored session, clearing:', e);
      try {
        window.localStorage.removeItem('crm-auth-token');
        window.localStorage.removeItem('crm-user-cache');
      } catch { /* ignore */ }
    }

    // Priority 1: Demo session
    if (isDemoSession()) {
      console.log("AuthContext: Demo session detected");
      setUser(DEMO_USER);
      setIsLoading(false);
      return;
    }

    // Priority 2: Try biometric auto-login on desktop (if enabled and no active session)
    const tryBiometricAutoLogin = async () => {
      if (!isDesktop || biometricLoginAttemptedRef.current) return false;

      try {
        const [biometricEnabled, credentials] = await Promise.all([
          platformAdapter.session.isBiometricEnabled(),
          platformAdapter.session.getCredentials(),
        ]);

        if (!biometricEnabled || !credentials) {
          console.log("[AuthContext] Auto-login: No biometric or credentials");
          return false;
        }

        // Validate refresh token format before using it
        if (typeof credentials.refreshToken !== 'string' || credentials.refreshToken.length < 10) {
          console.warn("[AuthContext] Auto-login: Invalid refresh token format, clearing");
          await platformAdapter.session.clearCredentials();
          setHasSavedCredentials(false);
          return false;
        }

        console.log("[AuthContext] Auto-login: Prompting for biometric...");
        biometricLoginAttemptedRef.current = true;

        const success = await platformAdapter.biometric.prompt("Odemknout Tender Flow");
        if (!success) {
          console.log("[AuthContext] Auto-login: Biometric cancelled");
          biometricLoginAttemptedRef.current = false;
          setHasSavedCredentials(true);
          setCanUseBiometric(true);
          return false;
        }

        // Clear any existing (potentially corrupted) session before refreshing
        // This ensures we always use a fresh session from the refresh token
        console.log("[AuthContext] Auto-login: Clearing old session before refresh...");
        try {
          window.localStorage.removeItem('crm-auth-token');
        } catch { /* ignore */ }

        // Refresh session with stored token - this creates a completely fresh session
        console.log("[AuthContext] Auto-login: Refreshing session with stored token...");
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: credentials.refreshToken,
        });

        if (error || !data.session) {
          console.error("[AuthContext] Auto-login: Session refresh failed", error);
          await platformAdapter.session.clearCredentials();
          setHasSavedCredentials(false);
          biometricLoginAttemptedRef.current = false;
          return false;
        }

        console.log("[AuthContext] Auto-login: Session refreshed successfully");

        // Update stored credentials with new refresh token
        await platformAdapter.session.saveCredentials({
          refreshToken: data.session.refresh_token,
          email: credentials.email,
        });

        const currentUser = await authService.getUserFromSession(data.session);
        if (currentUser) {
          setUser(currentUser);
          setHasSavedCredentials(true);
          setCanUseBiometric(true);
          setIsLoading(false);
          console.log("[AuthContext] Auto-login: Success!", currentUser.email);
          biometricLoginAttemptedRef.current = false;
          return true;
        }

        biometricLoginAttemptedRef.current = false;
        return false;
      } catch (e) {
        console.error("[AuthContext] Auto-login error:", e);
        // Clear potentially corrupted credentials
        try {
          await platformAdapter.session.clearCredentials();
          setHasSavedCredentials(false);
          window.localStorage.removeItem('crm-auth-token');
          window.localStorage.removeItem('crm-user-cache');
        } catch { /* ignore */ }
        biometricLoginAttemptedRef.current = false;
        return false;
      }
    };

    // Listen for auth changes first (so INITIAL_SESSION can hydrate even if getCurrentUser hangs)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "[AuthContext] Auth State Change:",
        event,
        session?.user?.email
      );
      authEventRef.current = true;
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
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
            const currentUser = await authService.getUserFromSession(session);
            if (currentUser) {
              setUser(currentUser);
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
        } else if (event === "INITIAL_SESSION") {
          // No session on initial load - not authenticated
          setIsLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        console.warn("[AuthContext] Received SIGNED_OUT event from Supabase");
        setUser(null);
        setIsLoading(false);
      }
    });

    // Best-effort active session load, but never block UI indefinitely.
    const initTimeoutMs = 8000;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setIsLoading(false);
      console.log("AuthContext: Loading finished");
    };
    const timer = window.setTimeout(() => {
      console.warn(`[AuthContext] initAuth timed out (${initTimeoutMs}ms)`);
      finish();
    }, initTimeoutMs);

    (async () => {
      try {
        // First try biometric auto-login on desktop
        const biometricSuccess = await tryBiometricAutoLogin();
        if (biometricSuccess) {
          window.clearTimeout(timer);
          return; // Already logged in via biometric
        }

        // Desktop: Try to restore session from secure storage with Biometrics
        if (isDesktop && platformAdapter.session) {
          console.log("[AuthContext] Checking desktop secure storage...");
          const creds = await platformAdapter.session.getCredentials();

          if (creds?.refreshToken) {
            // Validate refresh token is a proper string before using it
            if (typeof creds.refreshToken !== 'string' || creds.refreshToken.length < 10) {
              console.warn("[AuthContext] Invalid refresh token format, clearing credentials");
              await platformAdapter.session.clearCredentials();
              setHasSavedCredentials(false);
            } else {
              console.log("[AuthContext] Found stored credentials, checking biometric status...");
              let biometricEnabled = false;
              try {
                biometricEnabled = await platformAdapter.session.isBiometricEnabled();
                console.log("[AuthContext] Biometric enabled status:", biometricEnabled);
              } catch (e) {
                console.error("[AuthContext] Failed to check biometric status:", e);
              }

              let authenticated = true;
              if (biometricEnabled) {
                console.log("[AuthContext] Biometric enabled, prompting...");
                authenticated = await platformAdapter.biometric.prompt("Přihlášení do Tender Flow");
              } else {
                console.log("[AuthContext] Biometric disabled, auto-login");
              }

              if (authenticated) {
                console.log("[AuthContext] Restoring session from refresh token...");
                try {
                  // Clear any existing (potentially corrupted) localStorage session first
                  // This ensures we get a completely fresh session from the refresh token
                  try {
                    window.localStorage.removeItem('crm-auth-token');
                  } catch { /* ignore */ }

                  const { data, error } = await supabase.auth.refreshSession({
                    refresh_token: creds.refreshToken,
                  });

                  if (!error && data.session) {
                    console.log("[AuthContext] Session restored successfully");

                    // Update stored credentials with new refresh token
                    await platformAdapter.session.saveCredentials({
                      refreshToken: data.session.refresh_token,
                      email: creds.email,
                    });

                    const user = await authService.getUserFromSession(data.session);
                    if (user) {
                      setUser(user);
                      setIsLoading(false);
                      window.clearTimeout(timer);
                      return;
                    }
                  } else {
                    console.warn("[AuthContext] Failed to restore session:", error);
                    // Clear invalid credentials to prevent retry loops
                    await platformAdapter.session.clearCredentials();
                    setHasSavedCredentials(false);
                    // Also clear localStorage session data
                    try {
                      window.localStorage.removeItem('crm-auth-token');
                      window.localStorage.removeItem('crm-user-cache');
                    } catch { /* ignore */ }
                  }
                } catch (sessionError) {
                  console.error("[AuthContext] Session restore threw error:", sessionError);
                  // Clear corrupted credentials
                  await platformAdapter.session.clearCredentials();
                  setHasSavedCredentials(false);
                  try {
                    window.localStorage.removeItem('crm-auth-token');
                    window.localStorage.removeItem('crm-user-cache');
                  } catch { /* ignore */ }
                }
              }
            }
          }
        }

        const currentUser = await authService.getCurrentUser();
        console.log("AuthContext: User loaded", currentUser?.email);
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
      // Cleanup
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    try {
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

      // Save session for biometric unlock (desktop only) - only if rememberMe is enabled
      if (isDesktop && rememberMe) {
        const { data } = await supabase.auth.getSession();
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
      console.log("[AuthContext] Biometric login already in progress");
      return false;
    }

    biometricLoginAttemptedRef.current = true;

    try {
      // Check if biometric is enabled and credentials exist
      const [biometricEnabled, credentials] = await Promise.all([
        platformAdapter.session.isBiometricEnabled(),
        platformAdapter.session.getCredentials(),
      ]);

      if (!biometricEnabled || !credentials) {
        console.log("[AuthContext] Biometric not enabled or no saved credentials");
        biometricLoginAttemptedRef.current = false;
        return false;
      }

      // Prompt for biometric authentication
      const success = await platformAdapter.biometric.prompt("Přihlášení do Tender Flow");
      if (!success) {
        console.log("[AuthContext] Biometric authentication cancelled or failed");
        biometricLoginAttemptedRef.current = false;
        return false;
      }

      // Use refresh token to get new session
      console.log("[AuthContext] Biometric success, refreshing session...");
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: credentials.refreshToken,
      });

      if (error || !data.session) {
        console.error("[AuthContext] Failed to refresh session:", error);
        // Clear invalid credentials
        await platformAdapter.session.clearCredentials();
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
      const currentUser = await authService.getUserFromSession(data.session);
      if (currentUser) {
        setUser(currentUser);
        console.log("[AuthContext] Biometric login successful:", currentUser.email);
        biometricLoginAttemptedRef.current = false;
        return true;
      }

      biometricLoginAttemptedRef.current = false;
      return false;
    } catch (error) {
      console.error("[AuthContext] Biometric login error:", error);
      biometricLoginAttemptedRef.current = false;
      return false;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const user = await authService.register(name, email, password);
      setUser(user);
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const updatePreferences = async (preferences: any) => {
    try {
      const updatedUser = await authService.updateUserPreferences(preferences);
      setUser(updatedUser);
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
      // Clear stored session credentials (desktop)
      if (isDesktop) {
        await platformAdapter.session.clearCredentials();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // Always clear local session even if server request fails
      setUser(null);
      // Navigate to login page - use navigate for SPA routing (works better with Electron)
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
