import { APP_VERSION } from "@/config/version";

export const DESKTOP_RELEASES_OWNER = "Martin82K";
export const DESKTOP_RELEASES_REPO = "Tender-Flow-Releases";

export const DESKTOP_RELEASES_LATEST_URL =
  `https://github.com/${DESKTOP_RELEASES_OWNER}/${DESKTOP_RELEASES_REPO}/releases/latest`;

const assetUrl = (filename: string): string =>
  `https://github.com/${DESKTOP_RELEASES_OWNER}/${DESKTOP_RELEASES_REPO}/releases/download/v${APP_VERSION}/${filename}`;

export const DESKTOP_DOWNLOADS = [
  {
    id: "windows",
    platform: "Windows",
    label: "Stáhnout pro Windows",
    filename: `Tender-Flow-Setup-${APP_VERSION}.exe`,
    href: assetUrl(`Tender-Flow-Setup-${APP_VERSION}.exe`),
  },
  {
    id: "macos",
    platform: "macOS",
    label: "Stáhnout pro macOS",
    filename: `Tender-Flow-${APP_VERSION}-arm64.dmg`,
    href: assetUrl(`Tender-Flow-${APP_VERSION}-arm64.dmg`),
  },
] as const;

export type DesktopDownload = (typeof DESKTOP_DOWNLOADS)[number];
