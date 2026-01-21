---
description: Doplneni uzivatelske prirucky o nove funkce a zmeny ve stejnem stylu
---

# 📘 Workflow: Doplneni uzivatelske prirucky

Tento workflow resi pouze doplneni novinek a souvisejicich informaci ve stejnem stylu,
ktery uz je v prirucce pouzit. Neprovadi se prepis ani prestrukturovani kapitol.

---

## Vstupy

- Seznam novinek (release notes, changelog, seznam commit/PR zmen)
- Aktualni verze aplikace a datum (napr. v0.9.7, 2026-01-21)
- Kontext UI (menu, zalozky, nastaveni), kde se zmeny projevuji

---

## Soubory

- `public/user-manual/index.md`
- Volitelne obrazky: `public/user-manual/assets/`

---

## 1. Doplnit sekci Novinky

1. Otevri `public/user-manual/index.md`.
2. Najdi sekci "Novinky (posledni zmeny)".
3. Pridat novou podsekci jako prvni v poradi:
   - Nadpis verze: `### vX.Y.Z`
   - Odrazky s tucnym nazvem funkce na zacatku.
4. Drz stejnou strukturu odrazek a styl pojmenovani jako u posledni verze.

---

## 2. Doplnit souvisejici kapitoly

Pouze pokud novinka meni chovani nebo UX v konkretni oblasti:

- Doplneni kratkeho odstavce nebo odrazek do prislusne kapitoly
- Zachovat existujici terminologii a pojmenovani sekci
- Neprepisovat existujici obsah, pouze doplnit

---

## 3. Aktualizace meta radku prirucky

Na zacatku souboru uprav radek s verzi prirucky:

- Cislo prirucky
- Datum
- Verze aplikace

---

## Kontrolni seznam

- Novinky jsou nejvyse v seznamu a ve stejnem formatu jako predchozi verze
- Nedochazi k prepisu struktury kapitol
- Jazyk je cesky, kratky a vecny
- Jsou pouzity stejne nazvy menu a zalozek jako v aplikaci

---

## Volitelne

```bash
npm run build:user-manual
```
