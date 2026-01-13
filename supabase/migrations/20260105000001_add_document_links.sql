-- Add document_links column to projects table to store multiple document links as JSON
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS document_links JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN projects.document_links IS 'List of document links with metadata (label, url, date, etc.)';
