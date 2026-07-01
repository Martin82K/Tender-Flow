import { DemandCategory, ProjectDetails, Bid } from '../types';
import type { EmailAttachment } from './budgetAttachmentService';

const stripCrLf = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();
const sanitizeEmailRecipient = (value: string): string => value.replace(/[\r\n]+/g, '').trim();
const sanitizeHeaderParameter = (value: string): string =>
  value.replace(/[\r\n"]/g, '').replace(/[\\/:*?<>|]+/g, '_').trim() || 'priloha';
const encodeHeaderParameter = (value: string): string =>
  encodeURIComponent(value).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const foldBase64 = (value: string): string => value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
const encodeUtf8Base64 = (value: string): string =>
  btoa(unescape(encodeURIComponent(value)));

const buildAlternativePart = (boundary: string, htmlBody: string): string[] => [
  `--${boundary}`,
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  encodeUtf8Base64(htmlBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, "")),
  "",
  `--${boundary}`,
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  encodeUtf8Base64(htmlBody),
  "",
  `--${boundary}--`,
];

const buildAttachmentPart = (boundary: string, attachment: EmailAttachment): string[] => {
  const safeFilename = sanitizeHeaderParameter(attachment.filename);
  const encodedFilename = encodeHeaderParameter(attachment.filename.replace(/[\r\n]+/g, ' ').trim() || safeFilename);

  return [
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${safeFilename}"; name*=UTF-8''${encodedFilename}`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
    "",
    foldBase64(attachment.base64Content),
    "",
  ];
};

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
  htmlBody: string,
  options?: {
    attachments?: EmailAttachment[];
  }
) {
  const emlContent = generateEmlContent(to, subject, htmlBody, options);

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
  htmlBody: string,
  options?: {
    bcc?: string;
    attachments?: EmailAttachment[];
  }
): string {
  const safeTo = sanitizeEmailRecipient(to);
  const safeBcc = sanitizeEmailRecipient(options?.bcc || "");
  const safeSubject = stripCrLf(subject);
  const boundary = "boundary_string_123456789";
  const attachments = options?.attachments || [];

  const bodyLines =
    attachments.length === 0
      ? [
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          ...buildAlternativePart(boundary, htmlBody),
        ]
      : [
          `Content-Type: multipart/mixed; boundary="${boundary}_mixed"`,
          "",
          `--${boundary}_mixed`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          ...buildAlternativePart(boundary, htmlBody),
          "",
          ...attachments.flatMap((attachment) =>
            buildAttachmentPart(`${boundary}_mixed`, attachment),
          ),
          `--${boundary}_mixed--`,
        ];

  const emlContent = [
    `To: ${safeTo}`,
    ...(safeBcc ? [`Bcc: ${safeBcc}`] : []),
    `Subject: =?utf-8?B?${encodeUtf8Base64(safeSubject)}?=`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    ...bodyLines,
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
