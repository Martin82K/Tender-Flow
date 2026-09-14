"""Generate the three Czech feature guides with ReportLab (no network access)."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'output/pdf/novinky-2026-09-14'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Guide', '/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('GuideBold', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold')
INK = '#292621'
MUTED = '#686157'
ACCENT = '#AF6030'

def para(c, text, x, top, width, size=10.5, color=INK, bold=False):
    p = Paragraph(text, ParagraphStyle('p', fontName='GuideBold' if bold else 'Guide', fontSize=size, leading=size*1.4, textColor=HexColor(color)))
    _, h = p.wrap(width, 800)
    p.drawOn(c, x, top-h)
    return top-h

def shot(c, name, x, top, width):
    path = HERE / 'screenshots' / name
    w,h = Image.open(path).size
    height = width*h/w
    c.drawImage(str(path), x, top-height, width=width, height=height)
    return top-height

def start(name, num, title, intro):
    c=canvas.Canvas(str(OUT/name), pagesize=(595.28,841.89))
    c.setTitle(title+' | Tender Flow')
    c.setAuthor('Tender Flow')
    c.setFillColor(HexColor('#FAF8F4')); c.rect(0,0,596,842,fill=1,stroke=0)
    c.setFillColor(HexColor(ACCENT)); c.rect(40,781,33,4,fill=1,stroke=0)
    para(c,'TENDER FLOW / NOVINKY',40,814,320,10,ACCENT,True)
    para(c,num,507,814,50,10,MUTED)
    y=para(c,title,40,759,515,26,bold=True)
    y=para(c,intro,40,y-14,515,11.5)
    return c,y-24

def finish(c, refs):
    c.setStrokeColor(HexColor('#DED7CB')); c.line(40,73,555,73)
    para(c,'Změny z 14.-15. 9. 2026 | Skutečné komponenty, syntetické ukázkové údaje',40,61,515,8,MUTED)
    para(c,'Ověřený stav main: 708a4267 | '+refs,40,46,515,8,MUTED)
    c.showPage(); c.save()

c,y=start('01-jedna-smlouva-vice-vr.pdf','01 / 03','Jedna smlouva, více VŘ','Smlouvu můžete propojit s více výběrovými řízeními ve stejné stavbě. Dokumenty a finance tak spravujete na jednom místě.')
y=shot(c,'smlouva-pridat-vr.png',40,y,350)-9
para(c,'Smlouvy > detail smlouvy > Přehled > Výběrová řízení',40,y,510,8.5,MUTED)
top=y-32
shot(c,'smlouva-vyber-vr.png',40,top,173)
ty=para(c,'Jak přidat další VŘ',235,top,320,14,bold=True)-9
for s in ['1. Otevřete smlouvu a její záložku Přehled.','2. Vyberte volné VŘ a nabídku dodavatele. Dlouhý seznam lze prohledat.','3. Stiskněte Propojit VŘ. Samotný výběr vazbu ještě neuloží.','4. Stejným způsobem připojte další VŘ. Název propojeného VŘ otevře konkrétní kartu dodavatele.']:
    ty=para(c,s,235,ty,310)-10
ty=para(c,'Co platí pro propojení',40,top-215,515,14,bold=True)-9
ty=para(c,'Každé VŘ může mít nejvýše jednu smlouvu. Výběr nabízí pouze volná VŘ dané stavby. Již použitou smlouvu lze vybrat také přímo z dalšího VŘ.',40,ty,515)-12
ty=para(c,'Odpojit odstraní po potvrzení jen vybranou vazbu. Smlouva, její dokumenty, faktury i ostatní VŘ zůstanou zachované. Cena se počtem vazeb nenásobí a částky se automaticky nerozdělují mezi VŘ.',40,ty,515)
finish(c,'Změna #456')

c,y=start('02-volba-prijemce-poptavky.pdf','02 / 03','Poptávka správnému člověku','Příjemce volíte přímo na kartě dodavatele. Zvolený kontakt se použije při příštím generování běžné i materiálové poptávky.')
shot(c,'vyber-prijemce.png',40,y,215)
ty=para(c,'Jak kontakt vybrat',280,y,275,14,bold=True)-10
for s in ['1. Ve VŘ otevřete výběr Příjemce poptávky na kartě dodavatele.','2. Vyberte osobu. Společně se změní jméno, e-mail i telefon.','3. Klikněte na Generovat poptávku nebo Materiálová poptávka.','Kontakty bez platného e-mailu nelze použít. Bez platné adresy není generování dostupné.']:
    ty=para(c,s,280,ty,275)-12
ty=para(c,'Rozpracovaný koncept má pevného adresáta',40,y-270,515,14,bold=True)-10
ty=para(c,'Při zahájení generování se adresa zkopíruje do konceptu. Když během přípravy vyberete jiný kontakt, první koncept si ponechá původního příjemce. Nová volba platí až pro další generování.',40,ty,515)-12
ty=para(c,'Hromadná poptávka používá příjemce z otevřené rekapitulace. Ta ukáže i přeskočené karty bez platné adresy. Pozdější změny karet už tento koncept nepřepíšou.',40,ty,515)-12
ty=para(c,'Volba funguje ihned; zapamatování na kartě probíhá na pozadí. Při chybě se zobrazí upozornění, ale volba zůstane použitelná v aktuální relaci. Po úplném obnovení stránky se načte uložená hodnota. Hlavní kontakt v adresáři se nemění.',40,ty,515)-12
para(c,'Generování připraví e-mailový koncept. Stav „Odesláno“ sám nepotvrzuje skutečné odeslání e-mailu.',40,ty,515,9.5,ACCENT,True)
finish(c,'Změny #458, #459')

c,y=start('03-prehlednejsi-kontaktni-karta.pdf','03 / 03','Kontakt bez zbytečného rámu','Jméno, e-mail a telefon nyní tvoří jeden přehledný blok pod názvem firmy. Karta nabízí výběr jen tam, kde je co vybírat.')
y=shot(c,'karty-kontaktu.png',40,y,515)-10
y=para(c,'Vlevo více kontaktů se šipkou. Vpravo jediný kontakt bez nabídky.',40,y,515,8.5,MUTED)-20
y=para(c,'Co se změnilo',40,y,515,14,bold=True)-10
for s in ['<b>Více kontaktů:</b> šipka otevře seznam. Zavřený výběr nemá trvalý rámeček ani podbarvení; otevřená nabídka a klávesnicový fokus zůstávají zřetelné.','<b>Jediný kontakt:</b> údaje jsou zobrazené přímo, bez rozbalovacího menu. Typy „Hlavní“, „OZ“ a další už blok nezatěžují.','<b>Změna osoby:</b> aktualizuje se i telefon. Pokud ho nový kontakt nemá, číslo předchozí osoby se neponechá.','<b>Úprava údajů:</b> samostatný odkaz v bloku zmizel. Celou kartu dál upravíte tužkou nebo dvojklikem.']:
    y=para(c,s,40,y,515)-10
finish(c,'Změna #460')
print('\n'.join(str(p) for p in sorted(OUT.glob('*.pdf'))))
