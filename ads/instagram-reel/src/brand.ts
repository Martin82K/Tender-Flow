/**
 * Classic dark product surfaces from `index.css` (`html.dark`)
 * matching the public app screenshots, plus the orange TF logo family
 * for the reel header/CTA.
 * Keep this file free of Remotion imports so tests can load it without the renderer.
 */
export const brand = {
  bg: "#0f172a",
  surface: "#0f172a",
  surfaceMuted: "#1e293b",
  deep: "#020617",
  card: "#111827",
  text: "#f8fafc",
  text2: "#cbd5e1",
  muted: "#94a3b8",
  muted2: "#64748b",
  line: "#1e293b",
  line2: "#334155",
  primary: "#6580fb",
  primarySoft: "rgba(101, 128, 251, 0.18)",
  violet: "#a78bfa",
  violetSoft: "rgba(139, 92, 246, 0.28)",
  accent: "#ff8a33",
  accentHi: "#FF9E3D",
  accentMid: "#F26B1A",
  accentDeep: "#B03A05",
  apricot: "#fb923c",
  apricotSoft: "#fdba74",
  green: "#34d399",
  greenStrong: "#10b981",
  blue: "#60a5fa",
  amber: "#fbbf24",
  rose: "#fb7185",
  inkOnAccent: "#0b1220",
  inkOnPrimary: "#ffffff",
} as const;

export const fontFamily =
  'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
