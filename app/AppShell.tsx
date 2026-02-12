import React from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppContent } from "@app/AppContent";

export const AppShell: React.FC = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};
