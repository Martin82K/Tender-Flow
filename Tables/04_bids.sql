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
