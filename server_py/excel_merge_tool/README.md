# Excel Merge Tool (merge_final.py)

CLI nástroj pro sloučení více listů z jednoho Excel souboru do jednoho listu `Kombinovane` se zachováním formátování.

## Požadavky

- Python 3.x
- `openpyxl`

Instalace:

```bash
pip install -r requirements.txt
```

## Použití

```bash
python merge_final.py vstup.xlsx
```

Vytvoří `vstup_combined_final.xlsx`.

```bash
python merge_final.py vstup.xlsx vystup.xlsx
```

## Vlastnosti

- Zachová formátování buněk (styly, čís. formáty, zarovnání, ochranu)
- Přidá sloupec `List` s názvem zdrojového listu
- Přidá modré oddělovače `=== NázevListu ===`
- Přeskočí listy `Rekapitulace stavby`, `Pokyny pro vyplnění` + hidden/veryHidden
- Nastaví autofilter na celý rozsah výsledku

