# ✅ Checklist pro Railway Iframe Deployment

## 📋 Před deploymentem

- [ ] **Express nainstalován**

  ```bash
  npm install
  ```

- [ ] **Build funguje lokálně**

  ```bash
  npm run build
  ```

- [ ] **Server funguje lokálně**

  ```bash
  npm start
  ```

  Otevřete: http://localhost:3000

- [ ] **Iframe test lokálně**
      Otevřete `iframe-test.html` v prohlížeči

- [ ] **Ověření hlaviček** (volitelné)
  ```bash
  # V jiném terminálu (když běží npm start)
  node test-iframe-headers.js
  ```

## 🚀 Deployment na Railway

- [ ] **Git status zkontrolován**

  ```bash
  git status
  ```

- [ ] **Změny commitnuty**

  ```bash
  git add .
  git commit -m "feat: add iframe support"
  ```

  **NEBO použijte helper script:**

  ```bash
  ./deploy-to-railway.sh
  ```

- [ ] **Změny pushnuty**

  ```bash
  git push
  ```

- [ ] **Railway build sledován**
  - Otevřete Railway dashboard
  - Sledujte build logs
  - Počkejte na úspěšný deployment

## 🧪 Po deploymentu

- [ ] **Aplikace dostupná**
      Otevřete Railway URL přímo v prohlížeči

- [ ] **Iframe test**
      Vytvořte testovací HTML soubor:

  ```html
  <!DOCTYPE html>
  <html>
    <body>
      <iframe
        src="https://VASE-RAILWAY-URL.railway.app"
        width="100%"
        height="800px"
        frameborder="0"
      ></iframe>
    </body>
  </html>
  ```

- [ ] **Developer Tools check**

  - Otevřete Developer Tools (F12)
  - Přejděte na Network tab
  - Zkontrolujte Headers u hlavního požadavku
  - Ověřte přítomnost:
    - ✅ `Content-Security-Policy: frame-ancestors *`
    - ✅ `Access-Control-Allow-Origin: *`
    - ❌ `X-Frame-Options` (NESMÍ být přítomen)

- [ ] **Console check**
  - Zkontrolujte Console tab
  - Nesmí být CSP nebo frame-ancestors chyby

## 🔧 Řešení problémů

### ❌ Aplikace se stále načítá v iframe

1. **Zkontrolujte Railway logs**

   ```
   Railway Dashboard → Deployments → View Logs
   ```

2. **Ověřte start command**

   ```
   Mělo by být: npm start
   NIKOLI: npm run preview
   ```

3. **Zkontrolujte hlavičky**

   ```
   Developer Tools → Network → Headers
   ```

4. **Restartujte deployment**
   ```
   Railway Dashboard → Redeploy
   ```

### ❌ CORS chyby

1. **Zkontrolujte server.js**

   ```bash
   cat server.js | grep "Access-Control"
   ```

2. **Rebuild a redeploy**
   ```bash
   git commit --amend --no-edit
   git push --force
   ```

### ❌ 404 chyby

1. **Zkontrolujte dist složku**

   ```bash
   ls -la dist/
   ```

2. **Rebuild lokálně**
   ```bash
   rm -rf dist
   npm run build
   npm start
   ```

## 📞 Podpora

Pokud máte problémy:

1. Přečtěte si `IFRAME_SOLUTION.md`
2. Přečtěte si `RAILWAY_IFRAME_DEPLOYMENT.md`
3. Zkontrolujte Railway logs
4. Otestujte lokálně s `npm start`

## 🎯 Rychlé příkazy

```bash
# Kompletní test lokálně
npm run build && npm start

# Deploy na Railway
./deploy-to-railway.sh

# Test hlaviček (když běží server)
node test-iframe-headers.js

# Otevřít iframe test
open iframe-test.html
```

---

**Poslední aktualizace:** 2026-01-01  
**Verze:** 0.9.3-260101
