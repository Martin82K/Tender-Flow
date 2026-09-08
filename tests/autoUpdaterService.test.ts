import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => ({ handle: vi.fn(), nsis: vi.fn() }));
vi.mock('electron-updater', () => ({ autoUpdater: {}, NsisUpdater: mocks.nsis }));
vi.mock('electron', () => ({ app: { getVersion: () => '1.9.26', isPackaged: true }, ipcMain: { handle: mocks.handle } }));
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
afterAll(() => { if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor); });
afterEach(() => vi.useRealTimers());
beforeEach(() => { mocks.handle.mockReset(); mocks.nsis.mockReset(); });

const info = (version: string) => ({ version, files: [{ url: 'installer.exe', sha512: 'same-payload-sha512', size: 10 }], releaseDate: '2026-09-07T00:00:00Z' });
const client = (version = '1.9.27', available = true) => {
  const events = new EventEmitter();
  const value = {
    autoDownload: true, autoInstallOnAppQuit: false, forceDevUpdateConfig: false,
    requestHeaders: null, allowDowngrade: false,
    on: events.on.bind(events), emit: events.emit.bind(events),
    checkForUpdates: vi.fn(async () => {
      events.emit(available ? 'update-available' : 'update-not-available', info(version));
      return { updateInfo: info(version), isUpdateAvailable: available };
    }),
    downloadUpdate: vi.fn(async () => ['installer.exe']), quitAndInstall: vi.fn(),
  };
  return value;
};
const create = async (sources: ReturnType<typeof client>[]) => {
  const { AutoUpdaterService } = await import('../desktop/main/services/autoUpdater');
  return new AutoUpdaterService(sources.map(source => () => source));
};

describe('updates from two release repositories', () => {
  it('uses exactly the two trusted public GitHub repositories by default', async () => {
    const primary = client(), legacy = client();
    mocks.nsis.mockImplementationOnce(function () { return primary; });
    mocks.nsis.mockImplementationOnce(function () { return legacy; });
    const { AutoUpdaterService } = await import('../desktop/main/services/autoUpdater');
    const service = new AutoUpdaterService();
    await service.checkForUpdates();
    expect(mocks.nsis.mock.calls).toEqual([
      [{ provider: 'github', owner: 'Martin82K', repo: 'Tender-Flow-Releases', private: false }],
      [{ provider: 'github', owner: 'Martin82K', repo: 'Tender-Flow', private: false }],
    ]);
    expect(primary.requestHeaders).toEqual({ 'Cache-Control': 'no-cache', Pragma: 'no-cache' });
    expect(legacy.allowDowngrade).toBe(false);
  });
  it('keeps macOS in manual update mode', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' });
    try {
      const source = client();
      const service = await create([source]);
      expect(await service.checkForUpdates()).toBe(false);
      await service.downloadUpdate();
      service.quitAndInstall();
      expect(source.checkForUpdates).not.toHaveBeenCalled();
      expect(source.downloadUpdate).not.toHaveBeenCalled();
      expect(source.quitAndInstall).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
    }
  });
  it('checks both sources and downloads only the newer release, comparing versions numerically', async () => {
    const primary = client('1.9.99'), legacy = client('1.10.0');
    const service = await create([primary, legacy]);
    expect(await service.checkForUpdates()).toBe(true);
    expect(primary.checkForUpdates).toHaveBeenCalledOnce();
    expect(legacy.checkForUpdates).toHaveBeenCalledOnce();
    expect(primary.autoDownload).toBe(false);
    expect(primary.downloadUpdate).not.toHaveBeenCalled();
    expect(legacy.downloadUpdate).toHaveBeenCalledOnce();
    expect(legacy.autoInstallOnAppQuit).toBe(true);
  });
  it('prefers the new repository when both versions are equal', async () => {
    const primary = client(), legacy = client();
    await (await create([primary, legacy])).checkForUpdates();
    expect(primary.downloadUpdate).toHaveBeenCalledOnce();
    expect(legacy.downloadUpdate).not.toHaveBeenCalled();
  });
  it.each([0, 1])('continues when source %i is private, empty or unavailable', async (failed) => {
    const sources = [client(), client()];
    sources[failed].checkForUpdates.mockRejectedValue(new Error('HTTP 404'));
    const service = await create(sources);
    expect(await service.checkForUpdates()).toBe(true);
    expect(sources[1 - failed].downloadUpdate).toHaveBeenCalledOnce();
    expect(service.getStatus().status).toBe('downloading');
  });
  it('does not expose a rejected probe event as a global updater error', async () => {
    const primary = client(), legacy = client();
    legacy.checkForUpdates.mockImplementation(async () => { legacy.emit('error', new Error('private')); throw Error('private'); });
    const service = await create([primary, legacy]);
    await service.checkForUpdates();
    legacy.emit('update-not-available', info('1.9.26'));
    expect(service.getStatus().status).toBe('downloading');
  });
  it('shows a recoverable error when neither source can be checked', async () => {
    const sources = [client(), client()];
    sources.forEach(s => s.checkForUpdates.mockRejectedValue(Error('network')));
    const service = await create(sources);
    expect(await service.checkForUpdates()).toBe(false);
    expect(service.getStatus()).toEqual({ status: 'error', error: expect.any(String) });
  });
  it('does not report an update when the only reachable source is current', async () => {
    const primary = client('1.9.26', false), legacy = client();
    legacy.checkForUpdates.mockRejectedValue(Error('404'));
    const service = await create([primary, legacy]);
    expect(await service.checkForUpdates()).toBe(false);
    expect(service.getStatus().status).toBe('not-available');
    expect(primary.downloadUpdate).not.toHaveBeenCalled();
  });
  it.each(['1.9.25', 'invalid'])('never downloads an older or invalid candidate: %s', async version => {
    const source = client(version);
    const service = await create([source]);
    expect(await service.checkForUpdates()).toBe(false);
    expect(source.downloadUpdate).not.toHaveBeenCalled();
  });
  it('honours updater eligibility such as staged rollout or minimum OS version', async () => {
    const source = client('1.10.0', false);
    expect(await (await create([source])).checkForUpdates()).toBe(false);
    expect(source.downloadUpdate).not.toHaveBeenCalled();
  });
  it('selects a stable release above a prerelease and ignores build metadata for precedence', async () => {
    const primary = client('1.10.0-rc.2'), legacy = client('1.10.0+build.1');
    await (await create([primary, legacy])).checkForUpdates();
    expect(legacy.downloadUpdate).toHaveBeenCalledOnce();
  });
  it('coalesces parallel checks and protects an ongoing download from a subsequent check', async () => {
    const source = client();
    source.downloadUpdate.mockImplementation(() => new Promise(() => {}));
    const service = await create([source]);
    await Promise.all([service.checkForUpdates(), service.checkForUpdates()]);
    await service.checkForUpdates();
    expect(source.checkForUpdates).toHaveBeenCalledOnce();
    expect(source.downloadUpdate).toHaveBeenCalledOnce();
  });
  it('allows only the selected source to report progress and trigger a verified restart', async () => {
    const primary = client(), legacy = client();
    const service = await create([primary, legacy]);
    service.quitAndInstall();
    expect(primary.quitAndInstall).not.toHaveBeenCalled();
    await service.checkForUpdates();
    legacy.emit('update-downloaded', info('1.9.99'));
    service.quitAndInstall();
    expect(legacy.quitAndInstall).not.toHaveBeenCalled();
    expect(primary.quitAndInstall).not.toHaveBeenCalled();
    primary.emit('update-downloaded', info('1.9.27'));
    await service.checkForUpdates();
    service.quitAndInstall();
    expect(service.getStatus().status).toBe('downloaded');
    expect(primary.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(primary.checkForUpdates).toHaveBeenCalledOnce();
  });
  it('preserves installation error reporting from the selected source after downloading', async () => {
    const source = client();
    source.downloadUpdate.mockImplementation(async () => {
      source.emit('update-downloaded', info('1.9.27'));
      return ['installer.exe'];
    });
    source.quitAndInstall.mockImplementation(() => source.emit('error', new Error('Installer could not start')));
    const service = await create([source]);
    await service.checkForUpdates();
    await service.downloadUpdate();
    service.quitAndInstall();
    expect(service.getStatus()).toMatchObject({ status: 'error', error: 'Installer could not start' });
  });
  it('does not switch to an older source after a checksum or signature failure', async () => {
    const primary = client('1.10.0'), legacy = client();
    primary.downloadUpdate.mockRejectedValue(Error('checksum mismatch'));
    const service = await create([primary, legacy]);
    await service.checkForUpdates();
    await service.downloadUpdate();
    expect(service.getStatus().status).toBe('error');
    expect(legacy.downloadUpdate).not.toHaveBeenCalled();
    service.quitAndInstall();
    expect(primary.quitAndInstall).not.toHaveBeenCalled();
  });
  it.each([
    new Error('Cannot download "https://example.test/installer.exe", status 404: Not Found'),
    Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }),
    new Error('net::ERR_CONNECTION_RESET'),
  ])('downloads an identical mirror after a transport failure: %s', async error => {
    const primary = client(), legacy = client();
    primary.downloadUpdate.mockRejectedValue(error);
    legacy.downloadUpdate.mockImplementation(async () => {
      legacy.emit('update-downloaded', info('1.9.27'));
      return ['installer.exe'];
    });
    const service = await create([primary, legacy]);
    await service.checkForUpdates();
    await service.downloadUpdate();
    expect(primary.downloadUpdate).toHaveBeenCalledOnce();
    expect(legacy.downloadUpdate).toHaveBeenCalledOnce();
    expect(service.getStatus().status).toBe('downloaded');
    primary.emit('error', error);
    primary.emit('update-downloaded', info('1.9.27'));
    expect(service.getStatus().status).toBe('downloaded');
    service.quitAndInstall();
    expect(primary.quitAndInstall).not.toHaveBeenCalled();
    expect(legacy.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
  it.each(['ERR_CHECKSUM_MISMATCH', 'ERR_UPDATER_INVALID_SIGNATURE', 'ERR_CERT_AUTHORITY_INVALID', 'ENOSPC'])
    ('does not switch even to an identical mirror after %s', async code => {
      const primary = client(), legacy = client();
      primary.downloadUpdate.mockRejectedValue(Object.assign(new Error('blocked'), { code }));
      const service = await create([primary, legacy]);
      await service.checkForUpdates();
      await service.downloadUpdate();
      expect(service.getStatus().status).toBe('error');
      expect(legacy.downloadUpdate).not.toHaveBeenCalled();
    });
  it.each(['different version', 'different checksum'])('rejects a non-equivalent mirror: %s', async difference => {
    const primary = client('1.9.28'), legacy = client(difference === 'different version' ? '1.9.27' : '1.9.28');
    if (difference === 'different checksum') {
      legacy.checkForUpdates.mockResolvedValue({ updateInfo: { ...info('1.9.28'), files: [{ url: 'installer.exe', sha512: 'different-payload', size: 10 }] }, isUpdateAvailable: true });
    }
    primary.downloadUpdate.mockRejectedValue(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));
    const service = await create([primary, legacy]);
    await service.checkForUpdates();
    await service.downloadUpdate();
    expect(service.getStatus().status).toBe('error');
    expect(legacy.downloadUpdate).not.toHaveBeenCalled();
  });
  it('reports an error after both mirrors fail without looping', async () => {
    const sources = [client(), client()];
    sources.forEach(s => s.downloadUpdate.mockRejectedValue(Object.assign(new Error('reset'), { code: 'ECONNRESET' })));
    const service = await create(sources);
    await service.checkForUpdates();
    await service.downloadUpdate();
    expect(service.getStatus().status).toBe('error');
    sources.forEach(s => expect(s.downloadUpdate).toHaveBeenCalledOnce());
  });
  it('allows a healthy source through after another source times out and ignores its late result', async () => {
    vi.useFakeTimers();
    const primary = client(), legacy = client('1.10.0');
    let resolve!: (value: Awaited<ReturnType<typeof legacy.checkForUpdates>>) => void;
    legacy.checkForUpdates.mockImplementation(() => new Promise(r => { resolve = r; }));
    const service = await create([primary, legacy]);
    const check = service.checkForUpdates();
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await check).toBe(true);
    expect(primary.downloadUpdate).toHaveBeenCalledOnce();
    resolve({ updateInfo: info('1.10.0'), isUpdateAvailable: true });
    await Promise.resolve();
    legacy.emit('update-available', info('1.10.0'));
    expect(service.getStatus().info?.version).toBe('1.9.27');
    expect(legacy.downloadUpdate).not.toHaveBeenCalled();
  });
  it('starts fresh requests on retry when both original checks never settle', async () => {
    vi.useFakeTimers();
    const stale = [client(), client()];
    const fresh = [client('1.9.28'), client('1.9.27')];
    stale.forEach(s => s.checkForUpdates.mockImplementation(() => new Promise(() => {})));
    const factories = stale.map((source, index) => vi.fn().mockReturnValueOnce(source).mockReturnValue(fresh[index]));
    const { AutoUpdaterService } = await import('../desktop/main/services/autoUpdater');
    const service = new AutoUpdaterService(factories);
    const first = service.checkForUpdates();
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await first).toBe(false);
    expect(service.getStatus().status).toBe('error');
    expect(await service.checkForUpdates()).toBe(true);
    fresh.forEach(s => expect(s.checkForUpdates).toHaveBeenCalledOnce());
    stale.forEach(s => expect(s.checkForUpdates).toHaveBeenCalledOnce());
    factories.forEach(factory => expect(factory).toHaveBeenCalledTimes(2));
    expect(fresh[0].downloadUpdate).toHaveBeenCalledOnce();
    stale[0].emit('update-downloaded', info('1.9.99'));
    expect(service.getStatus().info?.version).toBe('1.9.28');
  });
  it('does not download before any eligible release has been selected', async () => {
    const source = client();
    await (await create([source])).downloadUpdate();
    expect(source.downloadUpdate).not.toHaveBeenCalled();
  });
});
