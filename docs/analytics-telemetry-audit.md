# Analytics and telemetry audit

Last reviewed: 2026-05-20

## Current decision

Tender Flow does not ship Google Analytics or Google Tag Manager tracking scripts.
PostHog is the preferred optional product analytics provider, but it remains
disabled unless both conditions are true:

- `app_settings.posthog_enabled = true` and `posthog_project_key` is populated.
- The browser has stored the optional cookie consent decision `accepted_all`.

Optional usage analytics are consent-gated consistently in the client. Without
`accepted_all`, the client must not send PostHog events, feature usage events,
application usage actions, or application usage heartbeat calls.

## Inventory

| Flow | Storage / recipient | Classification | Consent behavior | Retention / cleanup |
| --- | --- | --- | --- | --- |
| PostHog | PostHog EU cloud by default (`https://eu.i.posthog.com`) | Optional product analytics | Disabled by DB config by default; initialized opt-out; captures only after `accepted_all` | Controlled in PostHog project settings |
| Feature usage | Supabase `feature_usage_events` | Optional usage analytics | `trackFeatureUsage` returns without RPC unless `accepted_all` | `feature-usage-events`, 180 days |
| App usage heartbeat | Supabase `usage_daily_stats` plus short-lived `usage_session_state` | Optional usage analytics | `useAppUsageHeartbeat` and `recordUsageHeartbeat` require `accepted_all` | Aggregated daily stats; session state expires in DB |
| App usage actions | Supabase `usage_daily_stats` | Optional usage analytics | `recordUsageAction` requires `accepted_all` | Aggregated daily stats |
| AI agent telemetry | Supabase `ai_agent_usage_events` | Operational cost and abuse telemetry | Not controlled by cookie banner; tied to AI feature execution and cost control | `ai-agent-usage-events`, 180 days |
| AI voice telemetry | Supabase `ai_voice_usage_events` | Operational cost and abuse telemetry | Not controlled by cookie banner; tied to voice feature execution and cost control | `ai-voice-usage-events`, 180 days |

## Security and privacy guardrails

- PostHog is configured with `autocapture: false`, `capture_pageview: false`,
  `capture_pageleave: false`, `disable_session_recording: true`, and
  `opt_out_capturing_by_default: true`.
- Demo users are not identified in PostHog and app usage heartbeat is disabled
  for demo role in the app shell.
- PostHog project keys are publishable keys. Secrets must not be stored in
  `app_settings`; sensitive analytics or service tokens belong in server-side
  secret storage.
- Logs must use sanitized error summaries and must not print tokens, cookies,
  authorization headers, or raw provider payloads.

## Production verification checklist

- Verify the production row `app_settings.id = 'default'` before saying PostHog
  is active in production.
- Confirm allowed origins in PostHog before enabling a production project key.
- Confirm `/cookies` and privacy copy whenever a new tracking provider or
  telemetry table is added.
- Keep analytics packages reviewed under the repository rule that new packages
  younger than 14 days must not be installed.
