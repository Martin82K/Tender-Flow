# 🔐 Nastavení GitHub Actions pro Google Cloud

Tento průvodce vám ukáže, jak nastavit automatické nasazení na Google Cloud pomocí GitHub Actions.

Poznámka: ostatní deployment materiály jsou v `docs/deploy/`.

## 📋 Předpoklady

- Google Cloud projekt
- GitHub repository
- Google Cloud SDK nainstalované lokálně

## 🔧 Krok 1: Vytvoření Service Account

```bash
# Nastavte proměnné
export PROJECT_ID="your-project-id"
export SA_NAME="github-actions-deployer"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Vytvořte service account
gcloud iam service-accounts create $SA_NAME \
  --display-name "GitHub Actions Deployer" \
  --project $PROJECT_ID

# Přidělte potřebná oprávnění
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

## 🔑 Krok 2: Vytvoření klíče

```bash
# Vytvořte JSON klíč
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=$SA_EMAIL \
  --project=$PROJECT_ID

# Zobrazit obsah klíče (pro kopírování)
cat github-actions-key.json
```

**⚠️ DŮLEŽITÉ:** Tento klíč nikdy necommitujte do Git!

## 🔒 Krok 3: Nastavení GitHub Secrets

1. Přejděte na GitHub repository
2. Klikněte na **Settings** → **Secrets and variables** → **Actions**
3. Klikněte na **New repository secret**

### Přidejte tyto secrets:

#### `GCP_PROJECT_ID`

- **Name:** `GCP_PROJECT_ID`
- **Value:** Vaše Google Cloud Project ID (např. `my-project-12345`)

#### `GCP_SA_KEY`

- **Name:** `GCP_SA_KEY`
- **Value:** Celý obsah souboru `github-actions-key.json`

```bash
# Zkopírujte obsah klíče
cat github-actions-key.json | pbcopy  # macOS
# nebo
cat github-actions-key.json | xclip -selection clipboard  # Linux
```

## ✅ Krok 4: Ověření nastavení

Po nastavení secrets:

1. Pushněte změny do `main` nebo `master` branch
2. Přejděte na **Actions** tab v GitHub
3. Sledujte průběh deploymentu
4. Po úspěšném dokončení najdete URL v deployment summary

## 🚀 Použití

### Automatické nasazení

Každý push do `main` nebo `master` branch spustí automatické nasazení.

### Manuální nasazení

1. Přejděte na **Actions** tab
2. Vyberte workflow "Deploy to Google Cloud Run"
3. Klikněte na **Run workflow**
4. Vyberte branch a klikněte **Run workflow**

## 🔍 Řešení problémů

### Chyba: Permission denied

**Řešení:** Zkontrolujte, že service account má všechna potřebná oprávnění:

```bash
# Zobrazit aktuální oprávnění
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SA_EMAIL}"
```

### Chyba: Invalid credentials

**Řešení:**

1. Ověřte, že `GCP_SA_KEY` obsahuje platný JSON
2. Zkontrolujte, že klíč není expirovaný
3. Vytvořte nový klíč

### Chyba: API not enabled

**Řešení:** Povolte potřebné API:

```bash
gcloud services enable cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project=$PROJECT_ID
```

## 🧹 Bezpečnost

### Po nastavení:

1. **Smažte lokální klíč:**

   ```bash
   rm github-actions-key.json
   ```

2. **Rotace klíčů (doporučeno každých 90 dní):**

   ```bash
   # Vypište všechny klíče
   gcloud iam service-accounts keys list \
     --iam-account=$SA_EMAIL

   # Smažte starý klíč
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=$SA_EMAIL

   # Vytvořte nový klíč
   gcloud iam service-accounts keys create new-key.json \
     --iam-account=$SA_EMAIL

   # Aktualizujte GitHub secret
   ```

3. **Audit logů:**
   ```bash
   # Zobrazit aktivity service account
   gcloud logging read \
     "protoPayload.authenticationInfo.principalEmail=${SA_EMAIL}" \
     --limit 50 \
     --format json
   ```

## 📊 Monitoring

### Sledování deploymentů:

```bash
# Cloud Run logy
gcloud run logs tail --service excelmerger-pro --region europe-west1

# Build logy
gcloud builds list --limit 10

# Detaily konkrétního buildu
gcloud builds describe BUILD_ID
```

### GitHub Actions logy:

- Přejděte na **Actions** tab
- Klikněte na konkrétní workflow run
- Prohlédněte si jednotlivé kroky

## 🎯 Checklist

- [ ] Service account vytvořen
- [ ] Oprávnění přidělena
- [ ] JSON klíč vytvořen
- [ ] `GCP_PROJECT_ID` secret nastaven
- [ ] `GCP_SA_KEY` secret nastaven
- [ ] Lokální klíč smazán
- [ ] Workflow soubor commitnut
- [ ] První deployment úspěšný
- [ ] URL aplikace funguje
- [ ] Iframe test prošel

## 📚 Další zdroje

- [GitHub Actions dokumentace](https://docs.github.com/en/actions)
- [Google Cloud Run CI/CD](https://cloud.google.com/run/docs/continuous-deployment)
- [Service Account best practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)

---

**Datum:** 2026-01-01  
**Verze:** 0.9.4-260102
