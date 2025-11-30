# Supabase Migration Instructions

## Step 1: Run SQL Migration

Open your Supabase SQL Editor and run the following file:

**File:** `Tables/00_combined_migration.sql`

This will create all necessary tables:

- `projects` - Main projects table
- `project_contracts` - Contract details
- `project_investor_financials` - Investor financials
- `project_amendments` - Project amendments
- `subcontractor_statuses` - Status configuration
- `subcontractors` - Subcontractors database
- `demand_categories` - Demand categories (poptávky)
- `bids` - Bids table

## Step 2: Verify Tables

In Supabase, go to Table Editor and verify all tables exist.

## Step 3: Test the Application

1. Refresh the browser
2. Application should load with empty state
3. Try creating a new project in Settings
4. Try adding a new category in Pipeline
5. Try creating a new subcontractor

## Optional: Seed Data

If you want some initial test data, you can manually add projects through the Settings page, or use the Supabase Table Editor to insert sample data.

## Important Notes

- All data is now loaded from Supabase on app mount
- All edits are automatically persisted to the database
- The application uses optimistic updates for better UX
- Mock data (`data.ts`) is no longer used
