-- =====================================================
-- CONTRACTS MODULE - Permissions & Feature Flags
-- Migration: 20260126000200_contracts_permissions.sql
-- =====================================================

-- Add contracts-related permissions
INSERT INTO permission_definitions (key, label, description, category) VALUES
    ('view_contracts', 'Zobrazit smlouvy', 'Přístup k zobrazení smluv projektu', 'contracts'),
    ('edit_contracts', 'Upravit smlouvy', 'Vytváření a úprava smluv', 'contracts'),
    ('delete_contracts', 'Mazat smlouvy', 'Mazání smluv', 'contracts'),
    ('approve_drawdowns', 'Schvalovat čerpání', 'Schvalování průvodek/čerpání', 'contracts'),
    ('ai_extract_contracts', 'AI extrakce smluv', 'Použití AI pro extrakci dat z PDF', 'contracts')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to roles
INSERT INTO role_permissions (role_id, permission_key, enabled) VALUES
    ('priprava', 'view_contracts', true),
    ('priprava', 'edit_contracts', true),
    ('priprava', 'ai_extract_contracts', true),
    ('hl_stavbyvedo', 'view_contracts', true),
    ('hl_stavbyvedo', 'edit_contracts', true),
    ('hl_stavbyvedo', 'delete_contracts', true),
    ('hl_stavbyvedo', 'approve_drawdowns', true),
    ('hl_stavbyvedo', 'ai_extract_contracts', true),
    ('stavbyvedo', 'view_contracts', true),
    ('stavbyvedo', 'edit_contracts', true),
    ('technik', 'view_contracts', true)
ON CONFLICT (role_id, permission_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Add feature flag for contracts module
INSERT INTO subscription_features (key, name, description, category) VALUES
    ('module_contracts', 'Modul Smlouvy', 'Správa smluv, dodatků a čerpání', 'modules')
ON CONFLICT (key) DO NOTHING;

-- Enable for paid tiers
INSERT INTO subscription_tier_features (tier, feature_key, enabled) VALUES
    ('free', 'module_contracts', false),
    ('pro', 'module_contracts', true),
    ('enterprise', 'module_contracts', true),
    ('admin', 'module_contracts', true)
ON CONFLICT (tier, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
