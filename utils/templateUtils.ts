import { ProjectDetails, DemandCategory, Bid } from '../types';

export interface TemplateVariable {
    code: string;
    description: string;
    category: 'Project' | 'Financial' | 'Contact';
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
    { code: '{NAZEV_STAVBY}', description: 'Název projektu', category: 'Project' },
    { code: '{INVESTOR}', description: 'Investor', category: 'Project' },
    { code: '{LOKACE}', description: 'Lokace stavby', category: 'Project' },
    { code: '{TERMIN_DOKONCENI}', description: 'Termín dokončení', category: 'Project' },
    { code: '{TYP_STAVBY}', description: 'Typ stavby (Soutěž/Realizace)', category: 'Project' },
    { code: '{SOUTEZ_REALIZACE}', description: 'Fáze projektu (Soutěž/Realizace)', category: 'Project' },
    { code: '{HLAVNI_STAVBYVEDOUCI}', description: 'Hlavní stavbyvedoucí', category: 'Project' },
    { code: '{STAVBYVEDOUCI}', description: 'Stavbyvedoucí', category: 'Project' },
    { code: '{STAVEBNI_TECHNIK}', description: 'Stavební technik', category: 'Project' },
    { code: '{OPRAVNENA_OSOBA}', description: 'Oprávněná osoba', category: 'Project' },
    { code: '{TECHNICKY_DOZOR}', description: 'Technický dozor', category: 'Project' },
    { code: '{ODKAZ_DOKUMENTACE}', description: 'Odkaz na dokumentaci', category: 'Project' },

    { code: '{SOD_CENA}', description: 'Cena SOD smlouvy', category: 'Financial' },
    { code: '{SPLATNOST}', description: 'Splatnost faktury', category: 'Financial' },
    { code: '{ZARUKA}', description: 'Záruční doba', category: 'Financial' },
    { code: '{POZASTAVKA}', description: 'Pozastávka', category: 'Financial' },
    { code: '{POJISTENI}', description: 'Pojištění', category: 'Financial' },
    { code: '{ZARIZENI_STAVENISTE}', description: 'Zařízení staveniště', category: 'Financial' },

    { code: '{KATEGORIE_NAZEV}', description: 'Název poptávky', category: 'Project' },
    { code: '{POPIS_PRACI}', description: 'Seznam prací (z poptávky)', category: 'Project' },
    { code: '{DATUM_ODESLANI}', description: 'Datum odeslání', category: 'Project' },
    { code: '{TERMIN_REALIZACE}', description: 'Termín realizace', category: 'Project' },
    { code: '{TERMIN_POPTAVKY}', description: 'Termín pro podání nabídky', category: 'Project' },
    { code: '{PODPIS_UZIVATELE}', description: 'Váš podpis (z nastavení)', category: 'Contact' },
];

export const getPreviewData = (project?: ProjectDetails, category?: DemandCategory, format: 'text' | 'html' = 'text', userSignature?: string) => {
    const today = new Date().toLocaleDateString('cs-CZ');

    if (project) {
        // Safe mapping for project status

        const cat = category || (project.categories && project.categories.length > 0 ? project.categories[0] : null);
        const realizationDate = cat && cat.realizationStart && cat.realizationEnd
            ? `${new Date(cat.realizationStart).toLocaleDateString('cs-CZ')} - ${new Date(cat.realizationEnd).toLocaleDateString('cs-CZ')}`
            : 'Dle harmonogramu';

        const bidDeadline = cat && cat.deadline
            ? new Date(cat.deadline).toLocaleDateString('cs-CZ')
            : 'Dle dohody';

        const signature = userSignature || project.siteManager || 'S pozdravem Tým';

        // Auto-detect HTML: if it contains tags like <p, <div, <br, <span, <a, assume it's HTML.
        const isHtmlSignature = /<[a-z][\s\S]*>/i.test(signature);

        // If HTML format requested:
        // - If signature IS HTML, leave it alone (user provided HTML source)
        // - If signature is NOT HTML, convert newlines to <br>
        const formattedSignature = format === 'html'
            ? (isHtmlSignature ? signature : signature.replace(/\n/g, '<br>'))
            : signature;

        return {
            '{NAZEV_STAVBY}': project.title || 'Můj Projekt',
            '{INVESTOR}': project.investor || 'Investor s.r.o.',
            '{LOKACE}': project.location || 'Praha 1',
            '{TERMIN_DOKONCENI}': project.finishDate || '31.12.2025',
            '{TYP_STAVBY}': project.status === 'tender' ? 'Soutěž' : (project.status === 'realization' ? 'Realizace' : 'Realizace'),
            '{SOUTEZ_REALIZACE}': project.status === 'tender' ? 'Soutěž' : (project.status === 'realization' ? 'Realizace' : 'Realizace'),

            '{HLAVNI_STAVBYVEDOUCI}': project.siteManager || 'Ing. Jan Hlavní',
            '{STAVBYVEDOUCI}': project.constructionManager || 'Ing. Petr Stavitel',
            '{STAVEBNI_TECHNIK}': project.constructionTechnician || 'Tomáš Technik',

            '{OPRAVNENA_OSOBA}': 'Ing. Petr Svoboda',
            '{TECHNICKY_DOZOR}': project.technicalSupervisor || 'Ing. Kontrola',
            '{ODKAZ_DOKUMENTACE}': (() => {
                if (project.documentLinks && project.documentLinks.length > 0) {
                    if (format === 'html') {
                        return project.documentLinks.map(l => `📂 <a href="${l.url}">${l.label}</a>`).join('<br>');
                    }
                    return project.documentLinks.map(l => `📂 ${l.label}: ${l.url}`).join('\n');
                }
                const link = project.documentationLink || 'https://drive.google.com/...';
                return format === 'html' ? `<a href="${link}">Odkaz na dokumentaci</a>` : link;
            })(),

            '{SOD_CENA}': project.investorFinancials?.sodPrice ? `${project.investorFinancials.sodPrice.toLocaleString('cs-CZ')} Kč` : '1 000 000 Kč',
            '{SPLATNOST}': project.contract?.maturity ? `${project.contract.maturity} dnů` : '30 dnů',
            '{ZARUKA}': project.contract?.warranty ? `${project.contract.warranty} měsíců` : '60 měsíců',
            '{POZASTAVKA}': project.contract?.retention || '10%',
            '{POJISTENI}': project.contract?.insurance ? `${project.contract.insurance} %` : '0 %',
            '{ZARIZENI_STAVENISTE}': project.contract?.siteFacilities ? `${project.contract.siteFacilities} %` : '0 %',

            '{KATEGORIE_NAZEV}': cat ? cat.title : 'Ocelová konstrukce',
            '{POPIS_PRACI}': (() => {
                if (cat && cat.workItems && cat.workItems.length > 0) {
                    if (format === 'html') {
                        return `<ul>${cat.workItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
                    }
                    return cat.workItems.map(item => `- ${item}`).join('\n');
                }
                if (cat && cat.description) {
                    // Fallback to splitting description by newline if workItems missing but description exists (legacy)
                    const items = cat.description.split('\n').filter(Boolean);
                    if (items.length > 1) {
                        if (format === 'html') {
                            return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
                        }
                        return items.map(item => `- ${item}`).join('\n');
                    }
                    return cat.description;
                }
                return 'Popis prací neuveden';
            })(),
            '{DATUM_ODESLANI}': today,
            '{TERMIN_REALIZACE}': realizationDate,
            '{TERMIN_POPTAVKY}': bidDeadline,
            '{PODPIS_UZIVATELE}': formattedSignature,
        };
    }

    // Fallback dummy data
    return {
        '{NAZEV_STAVBY}': 'Rezidence Parková',
        '{INVESTOR}': 'Development Group a.s.',
        '{LOKACE}': 'Karlova 25, Brno',
        '{TERMIN_DOKONCENI}': '15. listopadu 2024',
        '{TYP_STAVBY}': 'Výběrové řízení',
        '{SOUTEZ_REALIZACE}': 'Soutěž',
        '{HLAVNI_STAVBYVEDOUCI}': 'Ing. Jan Hlavní',
        '{STAVBYVEDOUCI}': 'Ing. Karel Stavitel',
        '{STAVEBNI_TECHNIK}': 'Tomáš Technik',
        '{OPRAVNENA_OSOBA}': 'Ing. Petr Ředitel',
        '{TECHNICKY_DOZOR}': 'TDI Servis s.r.o.',
        '{ODKAZ_DOKUMENTACE}': format === 'html' ? '<a href="https://sharepoint.com/project-123">Odkaz na dokumentaci</a>' : 'https://sharepoint.com/project-123',

        '{SOD_CENA}': '15 500 000 Kč',
        '{SPLATNOST}': '45 dnů',
        '{ZARUKA}': '60 měsíců',
        '{POZASTAVKA}': '5% po dobu záruky',
        '{POJISTENI}': '1 %',
        '{ZARIZENI_STAVENISTE}': '2.5 %',

        '{KATEGORIE_NAZEV}': 'Tesařské konstrukce',
        '{POPIS_PRACI}': format === 'html' ? '<ul><li>Dodávka materiálu</li><li>Montáž krovu</li><li>Nátěry</li></ul>' : '- Dodávka materiálu\n- Montáž krovu\n- Nátěry',
        '{DATUM_ODESLANI}': today,
        '{TERMIN_REALIZACE}': '01.03.2024 - 15.04.2024',
        '{TERMIN_POPTAVKY}': '20.01.2024',
        '{PODPIS_UZIVATELE}': userSignature || 'S pozdravem,\nJan Novák',
    };
};

export const processTemplate = (template: string, projectOrData: ProjectDetails | Record<string, string>, category?: DemandCategory, format: 'text' | 'html' = 'text', userSignature?: string): string => {
    let data: Record<string, string>;

    // Check if projectOrData is strict ProjectDetails (has 'id', 'title' etc) or just a Record
    if ('title' in projectOrData && 'investor' in projectOrData) {
        // It's ProjectDetails
        data = getPreviewData(projectOrData as ProjectDetails, category, format, userSignature);
    } else {
        // It's already the map
        data = projectOrData as Record<string, string>;
        // If extra variables are needed here, we assume they are already in the map.
        // But if userSignature is passed and not in map, we could inject it?
        if (userSignature && !data['{PODPIS_UZIVATELE}']) {
            data['{PODPIS_UZIVATELE}'] = format === 'html' ? userSignature.replace(/\n/g, '<br>') : userSignature;
        }
    }

    let result = template;
    for (const [key, value] of Object.entries(data)) {
        // Escape special chars in key for regex if needed, though our keys are simple {KEY}
        result = result.replace(new RegExp(key, 'g'), value);
    }
    return result;
};
