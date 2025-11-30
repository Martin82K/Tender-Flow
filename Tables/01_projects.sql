-- Projects Table
CREATE TABLE projects (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) CHECK (status IN ('tender', 'realization', 'archived')),
    investor VARCHAR(255),
    technical_supervisor VARCHAR(255),
    finish_date VARCHAR(50), -- Keeping as string to match "Prosinec 2025" format, or use DATE
    site_manager VARCHAR(255),
    construction_manager VARCHAR(255),
    construction_technician VARCHAR(255),
    planned_cost DECIMAL(15, 2),
    documentation_link TEXT, -- Link to project documentation
    inquiry_letter_link TEXT, -- Link to inquiry letter template
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Contracts Table (1:1 with projects)
CREATE TABLE project_contracts (
    project_id VARCHAR(36) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    maturity_days INTEGER,
    warranty_months INTEGER,
    retention_terms VARCHAR(100), -- e.g. "5+5 %"
    site_facilities_percent DECIMAL(5, 2),
    insurance_percent DECIMAL(5, 2)
);

-- Project Investor Financials Table (1:1 with projects)
CREATE TABLE project_investor_financials (
    project_id VARCHAR(36) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    sod_price DECIMAL(15, 2) -- Base contract price
);

-- Project Amendments Table (1:N with projects)
CREATE TABLE project_amendments (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(255), -- e.g. "Dodatek č.1"
    price DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
