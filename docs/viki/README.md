# Viki dokumentace

Tato složka je centralizovaný source of truth pro architekturu, bezpečnost, data, skilly, provoz a testování asistentky Viki.

## Rychlá orientace
- [Architektura](./architecture.md): end-to-end tok Viki od UI po odpověď.
- [Katalog skillů](./skills-catalog.md): registry, naming konvence a mapování na detailní skill dokumenty.
- [Viki Skills](./skills/README.md): detailní dokumentace každého skillu (`manifest-id.md`).
- [Datové zdroje](./data-sources.md): odkud Viki čte data a co je autoritativní zdroj.
- [Security model](./security-model.md): guardy, audience režimy, přístupová pravidla, threat scénáře.
- [Markdown output](./markdown-output.md): standard formátu odpovědí a bezpečný subset.
- [Provoz](./operations.md): telemetrie, voice limity, incident postupy.
- [Testování](./testing.md): test matrix a acceptance checklist.
- [Changelog](./changelog.md): změny pouze pro Viki.

## Scope
- Viki smí shrnovat pouze data, která jsou dostupná aktuálně přihlášenému uživateli.
- Každý nový skill musí mít dokumentaci před dokončením PR.
- Dokumentace v této složce má přednost před staršími rozptýlenými poznámkami.

## Governance
- PR měnící chování Viki musí aktualizovat minimálně:
  - `docs/viki/skills-catalog.md` (pokud se mění skill/trigger/outcome)
  - `docs/viki/security-model.md` (pokud se mění policy/guard/access)
  - `docs/viki/changelog.md` (vždy)
- PR checklist musí obsahovat položku `Viki docs updated`.
- Skill bez dokumentace není považovaný za done.

## Migrace starší dokumentace
- Původní [viki-context-policy](../viki-context-policy.md) je ponechán jako deprecated pointer kvůli kompatibilitě odkazů.

## Doc drift check
- Každý skill v `features/agent/skills/` musí mít vlastní `.md` soubor ve [skills](./skills/README.md) a být uvedený v [skills-catalog](./skills-catalog.md).
- Každý guard z `app/agent/contextPolicy.ts` musí být popsaný v [security-model](./security-model.md).
- Uživatelský label, `manifest.id` a název TS symbolu musí být synchronní.
