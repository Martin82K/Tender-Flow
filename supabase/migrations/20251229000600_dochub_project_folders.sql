-- Migration: dochub_project_folders
-- Date: 2025-12-29
-- Description: Stores provider item IDs/webUrls for frequently used DocHub folders.

CREATE TABLE IF NOT EXISTS public.dochub_project_folders (
  project_id VARCHAR(36) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gdrive', 'onedrive')),
  kind TEXT NOT NULL, -- e.g. 'pd','tenders','contracts','realization','archive','tender','supplier','supplier_email','supplier_offer'
  key TEXT, -- e.g. demand_category_id or subcontractor_id, or composite like `${categoryId}:${subcontractorId}`
  item_id TEXT NOT NULL,
  drive_id TEXT,
  web_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (project_id, provider, kind, key)
);

ALTER TABLE public.dochub_project_folders ENABLE ROW LEVEL SECURITY;
-- No policies; only service_role via edge functions.

