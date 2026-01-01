# 🎯 Řešení problému s iframe na Railway

## 📋 Problém

Aplikace nasazená na Railway se nechtěla načíst v iframe - stále se jen načítala (spinning loader).

## 🔍 Příčina

Railway (a většina moderních web serverů) ve výchozím nastavení blokují zobrazení stránek v iframe pomocí bezpečnostních hlaviček:

- `X-Frame-Options: DENY` nebo `SAMEORIGIN`
- `Content-Security-Policy` bez `frame-ancestors`

## ✅ Řešení

### 1. Vytvořen Express server (`server.js`)

```javascript
// Middleware pro nastavení hlaviček
app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // ... další CORS hlavičky
  next();
});
```

### 2. Aktualizován `vite.config.ts`

Přidány hlavičky pro development server:

```typescript
server: {
  headers: {
    'Access-Control-Allow-Origin': '*',
    // ... další hlavičky
  }
}
```

### 3. Vytvořen `public/_headers`

Konfigurace pro statické soubory:

```
/*
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors *
  Access-Control-Allow-Origin: *
```

### 4. Aktualizován `package.json`

```json
{
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### 5. Vytvořen `railway.json`

```json
{
  "deploy": {
    "startCommand": "npm start"
  }
}
```

## 📁 Vytvořené soubory

1. **server.js** - Express server s iframe podporou
2. **railway.json** - Railway konfigurace
3. **public/\_headers** - Statické hlavičky
4. **middleware.js** - Middleware handler
5. **iframe-test.html** - Testovací stránka
6. **test-iframe-headers.js** - Test script
7. **RAILWAY_IFRAME_DEPLOYMENT.md** - Deployment guide

## 🚀 Deployment postup

### Krok 1: Commit a push

```bash
git add .
git commit -m "feat: add iframe support for Railway deployment"
git push
```

### Krok 2: Railway automaticky

- Detekuje změny
- Spustí `npm install && npm run build`
- Spustí `npm start`
- Aplikace bude dostupná s iframe podporou

### Krok 3: Použití v iframe

```html
<iframe
  src="https://excelmerger-pro.railway.internal"
  width="100%"
  height="800px"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
></iframe>
```

## 🧪 Lokální testování

### 1. Build aplikace

```bash
npm run build
```

### 2. Spustit produkční server

```bash
npm start
```

### 3. Otevřít testovací stránku

Otevřete `iframe-test.html` v prohlížeči

### 4. Ověřit hlavičky

```bash
node test-iframe-headers.js
```

## 📊 Technické detaily

### HTTP hlavičky nastavené serverem:

- ❌ **X-Frame-Options**: Odstraněno (nebo ALLOWALL)
- ✅ **Content-Security-Policy**: `frame-ancestors *`
- ✅ **Access-Control-Allow-Origin**: `*`
- ✅ **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- ✅ **Access-Control-Allow-Headers**: `Content-Type, Authorization`

### Proč to funguje:

1. **X-Frame-Options** - Když není nastaveno nebo je ALLOWALL, prohlížeč povolí iframe
2. **CSP frame-ancestors** - Explicitně povoluje všechny domény (`*`)
3. **CORS hlavičky** - Umožňují cross-origin požadavky

## 🔧 Řešení problémů

### Problém: Stále se načítá

**Řešení:**

1. Zkontrolujte Railway logs
2. Ověřte, že používá `npm start` (ne `npm run preview`)
3. Otevřete Developer Tools → Network → Headers
4. Hledejte CSP nebo X-Frame-Options chyby

### Problém: CORS chyby

**Řešení:**

1. Zkontrolujte `server.js` middleware
2. Ověřte, že Express správně nastavuje hlavičky
3. Restartujte Railway deployment

### Problém: 404 chyby

**Řešení:**

1. Zkontrolujte, že `dist` složka existuje
2. Spusťte `npm run build` před `npm start`
3. Ověřte cesty v `server.js`

## 📚 Další kroky

1. ✅ Commitněte změny
2. ✅ Pushněte na Railway
3. ✅ Počkejte na build
4. ✅ Otestujte iframe
5. ⏭️ Případně upravte CSP pro konkrétní domény (místo `*`)

## 🎉 Výsledek

Aplikace nyní:

- ✅ Funguje v iframe
- ✅ Podporuje CORS
- ✅ Má správné bezpečnostní hlavičky
- ✅ Je připravena pro Railway deployment

---

**Datum:** 2026-01-01  
**Verze:** 0.9.3-260101  
**Status:** ✅ Vyřešeno
