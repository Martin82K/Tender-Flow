# 🚀 Quick Deployment Guide

Rychlý průvodce pro nasazení aplikace s podporou iframe embedování.

## ⚡ Nejrychlejší cesta

### Railway (Doporučeno pro rychlý start)

```bash
./scripts/deploy/deploy-to-railway.sh
```

### Google Cloud Run (Doporučeno pro produkci)

```bash
./scripts/deploy/deploy-to-gcp.sh
```

## 📋 Co je připraveno

✅ **Iframe podpora** - Aplikace je plně nakonfigurována pro zobrazení v iframe  
✅ **Express server** - Production-ready server s správnými hlavičkami  
✅ **Docker konfigurace** - Optimalizovaný multi-stage Dockerfile  
✅ **Deployment skripty** - Automatizované deployment pro Railway a Google Cloud  
✅ **CI/CD** - GitHub Actions workflow pro automatické nasazení  
✅ **Dokumentace** - Kompletní průvodci pro všechny platformy

## 🎯 Deployment možnosti

| Platforma             | Příkaz                     | Dokumentace                                     |
| --------------------- | -------------------------- | ----------------------------------------------- |
| **Railway**           | `./scripts/deploy/deploy-to-railway.sh`   | [Railway Guide](RAILWAY_IFRAME_DEPLOYMENT.md)   |
| **Google Cloud Run**  | `./scripts/deploy/deploy-to-gcp.sh`       | [GCP Guide](GOOGLE_CLOUD_DEPLOYMENT.md)         |
| **Google App Engine** | `./scripts/deploy/deploy-to-appengine.sh` | [GCP Guide](GOOGLE_CLOUD_DEPLOYMENT.md)         |
| **GitHub Actions**    | Auto při push              | [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) |

## 📚 Kompletní dokumentace

- **[DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md)** - Srovnání všech deployment možností
- **[IFRAME_SOLUTION.md](IFRAME_SOLUTION.md)** - Jak funguje iframe podpora
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Checklist pro deployment
- **[RAILWAY_IFRAME_DEPLOYMENT.md](RAILWAY_IFRAME_DEPLOYMENT.md)** - Railway deployment guide
- **[GOOGLE_CLOUD_DEPLOYMENT.md](GOOGLE_CLOUD_DEPLOYMENT.md)** - Google Cloud deployment guide
- **[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)** - CI/CD setup guide

## 🧪 Lokální testování

```bash
# Development
npm run dev

# Production build
npm run build

# Production server
npm start

# Test iframe
open tools/iframe/iframe-test.html

# Test headers
node tools/iframe/test-iframe-headers.js
```

## 🎨 Použití v iframe

Po nasazení můžete aplikaci vložit do iframe:

```html
<iframe
  src="https://your-app-url.com"
  width="100%"
  height="800px"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
></iframe>
```

## 🔧 Soubory

### Production

- `server.js` - Express server s iframe hlavičkami
- `Dockerfile` - Docker konfigurace pro Cloud Run
- `app.yaml` - App Engine konfigurace
- `railway.json` - Railway konfigurace

### Deployment

- `scripts/deploy/deploy-to-railway.sh` - Railway deployment script
- `scripts/deploy/deploy-to-gcp.sh` - Google Cloud Run deployment script
- `scripts/deploy/deploy-to-appengine.sh` - App Engine deployment script
- `.github/workflows/deploy-gcp.yml` - GitHub Actions workflow

### Testing

- `tools/iframe/iframe-test.html` - Interaktivní iframe test
- `tools/iframe/test-iframe-headers.js` - Test HTTP hlaviček

### Documentation

- Všechny `.md` soubory v root složce

## 💡 Rychlé tipy

### Chcete rychlý deployment?

→ Použijte Railway: `./scripts/deploy/deploy-to-railway.sh`

### Chcete produkční řešení?

→ Použijte Google Cloud Run: `./scripts/deploy/deploy-to-gcp.sh`

### Chcete automatické nasazení?

→ Nastavte GitHub Actions podle `GITHUB_ACTIONS_SETUP.md`

### Máte problémy s iframe?

→ Přečtěte si `IFRAME_SOLUTION.md`

## 🆘 Pomoc

Pokud máte problémy, postupujte takto:

1. **Zkontrolujte checklist:** `DEPLOYMENT_CHECKLIST.md`
2. **Přečtěte si řešení iframe:** `IFRAME_SOLUTION.md`
3. **Vyberte platformu:** `DEPLOYMENT_OPTIONS.md`
4. **Následujte guide:** Konkrétní deployment guide

## 📊 Srovnání platforem

| Kritérium         | Railway | Cloud Run | App Engine |
| ----------------- | ------- | --------- | ---------- |
| **Cena**          | 💰💰    | 💰        | 💰💰       |
| **Složitost**     | ⭐      | ⭐⭐      | ⭐⭐       |
| **Škálování**     | ⚡⚡    | ⚡⚡⚡    | ⚡⚡⚡     |
| **Setup čas**     | 2 min   | 5 min     | 5 min      |
| **Iframe**        | ✅      | ✅        | ✅         |
| **HTTPS**         | ✅      | ✅        | ✅         |
| **Custom domain** | ✅      | ✅        | ✅         |

---

**Vytvořeno:** 2026-01-01  
**Verze:** 0.9.3-260101

**🎯 Doporučení:**

- **Rychlý start:** Railway
- **Produkce:** Google Cloud Run
- **Enterprise:** Google App Engine
