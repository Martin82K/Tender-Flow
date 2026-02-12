import { DemandCategory, ProjectDetails, Bid } from '../types';

const stripCrLf = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();
const sanitizeEmailRecipient = (value: string): string => value.replace(/[\r\n]+/g, '').trim();

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
  const safeEmail = sanitizeEmailRecipient(email);
  const safeSubject = stripCrLf(subject);
  const encodedSubject = encodeURIComponent(safeSubject);
  const encodedBody = encodeURIComponent(body);

  return `mailto:${safeEmail}?subject=${encodedSubject}&body=${encodedBody}`;
}


/**
 * Generate and trigger download of .eml file
 */
export function downloadEmlFile(
  to: string,
  subject: string,
  htmlBody: string
) {
  const emlContent = generateEmlContent(to, subject, htmlBody);

  const blob = new Blob([emlContent], { type: "message/rfc822" });
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
 * Generate EML content as string (for desktop direct open)
 */
export function generateEmlContent(
  to: string,
  subject: string,
  htmlBody: string
): string {
  const safeTo = sanitizeEmailRecipient(to);
  const safeSubject = stripCrLf(subject);
  const boundary = "boundary_string_123456789";

  const emlContent = [
    `To: ${safeTo}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(safeSubject)))}?=`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(htmlBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, "")))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(htmlBody))),
    "",
    `--${boundary}--`
  ].join("\r\n");

  return emlContent;
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
