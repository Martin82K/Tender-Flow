import { DemandCategory, ProjectDetails, Bid } from '../types';

/**
 * Generate email inquiry from template
 */
/**
 * Generate email inquiry from template
 * @deprecated Use templateService and processTemplate instead
 */
export function generateInquiryEmail(
  category: DemandCategory,
  project: ProjectDetails,
  bid: Bid,
  signature?: string
): { subject: string; body: string } {
  // This is legacy fallback. We should not be using this.
  // But to satisfy types if referenced elsewhere:
  return {
    subject: `Poptávka - ${category.title} - ${project.title}`,
    body: "Error: No template selected."
  };
}

/**
 * Generate email inquiry from template (HTML version with hidden links)
 * @deprecated Use templateService and processTemplate instead
 */
export function generateInquiryEmailHtml(
  category: DemandCategory,
  project: ProjectDetails,
  bid: Bid,
  signature?: string
): string {
  return "<p>Error: No template selected.</p>";
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
