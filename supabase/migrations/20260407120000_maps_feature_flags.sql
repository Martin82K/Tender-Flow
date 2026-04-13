-- Add Maps Module Feature Flags
-- Enables map tabs and geocoding features in Tender Flow

-- 1) Feature definitions
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('module_maps', 'Modul Mapy', 'Zobrazení map a geolokace projektů a subdodavatelů', 'Moduly', 5),
  ('maps_recommendations', 'Mapy - Doporučení', 'Automatické doporučení blízkých subdodavatelů podle geolokace', 'Mapy', 62),
  ('maps_routing', 'Mapy - Směrování', 'Výpočet tras a jízdních dob mezi lokalitami', 'Mapy', 63),
  ('maps_bulk_geocode', 'Mapy - Hromadné geokódování', 'Hromadné zpracování geolokací pro kontakty a projekty', 'Mapy', 64)
ON CONFLICT (key) DO NOTHING;

-- 2) module_maps: all tiers (basic map view)
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'module_maps', true),
  ('starter', 'module_maps', true),
  ('pro', 'module_maps', true),
  ('enterprise', 'module_maps', true),
  ('admin', 'module_maps', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- 3) Advanced maps features: pro+ only
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'maps_recommendations', false),
  ('starter', 'maps_recommendations', false),
  ('pro', 'maps_recommendations', true),
  ('enterprise', 'maps_recommendations', true),
  ('admin', 'maps_recommendations', true),
  ('free', 'maps_routing', false),
  ('starter', 'maps_routing', false),
  ('pro', 'maps_routing', true),
  ('enterprise', 'maps_routing', true),
  ('admin', 'maps_routing', true),
  ('free', 'maps_bulk_geocode', false),
  ('starter', 'maps_bulk_geocode', false),
  ('pro', 'maps_bulk_geocode', true),
  ('enterprise', 'maps_bulk_geocode', true),
  ('admin', 'maps_bulk_geocode', true)
ON CONFLICT (tier, feature_key) DO NOTHING;
