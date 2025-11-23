
import { DemandCategory, Bid, Project, ProjectDetails } from './types';

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
      { id: '1', title: 'Vnitřní omítky', budget: '~1.5M Kč', status: 'sod', subcontractorCount: 5, description: 'Kompletní vnitřní omítky pro objekt A a B.' },
      { id: '2', title: 'Elektroinstalace', budget: '~2.1M Kč', status: 'open', subcontractorCount: 8, description: 'Silnoproud a slaboproud, včetně rozvaděčů.' },
      { id: '3', title: 'Fasády', budget: '~3.5M Kč', status: 'sod', subcontractorCount: 3, description: 'Zateplovací systém a finální omítka.' },
      { id: '4', title: 'Sádrokartony', budget: '~950 000 Kč', status: 'open', subcontractorCount: 4, description: 'Příčky a podhledy ve 2. a 3. NP.' },
      { id: '5', title: 'Zdravotechnika', budget: '~1.2M Kč', status: 'open', subcontractorCount: 6, description: 'Voda, odpady, kanalizace.' },
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
      { id: '6', title: 'Vzduchotechnika', budget: '~5.0M Kč', status: 'open', subcontractorCount: 2, description: 'HVAC systém pro 4 patra kanceláří.' },
      { id: '7', title: 'Skleněné příčky', budget: '~2.8M Kč', status: 'sod', subcontractorCount: 3, description: 'Dělící stěny zasedacích místností.' },
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
        { id: '8', title: 'Průmyslové podlahy', budget: '~12.5M Kč', status: 'open', subcontractorCount: 4, description: 'Litý beton pro halu A.' },
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