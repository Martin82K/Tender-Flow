import React from "react";
import { AppContent } from "@app/AppContent";
import { HelpProvider } from "@features/help";
import { HelpOverlay } from "@features/help/ui/HelpOverlay";

export default function AuthenticatedApp() {
  return (
    <HelpProvider>
      <AppContent />
      <HelpOverlay />
    </HelpProvider>
  );
}
