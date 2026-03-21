import React, { useEffect, useMemo } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { LandingPage } from "@/components/LandingPage";
import { ForgotPasswordPage } from "@/features/auth/ui/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { RegisterPage } from "@/features/auth/ui/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ui/ResetPasswordPage";
import { navigate } from "@/shared/routing/router";
import { logRuntimeEvent } from "@infra/diagnostics/runtimeDiagnostics";

interface AuthGateProps {
  pathname: string;
  search: string;
  isDesktop: boolean;
}

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/"];

export const AuthGate: React.FC<AuthGateProps> = ({
  pathname,
  search,
  isDesktop,
}) => {
  const shouldRenderDesktopLogin = pathname === "/" && isDesktop;
  const redirectTo = useMemo(() => {
    if (shouldRenderDesktopLogin) return null;
    if (!AUTH_ROUTES.includes(pathname)) {
      const nextUrl = encodeURIComponent(pathname + search);
      return `/login?next=${nextUrl}`;
    }
    return null;
  }, [pathname, search, shouldRenderDesktopLogin]);

  useEffect(() => {
    logRuntimeEvent("auth-gate", "route_decision", {
      pathname,
      search: search ? "[redacted]" : "",
      isDesktop,
      shouldRenderDesktopLogin,
      redirectTo,
    });
  }, [pathname, search, isDesktop, shouldRenderDesktopLogin, redirectTo]);

  useEffect(() => {
    if (!redirectTo) return;
    try {
      navigate(redirectTo, { replace: true });
      logRuntimeEvent("auth-gate", "redirect_triggered", { redirectTo });
    } catch {
      logRuntimeEvent("auth-gate", "redirect_failed_router_navigate", { redirectTo }, "warn");
      // Fallback to direct URL mutation if router navigation fails.
      if (typeof window !== "undefined" && window.location.protocol === "file:") {
        window.location.hash = `#${redirectTo}`;
        logRuntimeEvent("auth-gate", "redirect_fallback_hash", { redirectTo }, "warn");
      } else if (typeof window !== "undefined") {
        window.location.replace(redirectTo);
        logRuntimeEvent("auth-gate", "redirect_fallback_location_replace", { redirectTo }, "warn");
      }
    }
  }, [redirectTo]);

  if (redirectTo) {
    return (
      <AuthLayout>
        <div
          className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-white/70 select-none"
          style={{ WebkitAppRegion: "drag" } as any}
        >
          Přesměrování na přihlášení...
        </div>
      </AuthLayout>
    );
  }
  if (shouldRenderDesktopLogin) {
    return (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    );
  }
  if (pathname === "/") return <LandingPage />;

  return (
    <AuthLayout>
      {pathname === "/login" && <LoginPage />}
      {pathname === "/register" && <RegisterPage />}
      {pathname === "/forgot-password" && <ForgotPasswordPage />}
      {pathname === "/reset-password" && <ResetPasswordPage />}
    </AuthLayout>
  );
};
