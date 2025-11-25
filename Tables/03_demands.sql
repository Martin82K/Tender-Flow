-- Demand Categories (Budget Items)
CREATE TABLE demand_categories (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    budget_display VARCHAR(100), -- Legacy display string e.g. "~1.5M Kč"
    sod_budget DECIMAL(15, 2), -- Revenue from investor
    plan_budget DECIMAL(15, 2), -- Target internal cost
    status VARCHAR(50) CHECK (status IN ('open', 'negotiating', 'closed', 'sod')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
