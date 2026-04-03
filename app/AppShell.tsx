import React from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppContent } from "@app/AppContent";
import { CookieConsentBanner } from "@/features/public/ui/CookieConsentBanner";
import { ToastProvider } from "@features/notifications/context/ToastContext";
import { ToastContainer } from "@features/notifications/ui/ToastContainer";

export const AppShell: React.FC = () => {
  return (
    <AppProviders>
      <ToastProvider>
        <AppContent />
        <ToastContainer />
        <CookieConsentBanner />
      </ToastProvider>
    </AppProviders>
  );
};
