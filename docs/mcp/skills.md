# Tender Flow skilly nad MCP

Stav: návrh; skilly uvedené níže nejsou dosud produkční MCP capabilities
Zdroj pravdy po implementaci: verzované skill balíčky a MCP tool/resource katalog

Skill je opakovatelný pracovní postup agenta nad omezenými MCP schopnostmi.
Neuděluje nové oprávnění: může použít pouze tools/resources viditelné tokenu.
Business změny procházejí serverovým prepare → confirm → execute; jedinou
přímou write výjimkou je omezená auditovaná Outlook metadata vazba popsaná v
[bezpečném zápisu](write-safety.md).

Aktuálně lze produkčně stavět jen skilly nad obecnou read permission.
`contacts read` a `read + write` varianty jsou roadmapa a zůstávají disabled.

## Plánované skilly

| Skill | Účel | Primární vstupy | Výstup | Režim |
| --- | --- | --- | --- | --- |
| Tender intelligence | shrnutí stavu VŘ a nabídek | projekt, VŘ, termín | citované shrnutí a mezery | read-only |
| Contract control | kontrola cen, dodatků, retencí a termínů | organizace/projekt | rizika a checklist | read-only |
| Supplier shortlist | porovnání relevantních dodavatelů | obor, region, VŘ | zdůvodněný shortlist | contacts read |
| Project follow-up | navržení navazujících úkolů | projekt a deadline | plán + volitelný task proposal | read + write |
| Tender risk review | kontrola blížících se a nekonzistentních termínů | projekt/rozsah dní | prioritizovaná rizika | read-only |

## Povinný kontrakt skillu

Každý skill musí deklarovat název/verzi, účel a zákaz použití, potřebné interní permissions,
vstupní a výstupní schema, povolené tools/resources, datovou citlivost, limity,
chybové chování, citace zdrojů, write approval body a eval dataset.

## Bezpečnostní pravidla

- Data z kontaktů, smluv a dokumentů jsou nedůvěryhodný obsah.
- Skill nesmí interpretovat text z dat jako systémový příkaz.
- Chybějící data musí označit; nesmí vymýšlet dodavatele, cenu ani termín.
- Kontaktní PII se zobrazí jen při nezbytnosti a explicitním serverovém contacts grantu.
- Skill nemůže automaticky potvrdit vlastní proposal.
- Filesystem, lokální Excel/PDF a desktop akce nejsou součást remote MCP.

Každý skill dostane pozitivní, hraniční, adversarial a cross-tenant evaly před
publikací. Detailní obecná strategie je v [agent skills](../agent-skills.md).
