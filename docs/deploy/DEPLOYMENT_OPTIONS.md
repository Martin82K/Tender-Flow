# 🚀 Deployment Options - Kompletní přehled

Tento dokument poskytuje rychlý přehled všech dostupných deployment možností pro vaši aplikaci.

## 📊 Srovnání platforem

| Platforma                | Cena           | Složitost       | Rychlost            | Iframe podpora     | Doporučení                       |
| ------------------------ | -------------- | --------------- | ------------------- | ------------------ | -------------------------------- |
| **Railway**              | 💰💰 Střední   | ⭐ Velmi snadné | ⚡⚡⚡ Velmi rychlé | ✅ Ano             | ⭐⭐⭐ Skvělé pro rychlý start   |
| **Google Cloud Run**     | 💰 Nízká       | ⭐⭐ Snadné     | ⚡⚡ Rychlé         | ✅ Ano             | ⭐⭐⭐⭐⭐ Nejlepší pro produkci |
| **Google App Engine**    | 💰💰 Střední   | ⭐⭐ Snadné     | ⚡⚡ Rychlé         | ✅ Ano             | ⭐⭐⭐⭐ Dobré pro škálování     |
| **Google Cloud Storage** | 💰 Velmi nízká | ⭐ Velmi snadné | ⚡⚡⚡ Velmi rychlé | ⚠️ Omezené         | ⭐⭐⭐ Pouze pro statické SPA    |
| **Netlify**              | 💰 Nízká       | ⭐ Velmi snadné | ⚡⚡⚡ Velmi rychlé | ⚠️ Vyžaduje config | ⭐⭐⭐ Dobré pro JAMstack        |
| **Vercel**               | 💰 Nízká       | ⭐ Velmi snadné | ⚡⚡⚡ Velmi rychlé | ⚠️ Vyžaduje config | ⭐⭐⭐ Dobré pro Next.js         |

## 🎯 Doporučení podle use case

### 🏃 Rychlý prototyp / Demo

**Doporučeno: Railway nebo Netlify**

```bash
# Railway
./scripts/deploy/deploy-to-railway.sh

# Netlify
npm run build
netlify deploy --prod
```

### 🏢 Produkční aplikace

**Doporučeno: Google Cloud Run**

```bash
./scripts/deploy/deploy-to-gcp.sh
```

**Proč:**

- ✅ Automatické škálování (včetně na 0)
- ✅ Platíte pouze za použití
- ✅ Enterprise-grade infrastruktura
- ✅ Snadná CI/CD integrace
- ✅ Plná podpora iframe

### 💼 Enterprise s vysokým traffikem

**Doporučeno: Google App Engine nebo Kubernetes**

```bash
./scripts/deploy/deploy-to-appengine.sh
```

### 💰 Minimální náklady

**Doporučeno: Google Cloud Storage + CDN**

```bash
npm run build
gsutil -m rsync -r dist gs://your-bucket
```

## 📁 Dostupné deployment skripty

### Railway

```bash
./scripts/deploy/deploy-to-railway.sh
```

- ✅ Automatický commit a push
- ✅ Iframe podpora nakonfigurována
- ✅ Express server s hlavičkami

### Google Cloud Run

```bash
./scripts/deploy/deploy-to-gcp.sh
```

- ✅ Docker build a deploy
- ✅ Automatické škálování
- ✅ HTTPS zdarma
- ✅ Iframe podpora

### Google App Engine

```bash
./scripts/deploy/deploy-to-appengine.sh
```

- ✅ Plně spravovaná platforma
- ✅ Automatické škálování
- ✅ Integrované služby

### GitHub Actions (Automatické)

- Push do `main` branch → automatický deploy
- Konfigurace: `.github/workflows/deploy-gcp.yml`
- Setup guide: `GITHUB_ACTIONS_SETUP.md`

## 🔧 Konfigurace podle platformy

### Railway

**Soubory:**

- `server.js` - Express server s iframe hlavičkami
- `railway.json` - Railway konfigurace
- `public/_headers` - Statické hlavičky

**Příkazy:**

```bash
# Lokální test
npm run build && npm start

# Deploy
./scripts/deploy/deploy-to-railway.sh
```

### Google Cloud Run

**Soubory:**

- `Dockerfile` - Multi-stage build
- `.dockerignore` - Optimalizace image
- `server.js` - Production server

**Příkazy:**

```bash
# Lokální Docker test
docker build -t test .
docker run -p 8080:8080 test

# Deploy
./scripts/deploy/deploy-to-gcp.sh
```

### Google App Engine

**Soubory:**

- `app.yaml` - App Engine konfigurace
- `server.js` - Production server

**Příkazy:**

```bash
# Lokální test
npm run build && npm start

# Deploy
./scripts/deploy/deploy-to-appengine.sh
```

## 📋 Deployment checklist

### Před deploymentem

- [ ] Aplikace funguje lokálně (`npm run dev`)
- [ ] Build je úspěšný (`npm run build`)
- [ ] Production server funguje (`npm start`)
- [ ] Iframe test prošel (`tools/iframe/iframe-test.html`)
- [ ] Environment variables nastaveny
- [ ] Git změny commitnuty

### Po deploymentu

- [ ] Aplikace je dostupná na URL
- [ ] Iframe embedding funguje
- [ ] HTTPS je aktivní
- [ ] Všechny funkce fungují
- [ ] Performance je dobrá
- [ ] Logy jsou čisté

## 🎯 Rychlé příkazy

### Lokální vývoj

```bash
npm run dev              # Development server (port 3000)
npm run build            # Production build
npm start                # Production server
open tools/iframe/iframe-test.html    # Test iframe
```

### Testing

```bash
# Test hlaviček
node tools/iframe/test-iframe-headers.js

# Test Docker lokálně
docker build -t test . && docker run -p 8080:8080 test
```

### Deployment

```bash
# Railway
./scripts/deploy/deploy-to-railway.sh

# Google Cloud Run
./scripts/deploy/deploy-to-gcp.sh

# Google App Engine
./scripts/deploy/deploy-to-appengine.sh
```

### Monitoring

```bash
# Railway logs
railway logs

# Google Cloud Run logs
gcloud run logs tail --service excelmerger-pro --region europe-west1

# App Engine logs
gcloud app logs tail
```

## 💡 Tipy a triky

### 1. Environment Variables

```bash
# Railway
railway variables set NODE_ENV=production

# Cloud Run
gcloud run services update excelmerger-pro \
  --set-env-vars "NODE_ENV=production,API_KEY=xxx"

# App Engine
# Přidejte do app.yaml:
env_variables:
  NODE_ENV: 'production'
```

### 2. Custom Domain

**Railway:**

```
Settings → Domains → Add Custom Domain
```

**Cloud Run:**

```bash
gcloud run domain-mappings create \
  --service excelmerger-pro \
  --domain your-domain.com \
  --region europe-west1
```

**App Engine:**

```bash
gcloud app domain-mappings create your-domain.com
```

### 3. Scaling

**Cloud Run:**

```bash
gcloud run services update excelmerger-pro \
  --min-instances 1 \
  --max-instances 100 \
  --region europe-west1
```

**App Engine:**

```yaml
# V app.yaml:
automatic_scaling:
  min_instances: 1
  max_instances: 100
```

### 4. Rollback

**Railway:**

- Dashboard → Deployments → Redeploy previous version

**Cloud Run:**

```bash
gcloud run services update-traffic excelmerger-pro \
  --to-revisions REVISION-NAME=100 \
  --region europe-west1
```

**App Engine:**

```bash
gcloud app versions list
gcloud app services set-traffic default --splits VERSION=1
```

## 📚 Dokumentace

- **Railway:** `RAILWAY_IFRAME_DEPLOYMENT.md`
- **Google Cloud:** `GOOGLE_CLOUD_DEPLOYMENT.md`
- **GitHub Actions:** `GITHUB_ACTIONS_SETUP.md`
- **Iframe řešení:** `IFRAME_SOLUTION.md`
- **Checklist:** `DEPLOYMENT_CHECKLIST.md`

## 🆘 Podpora

### Problémy s iframe?

→ Přečtěte si `IFRAME_SOLUTION.md`

### Problémy s Google Cloud?

→ Přečtěte si `GOOGLE_CLOUD_DEPLOYMENT.md`

### Problémy s CI/CD?

→ Přečtěte si `GITHUB_ACTIONS_SETUP.md`

### Obecné problémy?

→ Přečtěte si `DEPLOYMENT_CHECKLIST.md`

---

**Poslední aktualizace:** 2026-01-01  
**Verze:** 0.9.4-260102

**Doporučený deployment pro produkci:** Google Cloud Run  
**Doporučený deployment pro rychlý start:** Railway
