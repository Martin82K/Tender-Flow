export const PUBLIC_FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    "question": "Co je Tender Flow?",
    "answer": "Tender Flow je česká platforma pro přípravu a vedení staveb. Propojuje poptávky, výběrová řízení, nabídky subdodavatelů, smlouvy, projektové dokumenty a harmonogram. Je určena stavebním firmám, přípravářům, stavbyvedoucím, projektovým manažerům a kalkulantům."
  },
  {
    "question": "Kolik stojí Tender Flow a jak získám ukázku?",
    "answer": "Tender Flow nabízíme jako firemní licenci Enterprise s individuální cenou podle počtu licencí a dohodnutého období. Platba probíhá bankovním převodem na základě faktury. Ukázku a podmínky přístupu domluvíte na martin@tenderflow.cz."
  },
  {
    "question": "Jak funguje AI čtení smluv a ochrana dokumentů?",
    "answer": "Mistral AI pomáhá přečíst naskenované smlouvy a objednávky a získat klíčové údaje. Výsledky před uložením kontroluje uživatel. Pro podporovaná API používáme Zero Data Retention: vstupy a výstupy se u Mistralu neuchovávají déle, než je nutné k odpovědi. Tento režim nemaže dokumenty uložené v Tender Flow a nevztahuje se automaticky na připojené AI klienty. Nastavení trénování modelů je samostatné."
  },
  {
    "question": "Co umožňuje vlastní MCP server?",
    "answer": "Kompatibilní AI klient může s udělenými oprávněními číst projektové údaje, nabídky a smluvní přehledy. Podporované změny, například vytvoření úkolu nebo úprava stavu či ceny nabídky, vyžadují přípravu návrhu, potvrzení a provedení. Přístup lze odvolat. E-mail a kalendář vyžadují vlastní konektory klienta a mají vlastní pravidla ochrany dat."
  },
  {
    "question": "Co zahrnuje TODO Osobní a propojení s Microsoft To Do?",
    "answer": "TODO Osobní nabízí seznamy, projekty, podúkoly, termíny a připomínky. Volitelné propojení s Microsoft To Do synchronizuje podporované údaje ve spárovaných seznamech obousměrně. Přílohy, opakování a ostatní osobní seznamy Microsoft To Do se touto integrací nepřenášejí."
  },
  {
    "question": "Je Tender Flow dostupný na webu a desktopu? Funguje offline?",
    "answer": "Tender Flow je dostupný jako webová aplikace a desktopová aplikace pro Windows a macOS. Přihlášení, ověření licence, sdílená data, synchronizace a AI služby vyžadují připojení k internetu. Některé lokální nástroje pracují se soubory v počítači; nejde o plný offline režim celé aplikace."
  },
  {
    "question": "Jaké podklady lze v projektu evidovat a exportovat?",
    "answer": "Projekt propojuje plán výběrových řízení, nabídky, smlouvy, dodatky, fakturaci, dokumenty a harmonogram. Přehled stavby lze exportovat do Excelu. Další exporty a lokální nástroje jsou dostupné podle konkrétního modulu, platformy a oprávnění."
  },
  {
    "question": "Jak jsou řízena přístupová práva?",
    "answer": "Přístup k projektovým datům se řídí účtem, organizací, rolí a sdílením projektu. Databázová pravidla Row Level Security omezují přístup k záznamům. Podmínky zpracování dat popisují zásady ochrany osobních údajů a zpracovatelská doložka DPA. Dostupnost funkcí závisí také na licenci a konfiguraci."
  }
];
