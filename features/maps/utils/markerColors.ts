import { MAPS_CONFIG } from '@/config/maps';

export function getMarkerColor(specializations: string[]): string {
  if (!specializations?.length) return MAPS_CONFIG.colors['default'];
  // Use the first specialization for color
  return MAPS_CONFIG.colors[specializations[0]] || MAPS_CONFIG.colors['default'];
}

export function getAllSpecializationColors(): Record<string, string> {
  const { default: _, ...rest } = MAPS_CONFIG.colors;
  return rest;
}
