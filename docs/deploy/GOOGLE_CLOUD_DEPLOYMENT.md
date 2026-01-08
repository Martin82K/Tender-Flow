# Google Cloud Deployment (Cloud Run, bez Dockeru)

Tento návod nasadí aplikaci na **Google Cloud Run** přímo ze zdrojových kódů pomocí `gcloud run deploy --source .` (Cloud Build + buildpacks).

## Předpoklady

- Google Cloud projekt + billing
- Nainstalovaný Google Cloud SDK (`gcloud`)
- Přihlášení: `gcloud auth login`

## 1) Nastavení projektu a API

```bash
gcloud config set project VÁŠ-PROJECT-ID
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

## 2) Rychlý deploy (doporučeno)

```bash
./scripts/deploy/deploy-to-gcp.sh
```

Skript použije `gcloud run deploy --source .` a nastaví základní parametry služby (region, port, memory, env).

## 3) Manuální deploy (alternativa)

```bash
gcloud run deploy excelmerger-pro \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production"
```

## 4) GitHub Actions (automatické nasazení)

- Workflow: `.github/workflows/deploy-gcp.yml`
- Secrets:
  - `GCP_PROJECT_ID` – ID projektu
  - `GCP_SA_KEY` – JSON klíč service accountu

Detailní postup je v `docs/deploy/GITHUB_ACTIONS_SETUP.md`.

## 5) Ověření a troubleshooting

- URL služby: `gcloud run services describe excelmerger-pro --region europe-west1 --format 'value(status.url)'`
- Logy: `gcloud run logs tail --service excelmerger-pro --region europe-west1`
