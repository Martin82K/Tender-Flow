# Analytics and telemetry audit

Last reviewed: 2026-09-06

## Current decision

Tender Flow does not ship Google Analytics or Google Tag Manager tracking scripts.
PostHog has been removed from the application, including its SDK, startup
configuration query, identity handling and network allowlist entries. Existing
PostHog configuration columns remain in the database for migration history and
older-client compatibility; the current client does not read them.

Optional feature usage analytics remain consent-gated: without `accepted_all`,
the client must not send detailed feature usage events. Privacy-minimized
application heartbeat and aggregate action counters are necessary service operations and remain active for signed-in
non-demo users independently of optional consent.

## Inventory

| Flow | Storage / recipient | Classification | Consent behavior | Retention / cleanup |
| --- | --- | --- | --- | --- |
| Feature usage | Supabase `feature_usage_events` | Optional usage analytics | `trackFeatureUsage` returns without RPC unless `accepted_all` | `feature-usage-events`, 180 days |
| App usage heartbeat | Supabase `usage_daily_stats` plus short-lived `usage_session_state` | Necessary aggregate B2B service operations | Runs for authenticated non-demo users; visible, focused and non-idle window only | Aggregated daily stats; session state expires in DB; no raw heartbeat history or content |
| App usage actions | Supabase `usage_daily_stats` | Necessary aggregate B2B service operations | Runs for authenticated non-demo users independently of optional cookie consent | Aggregated daily counters only; no content or per-action event history |
| AI agent telemetry | Supabase `ai_agent_usage_events` | Operational cost and abuse telemetry | Not controlled by cookie banner; tied to AI feature execution and cost control | `ai-agent-usage-events`, 180 days |
| AI voice telemetry | Supabase `ai_voice_usage_events` | Operational cost and abuse telemetry | Not controlled by cookie banner; tied to voice feature execution and cost control | `ai-voice-usage-events`, 180 days |

## Security and privacy guardrails

- App usage heartbeat is disabled for demo users.
- Sensitive analytics or service tokens belong in server-side secret storage.
- Logs must use sanitized error summaries and must not print tokens, cookies,
  authorization headers, or raw provider payloads.

## Production verification checklist

- Confirm the browser neither loads the removed SDK nor requests PostHog hosts,
  including after login, logout and optional-consent changes.
- Confirm `/cookies` and privacy copy whenever a new tracking provider or
  telemetry table is added.
- Keep analytics packages reviewed under the repository supply-chain policy:
  verify registry integrity, provenance/signatures, repository and maintainer
  history, vulnerabilities, and reported compromise incidents before install.
