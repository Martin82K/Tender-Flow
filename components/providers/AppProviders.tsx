import React, { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { FeatureProvider } from '../../context/FeatureContext';
import { UIProvider } from '../../context/UIContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../services/queryClient';
import { useDesktop } from "@/hooks/useDesktop";
import { useTheme } from "@/hooks/useTheme";
import { useLocation } from "@shared/routing/router";
import { ShortUrlRedirect } from "@shared/routing/ShortUrlRedirect";
import { AuthGate } from "@app/views/AuthGate";
import { AppLoadingView } from "@app/views/AppLoadingView";
import { LazyViewErrorBoundary } from "@app/views/LazyViewErrorBoundary";
import { setIncidentContext } from "@infra/diagnostics/incidentLogger";
import { getLegalPage } from "@app/views/LegalPageRouter";

interface AppProvidersProps {
    children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <UIProvider>
                    <FeatureProvider>
                        {children}
                    </FeatureProvider>
                </UIProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
};

const AuthenticatedApp = lazy(() => import("@app/AuthenticatedApp"));

// This component unmounts before AppContent mounts its own theme controls.
const PublicEntry: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updatePreferences } = useAuth();
  const { pathname, search } = useLocation();
  const { isDesktop } = useDesktop();
  useTheme({ user, onPreferencesUpdate: updatePreferences });
  useEffect(() => {
    setIncidentContext({ route: `${pathname}${search}`, platform: isDesktop ? "desktop" : "web" });
  }, [pathname, search, isDesktop]);
  return <>{children}</>;
};

export const AppEntry: React.FC = () => {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { pathname, search } = useLocation();
  const { isDesktop } = useDesktop();
  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");

  if (isLoading && (isAppPath || isAuthenticated)) {
    return <PublicEntry><AppLoadingView authLoading isDataLoading={false} /></PublicEntry>;
  }

  if (pathname.startsWith("/s/")) {
    return <PublicEntry><ShortUrlRedirect code={pathname.split("/s/")[1]} /></PublicEntry>;
  }

  const legalPage = getLegalPage(pathname);
  if (legalPage) return <PublicEntry>{legalPage}</PublicEntry>;

  if (!isAuthenticated) {
    return (
      <PublicEntry>
        <AuthGate pathname={pathname} search={search} isDesktop={isDesktop} />
      </PublicEntry>
    );
  }

  return (
    <LazyViewErrorBoundary onReload={() => window.location.reload()} onLogout={() => void logout()}>
      <Suspense fallback={<AppLoadingView authLoading={false} isDataLoading={false} />}>
        <AuthenticatedApp />
      </Suspense>
    </LazyViewErrorBoundary>
  );
};
