# Audit: Feature Access Consistency

Run a full audit to ensure `user_id_has_feature()` matches the expected feature flag based on each user's effective tier.

## Requirements
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (service role key)

## Usage
```bash
node scripts/audit_feature_access.js
```

The script checks all users in `public.user_profiles`, compares:
- `get_user_subscription_tier(user_id)`
- `subscription_tier_features` for `dynamic_templates`
- `user_id_has_feature(user_id, 'dynamic_templates')`

It prints any mismatches for follow-up.
