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

Fonty, výplně a okraje se kopírují jako hodnoty do nového sešitu. Interní čísla
stylů zdrojového sešitu se nepřenášejí. Výstup přebírá také motiv a indexovanou
barevnou paletu, aby zůstaly zachované barvy buněk odkazující na tyto hodnoty.
Vzorce se kopírují beze změny odkazů, stejně jako dříve.
Generované oddělovače `=== NázevListu ===` se ukládají jako text, aby je Excel
nevyhodnocoval jako neplatné vzorce a nenabízel opravu souboru.

## Regresní testy

Z kořene repozitáře s Pythonem 3 a závislostmi z `tests/python/requirements.txt`:

```bash
python3 -m unittest discover -s tests/python -p 'test_*.py' -v -b
```

CI používá izolované Python prostředí a instalaci wheelů ověřenou hashi:

```bash
python3 -m pip install --only-binary=:all: --require-hashes -r tests/python/requirements.txt
```

Testy ukládají a znovu načítají skutečné XLSX soubory. Kontrolují styly, motiv,
paletu, data, vzorce, rozložení, vynechávané listy a oba způsoby zadání CLI výstupu.
