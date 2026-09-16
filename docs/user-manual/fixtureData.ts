import type { ProjectDetails, Project, Subcontractor, ContractWithDetails } from '@/types';
import type { Task } from '@/features/tasks/types';

export const user = { id: 'manual-user', email: 'anna@example.com', name: 'Anna Ukázková', role: 'user' as const, organizationId: 'manual-org' };
export const contacts: Subcontractor[] = [
  { id: 'javor', company: 'Javor Elektro — ukázka', specialization: ['Elektroinstalace', 'Slaboproud'], status: 'active', city: 'Brno', address: 'Ukázková 1', regions: ['JHM'], note: 'Syntetický kontakt pro příručku.', contacts: [{ id: 'anna', name: 'Anna Ukázková', email: 'anna@example.com', phone: '+420 000 000 001', position: 'Příprava zakázek' }, { id: 'petr', name: 'Petr Vzorový', email: 'petr@example.com', phone: '+420 000 000 002', position: 'Technik' }], vendorRatingAverage: 4.5, vendorRatingCount: 2 },
  { id: 'lumen', company: 'Lumen Mont — ukázka', specialization: ['Elektroinstalace'], status: 'active', city: 'Brno', regions: ['JHM'], contacts: [{ id: 'eva', name: 'Eva Příkladová', email: 'eva@example.com', phone: '+420 000 000 003' }] },
];
export const projects: Project[] = [{ id: 'manual-javor', name: 'Bytový dům Javor', location: 'Ukázková lokalita, Brno', status: 'realization', ownerId: user.id, isDemo: true }, { id: 'manual-lipa', name: 'Škola Lípa — ukázka', location: 'Ukázková lokalita, Olomouc', status: 'tender', ownerId: user.id, isDemo: true }];
export const project: ProjectDetails = {
  id: projects[0].id, title: projects[0].name, location: projects[0].location, status: 'realization', finishDate: '2027-03-31', siteManager: 'Petr Vzorový', investor: 'Javor Invest — ukázka', plannedCost: 2100000,
  categories: [
    { id: 'elektro', title: 'Elektroinstalace', budget: '1 500 000 Kč', sodBudget: 1700000, planBudget: 1500000, status: 'open', subcontractorCount: 2, description: 'Kompletní rozvody včetně revizí.', workItems: ['Kabelové rozvody', 'Rozvaděče', 'Výchozí revize'], deadline: '2026-10-23', realizationStart: '2026-11-02', realizationEnd: '2027-01-29' },
    { id: 'slaboproud', title: 'Slaboproud', budget: '300 000 Kč', sodBudget: 350000, planBudget: 300000, status: 'sod', subcontractorCount: 1, description: 'Datové rozvody a vstupní systém.', deadline: '2026-10-30', realizationStart: '2026-11-16', realizationEnd: '2027-02-12' },
  ],
  contract: { maturity: 30, warranty: 60, retention: '5 + 5 %', siteFacilities: 1, insurance: 0.5 },
  investorFinancials: { sodPrice: 2500000, customerName: 'Javor Invest — ukázka', contractNumber: 'JAV-2026-OBJ', amendments: [{ id: 'am-obj', label: 'Dodatek 1 — osvětlení', price: 100000 }], invoices: [] },
  bids: { elektro: contacts.map((c, i) => ({ id: `bid-${i}`, subcontractorId: c.id, companyName: c.company, contactPerson: c.contacts[0].name, email: c.contacts[0].email, phone: c.contacts[0].phone, price: i ? '1 420 000 Kč' : '1 380 000 Kč', status: 'offer' })), slaboproud: [{ id: 'bid-slabo', subcontractorId: 'javor', companyName: contacts[0].company, contactPerson: contacts[0].contacts[0].name, email: 'anna@example.com', phone: '+420 000 000 001', price: '240 000 Kč', status: 'sod', contracted: true }] },
  documentLinks: [{ id: 'pd', label: 'Projektová dokumentace — elektro', url: 'https://example.com/javor/pd', dateAdded: '2026-09-16' }, { id: 'vykaz', label: 'Výkaz výměr — ukázka', url: 'https://example.com/javor/vykaz', dateAdded: '2026-09-16' }],
  inquiryLetterLink: 'template:manual-inquiry', materialInquiryTemplateLink: 'template:manual-material', losersEmailTemplateLink: 'template:manual-losers',
};
export const contract: ContractWithDetails = {
  id: 'manual-contract', projectId: projects[0].id, vendorName: contacts[0].company, title: 'Elektroinstalace a slaboproud', contractNumber: 'JAV-2026-001', status: 'active', currency: 'CZK', basePrice: 1620000, source: 'manual', signedAt: '2026-09-10', linkedBidIds: ['bid-0', 'bid-slabo'],
  retentionShortPercent: 5, retentionLongPercent: 5, retentionShortStatus: 'held', retentionLongStatus: 'held', retentionShortExpectedOn: '2027-03-31', retentionLongExpectedOn: '2032-03-31', warrantyMonths: 60, paymentTerms: 'Splatnost 30 dní', siteSetupPercent: 1,
  amendments: [{ id: 'am-1', contractId: 'manual-contract', amendmentNo: 1, deltaPrice: 80000, reason: 'Doplnění osvětlení společných prostor', signedAt: '2026-09-14' }],
  drawdowns: [{ id: 'd-1', contractId: 'manual-contract', period: '2026-09', claimedAmount: 300000, approvedAmount: 280000, note: 'Odsouhlasený soupis prací — ukázka' }],
  invoices: [{ id: 'i-1', contractId: 'manual-contract', invoiceNumber: 'UK-2026-001', issueDate: '2026-09-10', dueDate: '2026-10-10', amount: 280000, currency: 'CZK', status: 'paid', paidAt: '2026-09-15' }, { id: 'i-2', contractId: 'manual-contract', invoiceNumber: 'UK-2026-002', issueDate: '2026-09-16', dueDate: '2026-10-16', amount: 120000, currency: 'CZK', status: 'issued' }],
  currentTotal: 1700000, approvedSum: 280000, remaining: 1420000, invoicedSum: 400000, paidSum: 280000, overdueSum: 0,
};
export const task: Task = { id: 'task-1', title: 'Porovnat nabídky elektroinstalace', note: 'Ověřit rozsah dodávky, revize a termín realizace.', dueAt: '2026-10-20T12:00:00Z', reminderAt: '2026-10-19T12:00:00Z', priority: 2, projectId: projects[0].id, sortOrder: 0, completed: false, createdBy: user.id, createdAt: '2026-09-16T08:00:00Z', updatedAt: '2026-09-16T08:00:00Z' };
