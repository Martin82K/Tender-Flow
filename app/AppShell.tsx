import React, { useEffect } from "react";
import { AppProviders, AppEntry } from "@/components/providers/AppProviders";
import { CookieConsentBanner } from "@/features/public/ui/CookieConsentBanner";
import { ToastProvider } from "@features/notifications/context/ToastContext";
import { ToastContainer } from "@features/notifications/ui/ToastContainer";
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
        <AppEntry />
        <ToastContainer />
        <CookieConsentBanner />
      </ToastProvider>
    </AppProviders>
  );
};
