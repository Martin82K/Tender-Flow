# Viki changelog

## 2026-03-02

### Změněno
- `ai-voice/speak` už nepoužívá pevný hlas `alloy`; výchozí hlas Viki je nyní `nova` (ženský profil).
- Přidána konfigurace `VIKI_TTS_VOICE` pro server-side override TTS hlasu bez změny kódu.
- Konfigurace hlasu je sanitována (`[a-z0-9_-]{2,32}`), kontrolována proti allowlistu podporovaných hlasů a při nevalidní hodnotě bezpečně fallbackne na `nova`.

## 2026-02-28

### Přidáno
- Zavedena samostatná dokumentační struktura `docs/viki/`.
- Přidány dokumenty pro architekturu, skilly, data, security, markdown output, provoz a testování.
- Zavedena governance pravidla pro povinnou aktualizaci Viki dokumentace při změnách behavior.
- Přidán skill `deep-project-briefing` (`deepProjectBriefingSkill`) pro detailní reporting projektu.
- Do skillu byl zapracován hodnoticí rámec vedoucího projektu (ekonomika + realizace + rizika + nestrannost výstupu pro vedení).
- Skill generuje detailní markdown report s KPI tabulkami, ASCII grafy, riziky a doporučenými kroky.
- Přidána samostatná složka `docs/viki/skills/` s jedním `.md` souborem pro každý skill (`<manifest-id>.md`).

### Změněno
- `docs/viki-context-policy.md` je nyní deprecated pointer na `docs/viki/README.md`.

### Poznámka
- Tento changelog je vyhrazený pouze pro změny týkající se Viki.
