-- Migration: per_user_templates
-- Date: 2026-01-13
-- Description: Implements per-user template isolation with default template seeding for new users.

-- ============================================================================
-- 1. Create default_templates table (master templates for new users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.default_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on default_templates (read-only for authenticated users)
ALTER TABLE public.default_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read default templates" ON public.default_templates;

CREATE POLICY "Allow authenticated users to read default templates" 
  ON public.default_templates
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Only service_role can modify default templates
GRANT SELECT ON public.default_templates TO authenticated;
GRANT ALL ON public.default_templates TO service_role;

-- ============================================================================
-- 2. Modify templates table to add user_id for isolation
-- ============================================================================

-- Add user_id column (nullable initially for migration)
ALTER TABLE public.templates 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add source_template_id to track which default template this came from
ALTER TABLE public.templates 
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.default_templates(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_default ON public.templates(user_id, is_default);

-- ============================================================================
-- 3. Migrate existing INITIAL_TEMPLATES data to default_templates
-- ============================================================================

INSERT INTO public.default_templates (name, subject, content, is_default, sort_order, created_at, updated_at)
VALUES (
  'MK poptávka standard',
  'Poptávka: {NAZEV_STAVBY} - {KATEGORIE_NAZEV}',
  'Dobrý den,

dovoluji si obrátit se na Vás s poptávkou pro výběrové řízení <b>„{KATEGORIE_NAZEV}" </b>pro akci <b>„{NAZEV_STAVBY}"</b>.

Tato poptávka je do <b>{SOUTEZ_REALIZACE}</b>.
Současně zasílám odkaz na PD a výkaz výměr k ocenění.
{ODKAZ_DOKUMENTACE}

Termín realizace: <b>{TERMIN_REALIZACE}</b>
Termín dokončení stavby: <b>{TERMIN_DOKONCENI}</b>

V cenové nabídce by mělo být mimo jiné zahrnuto:
- splatnost: {SPLATNOST}
- záruka: {ZARUKA}
- zádržné: {POZASTAVKA}
- veškerý vodorovný a svislý přesun hmot
- doprava, likvidace odpadu
- montážní dokumentace včetně schválení zadavatelem
- předložení vzorků ke schválení
- kompletní spojovací materiál (kotvy, nýty, ukončovací lišty, separační pásky, tmely apod.)
- do ceny je nutné započítat vlastní manipulační techniku, manipulátor, jeřáb, montážní plošiny, lešení
- součást dodávky je i prověření požadovaných parametrů konstrukcí

<b>Cenovou nabídku zašlete, prosím, nejpozději do {TERMIN_POPTAVKY} do 12:00 hodin.
Prosím o zpětnou vazbu, zdali budete cenovou nabídku zpracovávat. V případě jejího odmítnutí prosím o oznámení této skutečnosti co nejdříve.</b>
V případě jakýchkoli dotazů mě neváhejte kontaktovat.

Děkuji.',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Copy default templates to all existing users
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  template_record RECORD;
BEGIN
  -- For each existing user
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Check if user already has templates
    IF NOT EXISTS (SELECT 1 FROM public.templates WHERE user_id = user_record.id) THEN
      -- Copy all default templates to this user
      FOR template_record IN SELECT * FROM public.default_templates LOOP
        INSERT INTO public.templates (user_id, name, subject, content, is_default, source_template_id, created_at, updated_at)
        VALUES (
          user_record.id,
          template_record.name,
          template_record.subject,
          template_record.content,
          template_record.is_default,
          template_record.id,
          NOW(),
          NOW()
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 5. Update RLS policies for templates table
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.templates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.templates;

-- Drop new policies if they exist (idempotency)
DROP POLICY IF EXISTS "Users can read own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates;

-- Create new policies with user isolation
CREATE POLICY "Users can read own templates" 
  ON public.templates
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own templates" 
  ON public.templates
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates" 
  ON public.templates
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates" 
  ON public.templates
  FOR DELETE 
  USING (user_id = auth.uid());

-- ============================================================================
-- 6. Create trigger function to copy default templates to new users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.copy_default_templates_to_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Copy all default templates to the new user
  INSERT INTO public.templates (user_id, name, subject, content, is_default, source_template_id, created_at, updated_at)
  SELECT 
    NEW.id,                -- new user's ID
    name,
    subject,
    content,
    is_default,
    id,                    -- source template ID
    NOW(),
    NOW()
  FROM public.default_templates;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Create trigger on auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created_copy_templates ON auth.users;

CREATE TRIGGER on_auth_user_created_copy_templates
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_default_templates_to_new_user();

-- ============================================================================
-- 8. Make user_id NOT NULL now that migration is complete
-- ============================================================================

-- Set user_id to a default value for any remaining NULL values (shouldn't happen but safety check)
UPDATE public.templates 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.templates 
  ALTER COLUMN user_id SET NOT NULL;
