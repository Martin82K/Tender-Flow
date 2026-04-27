-- Migration: PostHog telemetry configuration in app_settings
-- Stores publishable PostHog Project API key + hosts. The key is intentionally
-- public (PostHog projects are secured by allowed origins, not by key secrecy).
-- Citlivé klíče by patřily do app_secrets; phc_* je z principu veřejný a smí
-- ho přečíst kdokoli (RLS na app_settings: SELECT USING (true)).

ALTER TABLE public.app_settings
    ADD COLUMN IF NOT EXISTS posthog_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS posthog_project_key TEXT,
    ADD COLUMN IF NOT EXISTS posthog_api_host TEXT NOT NULL DEFAULT 'https://eu.i.posthog.com',
    ADD COLUMN IF NOT EXISTS posthog_ui_host TEXT NOT NULL DEFAULT 'https://eu.posthog.com';

COMMENT ON COLUMN public.app_settings.posthog_enabled IS
    'Master toggle. Když false, PostHog se v klientovi vůbec neinicializuje.';
COMMENT ON COLUMN public.app_settings.posthog_project_key IS
    'PostHog Project API Key (phc_*). Je veřejný — projekt se zabezpečuje allow-listem domén v PostHog UI.';
COMMENT ON COLUMN public.app_settings.posthog_api_host IS
    'PostHog ingest endpoint. Default = EU cloud (https://eu.i.posthog.com).';
COMMENT ON COLUMN public.app_settings.posthog_ui_host IS
    'PostHog dashboard URL pro deep-linky z klienta (např. session replay).';
