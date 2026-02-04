# Windows Hello setup (desktop)

This document tracks the Windows-specific steps required to build the desktop app with Windows Hello support.

## Prerequisites

- Windows 10/11 machine.
- Node.js version compatible with Electron 40.

## Install desktop dependencies

From the repo root:

```bash
npm run desktop:install
```

This installs the `win-hello` package with prebuilt native binaries (no node-gyp compilation needed).

## Build desktop app

From the repo root:

```bash
npm run desktop:build:win
```

## Notes

- `win-hello` ships with prebuilt `.node` binaries, so Visual Studio Build Tools are NOT required for installation.
- `win-hello` is a Windows-only native module; installing it on macOS will skip the Windows Hello functionality.
- Windows Hello prompt is tied to the active Electron window (native window handle is passed automatically).
- If biometrics are not available, Windows can fall back to a Hello PIN.
