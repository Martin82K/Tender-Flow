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
