
import { DemandCategory, Bid, Project, ProjectDetails, Subcontractor, StatusConfig } from './types';

export const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'available', label: 'K dispozici', color: 'green' },
  { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
  { id: 'waiting', label: 'Čeká', color: 'yellow' }
];

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Rezidence Slunečnice', location: 'Praha', status: 'realization' },
  { id: 'p2', name: 'Kanceláře Nová Karolina', location: 'Ostrava', status: 'tender' },
  { id: 'p3', name: 'Logistický Park D1', location: 'Brno', status: 'realization' },
];

export const PROJECTS_DB: Record<string, ProjectDetails> = {
  'p1': {
    title: 'Rezidence Slunečnice',
    investor: 'Slunečnice Development s.r.o.',
    technicalSupervisor: 'Ing. Jan Dozor (TDI Consult)',
    location: 'Praha 6, Dejvice',
    finishDate: 'Prosinec 2025',
    siteManager: 'Ing. Karel Novotný',
    constructionManager: 'Petr Hrubý',
    constructionTechnician: 'David Malý',
    plannedCost: 7800000, // Target cost
    contract: {
        maturity: 30,
        warranty: 60,
        retention: '5+5 %',
        siteFacilities: 1.4,
        insurance: 0.4
    },
    investorFinancials: {
        sodPrice: 8500000,
        amendments: [
            { id: 'a1', label: 'Dodatek č.1 - Změna dispozic', price: 150000 },
            { id: 'a2', label: 'Dodatek č.2 - Nadstandard obklady', price: 320000 }
        ]
    },
    categories: [
      { id: '1', title: 'Vnitřní omítky', budget: '~1.5M Kč', sodBudget: 1650000, planBudget: 1500000, status: 'sod', subcontractorCount: 5, description: 'Kompletní vnitřní omítky pro objekt A a B.' },
      { id: '2', title: 'Elektroinstalace', budget: '~2.1M Kč', sodBudget: 2300000, planBudget: 2100000, status: 'open', subcontractorCount: 8, description: 'Silnoproud a slaboproud, včetně rozvaděčů.' },
      { id: '3', title: 'Fasády', budget: '~3.5M Kč', sodBudget: 3800000, planBudget: 3500000, status: 'sod', subcontractorCount: 3, description: 'Zateplovací systém a finální omítka.' },
      { id: '4', title: 'Sádrokartony', budget: '~950 000 Kč', sodBudget: 1100000, planBudget: 950000, status: 'open', subcontractorCount: 4, description: 'Příčky a podhledy ve 2. a 3. NP.' },
      { id: '5', title: 'Zdravotechnika', budget: '~1.2M Kč', sodBudget: 1400000, planBudget: 1200000, status: 'open', subcontractorCount: 6, description: 'Voda, odpady, kanalizace.' },
    ]
  },
  'p2': {
    title: 'Kanceláře Nová Karolina',
    investor: 'Nová Karolina Park a.s.',
    technicalSupervisor: 'Ing. Aleš Přísný',
    location: 'Ostrava, Centrum',
    finishDate: 'Srpen 2026',
    siteManager: 'Ing. Petr Svoboda',
    constructionManager: 'Ing. Jana Rychlá',
    constructionTechnician: 'Tomáš Kovář',
    plannedCost: 10500000,
    contract: {
        maturity: 45,
        warranty: 60,
        retention: '10 %',
        siteFacilities: 1.8,
        insurance: 0.5
    },
    investorFinancials: {
        sodPrice: 12000000,
        amendments: []
    },
    categories: [
      { id: '6', title: 'Vzduchotechnika', budget: '~5.0M Kč', sodBudget: 5500000, planBudget: 5000000, status: 'open', subcontractorCount: 2, description: 'HVAC systém pro 4 patra kanceláří.' },
      { id: '7', title: 'Skleněné příčky', budget: '~2.8M Kč', sodBudget: 3200000, planBudget: 2800000, status: 'sod', subcontractorCount: 3, description: 'Dělící stěny zasedacích místností.' },
    ]
  },
  'p3': {
    title: 'Logistický Park D1',
    investor: 'Logistics Global Ltd.',
    technicalSupervisor: 'TDI Team Brno',
    location: 'Brno - Slatina',
    finishDate: 'Březen 2025',
    siteManager: 'Jan Černý',
    constructionManager: 'Miroslav Veselý',
    constructionTechnician: '-',
    plannedCost: 13500000,
    contract: {
        maturity: 60,
        warranty: 36,
        retention: '5 %',
        siteFacilities: 1.0,
        insurance: 0.3
    },
    investorFinancials: {
        sodPrice: 15000000,
        amendments: [
            { id: 'a1', label: 'Dodatek č.1 - Zpevněné plochy', price: 450000 }
        ]
    },
    categories: [
        { id: '8', title: 'Průmyslové podlahy', budget: '~12.5M Kč', sodBudget: 13000000, planBudget: 12500000, status: 'open', subcontractorCount: 4, description: 'Litý beton pro halu A.' },
    ]
  }
};

export const INITIAL_BIDS: Record<string, Bid[]> = {
    // Project 1 - Category 1 (Omítky)
    '1': [ 
        { id: '101', subcontractorId: 's1', companyName: 'Stavby-Praha s.r.o.', contactPerson: 'Jan Novák', price: '1.55M Kč', tags: ['Reliable'], status: 'sod' }, // Winning Bid
        { id: '102', subcontractorId: 's2', companyName: 'Omítky Profi', contactPerson: 'Petr Rychlý', price: '1.48M Kč', tags: ['Cheapest'], status: 'offer' },
        { id: '103', subcontractorId: 's3', companyName: 'Kvalitní Zdi a.s.', contactPerson: 'Alois Vomáčka', price: '-', notes: 'Odmítli pro kapacitu', status: 'rejected' },
    ],
    // Project 1 - Category 2 (Elektro)
    '2': [ 
         { id: '201', subcontractorId: 'e1', companyName: 'El-mont s.r.o.', contactPerson: 'Martina Černá', price: '2.2M Kč', status: 'offer' },
         { id: '202', subcontractorId: 'e2', companyName: 'VoltAmpere', contactPerson: 'Josef Blesk', price: '?', status: 'sent' },
    ],
    // Project 1 - Category 3 (Fasády)
    '3': [
        { id: '301', subcontractorId: 'f1', companyName: 'Fasády Top', contactPerson: 'Karel Fasáda', price: '3.35M Kč', status: 'sod' }, // Winning Bid
    ],
    // Project 2 - Category 6 (Vzduchotechnika)
    '6': [
        { id: '601', subcontractorId: 'ac1', companyName: 'AirFlow Systems', contactPerson: 'Tomáš Větrák', price: '4.9M Kč', status: 'shortlist' }
    ],
    // Project 2 - Category 7 (Sklo)
    '7': [
        { id: '701', subcontractorId: 'gl1', companyName: 'Glass & Design', contactPerson: 'Jana Sklenářová', price: '2.65M Kč', status: 'sod' } // Winning
    ]
};

// Parsed data from the PDF documents
export const ALL_CONTACTS: Subcontractor[] = [
    // Akustika
    { id: 'c1', company: 'Ecophon', specialization: 'Akustická opatření', name: 'Viktor Dyk', phone: '602 394 331', email: 'viktor.dyk@ecophon.cz', status: 'available' },
    { id: 'c2', company: 'Esprit', specialization: 'Akustická opatření', name: '-', phone: '-', email: 'priprava@esprit-pha.cz', status: 'available' },
    { id: 'c3', company: 'Farrao', specialization: 'Akustická opatření', name: 'Plívová', phone: '724 100 712', email: 'plivova@farrao.cz', status: 'busy' },
    { id: 'c4', company: 'Intergips', specialization: 'Akustická opatření', name: 'Petr Zlesa', phone: '602 347 703', email: 'petr.zlesa@intergips.cz', status: 'available' },
    { id: 'c5', company: 'Komont', specialization: 'Akustická opatření', name: 'Jiří Kollowrat', phone: '602 201 251', email: 'kolowrat.j@komont.cz', status: 'available' },
    { id: 'c6', company: 'Soning', specialization: 'Akustická opatření', name: 'Ing. Pavel Bezděk', phone: '602 271 732', email: 'pavel.bezdek@soning.cz', status: 'available' },
    { id: 'c7', company: 'Stavomak', specialization: 'Akustická opatření', name: 'Jiří Karafiát', phone: '775 739 714', email: 'karafiat@stavomak.cz', status: 'busy' },
    
    // Bourací práce / Demolice
    { id: 'c8', company: 'A1 Demolice', specialization: 'Bourací práce', name: 'Jan Zavázal', phone: '724 068 700', email: 'j.zavazal@a1demolice.cz', status: 'available' },
    { id: 'c9', company: 'APB - PLZEŇ a.s.', specialization: 'Bourací práce', name: 'Eva Březinová', phone: '606 759 200', email: 'brezinova.eva@apb-plzen.cz', ico: '27066410', status: 'busy' },
    { id: 'c10', company: 'LB s.r.o.', specialization: 'Bourací práce', name: 'Jan Frič', phone: '607 71 39 43', email: 'info@lbsro.cz', ico: '46882049', status: 'available' },
    { id: 'c11', company: 'Metta', specialization: 'Bourací práce', name: 'Ing. Vladimír Kendera', phone: '733 128 404', email: 'info@metta.cz', status: 'available' },
    { id: 'c12', company: 'Odpady Janeček', specialization: 'Bourací práce', name: 'Pavel Bouz', phone: '778 798 989', email: 'bouz.pavel@odpady-janecek.cz', status: 'waiting' },
    
    // Elektro
    { id: 'c13', company: 'AZ Klima', specialization: 'Elektro Silnoproud', name: '-', phone: '-', email: 'obchod@azklima.com', status: 'available' },
    { id: 'c14', company: 'COBAP s.r.o.', specialization: 'Elektro Silnoproud', name: 'Jaroslav Plíšek', phone: '724 895 676', email: 'jaroslav.plisek@cobap.cz', status: 'busy' },
    { id: 'c15', company: 'Colsys', specialization: 'Elektro Silnoproud', name: 'Miroslav Klír', phone: '603 234 773', email: 'miroslav.klir@colsys.cz', status: 'available' },
    { id: 'c16', company: 'Electro Enterprises', specialization: 'Elektro Silnoproud', name: '-', phone: '-', email: 'info@electroenterprises.cz', status: 'available' },
    { id: 'c17', company: 'KARSCH ELEKTRO s.r.o.', specialization: 'Elektro Silnoproud', name: 'Karsch', phone: '-', email: 'karsch@karsch-elektro.cz', ico: '27310159', status: 'available' },
    { id: 'c18', company: 'Minet Elektro', specialization: 'Elektro Silnoproud', name: 'Skřivánek', phone: '-', email: 'skrivanek@minetelektro.cz', ico: '25016202', status: 'available' },
    
    // Výtahy
    { id: 'c19', company: 'KONE', specialization: 'Výtahy', name: 'Lucie Benetková', phone: '778 755 202', email: 'lucie.benetkova@kone.com', status: 'available' },
    { id: 'c20', company: 'Otis', specialization: 'Výtahy', name: 'Adéla Lukačovská', phone: '731 639 054', email: 'adela.lukacovska@otis.com', status: 'busy' },
    { id: 'c21', company: 'Schindler', specialization: 'Výtahy', name: 'Petr Malý', phone: '605 207 932', email: 'petr.maly@cz.schindler.com', status: 'available' },
    { id: 'c22', company: 'Výtahy Voto', specialization: 'Výtahy', name: 'Herman', phone: '-', email: 'herman@vytahy-voto.cz', status: 'waiting' },
    
    // Dveře / Okna
    { id: 'c23', company: 'Termetal s.r.o.', specialization: 'Dveře automatické', name: 'Zavřel', phone: '777 711 197', email: 'zavrel@termetal.cz', status: 'available' },
    { id: 'c24', company: 'Sapeli', specialization: 'Dveře interiér', name: 'Ivana Kalousová', phone: '734 571 529', email: 'ivana.kalousova@development-sapeli.cz', status: 'available' },
    { id: 'c25', company: 'Vekra', specialization: 'Výplně otvorů', name: 'Petr Laibl', phone: '725 596 408', email: 'petr.laibl@vekra.cz', status: 'busy' },
    { id: 'c26', company: 'Sulko', specialization: 'Výplně otvorů', name: 'Ondřej Pěnička', phone: '725 060 610', email: 'ondrej.penicka@sulko.cz', status: 'available' },
    
    // Podlahy
    { id: 'c27', company: 'Barkotex', specialization: 'Podlahy povlakové', name: 'Petr Polanecký', phone: '727 985 457', email: 'polanecky@barkotex.cz', status: 'available' },
    { id: 'c28', company: 'BOCA Group', specialization: 'Podlahy povlakové', name: 'Kovář', phone: '602 201 118', email: 'kovar@bocapraha.cz', status: 'available' },
    { id: 'c29', company: 'Pro Interier', specialization: 'Podlahy dřevěnné', name: 'Ondřej Novák', phone: '777 472 260', email: 'Ondrej.Novak@pro-interier.cz', status: 'waiting' },
    
    // ZTI / Voda / Topení
    { id: 'c30', company: 'Kmont', specialization: 'ZTI', name: 'Spurný', phone: '603 251 447', email: 'spurny@kmont.cz', status: 'available' },
    { id: 'c31', company: 'Instalace Praha', specialization: 'ZTI', name: 'Látal', phone: '737 200 424', email: 'latal@instalace.cz', status: 'available' },
    { id: 'c32', company: 'Promat', specialization: 'PBŘ', name: '-', phone: '-', email: 'martinek@promat.cz', status: 'available' },
    
    // Zámečnické
    { id: 'c33', company: 'Solidsteel s.r.o.', specialization: 'Zámečnické kce', name: 'Petr Bára', phone: '602 354 581', email: 'petr.bara@solidsteel.cz', status: 'available' },
    { id: 'c34', company: 'Sollus', specialization: 'Zámečnické kce', name: 'M. Šilhanek', phone: '-', email: 'm_silhanek@sollus.cz', status: 'busy' },
    { id: 'c35', company: 'Fibeko', specialization: 'Zámečník NEREZ', name: '-', phone: '-', email: 'info@fibeko.cz', status: 'available' },
    
    // Fasády
    { id: 'c36', company: 'Baumit', specialization: 'Fasáda KZS', name: 'K. Kladívko', phone: '725 114 848', email: 'k.kladivko@baumit.cz', status: 'available' },
    { id: 'c37', company: 'Stavomak', specialization: 'Fasáda KZS', name: 'Karafiát', phone: '-', email: 'karafiat@stavomak.cz', status: 'available' },
    { id: 'c38', company: 'Alufront', specialization: 'Fasáda - LOP', name: 'Josef Drechsel', phone: '776 782 350', email: 'josef.drechsel@alufront.cz', status: 'busy' },
    
    // Ostatní
    { id: 'c39', company: 'Siko', specialization: 'Obklady a Dlažby', name: 'Ondřej Malý', phone: '737 260 184', email: 'ondrej.maly@siko.cz', status: 'available' },
    { id: 'c40', company: 'Ptáček', specialization: 'Zařizovací předměty', name: 'Petra Vlčková', phone: '725 507 829', email: 'Petra.Vlckova@ptacek.cz', status: 'available' },
    { id: 'c41', company: 'Lignis', specialization: 'Dveře interiér', name: 'Neduchalová', phone: '775 850 931', email: 'neduchalova@lignis.cz', status: 'available' },
    { id: 'c42', company: 'Hormann', specialization: 'Vrata', name: 'J. Mlejnek', phone: '727 953 665', email: 'j.mlejnek.prg@hormann.cz', status: 'available' },
    { id: 'c43', company: 'GAPA MB', specialization: 'Čistící zóny', name: '-', phone: '-', email: 'vyroba@gapa.cz', status: 'available' },
    { id: 'c44', company: 'Sport club', specialization: 'Dětské hřiště', name: '-', phone: '-', email: 'sportclub@spor-tclub.cz', status: 'available' },
    { id: 'c45', company: 'Best', specialization: 'Venkovní dlažba', name: '-', phone: '-', email: 'info@best.cz', status: 'available' },
    { id: 'c46', company: 'DEK Stavebniny', specialization: 'Stavební materiál', name: 'Lucie Bezručová', phone: '734 792 783', email: 'lucie.bezrucova@dek-cz.com', status: 'available' },
    { id: 'c47', company: 'ProCeram', specialization: 'Obklady a Dlažby', name: 'Michal Šťastný', phone: '734 311 700', email: 'michal.stastny@proceram.cz', status: 'busy' },
    { id: 'c48', company: 'Dřevomonta', specialization: 'Truhlářské kce', name: 'Aleš', phone: '602 333 747', email: 'ales@drevomonta.cz', status: 'available' },
    { id: 'c49', company: 'Exx', specialization: 'Svítidla', name: 'Kužel', phone: '725 032 131', email: 'kuzel@exx.cz', status: 'waiting' },
    { id: 'c50', company: 'Lasvit', specialization: 'Svítidla', name: 'Michaela Kozáková', phone: '723 858 003', email: 'michaela.kozakova@lasvit.com', status: 'busy' }
];
