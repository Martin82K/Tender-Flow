# Tender Flow Desktop – Phase 2: UI Integration

> Vytvořeno: 2026-01-10

## Přehled změn

V této fázi jsme integrovali desktop komponenty do hlavní aplikace a přidali auto-update UI.

---

## Nové soubory

### hooks/useDesktop.ts
Hook pro správu desktop-specifických funkcí:
- **showWelcome** – stav zobrazení uvítací obrazovky
- **dismissWelcome()** – zavře welcome a uloží verzi do storage
- **updateAvailable** – indikátor dostupné aktualizace
- **checkForUpdates()** – manuální kontrola aktualizací
- **selectFolder()** – otevře systémový dialog pro výběr složky

```typescript
const {
  isDesktop,
  showWelcome,
  dismissWelcome,
  updateAvailable,
  checkForUpdates,
  selectFolder,
} = useDesktop();
```

### components/desktop/UpdateBanner.tsx
- **UpdateBanner** – notifikační banner pro dostupné aktualizace
- **DesktopIndicator** – malý indikátor desktop verze

---

## Změny v App.tsx

Přidána integrace desktop komponent:

```tsx
import { useDesktop } from "./hooks/useDesktop";
import { DesktopWelcome, UpdateBanner } from "./components/desktop";

// V AppContent:
const { isDesktop, showWelcome, updateAvailable, ... } = useDesktop();

// V returnu:
{isDesktop && showWelcome && (
  <DesktopWelcome onClose={dismissWelcome} onSelectFolder={selectFolder} />
)}
{isDesktop && (
  <UpdateBanner isVisible={updateAvailable} ... />
)}
```

---

## Jak to funguje

1. **První spuštění** – zobrazí se DesktopWelcome s "Co je nového"
2. **Dismiss** – verze se uloží do secure storage, při další návštěvě se nezobrazí
3. **Update check** – 3 sekundy po startu se automaticky zkontrolují aktualizace
4. **Update banner** – pokud je dostupná nová verze, zobrazí se banner

---

## Status

✅ Build úspěšný – `npm run build` prošel bez chyb
