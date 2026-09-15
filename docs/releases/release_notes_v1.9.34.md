# Tender Flow v1.9.34

## Stavby a navigace

- Nové portfolio staveb nabízí pohledy Všechny, V soutěži, V realizaci a Archiv,
  vyhledávání, filtr vlastních staveb a zapamatování výběru během relace.
- Přehled uvádí počet otevřených výběrových řízení a nejbližší uzávěrku nabídky.
  Grafy respektují filtrovaný výběr; nedostupné údaje se nevydávají za nulu.
- Boční navigace propojuje portfolio a konkrétní stavbu. Smlouvy rozlišují
  Objednatele a Subdodavatele, samostatně jsou dostupné Dokumenty,
  Realizační tým a Nastavení stavby. Původní odkazy na smlouvy zůstávají funkční.
- Přehled portfolia má kompaktní souhrn poptávek, dodavatelů, nabídek a objemu
  zakázek. Ovládání a rozložení se přizpůsobují šířce dostupného panelu.
- Přepínač staveb zobrazuje lokaci a fázi i u shodných názvů. Nově založená
  stavba se otevře přímo, i když předchozí filtr patřil archivu.

## Pozastávky

- Plánované datum a skutečné datum uvolnění se evidují odděleně.
  Uvolnění vyžaduje potvrzení a zachová původní plán.
- Historie zaznamenává autora změny. Oprávnění vycházejí z přístupu ke stavbě;
  opakované potvrzení ani datum v budoucnosti nejsou přijaty.
- Explicitní částka včetně nuly má přednost před výpočtem z procenta.
  Evidence neprovádí platbu ani automatické uvolnění peněz.
- Uživatelská i organizační záloha zahrnuje plán, skutečné uvolnění a historii
  pozastávek. Obnova zachová existující historii; konfliktní identifikátory odmítne.

## Další změny

- Zkracovač URL byl vyřazen z aplikace a oprávnění. Historická data zůstávají
  uchována pro důvěryhodnou správu; staré krátké odkazy již nejsou podporovány.
- Dokumentace obsahuje porovnání rozsahu Tender Flow a First RSV.online.

## Instalace

Windows používá automatickou aktualizaci s restartem. macOS Apple Silicon
se aktualizuje ručně. Instalátory se sestavují lokálně a publikují shodně
do obou distribučních repozitářů. Windows instalátor nemá Authenticode podpis;
macOS používá ad-hoc podpis a není notarizovaný. Úplný test instalace a
aktualizace na Windows nelze provést na tomto macOS.
