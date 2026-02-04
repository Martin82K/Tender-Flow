# Windows Hello setup (desktop)

This document tracks the Windows-specific steps required to build the desktop app with Windows Hello support.

## Prerequisites

- Windows 10/11 machine.
- Visual Studio Build Tools (MSVC) + Windows SDK installed.
- Node.js version compatible with Electron 40.

## Install desktop dependencies

From the repo root:

```bash
cd desktop
npm install
```

This will run `node-gyp rebuild` for the `win-hello` native module.

## Build desktop app

From the repo root:

```bash
npm run desktop:build
```

## Notes

- `win-hello` is a Windows-only native module; installing it on macOS will fail.
- If you see node-gyp errors, verify MSVC Build Tools and Windows SDK are installed.
