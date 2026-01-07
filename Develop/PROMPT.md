Níže nalezneš konverzaci, která se týká brainstormingu a podkladu k novému modulu naší aplikace.
Má to jeden háček, který bych rád vysvětlil.

1. index je číselník, který vždy zůstane. Můžeš jej také později použít a vytvořit svůj vlastní číselník v jiné podobě.
2. test.xlsx je vlastně tabulka, která obsahuje stavební rozpočet, který má nějaké kody, které mi porovnáváme s kody v našem indexu. To vše se dozvíš níže.
   3.test_vyplneno.xlsx je již hotová tabulka, která obsahuje výsledek, který jsem chtěl.
3. chceme postavit modul k naší aplikaci, který bude dělat přesně toto co se popisuje v tomto dokumentu.
4. jelikož náš stack je Node.js + supabase, nemáme moc možností na backendu. Proto využíváme MCP server, který bude potřeba pravděpodobně dovytvořit tak, aby uměl i python a zvládl náš script. Pokud je toto možné. Pokud ne, dej mi informaci.
5. Níže je tedy script a popis toho, jak se vše odehrává.
6. chtěl bych to jako nový nástroj v Tender Flow, umístění je v sekci nastavení\Prostředí uživatele\ kde již jsou další jako import kontaktů , excel unlocker apod.
7. vytvoř tedy ui, které bude odpovídat tomu, že má editovatelnou šablonu číselníku, a potom drag and drop možnost vložení souboru, který chceme zpracovat a přiřadit mu hodnoty z číselníku.
8. Všechno by mělo mít podrobné logování a progress bar, aby uživatel detailně věděl, že se stále něco děje a ví jaký je stav a že se stále něco deje a proces se nezastavil.

Jasně — tady je hotový Python skript (pro novou aplikaci), který udělá přesně to, co popisuješ:
• načte index.xlsx (číselník: kód + popis)
• projde test.xlsx:
• ve sloupci F hledá buňky s číselným kódem (ignoruje prázdné/formátovací řádky)
• vezme prefix 3 číslice (pokud existuje v indexu), jinak zkusí 2 číslice
• do sloupce B zapíše popis pro tento prefix
• a vyplní stejné B i na následujících řádcích, dokud se ve F neobjeví další číselný kód

Používá openpyxl (běžné pro Excel v Pythonu).

Script:
from **future** import annotations

import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from openpyxl import load_workbook

DIGITS_ONLY = re.compile(r"^\d+$")

def normalize_code(value) -> Optional[str]:
"""
Vrátí číselný kód jako string, pokud je buňka 'číselný kód'.
Ignoruje prázdné / nečíselné / formátovací hodnoty.
"""
if value is None:
return None

    # openpyxl někdy vrátí int/float pro numerické buňky
    if isinstance(value, (int,)):
        return str(value)

    if isinstance(value, float):
        # pokud je to celé číslo (např. 311236101.0)
        if value.is_integer():
            return str(int(value))
        return None

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # někdy může být ve F "311236101 " apod.
        if DIGITS_ONLY.match(s):
            return s
        return None

    return None

def load_index(index_path: Path, sheet_name: Optional[str] = None) -> Dict[str, str]:
"""
Načte index (číselník) z XLSX.
Očekává 2 sloupce: kód a popis (typicky A a B), ale bere první 2 neprázdné hodnoty v řádku.
Vrací dict: { "31": "Svislé a kompletní konstrukce", ... }
"""
wb = load_workbook(index_path, data_only=True)
ws = wb[sheet_name] if sheet_name else wb.active

    mapping: Dict[str, str] = {}

    for row in ws.iter_rows(values_only=True):
        if not row:
            continue

        # najdi první dvě neprázdné hodnoty v řádku
        vals = [v for v in row if v is not None and str(v).strip() != ""]
        if len(vals) < 2:
            continue

        raw_key, raw_desc = vals[0], vals[1]
        key = str(raw_key).strip()
        desc = str(raw_desc).strip()

        # klíč může být v indexu číselný nebo textový, chceme string
        # typicky "31", "311" apod.
        if key and desc:
            mapping[key] = desc

    return mapping

def best_prefix_match(code: str, index_map: Dict[str, str]) -> Optional[Tuple[str, str]]:
"""
Vrátí nejlepší shodu prefixu: - preferuje 3 číslice, pokud jsou v indexu - jinak zkusí 2 číslice
"""
if len(code) >= 3:
p3 = code[:3]
if p3 in index_map:
return p3, index_map[p3]
if len(code) >= 2:
p2 = code[:2]
if p2 in index_map:
return p2, index_map[p2]
return None

def fill_descriptions(
test_path: Path,
index_map: Dict[str, str],
output_path: Path,
sheet_name: Optional[str] = None,
col_code: str = "F",
col_desc: str = "B",
start_row: int = 1,
) -> None:
"""
Prochází test excel: - najde 'segmenty' začínající řádkem s číselným kódem ve F - doplní popis do B pro tento řádek i pro následující řádky
až do dalšího číselného kódu ve F (nebo do konce dat).
"""
wb = load_workbook(test_path)
ws = wb[sheet_name] if sheet_name else wb.active

    max_row = ws.max_row

    current_desc: Optional[str] = None

    for r in range(start_row, max_row + 1):
        code_cell = ws[f"{col_code}{r}"].value
        code = normalize_code(code_cell)

        if code:
            match = best_prefix_match(code, index_map)
            current_desc = match[1] if match else None

        # Pokud máme aktivní popis (segment), zapisujeme do B
        if current_desc:
            ws[f"{col_desc}{r}"].value = current_desc
        # Pokud current_desc není (kód bez shody), necháme B beze změny

    wb.save(output_path)

if **name** == "**main**": # ---- Nastavení cest (uprav dle aplikace / prostředí)
index_file = Path("index.xlsx")
test_file = Path("test.xlsx")
out_file = Path("test_vyplneno.xlsx")

    index_map = load_index(index_file)  # případně: load_index(index_file, sheet_name="Index")
    fill_descriptions(
        test_path=test_file,
        index_map=index_map,
        output_path=out_file,
        sheet_name=None,   # nebo jméno listu
        col_code="F",
        col_desc="B",
        start_row=1
    )

    print(f"Hotovo: uloženo do {out_file}")

Konec scriptu.

Poznámky k chování (důležité)
• „Číselný kód“ beru jako: buňka ve F je int / float celé číslo / string složený jen z číslic.
• Prefix:
• nejdřív zkusí 3 číslice (např. 311)
• když v indexu není, zkusí 2 číslice (např. 31)
• Pokud kód nemá shodu v indexu, segment se nevypisuje (tj. do B se nic nedoplňuje) – lze snadno změnit, když chceš vynutit prázdný text nebo značku „NEZNÁMÝ KÓD“.
