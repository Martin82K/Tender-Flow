ALTER TABLE public.contract_amendments
  ADD COLUMN IF NOT EXISTS document_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS document_file_name TEXT,
  ADD COLUMN IF NOT EXISTS document_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS document_size BIGINT;

ALTER TABLE public.contract_amendments
  ADD CONSTRAINT contract_amendments_document_size_check
    CHECK (
      document_size IS NULL
      OR document_size BETWEEN 1 AND 20971520
    ),
  ADD CONSTRAINT contract_amendments_document_mime_type_check
    CHECK (
      document_mime_type IS NULL
      OR document_mime_type IN (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ),
  ADD CONSTRAINT contract_amendments_document_metadata_check
    CHECK (
      document_storage_path IS NULL
      OR (
        NULLIF(BTRIM(document_file_name), '') IS NOT NULL
        AND document_mime_type IS NOT NULL
        AND document_size IS NOT NULL
      )
    );

COMMENT ON COLUMN public.contract_amendments.document_storage_path IS
  'Private contract-documents bucket path for the amendment original.';
COMMENT ON COLUMN public.contract_amendments.document_file_name IS
  'Sanitized original file name of the amendment document.';
COMMENT ON COLUMN public.contract_amendments.document_mime_type IS
  'Validated PDF or DOCX MIME type of the amendment document.';
COMMENT ON COLUMN public.contract_amendments.document_size IS
  'Validated amendment document size in bytes, maximum 20 MiB.';
;
