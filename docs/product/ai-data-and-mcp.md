# Mistral AI, data a vlastní MCP server

## Zpracování dokumentů

TenderFlow používá Mistral AI pro OCR dokumentů. Produkční organizace má podle
potvrzení provozovatele z 4. září 2026 aktivované Zero Data Retention (ZDR).
U podporovaných bezstavových API požadavků Mistral neuchovává vstupy a výstupy
déle, než je nutné k vytvoření odpovědi. Mezi podporované cesty patří
`/v1/ocr` a `/v1/chat/completions`; rozsah vždy ověřte pro konkrétní službu.

ZDR neznamená smazání dokumentů, výsledků či obchodních dat uložených v TenderFlow.
Nevztahuje se automaticky na Files, Agents, Batch, Conversations, Libraries,
Chat ani Labs. Nastavení využití dat pro trénování je samostatná volba.
Při změně AI nastavení je nutné znovu zkontrolovat zvoleného poskytovatele,
API cestu a soukromí. Administrace stále obsahuje kompatibilitu s dřívějšími
poskytovateli; změna veřejného obsahu sama nemění jejich konfiguraci.

Zdroj: [Mistral – Zero Data Retention](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention).

## Příklad práce s více konektory

Landing page představuje společný postup v AI klientovi: z e-mailu dodavatele
získat změnu nabídky či termínu, dohledat projektové souvislosti v TenderFlow,
porovnat termín s kalendářem a připravit odpověď a navazující úkol.
Po potvrzení může klient použít podporované zápisy MCP, například vytvořit
úkol nebo změnit stav či cenu nabídky.

Čtení a případné odesílání e-mailů, práce s kalendářem a externími dokumenty
vyžadují samostatné konektory daného AI klienta. Nejde o zabudované nástroje
MCP serveru TenderFlow ani o automatickou službu sledující schránku.
Konkrétní možnosti závisejí na klientovi, konektorech a udělených oprávněních.
Technický návod k připojení zůstává níže a v MCP dokumentaci.

## Připojení MCP

TenderFlow provozuje vlastní Model Context Protocol server na adrese
`https://www.tenderflow.cz/api/mcp`. Kompatibilní AI klient přes něj může
pracovat s povolenými projekty, nabídkami, kontakty a úkoly.

1. V nastavení TenderFlow otevřete **Nástroje → MCP**.
2. Do kompatibilního klienta přidejte adresu serveru a dokončete přihlášení.
3. Povolte pouze potřebné čtení a případně konkrétní zápisy. Přístup lze odvolat.
4. Změny projdou přípravou návrhu, potvrzením a provedením. Před potvrzením
   zkontrolujte cílový projekt, hodnoty a navrženou akci.

Podporované zápisy zahrnují vytvoření úkolu a vybrané změny nabídek.
Server respektuje přístupová práva a organizaci přihlášeného uživatele.
Připojený AI klient má vlastní pravidla zpracování dat; ZDR aktivované pro
Mistral API TenderFlow se na něj automaticky nepřenáší.

Technický kontrakt, OAuth a seznam nástrojů: [MCP dokumentace](../mcp/README.md).

## Obchodní podmínky na veřejném webu

Veřejná nabídka je firemní licence Enterprise s individuální cenou.
Úhrada probíhá bankovním převodem podle faktury. Landing page ani její SEO
podklady nenabízejí karetní checkout nebo automatický trial. Historická
billing data a serverová kompatibilita nejsou tímto obsahovým krokem migrovány.


## Veřejné ujištění a podmínky od 5. září 2026

Landing page popisuje ochranu dokumentů krátce: Mistral AI po zpracování
neukládá obsah dokumentu ani odpověď ve svém API. Technický rozsah ZDR
zůstává popsaný výše. Toto ujištění se týká čtení dokumentů přes Mistral,
nikoli úložiště TenderFlow nebo samostatně připojených MCP klientů.

Podmínky uvádějí závazek řídit se příslušnými pravidly EU AI Act a nutnost
kontroly AI výstupů člověkem. Nejde o prohlášení o certifikaci ani o závěr,
že samotné ZDR zajišťuje soulad se všemi povinnostmi AI Act.
Zdroj: [Evropská komise – AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai).

Verze podmínek `2026-09-05` nahrazuje `2026-03-12` pro nově uzavírané smlouvy.
Pro stávající vztahy se nové znění použije až po přijetí nebo výslovné dohodě;
do té doby platí dosavadní ujednání. Aktualizovaná webová aplikace vyžádá
přijetí aktuálních dokumentů při dalším vstupu. Kontrola verze je klientská:
starší desktopový bundle novou verzi nezná a nelze tvrdit, že vynutí její
přijetí. Serverové vynucení minimální verze ani desktop release nejsou součástí
této obsahové změny. Předchozí souhlas se automaticky nepřepisuje.

Verze zásad ochrany osobních údajů se nemění. Platba převodem se vztahuje
na nově sjednané licence; změna textu neruší případná historická platební
ujednání. Přechod existující smlouvy na převod vyžaduje dohodu a skutečnou
změnu účtování. Stejně tak ZDR platí pro Mistral; při administrátorem zvoleném
jiném poskytovateli se řídí zpracování jeho vlastními pravidly.
