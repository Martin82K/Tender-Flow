import { BrowserWindow, WebContents, app } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

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
  // Auth state management. Positive auth transitions are verified by main.
  'auth:setAuthenticated',
]);

type PathAccessMode = 'read' | 'write';

interface RendererSessionCandidate {
  accessToken?: string | null;
  expiresAt?: number | null;
}

const APP_AUTH_TOKEN_KEY = 'crm-auth-token';
const SUPABASE_AUTH_TOKEN_KEY_PATTERN = /^sb-.+-auth-token$/;

const toAbsolutePath = (targetPath: string): string => path.resolve(targetPath);

const isPathInsideRoot = (targetPath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

class IpcAuthGuard {
  private _authenticated = false;
  private _mainWindowId: number | null = null;
  private _userGrantedRoots = new Set<string>();

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
   * Renderer logout can clear the main auth gate, but renderer login must be
   * backed by a session token that main verifies independently.
   */
  async setAuthenticatedFromRenderer(
    sender: WebContents,
    authenticated: boolean,
    session?: RendererSessionCandidate | null,
  ): Promise<void> {
    if (!this.isTrustedSender(sender)) {
      throw new Error('IPC_AUTH_DENIED: untrusted sender for auth:setAuthenticated');
    }

    if (!authenticated) {
      this.setAuthenticated(false);
      return;
    }

    await this.verifyRendererSession(sender, session);
    this.setAuthenticated(true);
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

  async addUserGrantedRoot(rootPath: string): Promise<string> {
    if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
      throw new Error('Access denied: invalid root path');
    }

    const realRoot = await fs.realpath(toAbsolutePath(rootPath.trim()));
    const stat = await fs.stat(realRoot);
    if (!stat.isDirectory()) {
      throw new Error('Access denied: granted root is not a directory');
    }

    this._userGrantedRoots.add(realRoot);
    return realRoot;
  }

  async ensurePathAllowed(requestedPath: string, mode: PathAccessMode): Promise<string> {
    if (typeof requestedPath !== 'string' || requestedPath.trim().length === 0) {
      throw new Error('Access denied: invalid path');
    }

    const normalizedPath = toAbsolutePath(requestedPath.trim());
    const allowedRoots = await this.getAllowedRoots();
    const isInsideAllowedRoot = (targetPath: string): boolean =>
      allowedRoots.some((root) => isPathInsideRoot(targetPath, root));

    if (mode === 'read') {
      const realPath = await fs.realpath(normalizedPath);
      if (!isInsideAllowedRoot(realPath)) {
        throw new Error(`Access denied: path is outside allowed roots (${realPath})`);
      }
      return realPath;
    }

    const existingTarget = await this.realpathIfExists(normalizedPath);
    if (existingTarget) {
      if (!isInsideAllowedRoot(existingTarget)) {
        throw new Error(`Access denied: path is outside allowed roots (${existingTarget})`);
      }
      return existingTarget;
    }

    let parentDir = path.dirname(normalizedPath);
    while (parentDir !== path.dirname(parentDir)) {
      const realParent = await this.realpathIfExists(parentDir);
      if (realParent) {
        if (!isInsideAllowedRoot(realParent)) {
          throw new Error(`Access denied: path is outside allowed roots (${realParent})`);
        }

        const unresolvedTail = path.relative(parentDir, normalizedPath);
        const resolvedTarget = path.resolve(realParent, unresolvedTail);
        if (!isPathInsideRoot(resolvedTarget, realParent) || !isInsideAllowedRoot(resolvedTarget)) {
          throw new Error(`Access denied: path is outside allowed roots (${resolvedTarget})`);
        }
        return resolvedTarget;
      }
      parentDir = path.dirname(parentDir);
    }

    throw new Error('Access denied: unable to resolve path within allowed roots');
  }

  resetForTest(): void {
    this._authenticated = false;
    this._mainWindowId = null;
    this._userGrantedRoots.clear();
  }

  private async getAllowedRoots(): Promise<string[]> {
    const rootCandidates = [
      this.safeAppPath('userData'),
      os.tmpdir(),
      ...this._userGrantedRoots,
    ].filter((root): root is string => Boolean(root));

    const realRoots = await Promise.all(
      rootCandidates.map(async (root) => this.realpathIfExists(toAbsolutePath(root))),
    );

    return Array.from(new Set(realRoots.filter((root): root is string => Boolean(root))));
  }

  private safeAppPath(name: Parameters<typeof app.getPath>[0]): string | null {
    try {
      return app.getPath(name);
    } catch {
      return null;
    }
  }

  private async realpathIfExists(targetPath: string): Promise<string | null> {
    try {
      return await fs.realpath(targetPath);
    } catch {
      return null;
    }
  }

  private async verifyRendererSession(
    sender: WebContents,
    sessionCandidate?: RendererSessionCandidate | null,
  ): Promise<void> {
    const session = this.normalizeRendererSessionCandidate(sessionCandidate)
      ?? await this.getRendererSessionCandidate(sender);
    const accessToken = session?.accessToken;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('IPC_AUTH_DENIED: missing verifiable renderer session');
    }

    if (session.expiresAt && session.expiresAt * 1000 <= Date.now()) {
      throw new Error('IPC_AUTH_DENIED: renderer session expired');
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('IPC_AUTH_DENIED: session verifier is not configured');
    }

    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('IPC_AUTH_DENIED: renderer session verification failed');
    }
  }

  private normalizeRendererSessionCandidate(input?: RendererSessionCandidate | null): RendererSessionCandidate | null {
    if (!input || typeof input !== 'object') return null;
    if (typeof input.accessToken !== 'string' || input.accessToken.trim().length === 0) return null;
    return {
      accessToken: input.accessToken,
      expiresAt: typeof input.expiresAt === 'number' ? input.expiresAt : null,
    };
  }

  private async getRendererSessionCandidate(sender: WebContents): Promise<RendererSessionCandidate | null> {
    const script = `
      (() => {
        const pickToken = (value) => {
          if (!value || typeof value !== 'object') return null;
          const candidates = [
            value,
            value.currentSession,
            value.session,
            value.data && value.data.session
          ].filter(Boolean);
          for (const candidate of candidates) {
            if (candidate && typeof candidate.access_token === 'string') {
              return {
                accessToken: candidate.access_token,
                expiresAt: typeof candidate.expires_at === 'number' ? candidate.expires_at : null
              };
            }
          }
          return null;
        };

        const isAuthStorageKey = (key) =>
          key === ${JSON.stringify(APP_AUTH_TOKEN_KEY)} ||
          ${SUPABASE_AUTH_TOKEN_KEY_PATTERN.toString()}.test(key);

        const storages = [localStorage, sessionStorage].filter(Boolean);
        for (const storage of storages) {
          for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (!key || !isAuthStorageKey(key)) continue;
            try {
              const token = pickToken(JSON.parse(storage.getItem(key) || '{}'));
              if (token) return token;
            } catch {
              continue;
            }
          }
        }
        return null;
      })();
    `;

    const result = await sender.executeJavaScript(script, true);
    if (!result || typeof result !== 'object') return null;
    return result as RendererSessionCandidate;
  }
}

export const ipcAuthGuard = new IpcAuthGuard();
