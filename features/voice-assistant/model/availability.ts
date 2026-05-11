export const isVoiceAssistantAvailable = (input: {
  isDesktop: boolean;
  isAdmin: boolean;
  hasFeature: boolean;
  isFeatureLoading?: boolean;
}): boolean => {
  if (input.isFeatureLoading) return false;
  return input.isDesktop && input.isAdmin && input.hasFeature;
};
