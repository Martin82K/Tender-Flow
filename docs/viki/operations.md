# Viki provoz a monitoring

## Telemetrie eventy
Zdroj: `app/agent/usageTracking.ts`

- `voice_record_started`
- `voice_transcribed`
- `voice_tts_played`
- `model_switched`
- `audience_switched`
- `context_policy_applied`
- `output_guard_triggered`
- `manual_context_used`
- `manual_citation_emitted`
- `manual_no_match`
- `tool_executed`
- `policy_decision_recorded`
- `trace_recorded`
- `cost_overview_viewed` (UI-side event lze doplnit, backend metrika už existuje přes `ai_agent_usage_events`)

Všechny eventy se trackují přes `trackFeatureUsage` se `source: "viki"`.

## Voice provoz
- Voice interaction mode: `text_only`, `push_to_talk`, `push_to_talk_auto_voice`.
- Lokální limit nahrávání ve controlleru: 30 s (`MAX_VOICE_SECONDS`).
- Rozpočtové limity vrací response typ `VoiceBudgetStatus`.
- Cloud TTS hlas pro `ai-voice/speak` defaultně používá `nova` (ženský profil); volitelný server-side override: `VIKI_TTS_VOICE`.

## Kritické závislosti
- Supabase Auth (session token)
- Supabase Functions (`ai-agent`, `ai-proxy`, `ai-voice/transcribe`, `ai-voice/speak`)
- Supabase Storage bucket `agent-memory`
- `/user-manual/index.kb.json`
- DB tabulky `ai_agent_usage_events` a `ai_voice_usage_events` + admin RPC `get_viki_cost_*_admin`
- Supabase Secrets: `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `TINYURL_API_KEY`

## Správa klíčů
- Viki běží v režimu server-only secrets: klíče se berou pouze z Supabase Secrets.
- UI neslouží pro ukládání API klíčů a neposílá je do functions.
- Rotace klíče:
1. Aktualizuj klíč v Supabase project secrets.
2. Redeployni dotčené functions (`ai-agent`, `ai-proxy`, `ai-voice`).
3. Proveď smoke test přes admin AI stránku a zkontroluj `ai_agent_usage_events`.

## Incident runbook (minimum)
1. Ověř, že uživatel má platnou session.
2. Ověř dostupnost functions endpointů.
3. Ověř, že `ai-agent`/`ai-proxy` nevrací auth/subscription chyby.
4. Ověř načtení manual indexu.
5. Ověř guard trigger ratio (nárůst může indikovat policy drift).

## Troubleshooting
- Symptom: Viki vrací fallback error message.
  - Zkontroluj network chyby functions call.
- Symptom: nefunguje voice.
  - Zkontroluj oprávnění mikrofonu, voice mode a budget warning.
- Symptom: prázdný manual context.
  - Zkontroluj `/user-manual/index.kb.json` a scope `manual`.

## Operativní doporučení
- Sleduj trend `output_guard_triggered` po release.
- U změn policy vždy proveď smoke test pro `internal` i `client` režim.
