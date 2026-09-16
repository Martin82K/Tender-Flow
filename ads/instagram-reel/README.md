# Instagram Reel 15s — Tender Flow

Samostatná Remotion kompozice `TenderFlowReel15` pro svislý Instagram Reel
(1080×1920, 15 s). Není součástí webového ani desktopového runtime; žije v
`ads/instagram-reel/`, aby se Remotion nedostal do kořenového `npm ci`.

## Storyboard

| Čas | Obrazovka | Text na plátně |
| --- | --- | --- |
| 0,0–2,5 s | Kategorie | *Kategorie* / **Příprava a VŘ** / Tendry. Nabídky. Smlouva. |
| 2,5–5,0 s | Oslovení | *Uchazeči* / **Oslovení uchazečů** / Koho oslovit. Přehledně. |
| 5,0–8,5 s | Kola | *Nabídky* / **Kola nabídek** / Další kolo bez ztráty kontextu. |
| 8,5–11,5 s | Výběr | *Rozhodnutí* / **Výběr nabídky** / Rozhodnutí zůstane u zakázky. |
| 11,5–15,0 s | Smlouva + CTA | *Uzavření* / **Smlouva** / Jedna cesta v jednom nástroji. / **Zjistit víc** / tenderflow.cz |

CTA (`Zjistit víc` + `tenderflow.cz`) je záměrně v `src/copy.ts`, aby šlo
vyměnit bez zásahu do scény. Spot neslibuje výkaz výměrů, soupisy, položkovou
kalkulaci ani náhradu Helios / First RSV.

## Náhled a render

```bash
cd ads/instagram-reel
npm ci
npm run typecheck
npm run studio
npm run render
```

Z kořene repozitáře:

```bash
npm run ads:reel:install
npm run ads:reel:typecheck
npm run ads:reel:studio
npm run ads:reel:render
```

Výstup: `ads/instagram-reel/out/TenderFlowReel15.mp4`. Poster snímky:

```bash
npm run ads:reel:stills
```

Studio i render používají systémový Chrome, pokud je nastavené
`CHROME_BIN` nebo `REMOTION_BROWSER_EXECUTABLE`. Kompozice je 15 s, 30 fps,
H.264, 9:16.

## Vizuál

Tmavé tokeny skinu **TF basic** (`#1c1b19` podklad, meruňka `#eaa079`).
Persona je přípravář / veřejné zakázky, ne construction ERP.

Remotion má vlastní licenci; před produkčním nasazením reklamy ověřte, zda
stačí volná licence, nebo je potřeba firemní.
