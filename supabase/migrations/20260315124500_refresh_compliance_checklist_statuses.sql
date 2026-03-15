-- Refresh compliance checklist bootstrap statuses to match the implemented state.

INSERT INTO public.compliance_checklist_items (id, area, title, description, status, priority)
VALUES
  (
    'breach-register',
    'Incidenty',
    'Breach register',
    'Runtime incident lze odděleně převést na GDPR breach case s právní klasifikací, timeline a exportem podkladů.',
    'implemented',
    'P0'
  ),
  (
    'cookie-consent',
    'Souhlasy',
    'Cookie consent vrstva',
    'Cookie consent manager a blokace nepovinné analytiky jsou zavedené v produkčním flow.',
    'implemented',
    'P1'
  ),
  (
    'mfa',
    'Přístupy',
    'MFA enforcement pro adminy',
    'Admin účty mají MFA enrollment flow a AAL2 enforcement pro citlivé admin sekce.',
    'implemented',
    'P1'
  )
ON CONFLICT (id) DO UPDATE
SET
  area = EXCLUDED.area,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  updated_at = timezone('utc'::text, now());
