const NOTIFICATION_PANEL_GAP = 8;
const NOTIFICATION_PANEL_MARGIN = 8;
const NOTIFICATION_PANEL_MAX_WIDTH = 416;

interface AnchorRect {
  bottom: number;
  right: number;
}

export interface NotificationPanelPosition {
  top: number;
  left: number;
}

export const getNotificationPanelPosition = (
  anchorRect: AnchorRect,
  viewportWidth: number,
): NotificationPanelPosition => {
  const panelWidth = Math.min(
    NOTIFICATION_PANEL_MAX_WIDTH,
    Math.max(0, viewportWidth - NOTIFICATION_PANEL_MARGIN * 2),
  );
  const minLeft = NOTIFICATION_PANEL_MARGIN;
  const maxLeft = Math.max(
    minLeft,
    viewportWidth - panelWidth - NOTIFICATION_PANEL_MARGIN,
  );
  const preferredLeft = anchorRect.right - panelWidth;

  return {
    top: anchorRect.bottom + NOTIFICATION_PANEL_GAP,
    left: Math.min(Math.max(preferredLeft, minLeft), maxLeft),
  };
};
