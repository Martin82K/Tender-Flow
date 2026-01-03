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
    losers_email_template_link TEXT, -- Link to email template for non-selected participants
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
-- Subcontractor Status Configuration
CREATE TABLE subcontractor_statuses (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'available', 'busy'
    label VARCHAR(100) NOT NULL,
    color VARCHAR(20) CHECK (color IN ('green', 'red', 'yellow', 'blue', 'purple', 'slate'))
);

-- Subcontractors Table
CREATE TABLE subcontractors (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    company_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255),
    specialization VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    ico VARCHAR(20),
    region VARCHAR(100),
    status_id VARCHAR(50) REFERENCES subcontractor_statuses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
-- Bids Table
CREATE TABLE bids (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    category_id VARCHAR(36) REFERENCES demand_categories(id) ON DELETE CASCADE,
    subcontractor_id VARCHAR(36) REFERENCES subcontractors(id),
    price DECIMAL(15, 2), -- Parsed numeric price
    price_display VARCHAR(50), -- Original string e.g. "1.55M Kč" or "?"
    notes TEXT,
    status VARCHAR(50) CHECK (status IN ('sent', 'offer', 'shortlist', 'sod', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bid Tags Table (Many-to-Many for tags like 'Reliable', 'Cheapest')
CREATE TABLE bid_tags (
    bid_id VARCHAR(36) REFERENCES bids(id) ON DELETE CASCADE,
    tag VARCHAR(50),
    PRIMARY KEY (bid_id, tag)
);
