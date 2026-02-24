-- =====================================================
-- Fix: contract markdown backlog view must use invoker security
-- Migration: 20260224100000_fix_contract_markdown_backlog_view_security.sql
-- =====================================================
-- Supabase flags views that run with definer rights because they can bypass
-- expected table grants and RLS context. Force invoker semantics explicitly.

ALTER VIEW IF EXISTS public.contract_markdown_integrity_backlog_v
  SET (security_invoker = true);
