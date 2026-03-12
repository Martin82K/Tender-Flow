import React from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppContent } from "@app/AppContent";
import { CookieConsentBanner } from "@/features/public/ui/CookieConsentBanner";

export const AppShell: React.FC = () => {
  return (
    <AppProviders>
      <AppContent />
      <CookieConsentBanner />
    </AppProviders>
  );
};
