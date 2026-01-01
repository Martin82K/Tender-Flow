# Deployment docs

Deployment / hosting materiály jsou přesunuté z rootu do `docs/deploy/`, aby byl root přehlednější.

## Co zůstává v rootu (kvůli platformám)

- `railway.json` (Railway detekuje v rootu)
- `netlify.toml` a `public/_headers` (Netlify / hosting hlaviček)
- `app.yaml` (Google App Engine)
- `Dockerfile` (Docker build)
- `server.js` (produkční start: `npm start`)

## Skripty

- Railway: `./scripts/deploy/deploy-to-railway.sh`
- GCP: `./scripts/deploy/deploy-to-gcp.sh`
- App Engine: `./scripts/deploy/deploy-to-appengine.sh`

## Iframe test nástroje

- Iframe test stránka: `./tools/iframe/iframe-test.html`
- Kontrola hlaviček: `node ./tools/iframe/test-iframe-headers.js`

