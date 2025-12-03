import { DemandCategory, ProjectDetails, Bid } from '../types';

/**
 * Generate email inquiry from template
 */
export function generateInquiryEmail(
  category: DemandCategory,
  project: ProjectDetails,
  bid: Bid
): { subject: string; body: string } {
  const subject = `Poptávka - ${category.title} - ${project.title}`;
  
  // Basic template with dynamic variables
  const template = `Dobrý den,

obracíme se na Vás s poptávkou subdodávky pro stavbu ${project.title}.

INFORMACE O STAVBĚ:
- Investor: ${project.investor || '-'}
- Lokace: ${project.location}
- Termín dokončení: ${project.finishDate}
- Stavbyvedoucí: ${project.siteManager}
${project.technicalSupervisor ? `- Technický dozor: ${project.technicalSupervisor}` : ''}

POPTÁVANÁ KATEGORIE:
${category.title}

POPIS PRACÍ:
${category.description || 'Detailní popis prací viz příloha.'}

PODMÍNKY SOD:
${project.contract ? `- Splatnost: ${project.contract.maturity} dnů
- Záruka: ${project.contract.warranty} měsíců
- Pozastávka: ${project.contract.retention}${project.contract.siteFacilities ? `
- Zařízení staveniště: ${project.contract.siteFacilities}%` : ''}${project.contract.insurance ? `
- Pojištění: ${project.contract.insurance}%` : ''}` : '- Budou specifikovány v SOD'}

Prosíme o zaslání cenové nabídky do [DATUM].

S pozdravem,
${project.siteManager}`;

  return {
    subject,
    body: template
  };
}

/**
 * Create mailto link with pre-filled content
 */
export function createMailtoLink(
  email: string,
  subject: string,
  body: string
): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Format money for display
 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0
  }).format(value);
}
