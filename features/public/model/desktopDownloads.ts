export const DESKTOP_RELEASES_OWNER = "Martin82K";
export const DESKTOP_RELEASES_REPO = "Tender-Flow-Releases";

/** Published installer version. Bump only after Tender-Flow-Releases assets exist. */
export const DESKTOP_DISTRIBUTION_VERSION = "1.9.38";
export const MACOS_DISTRIBUTION_VERSION = "1.9.36";

export const DESKTOP_RELEASES_LATEST_URL =
  `https://github.com/${DESKTOP_RELEASES_OWNER}/${DESKTOP_RELEASES_REPO}/releases/latest`;

const assetUrl = (filename: string, version = DESKTOP_DISTRIBUTION_VERSION): string =>
  `https://github.com/${DESKTOP_RELEASES_OWNER}/${DESKTOP_RELEASES_REPO}/releases/download/v${version}/${filename}`;

export const DESKTOP_DOWNLOADS = [
  {
    id: "windows",
    platform: "Windows",
    label: "Stáhnout pro Windows",
    filename: `Tender-Flow-Setup-${DESKTOP_DISTRIBUTION_VERSION}.exe`,
    href: assetUrl(`Tender-Flow-Setup-${DESKTOP_DISTRIBUTION_VERSION}.exe`),
  },
  {
    id: "macos",
    platform: "macOS (Apple Silicon)",
    label: "Stáhnout pro macOS (Apple Silicon)",
    filename: `Tender-Flow-${MACOS_DISTRIBUTION_VERSION}-arm64.dmg`,
    href: assetUrl(`Tender-Flow-${MACOS_DISTRIBUTION_VERSION}-arm64.dmg`, MACOS_DISTRIBUTION_VERSION),
  },
] as const;

export type DesktopDownload = (typeof DESKTOP_DOWNLOADS)[number];
