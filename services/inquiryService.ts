import { DemandCategory, ProjectDetails, Bid } from '../types';

/**
 * Generate email inquiry from template
 */
export function generateInquiryEmail(
  category: DemandCategory,
  project: ProjectDetails,
  bid: Bid,
  signature?: string
): { subject: string; body: string } {
  const subject = `Poptávka - ${category.title} - ${project.title}`;
  
  const footer = signature || project.siteManager;

  // Basic template with dynamic variables
  let template = `Dobrý den,

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

ODKAZ NA DOKUMENTACI:
${(() => {
    if (project.documentLinks && project.documentLinks.length > 0) {
      return project.documentLinks.map(l => `📂 ${l.label}: ${l.url}`).join('\n');
    }
    return project.documentationLink || 'Odkaz bude upřesněn.';
  })()}

Prosíme o zaslání cenové nabídky do [DATUM].

S pozdravem,
${footer}`;

  // Replace dynamic variables if custom template is used (this is a placeholder for future custom template logic)
  // For now, we just ensure the default template has the link. 
  // If we were loading a custom template string, we would do:
  // template = template.replace('{{odkaz_dokumentace}}', project.documentationLink || '');

  return {
    subject,
    body: template
  };
}

/**
 * Generate email inquiry from template (HTML version with hidden links)
 */
export function generateInquiryEmailHtml(
  category: DemandCategory,
  project: ProjectDetails,
  bid: Bid,
  signature?: string
): string {
  
  const footer = signature ? signature.replace(/\n/g, '<br>') : `<p>${project.siteManager}</p>`;

  // Basic template with dynamic variables
  let template = `<p>Dobrý den,</p>
<p>obracíme se na Vás s poptávkou subdodávky pro stavbu <strong>${project.title}</strong>.</p>

<h3>INFORMACE O STAVBĚ:</h3>
<ul>
<li>Investor: ${project.investor || '-'}</li>
<li>Lokace: ${project.location}</li>
<li>Termín dokončení: ${project.finishDate}</li>
<li>Stavbyvedoucí: ${project.siteManager}</li>
${project.technicalSupervisor ? `<li>Technický dozor: ${project.technicalSupervisor}</li>` : ''}
</ul>

<h3>POPTÁVANÁ KATEGORIE:</h3>
<p>${category.title}</p>

<h3>POPIS PRACÍ:</h3>
<p>${(category.description || 'Detailní popis prací viz příloha.').replace(/\n/g, '<br>')}</p>

<h3>PODMÍNKY SOD:</h3>
<ul>
${project.contract ? `<li>Splatnost: ${project.contract.maturity} dnů</li>
<li>Záruka: ${project.contract.warranty} měsíců</li>
<li>Pozastávka: ${project.contract.retention}</li>${project.contract.siteFacilities ? `
<li>Zařízení staveniště: ${project.contract.siteFacilities}%</li>` : ''}${project.contract.insurance ? `
<li>Pojištění: ${project.contract.insurance}%</li>` : ''}` : '<li>Budou specifikovány v SOD</li>'}
</ul>

<h3>ODKAZ NA DOKUMENTACI:</h3>
<p>
${(() => {
    if (project.documentLinks && project.documentLinks.length > 0) {
      return project.documentLinks.map(l => `📂 <a href="${l.url}">${l.label}</a>`).join('<br>');
    }
    const link = project.documentationLink || '#';
    return link !== '#' ? `<a href="${link}">Odkaz na dokumentaci</a>` : 'Odkaz bude upřesněn.';
  })()}
</p>

<p>Prosíme o zaslání cenové nabídky do <strong>[DATUM]</strong>.</p>

<p>S pozdravem,</p>
${footer.startsWith('<') ? footer : `<p>${footer}</p>`}`;

  return template;
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
 * Generate and trigger download of .eml file
 */
export function downloadEmlFile(
  to: string,
  subject: string,
  htmlBody: string
) {
  const boundary = "boundary_string_123456789";
  const emlContent = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "X-Unsent: 1", // Opens as draft
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n"), // Plain text fallback
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    // Simple QP encoding: =XX for non-ascii
    // For simplicity in client-side JS without libraries, we can use UTF-8 direct 
    // if client supports it well, but Outlook prefers QP or Base64.
    // Let's use Base64 which is safer for utf-8 content.
    // Actually, let's change transfer encoding to base64 for html part.
  ].join("\r\n");

  // Re-assembling with Base64 for safety
  const emlContentBase64 = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, // Valid subject encoding
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ""),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(htmlBody))),
    "",
    `--${boundary}--`
  ].join("\r\n");

  const blob = new Blob([emlContentBase64], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `Poptavka_${new Date().getTime()}.eml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
