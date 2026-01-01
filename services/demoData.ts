import { Subcontractor, Project, ProjectDetails, DemandCategory, Bid, StatusConfig } from '../types';

// Demo mode constants
export const DEMO_SESSION_KEY = 'demo_session';
export const DEMO_DATA_KEY = 'demo_data';

// Mock Status Configs
export const DEMO_STATUSES: StatusConfig[] = [
  { id: 'available', label: 'K dispozici', color: 'green' },
  { id: 'busy', label: 'Zaneprázdněn', color: 'red' },
  { id: 'waiting', label: 'Čeká', color: 'yellow' },
  { id: 'preferred', label: 'Preferovaný', color: 'blue' },
];

// 20 Mock Contacts (Czech construction companies)
export const DEMO_CONTACTS: Subcontractor[] = [
  {
    id: 'demo-contact-1',
    company: 'STRABAG a.s.',
    specialization: ['Zemní práce', 'Silnice'],
    contacts: [{ id: 'c1', name: 'Jan Novák', phone: '+420 123 456 789', email: 'novak@strabag.cz', position: 'Obchodní ředitel' }],
    ico: '60838744',
    region: 'Praha',
    status: 'available'
  },
  {
    id: 'demo-contact-2',
    company: 'EUROVIA CS a.s.',
    specialization: ['Dopravní stavby', 'Mosty'],
    contacts: [{ id: 'c2', name: 'Petr Svoboda', phone: '+420 234 567 890', email: 'svoboda@eurovia.cz', position: 'Projektový manažer' }],
    ico: '45274924',
    region: 'Brno',
    status: 'available'
  },
  {
    id: 'demo-contact-3',
    company: 'Skanska a.s.',
    specialization: ['Pozemní stavby', 'Bytová výstavba'],
    contacts: [{ id: 'c3', name: 'Marie Horáková', phone: '+420 345 678 901', email: 'horakova@skanska.cz', position: 'Kalkulant' }],
    ico: '26209535',
    region: 'Praha',
    status: 'preferred'
  },
  {
    id: 'demo-contact-4',
    company: 'HOCHTIEF CZ a.s.',
    specialization: ['Inženýrské stavby', 'Tunely'],
    contacts: [{ id: 'c4', name: 'Tomáš Krejčí', phone: '+420 456 789 012', email: 'krejci@hochtief.cz', position: 'Vedoucí výroby' }],
    ico: '46678468',
    region: 'Ostrava',
    status: 'available'
  },
  {
    id: 'demo-contact-5',
    company: 'METROSTAV a.s.',
    specialization: ['Metro', 'Podzemní stavby'],
    contacts: [{ id: 'c5', name: 'Jiří Dvořák', phone: '+420 567 890 123', email: 'dvorak@metrostav.cz', position: 'Ředitel divize' }],
    ico: '00014915',
    region: 'Praha',
    status: 'busy'
  },
  {
    id: 'demo-contact-6',
    company: 'ELEKTRO-MONT s.r.o.',
    specialization: ['Elektroinstalace', 'Silnoproud'],
    contacts: [{ id: 'c6', name: 'Pavel Černý', phone: '+420 678 901 234', email: 'cerny@elektro-mont.cz', position: 'Jednatel' }],
    ico: '12345678',
    region: 'Plzeň',
    status: 'available'
  },
  {
    id: 'demo-contact-7',
    company: 'THERMONA spol. s r.o.',
    specialization: ['Vytápění', 'Tepelná čerpadla'],
    contacts: [{ id: 'c7', name: 'Lucie Marková', phone: '+420 789 012 345', email: 'markova@thermona.cz', position: 'Obchodní zástupce' }],
    ico: '23456789',
    region: 'Olomouc',
    status: 'waiting'
  },
  {
    id: 'demo-contact-8',
    company: 'VODA-TOPENÍ-PLYN s.r.o.',
    specialization: ['ZTI', 'Plynové instalace'],
    contacts: [{ id: 'c8', name: 'Martin Procházka', phone: '+420 890 123 456', email: 'prochazka@vtp.cz', position: 'Technik' }],
    ico: '34567890',
    region: 'Liberec',
    status: 'available'
  },
  {
    id: 'demo-contact-9',
    company: 'VZDUCHOTECHNIKA CZ a.s.',
    specialization: ['VZT', 'Klimatizace'],
    contacts: [{ id: 'c9', name: 'Eva Němcová', phone: '+420 901 234 567', email: 'nemcova@vzduchotechnika.cz', position: 'Projektant' }],
    ico: '45678901',
    region: 'České Budějovice',
    status: 'preferred'
  },
  {
    id: 'demo-contact-10',
    company: 'OKNO-DVEŘE s.r.o.',
    specialization: ['Okna', 'Dveře', 'Fasády'],
    contacts: [{ id: 'c10', name: 'Radek Veselý', phone: '+420 012 345 678', email: 'vesely@okno-dvere.cz', position: 'Majitel' }],
    ico: '56789012',
    region: 'Hradec Králové',
    status: 'available'
  },
  {
    id: 'demo-contact-11',
    company: 'STŘECHY PROFESIONAL s.r.o.',
    specialization: ['Střechy', 'Klempířské práce'],
    contacts: [{ id: 'c11', name: 'Jaroslav Král', phone: '+420 111 222 333', email: 'kral@strechy-pro.cz', position: 'Stavbyvedoucí' }],
    ico: '67890123',
    region: 'Zlín',
    status: 'busy'
  },
  {
    id: 'demo-contact-12',
    company: 'PODLAHY EXPERT s.r.o.',
    specialization: ['Podlahy', 'Litý beton'],
    contacts: [{ id: 'c12', name: 'Alena Vlková', phone: '+420 222 333 444', email: 'vlkova@podlahy-expert.cz', position: 'Obchodní manažer' }],
    ico: '78901234',
    region: 'Pardubice',
    status: 'available'
  },
  {
    id: 'demo-contact-13',
    company: 'MALÍŘI & NATĚRAČI s.r.o.',
    specialization: ['Malířské práce', 'Nátěry'],
    contacts: [{ id: 'c13', name: 'Ondřej Fiala', phone: '+420 333 444 555', email: 'fiala@maliri.cz', position: 'Vedoucí party' }],
    ico: '89012345',
    region: 'Jihlava',
    status: 'waiting'
  },
  {
    id: 'demo-contact-14',
    company: 'SDK MONTÁŽE s.r.o.',
    specialization: ['SDK', 'Sádrokarton'],
    contacts: [{ id: 'c14', name: 'Michal Horák', phone: '+420 444 555 666', email: 'horak@sdk-montaze.cz', position: 'Montážník' }],
    ico: '90123456',
    region: 'Ústí nad Labem',
    status: 'available'
  },
  {
    id: 'demo-contact-15',
    company: 'IZOLACE PROFI a.s.',
    specialization: ['Tepelné izolace', 'ETICS'],
    contacts: [{ id: 'c15', name: 'Zdeněk Urban', phone: '+420 555 666 777', email: 'urban@izolace-profi.cz', position: 'Technik kvality' }],
    ico: '01234567',
    region: 'Karlovy Vary',
    status: 'preferred'
  },
  {
    id: 'demo-contact-16',
    company: 'BETONÁRNA MORAVIA s.r.o.',
    specialization: ['Beton', 'Transportbeton'],
    contacts: [{ id: 'c16', name: 'Jakub Pospíšil', phone: '+420 666 777 888', email: 'pospisil@betonarna-mor.cz', position: 'Dispečer' }],
    ico: '11223344',
    region: 'Brno',
    status: 'available'
  },
  {
    id: 'demo-contact-17',
    company: 'OCEL & KONSTRUKCE a.s.',
    specialization: ['Ocelové konstrukce', 'Svařování'],
    contacts: [{ id: 'c17', name: 'Robert Marek', phone: '+420 777 888 999', email: 'marek@ocel-konstr.cz', position: 'Ředitel' }],
    ico: '22334455',
    region: 'Ostrava',
    status: 'busy'
  },
  {
    id: 'demo-contact-18',
    company: 'ZAHRADNÍ ARCHITEKTURA s.r.o.',
    specialization: ['Sadové úpravy', 'Terénní úpravy'],
    contacts: [{ id: 'c18', name: 'Klára Šimková', phone: '+420 888 999 000', email: 'simkova@zahrad-arch.cz', position: 'Architektka' }],
    ico: '33445566',
    region: 'Praha',
    status: 'available'
  },
  {
    id: 'demo-contact-19',
    company: 'VÝTAHY SERVIS s.r.o.',
    specialization: ['Výtahy', 'Zdvihací zařízení'],
    contacts: [{ id: 'c19', name: 'David Šťastný', phone: '+420 999 000 111', email: 'stastny@vytahy-servis.cz', position: 'Servisní technik' }],
    ico: '44556677',
    region: 'Liberec',
    status: 'waiting'
  },
  {
    id: 'demo-contact-20',
    company: 'POŽÁRNÍ BEZPEČNOST CZ s.r.o.',
    specialization: ['EPS', 'Požární ochrana'],
    contacts: [{ id: 'c20', name: 'Věra Růžičková', phone: '+420 000 111 222', email: 'ruzickova@pozarni-bezp.cz', position: 'Specialista PO' }],
    ico: '55667788',
    region: 'Plzeň',
    status: 'available'
  }
];

// Demo Project Categories
const DEMO_CATEGORIES: DemandCategory[] = [
  {
    id: 'demo-cat-1',
    title: 'Zemní práce a základy',
    budget: '2 500 000 Kč',
    sodBudget: 2800000,
    planBudget: 2500000,
    status: 'sod',
    subcontractorCount: 5,
    description: 'Výkopy, základové desky, hydroizolace spodní stavby',
    deadline: '2024-02-15',
    realizationStart: '2024-03-01',
    realizationEnd: '2024-04-15'
  },
  {
    id: 'demo-cat-2',
    title: 'Hrubá stavba - svislé konstrukce',
    budget: '4 200 000 Kč',
    sodBudget: 4800000,
    planBudget: 4200000,
    status: 'negotiating',
    subcontractorCount: 3,
    description: 'Zdivo, železobetonové sloupy a stěny',
    deadline: '2024-03-01',
    realizationStart: '2024-04-15',
    realizationEnd: '2024-07-30'
  },
  {
    id: 'demo-cat-3',
    title: 'Střecha a klempířské práce',
    budget: '1 800 000 Kč',
    sodBudget: 2100000,
    planBudget: 1800000,
    status: 'open',
    subcontractorCount: 0,
    description: 'Krov, střešní krytina, okapy, svody',
    deadline: '2024-04-15',
    realizationStart: '2024-08-01',
    realizationEnd: '2024-09-15'
  },
  {
    id: 'demo-cat-4',
    title: 'Elektroinstalace',
    budget: '1 200 000 Kč',
    sodBudget: 1400000,
    planBudget: 1200000,
    status: 'open',
    subcontractorCount: 0,
    description: 'Silnoproud, slaboproud, rozvaděče',
    deadline: '2024-05-01'
  },
  {
    id: 'demo-cat-5',
    title: 'ZTI a vytápění',
    budget: '950 000 Kč',
    sodBudget: 1100000,
    planBudget: 950000,
    status: 'open',
    subcontractorCount: 0,
    description: 'Vodovod, kanalizace, topení, tepelné čerpadlo'
  }
];

// Demo Bids
const DEMO_BIDS: Record<string, Bid[]> = {
  'demo-cat-1': [
    {
      id: 'demo-bid-1',
      subcontractorId: 'demo-contact-1',
      companyName: 'STRABAG a.s.',
      contactPerson: 'Jan Novák',
      email: 'novak@strabag.cz',
      phone: '+420 123 456 789',
      price: '2 450 000 Kč',
      status: 'sod',
      contracted: true,
      selectionRound: 2
    },
    {
      id: 'demo-bid-2',
      subcontractorId: 'demo-contact-2',
      companyName: 'EUROVIA CS a.s.',
      contactPerson: 'Petr Svoboda',
      email: 'svoboda@eurovia.cz',
      price: '2 680 000 Kč',
      status: 'rejected',
      selectionRound: 1
    }
  ],
  'demo-cat-2': [
    {
      id: 'demo-bid-3',
      subcontractorId: 'demo-contact-3',
      companyName: 'Skanska a.s.',
      contactPerson: 'Marie Horáková',
      email: 'horakova@skanska.cz',
      price: '4 100 000 Kč',
      status: 'shortlist',
      selectionRound: 1
    },
    {
      id: 'demo-bid-4',
      subcontractorId: 'demo-contact-4',
      companyName: 'HOCHTIEF CZ a.s.',
      contactPerson: 'Tomáš Krejčí',
      email: 'krejci@hochtief.cz',
      price: '4 350 000 Kč',
      status: 'offer',
      selectionRound: 1
    }
  ]
};

// Demo Project
export const DEMO_PROJECT: Project = {
  id: 'demo-project-1',
  name: 'Bytový dům Slunečná - DEMO',
  location: 'Praha 4 - Modřany',
  status: 'realization',
  isDemo: true
};

export const DEMO_PROJECT_DETAILS: ProjectDetails = {
  id: 'demo-project-1',
  title: 'Bytový dům Slunečná - DEMO',
  status: 'realization',
  investor: 'Developerská s.r.o.',
  technicalSupervisor: 'Ing. Pavel Dozor',
  location: 'Praha 4 - Modřany, ul. Slunečná 123',
  finishDate: '2025-06-30',
  siteManager: 'Ing. Martin Stavitel',
  constructionManager: 'Jan Vedoucí',
  constructionTechnician: 'Petr Technik',
  plannedCost: 15000000,
  documentationLink: 'https://example.com/PD_Demo',
  priceListLink: 'https://example.com/Ceniky_Demo',
  docHubEnabled: true,
  docHubRootLink: 'https://example.com/Bytovy_dum_Slunecna_DEMO',
  docHubRootName: 'Bytový dům Slunečná - DEMO',
  docHubProvider: 'gdrive',
  docHubMode: 'org',
  docHubStatus: 'connected',
  docHubStructureVersion: 1,
  categories: DEMO_CATEGORIES,
  contract: {
    maturity: 30,
    warranty: 60,
    retention: '5 + 5 %',
    siteFacilities: 2.5,
    insurance: 0.3
  },
  investorFinancials: {
    sodPrice: 18500000,
    amendments: [
      { id: 'amend-1', label: 'Dodatek č.1 - Změna dispozice', price: 450000 }
    ]
  },
  bids: DEMO_BIDS
};

// Demo Mode Helper Functions
export const isDemoSession = (): boolean => {
  return localStorage.getItem(DEMO_SESSION_KEY) === 'true';
};

export const startDemoSession = (): void => {
  localStorage.setItem(DEMO_SESSION_KEY, 'true');
  // Initialize demo data in localStorage
  const initialData = {
    projects: [DEMO_PROJECT],
    projectDetails: { [DEMO_PROJECT.id]: DEMO_PROJECT_DETAILS },
    contacts: DEMO_CONTACTS,
    statuses: DEMO_STATUSES
  };
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(initialData));
};

export const endDemoSession = (): void => {
  localStorage.removeItem(DEMO_SESSION_KEY);
  localStorage.removeItem(DEMO_DATA_KEY);
};

export const getDemoData = () => {
  const stored = localStorage.getItem(DEMO_DATA_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const saveDemoData = (data: any): void => {
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
};

// Demo User
export const DEMO_USER = {
  id: 'demo-user',
  name: 'Demo Uživatel',
  email: 'demo@example.com',
  role: 'demo' as const,
  avatarUrl: 'https://ui-avatars.com/api/?name=Demo&background=f97316&color=fff',
  preferences: {
    darkMode: true,
    primaryColor: '#607AFB',
    backgroundColor: '#f5f6f8'
  }
};
