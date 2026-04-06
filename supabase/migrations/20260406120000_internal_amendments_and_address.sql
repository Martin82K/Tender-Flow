-- Internal amendments (independent from investor amendments)
CREATE TABLE IF NOT EXISTS project_internal_amendments (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(255),
    price DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE project_internal_amendments ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as project_amendments)
CREATE POLICY "Users can view internal amendments for their projects"
    ON project_internal_amendments FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
            UNION
            SELECT project_id FROM project_shares WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert internal amendments for their projects"
    ON project_internal_amendments FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
            UNION
            SELECT project_id FROM project_shares WHERE user_id = auth.uid() AND permission = 'edit'
        )
    );

CREATE POLICY "Users can update internal amendments for their projects"
    ON project_internal_amendments FOR UPDATE
    USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
            UNION
            SELECT project_id FROM project_shares WHERE user_id = auth.uid() AND permission = 'edit'
        )
    );

CREATE POLICY "Users can delete internal amendments for their projects"
    ON project_internal_amendments FOR DELETE
    USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
            UNION
            SELECT project_id FROM project_shares WHERE user_id = auth.uid() AND permission = 'edit'
        )
    );

-- Address column on projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;
