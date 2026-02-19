import React, { useEffect, useMemo } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { LandingPage } from "@/components/LandingPage";
import { ForgotPasswordPage } from "@/features/auth/ui/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { RegisterPage } from "@/features/auth/ui/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ui/ResetPasswordPage";
import { navigate } from "@/shared/routing/router";

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
  const redirectTo = useMemo(() => {
    if (pathname === "/" && isDesktop) {
      return "/login";
    }
    if (!AUTH_ROUTES.includes(pathname)) {
      const nextUrl = encodeURIComponent(pathname + search);
      return `/login?next=${nextUrl}`;
    }
    return null;
  }, [pathname, search, isDesktop]);

  useEffect(() => {
    if (!redirectTo) return;
    navigate(redirectTo, { replace: true });
  }, [redirectTo]);

  if (redirectTo) return null;
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
