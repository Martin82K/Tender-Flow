import { BrowserWindow, WebContents } from 'electron';

/**
 * IPC Authentication Guard
 *
 * Tracks renderer auth state in the main process and provides guard functions
 * for protecting sensitive IPC handlers from unauthorized access.
 *
 * Threat model: XSS in the renderer could call any exposed IPC channel.
 * This guard ensures sensitive operations require an authenticated session.
 */

// Channels that are allowed BEFORE authentication (needed for login flow)
const PRE_AUTH_CHANNELS = new Set([
  // App info
  'app:getVersion',
  'app:checkForUpdates',
  'app:getUserDataPath',
  // Biometric (needed for biometric login)
  'biometric:isAvailable',
  'biometric:prompt',
  // Session management (needed for auto-login and session cleanup on startup)
  'session:getCredentials',
  'session:getCredentialsWithBiometric',
  'session:isBiometricEnabled',
  // clearCredentials is needed pre-auth: startup clears corrupted sessions before login.
  // Risk: attacker could clear stored credentials (self-destructive, not a data leak).
  'session:clearCredentials',
  // UI utilities (non-destructive)
  'dialog:showMessage',
  'dialog:showError',
  'notification:show',
  // Updater status
  'updater:checkForUpdates',
  'updater:downloadUpdate',
  'updater:quitAndInstall',
  'updater:getStatus',
  // MCP state sync (happens on auth state changes including pre-auth events)
  // Risk: minimal — MCP server is localhost-only and validates tokens against Supabase
  'mcp:setCurrentProject',
  'mcp:setAuthToken',
  'mcp:getStatus',
  // Auth state management (renderer tells main about auth changes)
  'auth:setAuthenticated',
]);

class IpcAuthGuard {
  private _authenticated = false;
  private _mainWindowId: number | null = null;

  setMainWindow(win: BrowserWindow): void {
    this._mainWindowId = win.id;
  }

  setAuthenticated(authenticated: boolean): void {
    this._authenticated = authenticated;
    console.log(`[IpcAuthGuard] Auth state changed: ${authenticated}`);
  }

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  /**
   * Check if a channel is allowed without authentication.
   */
  isPreAuthChannel(channel: string): boolean {
    return PRE_AUTH_CHANNELS.has(channel);
  }

  /**
   * Validates that the IPC call originates from a trusted BrowserWindow.
   * Prevents calls from injected webviews or external windows.
   */
  isTrustedSender(sender: WebContents): boolean {
    const win = BrowserWindow.fromWebContents(sender);
    if (!win) return false;
    // If we know the main window, verify it matches
    if (this._mainWindowId !== null) {
      return win.id === this._mainWindowId;
    }
    // Fallback: accept any known window (before main window is set)
    return true;
  }

  /**
   * Guard function for protected IPC handlers.
   * Throws if the sender is untrusted or the user is not authenticated.
   */
  requireAuth(sender: WebContents, channel?: string): void {
    if (!this.isTrustedSender(sender)) {
      throw new Error(`IPC_AUTH_DENIED: untrusted sender${channel ? ` on ${channel}` : ''}`);
    }
    if (!this._authenticated) {
      throw new Error(`IPC_AUTH_DENIED: not authenticated${channel ? ` for ${channel}` : ''}`);
    }
  }
}

export const ipcAuthGuard = new IpcAuthGuard();
