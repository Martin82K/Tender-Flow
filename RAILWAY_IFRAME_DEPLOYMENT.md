# 🚀 Railway Deployment - Iframe Support

Tento projekt byl nakonfigurován pro podporu iframe embedování na Railway.

## 📋 Provedené změny

### 1. **Server konfigurace** (`server.js`)

- Vytvořen Express server pro obsluhu statických souborů
- Přidány HTTP hlavičky pro povolení iframe:
  - Odstraněn `X-Frame-Options`
  - Nastavena `Content-Security-Policy: frame-ancestors *`
  - Přidány CORS hlavičky

### 2. **Vite konfigurace** (`vite.config.ts`)

- Přidány hlavičky pro development server
- Umožňuje testování iframe lokálně

### 3. **Public headers** (`public/_headers`)

- Konfigurace hlaviček pro statické soubory
- Automaticky aplikováno při buildu

### 4. **Package.json**

- Přidán `express` jako závislost
- Přidán `start` script pro produkci

### 5. **Railway konfigurace** (`railway.json`)

- Nastaveno automatické buildování
- Start command: `npm start`

## 🔧 Deployment na Railway

### Krok 1: Commit změn

```bash
git add .
git commit -m "feat: add iframe support with custom Express server"
git push
```

### Krok 2: Railway nastavení

1. Přihlaste se na [Railway.app](https://railway.app)
2. Vyberte váš projekt
3. Railway automaticky detekuje změny a spustí build
4. Po buildu bude aplikace dostupná s iframe podporou

### Krok 3: Ověření

Po nasazení otestujte iframe pomocí:

```html
<iframe
  src="https://your-app.railway.app"
  width="100%"
  height="800px"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
></iframe>
```

## 🧪 Lokální testování

### Development server s iframe podporou:

```bash
npm run dev
```

### Testování produkčního buildu:

```bash
npm run build
npm start
```

### Otevřít testovací stránku:

Otevřete `iframe-test.html` v prohlížeči pro interaktivní test iframe embedování.

## 📝 Použití v iframe

### Základní příklad:

```html
<iframe
  src="https://your-app.railway.app"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

### S povolenými funkcemi:

```html
<iframe
  src="https://your-app.railway.app"
  width="100%"
  height="800px"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
></iframe>
```

## 🔍 Řešení problémů

### Aplikace se stále načítá v iframe?

1. **Zkontrolujte konzoli prohlížeče** - hledejte CSP nebo CORS chyby
2. **Ověřte Railway logs** - zkontrolujte, zda server běží správně
3. **Testujte přímo** - otevřete URL aplikace přímo v prohlížeči
4. **Zkontrolujte hlavičky** - použijte Developer Tools → Network → Headers

### Časté problémy:

**Problem:** `Refused to display in a frame`

- **Řešení:** Ujistěte se, že Railway používá `npm start` (ne `npm run preview`)

**Problem:** CORS chyby

- **Řešení:** Zkontrolujte, že `server.js` správně nastavuje CORS hlavičky

**Problem:** Aplikace nefunguje po buildu

- **Řešení:** Spusťte `npm run build` lokálně a otestujte `npm start`

## 📚 Další zdroje

- [Railway Dokumentace](https://docs.railway.app/)
- [Express.js Dokumentace](https://expressjs.com/)
- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## 🎯 Checklist před deploymentem

- [ ] Všechny změny commitnuty
- [ ] Express nainstalován (`npm install`)
- [ ] Build funguje lokálně (`npm run build`)
- [ ] Server funguje lokálně (`npm start`)
- [ ] Iframe test prošel (`iframe-test.html`)
- [ ] Změny pushnuty na Railway
- [ ] Railway build úspěšný
- [ ] Aplikace dostupná v iframe

---

**Vytvořeno:** 2026-01-01  
**Verze:** 0.9.3-260101
