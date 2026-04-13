import { MAPS_CONFIG } from '@/config/maps';

/**
 * Extended palette of 20 visually distinct colors for dynamic assignment.
 * Used when specializations are selected in filters — each gets a unique color.
 */
const DYNAMIC_PALETTE = [
  '#EF4444', // red
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#E11D48', // rose
  '#A855F7', // purple
  '#0EA5E9', // sky
  '#D946EF', // fuchsia
  '#22C55E', // green
  '#EAB308', // yellow
  '#78716C', // stone
  '#64748B', // slate
  '#DC2626', // red-600
];

/** Static color for a specialization (legacy, uses config map) */
export function getMarkerColor(specializations: string[]): string {
  if (!specializations?.length) return MAPS_CONFIG.colors['default'];
  return MAPS_CONFIG.colors[specializations[0]] || MAPS_CONFIG.colors['default'];
}

/** All statically defined specialization colors (legacy) */
export function getAllSpecializationColors(): Record<string, string> {
  const { default: _, ...rest } = MAPS_CONFIG.colors;
  return rest;
}

/**
 * Build a dynamic color map: each selected specialization gets a unique color
 * from the palette, assigned in the order they appear in the list.
 */
export function buildDynamicColorMap(selectedSpecs: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  selectedSpecs.forEach((spec, i) => {
    map[spec] = DYNAMIC_PALETTE[i % DYNAMIC_PALETTE.length];
  });
  return map;
}

/**
 * Get the marker color for a subcontractor based on dynamic color map.
 * Uses the first matching specialization from the active filter.
 * Falls back to default gray if no match.
 */
export function getDynamicMarkerColor(
  specializations: string[],
  colorMap: Record<string, string>,
): string {
  if (!specializations?.length) return MAPS_CONFIG.colors['default'];
  for (const spec of specializations) {
    if (colorMap[spec]) return colorMap[spec];
  }
  return MAPS_CONFIG.colors['default'];
}
