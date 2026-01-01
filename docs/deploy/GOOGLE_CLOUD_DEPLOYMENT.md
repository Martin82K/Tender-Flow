# 🚀 Google Cloud Platform Deployment Guide

Tento průvodce popisuje různé způsoby nasazení aplikace na Google Cloud Platform.

Poznámka: helper skripty jsou v `./scripts/deploy/`.

## 📋 Obsah

1. [Cloud Run (Doporučeno)](#cloud-run-doporučeno)
2. [App Engine](#app-engine)
3. [Cloud Storage + Load Balancer](#cloud-storage--load-balancer)
4. [Compute Engine](#compute-engine)

---

## 🎯 Cloud Run (Doporučeno)

Cloud Run je nejjednodušší a nejlevnější způsob pro nasazení kontejnerizovaných aplikací.

### Předpoklady

```bash
# Instalace Google Cloud SDK
# macOS:
brew install --cask google-cloud-sdk

# Nebo stáhněte z: https://cloud.google.com/sdk/docs/install
```

### Krok 1: Inicializace a přihlášení

```bash
# Přihlášení k Google Cloud
gcloud auth login

# Nastavení projektu
gcloud config set project VÁŠ-PROJECT-ID

# Povolení potřebných API
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Krok 2: Vytvoření Dockerfile

Vytvořte soubor `Dockerfile` v root projektu:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

# Expose port (Cloud Run uses PORT env variable)
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
```

### Krok 3: Vytvoření .dockerignore

```bash
cat > .dockerignore << 'EOF'
node_modules
dist
.git
.gitignore
.env
.env.local
*.md
.DS_Store
npm-debug.log
.vscode
.idea
EOF
```

### Krok 4: Build a Deploy

```bash
# Build a push do Container Registry
gcloud builds submit --tag gcr.io/VÁŠ-PROJECT-ID/excelmerger-pro

# Deploy na Cloud Run
gcloud run deploy excelmerger-pro \
  --image gcr.io/VÁŠ-PROJECT-ID/excelmerger-pro \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"
```

### Krok 5: Nastavení vlastní domény (volitelné)

```bash
# Mapování vlastní domény
gcloud run domain-mappings create \
  --service excelmerger-pro \
  --domain your-domain.com \
  --region europe-west1
```

---

## 🏗️ App Engine

App Engine je plně spravovaná platforma pro webové aplikace.

### Krok 1: Vytvoření app.yaml

```yaml
runtime: nodejs18

instance_class: F1

env_variables:
  NODE_ENV: "production"

handlers:
  # Serve static files from dist directory
  - url: /assets
    static_dir: dist/assets
    secure: always

  - url: /.*
    script: auto
    secure: always

automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.65
```

### Krok 2: Aktualizace package.json

Přidejte do `package.json`:

```json
{
  "scripts": {
    "gcp-build": "npm run build",
    "start": "node server.js"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### Krok 3: Deploy

```bash
# Inicializace App Engine (pouze poprvé)
gcloud app create --region=europe-west

# Deploy aplikace
gcloud app deploy

# Otevřít aplikaci v prohlížeči
gcloud app browse
```

### Krok 4: Sledování logů

```bash
# Sledování logů v reálném čase
gcloud app logs tail -s default

# Zobrazení posledních logů
gcloud app logs read
```

---

## 💾 Cloud Storage + Load Balancer

Statické hostování s CDN (nejlevnější pro statické SPA).

### Krok 1: Vytvoření bucket

```bash
# Vytvoření bucket
gsutil mb -l europe-west1 gs://excelmerger-pro

# Nastavení jako veřejný
gsutil iam ch allUsers:objectViewer gs://excelmerger-pro

# Konfigurace jako web hosting
gsutil web set -m index.html -e index.html gs://excelmerger-pro
```

### Krok 2: Build a upload

```bash
# Build aplikace
npm run build

# Upload do Cloud Storage
gsutil -m rsync -r -d dist gs://excelmerger-pro

# Nastavení cache headers
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" \
  gs://excelmerger-pro/**.html

gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" \
  gs://excelmerger-pro/assets/**
```

### Krok 3: Nastavení Load Balancer (pro HTTPS a vlastní doménu)

```bash
# Vytvoření backend bucket
gcloud compute backend-buckets create excelmerger-backend \
  --gcs-bucket-name=excelmerger-pro \
  --enable-cdn

# Vytvoření URL map
gcloud compute url-maps create excelmerger-lb \
  --default-backend-bucket=excelmerger-backend

# Vytvoření SSL certifikátu
gcloud compute ssl-certificates create excelmerger-cert \
  --domains=your-domain.com

# Vytvoření HTTPS proxy
gcloud compute target-https-proxies create excelmerger-proxy \
  --url-map=excelmerger-lb \
  --ssl-certificates=excelmerger-cert

# Vytvoření forwarding rule
gcloud compute forwarding-rules create excelmerger-https-rule \
  --global \
  --target-https-proxy=excelmerger-proxy \
  --ports=443
```

---

## 🖥️ Compute Engine

Virtuální server s plnou kontrolou.

### Krok 1: Vytvoření VM instance

```bash
# Vytvoření VM
gcloud compute instances create excelmerger-vm \
  --zone=europe-west1-b \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --tags=http-server,https-server

# Povolení HTTP/HTTPS traffic
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server
```

### Krok 2: SSH a instalace

```bash
# Připojení k VM
gcloud compute ssh excelmerger-vm --zone=europe-west1-b

# Na VM:
# Instalace Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalace nginx
sudo apt-get install -y nginx

# Klonování projektu
git clone https://github.com/your-repo/excelmerger-pro.git
cd excelmerger-pro

# Instalace závislostí a build
npm install
npm run build

# Spuštění serveru
npm start
```

### Krok 3: Konfigurace Nginx jako reverse proxy

```bash
# Vytvoření nginx konfigurace
sudo nano /etc/nginx/sites-available/excelmerger

# Přidejte:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Aktivace konfigurace
sudo ln -s /etc/nginx/sites-available/excelmerger /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Krok 4: Nastavení PM2 pro auto-restart

```bash
# Instalace PM2
sudo npm install -g pm2

# Spuštění aplikace s PM2
pm2 start server.js --name excelmerger-pro

# Nastavení auto-start při restartu
pm2 startup
pm2 save
```

---

## 🔧 Automatizace s GitHub Actions

Vytvořte `.github/workflows/deploy-gcp.yml`:

```yaml
name: Deploy to Google Cloud

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: excelmerger-pro
  REGION: europe-west1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker
        run: gcloud auth configure-docker

      - name: Build Docker image
        run: |
          docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA .
          docker tag gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
                     gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

      - name: Push to Container Registry
        run: |
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated
```

---

## 📊 Srovnání metod

| Metoda             | Cena           | Složitost       | Škálovatelnost  | Použití                        |
| ------------------ | -------------- | --------------- | --------------- | ------------------------------ |
| **Cloud Run**      | 💰 Nízká       | ⭐ Snadné       | ⚡ Vysoká       | Doporučeno pro většinu případů |
| **App Engine**     | 💰💰 Střední   | ⭐⭐ Střední    | ⚡ Vysoká       | Plně spravované aplikace       |
| **Cloud Storage**  | 💰 Velmi nízká | ⭐ Velmi snadné | ⚡ Velmi vysoká | Pouze statické SPA             |
| **Compute Engine** | 💰💰💰 Vysoká  | ⭐⭐⭐ Složité  | ⚡ Střední      | Plná kontrola                  |

---

## 🎯 Doporučení

Pro vaši aplikaci **doporučuji Cloud Run**, protože:

✅ Nejjednodušší setup  
✅ Automatické škálování (včetně na 0)  
✅ Platíte pouze za použití  
✅ Podpora iframe (s naším server.js)  
✅ HTTPS zdarma  
✅ Snadná CI/CD integrace

---

## 🚀 Rychlý start s Cloud Run

```bash
# 1. Přihlášení
gcloud auth login

# 2. Nastavení projektu
gcloud config set project VÁŠ-PROJECT-ID

# 3. Povolení API
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# 4. Deploy (vše v jednom příkazu)
gcloud run deploy excelmerger-pro \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

To je vše! Google Cloud automaticky:

- Detekuje Node.js aplikaci
- Vytvoří Dockerfile (pokud neexistuje)
- Buildne kontejner
- Nasadí na Cloud Run
- Poskytne HTTPS URL

---

## 📚 Další zdroje

- [Cloud Run dokumentace](https://cloud.google.com/run/docs)
- [App Engine dokumentace](https://cloud.google.com/appengine/docs)
- [Cloud Storage dokumentace](https://cloud.google.com/storage/docs)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs)

---

**Datum:** 2026-01-01  
**Verze:** 0.9.3-260101
