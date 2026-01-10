# Tender Flow – Electron Desktop App (rekapitulace)

Tento dokument shrnuje, o čem jsme se bavili, a jaké cíle a principy chceme pro **Electron desktop aplikaci** Tender Flow.

---

## 1. Proč desktop (strategie)

- **Web (tenderflow.cz)** zůstává hlavní produkt pro:
  - získání uživatelů a PMF (product–market fit),
  - jednoduchý onboarding bez instalace,
  - rychlé iterace a doručování změn.
- **Desktop** je:
  - *power-user / enterprise* rozšíření,
  - akcelerátor hodnoty (práce se soubory, AI workflow, lokální nástroje),
  - smysluplný hlavně tehdy, když to vyžádají klienti / přinese výrazné benefity.

> Desktop není náhrada webu, ale **multiplikátor užitku**.

---

## 2. Volba technologie: Electron

Rozhodnutí: **Electron**.

Důvody:
- stávající stack: **Node.js** (backend) + **TypeScript** + **Next.js** (frontend),
- možnost pohodlně kombinovat **Node + Python** lokálně,
- osvědčená praxe a ekosystém (typický desktop wrapper pro webové UI),
- menší tření než Tauri v našem kontextu.

Poznámka: Electron appky jsou větší (Chromium), ale benefity pro funkce a rychlost vývoje převáží.

---

## 3. Architektura: jedna codebase, dvě platformy

- **Jedna Next.js aplikace** jako společný UI základ.
- Rozdíly web vs desktop řešit přes **platform layer (adaptéry)**, ne přes dvě větve.

Co se může lišit podle platformy:
- start flow (desktop welcome/novinky vs web login/landing),
- storage (web cookies vs desktop secure storage),
- práce se soubory (web přes MCP vs desktop přes fs),
- nástroje (web TS implementace vs desktop Python).

---

## 4. MCP server a složky (zásadní zjištění)

### Jak MCP funguje dnes
- pracuje **vyloženě nad lokální synchronizovanou složkou OneDrive**,
- obchází Microsoft Graph API,
- dělá „most“ mezi webem a filesystemem.

### Důsledek pro desktop
- **V desktopu MCP nepotřebujeme**, protože Electron má přímý přístup k filesystemu.
- MCP zůstává **jen pro webovou verzi**.

---

## 5. Práce se složkami (OneDrive/SharePoint sync)

Desktop flow:
1. Uživatel vybere synchronizovanou složku (OneDrive / SharePoint sync) přes systémový dialog.
2. Electron:
   - listuje soubory,
   - čte/zapisuje,
   - spouští lokální zpracování (Python/Node),
   - případně sleduje změny (watcher).

Hlavní výhody:
- rychlost a lepší UX,
- menší potřeba uploadu (více lokální práce),
- compliance argument (zpracování lokálně, do cloudu jen výsledky/metadata),
- ideální pro budoucí AI workflow nad dokumentací.

---

## 6. Watcher složek (bez background služeb)

Záměr:
- watcher poběží **jen když je aplikace spuštěná**,
- nebude běžet jako systémová služba na pozadí.

Doporučení:
- watcher v **main process** (Node), renderer jen přes IPC.
- kombinovat:
  - event-based watcher (rychlá reakce),
  - občasný „light rescan“ jako pojistku (např. 60–120 s), aby nic neuteklo.

---

## 7. Snapshot model (JSON stav) pro detekci změn

MVP model:
- ukládat „snapshot“ stavu složky do JSONu (ne do sledované složky, ale do userData aplikace),
- při změně / rescan:
  - porovnat snapshot „minule vs teď“,
  - vyhodnotit nové/změněné/smazané soubory,
  - spustit akce,
  - uložit nový snapshot.

Co ukládat:
- `relativePath`, `size`, `mtimeMs`,
- volitelně stav `ok/pending/error`,
- hash jen tam, kde je potřeba jistota.

Pozor: ignorovat šum (např. `.DS_Store`, `Thumbs.db`, `~$*.xlsx`, `*.tmp`).

---

## 8. Python a lokální nástroje (desktop-only)

- Desktop umožní provozovat Python nástroje lokálně (např. Excel/PDF manipulace).
- Web varianta může mít:
  - TS verzi (pokud existuje), nebo
  - fallback s hláškou „jen v desktopu“.

Klíč: UI volá jednotné rozhraní, implementace se volí dle platformy (adaptér).

---

## 9. Autentikace: pohodlí na desktopu, stejné principy

- API autentikace (access/refresh token) zůstává.
- Rozdíl je v uložení:
  - web: cookies (ideálně httpOnly),
  - desktop: bezpečné úložiště OS (např. keychain/credential manager) – dle potřeby později.

Cíl UX:
- uživatel se přihlásí jednou,
- další starty jsou „auto-login“ díky uložené session.

---

## 10. Instalace a práva (per-user)

Zaměření: **per-user**.

Důsledky:
- obvykle **bez admin oprávnění** na Windows i macOS,
- žádná systémová služba,
- watcher běží jen při spuštěné appce.

Podepisování:
- pro interní test/early adopters lze i bez podpisu (za cenu varování OS),
- později lze:
  - podepsat (profesionální distribuce),
  - nebo náklady přenést na enterprise klienty jako součást balíčku.

---

## 11. Updaty (release-based)

- update se spouští **až při vydání nové verze (release)**,
- commit sám o sobě update nevyvolá,
- typický proces:
  1) změny v kódu,
  2) build,
  3) release,
  4) desktop klient nabídne update.

---

## 12. Desktop landing/welcome s novinkami

Nápad:
- desktop může mít vlastní úvodní obrazovku:
  - „Co je nového“ po poslední aktualizaci,
  - rychlé odkazy,
  - případně onboarding checklist.

Tím se zlepší přehled uživatelů a komunikace změn.

---

## 13. Shrnutí

Electron desktop pro Tender Flow:
- zjednoduší práci se složkami (bez MCP na desktopu),
- umožní lokální nástroje (Python) a AI workflow nad dokumenty,
- zachová jednu codebase (Next.js) s platform adaptéry,
- přinese lepší UX a enterprise hodnotu,
- instalace per-user bez admina, watcher jen při spuštěné appce,
- updaty přes release proces.

---

## 14. Excel Merger Pro 

Excel Merger Pro je nástroj, který je hostovaný na Railway, ale který se využívá v desktop aplikaci. 
- Nicméně v desktop aplikaci je zatím řešení přes i-frame.  
- Nyní je možnost v desktop aplikaci použitívat tento nástroj přes Node.js a Python a není potřeba dalšího hostování. 
- https://github.com/Martin82K/ExcelMerger-Pro.git
- použij odkaza na github, aby si použil REPO a mohl do naší aplikace integrovat tento nástroj jako nativní řešení. 
