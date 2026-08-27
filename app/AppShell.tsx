import React, { useEffect } from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppContent } from "@app/AppContent";
import { CookieConsentBanner } from "@/features/public/ui/CookieConsentBanner";
import { ToastProvider } from "@features/notifications/context/ToastContext";
import { ToastContainer } from "@features/notifications/ui/ToastContainer";
import { HelpProvider } from "@features/help";
import { HelpOverlay } from "@features/help/ui/HelpOverlay";
import { SeoManager } from "@/shared/seo/SeoManager";
import { cleanupRetiredFeatureStorage } from "@/shared/maintenance/retiredFeatureStorage";
import { MicrosoftConnectionCallback } from "@app/MicrosoftConnectionCallback";

export const AppShell: React.FC = () => {
  useEffect(() => {
    cleanupRetiredFeatureStorage(window.localStorage);
  }, []);

  return (
    <AppProviders>
      <MicrosoftConnectionCallback />
      <SeoManager />
      <ToastProvider>
        <HelpProvider>
          <AppContent />
          <HelpOverlay />
        </HelpProvider>
        <ToastContainer />
        <CookieConsentBanner />
      </ToastProvider>
    </AppProviders>
  );
};
