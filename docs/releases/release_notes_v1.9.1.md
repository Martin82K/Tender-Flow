# Tender Flow v1.9.1

Patch release opravuje spolehlivost Tender Flow MCP konektoru a mobilního
vyhledávání kontaktů. Před publikací zůstává GitHub Release v režimu draft a
desktopové instalační balíčky se ověřují na samostatném počítači.

## Opravy

- **MCP připojení účtu:** běžné webové nebo desktopové přihlášení už nepočítá
  OAuth session konektoru do stejného limitu a neodstraní jeho refresh-token
  chain. Již ztracený token vyžaduje jednorázové nové připojení konektoru.
- **Mobilní hledání kontaktů:** neplatné nebo neúplné položky v JSONB poli
  kontaktních osob se bezpečně zahodí či normalizují a nezpůsobí pád hledání.
- **Release kontrola:** explicitní stabilní release příkaz fail-closed ověřuje
  stabilní SemVer a shodu verze v `package.json`, lockfile a `APP_VERSION`, aniž
  by blokoval běžné prerelease desktop buildy.

## Ověření před publikací

- Lokálně sestavit macOS ARM64 DMG/ZIP a Windows x64 NSIS včetně blockmap a
  updater YAML souborů.
- Ověřit názvy, verzi, velikosti, SHA-512 metadata a instalaci na samostatném
  Windows PC.
- Ověřit aktualizaci z `v1.9.0`, přihlášení, mobilní hledání kontaktů a nové
  připojení Tender Flow MCP.
- Publikovat draft pouze po výslovném potvrzení výsledku manuálních testů.

## Instalace

Assety budou připojeny k draft release z lokálního `dist-electron/`. GitHub
Actions je nesmí připojit ani přepsat.
