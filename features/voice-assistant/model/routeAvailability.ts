import type { ProjectTab, View } from "@/types";

export const shouldEnableVoiceAssistantForRoute = (input: {
  currentView: View;
  activeProjectTab: ProjectTab | string | null;
}): boolean => {
  return input.currentView !== "project" || input.activeProjectTab !== "pipeline";
};
