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

Všechny eventy se trackují přes `trackFeatureUsage` se `source: "viki"`.

## Voice provoz
- Voice interaction mode: `text_only`, `push_to_talk`, `push_to_talk_auto_voice`.
- Lokální limit nahrávání ve controlleru: 30 s (`MAX_VOICE_SECONDS`).
- Rozpočtové limity vrací response typ `VoiceBudgetStatus`.

## Kritické závislosti
- Supabase Auth (session token)
- Supabase Functions (`ai-proxy`, `ai-voice/transcribe`, `ai-voice/speak`)
- Supabase Storage bucket `agent-memory`
- `/user-manual/index.kb.json`

## Incident runbook (minimum)
1. Ověř, že uživatel má platnou session.
2. Ověř dostupnost functions endpointů.
3. Ověř, že `ai-proxy` nevrací auth/subscription chyby.
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
