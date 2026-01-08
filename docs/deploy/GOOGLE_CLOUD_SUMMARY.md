# ✅ Kompletní přehled - Deployment pro Google Cloud

## 🎉 Co bylo vytvořeno

Vaše aplikace je nyní plně připravena pro nasazení na Google Cloud Platform (i Railway) s plnou podporou iframe embedování.

## 📦 Vytvořené soubory

### 🚀 Deployment skripty (3)

1. **`scripts/deploy/deploy-to-railway.sh`** - Automatický deployment na Railway
2. **`scripts/deploy/deploy-to-gcp.sh`** - Deployment na Google Cloud Run
3. **`scripts/deploy/deploy-to-appengine.sh`** - Deployment na Google App Engine

### ⚙️ Konfigurační soubory (3)

1. **`app.yaml`** - Google App Engine konfigurace
2. **`railway.json`** - Railway konfigurace
3. **`server.js`** - Express server s iframe hlavičkami _(již existoval, aktualizován)_

### 📚 Dokumentace (7)

1. **`docs/deploy/QUICK_DEPLOYMENT.md`** - ⭐ **ZAČNĚTE TADY** - Rychlý průvodce
2. **`docs/deploy/DEPLOYMENT_OPTIONS.md`** - Srovnání všech deployment možností
3. **`docs/deploy/GOOGLE_CLOUD_DEPLOYMENT.md`** - Kompletní Google Cloud guide
4. **`docs/deploy/RAILWAY_IFRAME_DEPLOYMENT.md`** - Railway deployment guide
5. **`docs/deploy/IFRAME_SOLUTION.md`** - Jak funguje iframe podpora
6. **`docs/deploy/DEPLOYMENT_CHECKLIST.md`** - Checklist pro deployment
7. **`docs/deploy/GITHUB_ACTIONS_SETUP.md`** - CI/CD setup guide

### 🧪 Testovací soubory (2)

1. **`tools/iframe/iframe-test.html`** - Interaktivní iframe test
2. **`tools/iframe/test-iframe-headers.js`** - Test HTTP hlaviček

### 🤖 CI/CD (1)

1. **`.github/workflows/deploy-gcp.yml`** - GitHub Actions workflow

## 🎯 Jak začít

### 1️⃣ Nejrychlejší cesta (Railway)

```bash
./scripts/deploy/deploy-to-railway.sh
```

✅ Hotovo za 2 minuty!

### 2️⃣ Produkční řešení (Google Cloud Run)

```bash
# Instalace Google Cloud SDK (pokud ještě nemáte)
brew install --cask google-cloud-sdk

# Přihlášení
gcloud auth login

# Deploy
./scripts/deploy/deploy-to-gcp.sh
```

✅ Hotovo za 5 minut!

### 3️⃣ Automatické nasazení (GitHub Actions)

1. Přečtěte si `GITHUB_ACTIONS_SETUP.md`
2. Nastavte GitHub secrets
3. Push do main branch
   ✅ Automatický deployment při každém push!

## 📖 Doporučené pořadí čtení

1. **`QUICK_DEPLOYMENT.md`** - Začněte zde pro rychlý přehled
2. **`DEPLOYMENT_OPTIONS.md`** - Vyberte si platformu
3. **`GOOGLE_CLOUD_DEPLOYMENT.md`** nebo **`RAILWAY_IFRAME_DEPLOYMENT.md`** - Detailní guide
4. **`GITHUB_ACTIONS_SETUP.md`** - Pro automatizaci (volitelné)

## 🔧 Příkazy pro Google Cloud

### Základní setup

```bash
# Instalace (macOS)
brew install --cask google-cloud-sdk

# Přihlášení
gcloud auth login

# Nastavení projektu
gcloud config set project VÁŠ-PROJECT-ID

# Povolení API
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

### Cloud Run deployment

```bash
# Automatický (doporučeno)
./scripts/deploy/deploy-to-gcp.sh

# Manuální
gcloud run deploy excelmerger-pro \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

### App Engine deployment

```bash
# Automatický (doporučeno)
./scripts/deploy/deploy-to-appengine.sh

# Manuální
npm run build
gcloud app deploy
```

### Monitoring

```bash
# Cloud Run logy
gcloud run logs tail --service excelmerger-pro --region europe-west1

# App Engine logy
gcloud app logs tail

# Seznam deploymentů
gcloud run services list
gcloud app versions list
```

## 🎨 Použití v iframe

Po nasazení vložte aplikaci do iframe:

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

## 📊 Srovnání Google Cloud služeb

### Cloud Run ⭐⭐⭐⭐⭐ (Doporučeno)

- **Cena:** 💰 Velmi nízká (platíte jen za použití)
- **Škálování:** Automatické (včetně na 0)
- **Setup:** 5 minut
- **Použití:** Kontejnerizované aplikace
- **Výhody:** Nejjednodušší, nejlevnější, nejflexibilnější

### App Engine ⭐⭐⭐⭐

- **Cena:** 💰💰 Střední
- **Škálování:** Automatické
- **Setup:** 5 minut
- **Použití:** Plně spravované aplikace
- **Výhody:** Zero-config, integrované služby

### Cloud Storage ⭐⭐⭐

- **Cena:** 💰 Velmi nízká
- **Škálování:** Neomezené
- **Setup:** 2 minuty
- **Použití:** Pouze statické SPA
- **Výhody:** Nejlevnější, nejrychlejší
- **Nevýhody:** Omezená iframe podpora, žádný backend

## 🔐 Bezpečnost

### Environment variables

```bash
# Cloud Run
gcloud run services update excelmerger-pro \
  --set-env-vars "API_KEY=xxx,DB_URL=xxx"

# App Engine
# Přidejte do app.yaml:
env_variables:
  API_KEY: 'xxx'
  DB_URL: 'xxx'
```

### Secrets (doporučeno pro citlivá data)

```bash
# Vytvoření secret
gcloud secrets create api-key --data-file=-
# Zadejte hodnotu a stiskněte Ctrl+D

# Použití v Cloud Run
gcloud run services update excelmerger-pro \
  --update-secrets=API_KEY=api-key:latest
```

## 💰 Odhad nákladů

### Cloud Run (Doporučeno)

- **Free tier:** 2 miliony požadavků/měsíc
- **Malý projekt:** ~$0-5/měsíc
- **Střední projekt:** ~$10-50/měsíc
- **Velký projekt:** ~$100+/měsíc

### App Engine

- **Free tier:** 28 hodin instance/den
- **Malý projekt:** ~$10-20/měsíc
- **Střední projekt:** ~$50-200/měsíc
- **Velký projekt:** ~$500+/měsíc

### Cloud Storage

- **Free tier:** 5 GB storage
- **Malý projekt:** ~$0.50-2/měsíc
- **Střední projekt:** ~$5-20/měsíc
- **Velký projekt:** ~$50+/měsíc

## 🆘 Řešení problémů

### Aplikace se nenačítá v iframe

→ Přečtěte si `IFRAME_SOLUTION.md`

### Chyby při buildu

```bash
# Zkontrolujte logy
gcloud builds list
gcloud builds log BUILD_ID
```

### Chyby při deploymentu

```bash
# Zkontrolujte logy
gcloud run logs tail --service excelmerger-pro
```

### Permission denied

```bash
# Zkontrolujte oprávnění
gcloud projects get-iam-policy PROJECT_ID
```

## 📚 Další zdroje

- [Google Cloud dokumentace](https://cloud.google.com/docs)
- [Cloud Run dokumentace](https://cloud.google.com/run/docs)
- [App Engine dokumentace](https://cloud.google.com/appengine/docs)
- [Pricing calculator](https://cloud.google.com/products/calculator)

## ✅ Checklist

- [ ] Přečetl jsem `QUICK_DEPLOYMENT.md`
- [ ] Vybral jsem platformu (`DEPLOYMENT_OPTIONS.md`)
- [ ] Nainstaloval jsem Google Cloud SDK
- [ ] Přihlásil jsem se (`gcloud auth login`)
- [ ] Nastavil jsem projekt
- [ ] Spustil jsem deployment script
- [ ] Aplikace je dostupná na URL
- [ ] Otestoval jsem iframe embedding
- [ ] Nastavil jsem monitoring (volitelné)
- [ ] Nastavil jsem CI/CD (volitelné)

## 🎯 Doporučení

Pro vaši aplikaci **doporučuji Google Cloud Run**, protože:

✅ **Nejjednodušší setup** - Jeden příkaz a je to hotové  
✅ **Nejlevnější** - Platíte pouze za skutečné použití  
✅ **Automatické škálování** - Včetně škálování na 0  
✅ **Plná iframe podpora** - Vše je nakonfigurováno  
✅ **HTTPS zdarma** - Automatický SSL certifikát  
✅ **Snadná CI/CD** - GitHub Actions workflow připraven

## 🚀 Začněte hned teď!

```bash
# 1. Instalace Google Cloud SDK
brew install --cask google-cloud-sdk

# 2. Přihlášení
gcloud auth login

# 3. Deploy!
./scripts/deploy/deploy-to-gcp.sh
```

**To je vše! Za 5 minut budete mít aplikaci live s plnou podporou iframe! 🎉**

---

**Vytvořeno:** 2026-01-01  
**Verze:** 0.9.4-260102  
**Status:** ✅ Připraveno k deploymentu
