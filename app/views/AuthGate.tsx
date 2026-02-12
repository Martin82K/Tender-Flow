import React from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { LandingPage } from "@/components/LandingPage";
import { ForgotPasswordPage } from "@/features/auth/ui/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { RegisterPage } from "@/features/auth/ui/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ui/ResetPasswordPage";
import { DesktopWelcome } from "@/components/desktop";
import { navigate } from "@/shared/routing/router";

interface AuthGateProps {
  pathname: string;
  search: string;
  isDesktop: boolean;
  showWelcome: boolean;
  dismissWelcome: () => void;
  selectFolder: () => void | Promise<void>;
}

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/"];

export const AuthGate: React.FC<AuthGateProps> = ({
  pathname,
  search,
  isDesktop,
  showWelcome,
  dismissWelcome,
  selectFolder,
}) => {
  if (pathname === "/") {
    if (isDesktop) {
      if (showWelcome) {
        return (
          <div className="fixed inset-0 bg-slate-950">
            <DesktopWelcome
              onClose={() => {
                dismissWelcome();
                navigate("/login", { replace: true });
              }}
              onSelectFolder={selectFolder}
            />
          </div>
        );
      }
      navigate("/login", { replace: true });
      return null;
    }
    return <LandingPage />;
  }

  if (!AUTH_ROUTES.includes(pathname)) {
    const nextUrl = encodeURIComponent(pathname + search);
    navigate(`/login?next=${nextUrl}`, { replace: true });
    return null;
  }

  return (
    <AuthLayout>
      {pathname === "/login" && <LoginPage />}
      {pathname === "/register" && <RegisterPage />}
      {pathname === "/forgot-password" && <ForgotPasswordPage />}
      {pathname === "/reset-password" && <ResetPasswordPage />}
    </AuthLayout>
  );
};
