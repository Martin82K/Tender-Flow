import DOMPurify from "dompurify";

import type {
  OrganizationEmailBranding,
  UserEmailSignatureProfile,
} from "@/types";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const convertPlainTextToHtml = (value: string): string =>
  escapeHtml(value).replace(/\n/g, "<br>");

export const sanitizeEmailDisclaimerHtml = (
  rawHtml: string | null | undefined,
): string => {
  const normalized = normalizeText(rawHtml);
  if (!normalized) return "";

  const prepared = /<[a-z][\s\S]*>/i.test(normalized)
    ? normalized
    : convertPlainTextToHtml(normalized);

  return DOMPurify.sanitize(prepared, {
    ALLOWED_TAGS: ["a", "b", "br", "em", "i", "p", "span", "strong"],
    ALLOWED_ATTR: ["href", "rel", "target"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  }).trim();
};

const sanitizeUrl = (value: string | null | undefined): string => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  return DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
};

const buildContactLinksHtml = (
  primaryPhone: string,
  secondaryPhone: string,
  email: string,
): string => {
  const entries: string[] = [];

  if (primaryPhone) {
    const href = `tel:${primaryPhone.replace(/\s+/g, "")}`;
    entries.push(
      `<a href="${escapeHtml(href)}" style="color:#1f2937;text-decoration:underline;">${escapeHtml(primaryPhone)}</a>`,
    );
  }

  if (secondaryPhone) {
    const href = `tel:${secondaryPhone.replace(/\s+/g, "")}`;
    entries.push(
      `<a href="${escapeHtml(href)}" style="color:#1f2937;text-decoration:underline;">${escapeHtml(secondaryPhone)}</a>`,
    );
  }

  if (email) {
    const href = `mailto:${email}`;
    entries.push(
      `<a href="${escapeHtml(href)}" style="color:#1f2937;text-decoration:underline;">${escapeHtml(email)}</a>`,
    );
  }

  return entries.join(
    `<span style="color:#9ca3af;padding:0 8px;">|</span>`,
  );
};

export interface EmailSignatureRenderInput {
  profile: UserEmailSignatureProfile | null;
  branding: OrganizationEmailBranding | null;
}

export interface EmailSignatureRenderResult {
  html: string;
  text: string;
  hasContent: boolean;
  isBrandingComplete: boolean;
}

export const buildEmailSignature = ({
  profile,
  branding,
}: EmailSignatureRenderInput): EmailSignatureRenderResult => {
  const greeting = normalizeText(profile?.signatureGreeting) || "S pozdravem";
  const signatureName =
    normalizeText(profile?.signatureName) || normalizeText(profile?.displayName);
  const signatureRole = normalizeText(profile?.signatureRole);
  const primaryPhone = normalizeText(profile?.signaturePhone);
  const secondaryPhone = normalizeText(profile?.signaturePhoneSecondary);
  const signatureEmail = normalizeText(profile?.signatureEmail);
  const companyName = normalizeText(branding?.companyName);
  const companyAddress = normalizeText(branding?.companyAddress);
  const companyMeta = normalizeText(branding?.companyMeta);
  const disclaimerHtml = sanitizeEmailDisclaimerHtml(branding?.disclaimerHtml);
  const emailLogoUrl = sanitizeUrl(branding?.emailLogoUrl);

  const personLine = signatureName
    ? [
        `<span style="font-weight:700;color:#111827;">${escapeHtml(signatureName)}</span>`,
        signatureRole
          ? `<span style="color:#9ca3af;padding:0 8px;">|</span><span style="color:#6b7280;">${escapeHtml(signatureRole)}</span>`
          : "",
      ].join("")
    : "";
  const contactLine = buildContactLinksHtml(
    primaryPhone,
    secondaryPhone,
    signatureEmail,
  );

  const companyBlockParts = [
    companyName ? `<div style="font-weight:600;color:#111827;">${convertPlainTextToHtml(companyName)}</div>` : "",
    companyAddress ? `<div style="margin-top:4px;color:#374151;">${convertPlainTextToHtml(companyAddress)}</div>` : "",
    companyMeta ? `<div style="margin-top:4px;color:#374151;">${convertPlainTextToHtml(companyMeta)}</div>` : "",
  ].filter(Boolean);

  const htmlParts = [
    `<div style="margin-top:24px;font-family:Arial,sans-serif;color:#1f2937;">`,
    `<div style="font-size:16px;line-height:1.5;">${convertPlainTextToHtml(greeting)}</div>`,
    personLine
      ? `<div style="margin-top:28px;font-size:18px;line-height:1.4;">${personLine}</div>`
      : "",
    contactLine
      ? `<div style="margin-top:10px;font-size:16px;line-height:1.5;">${contactLine}</div>`
      : "",
    emailLogoUrl || companyBlockParts.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;"><tr>${
          emailLogoUrl
            ? `<td valign="top" style="padding-right:24px;padding-bottom:12px;"><img src="${escapeHtml(emailLogoUrl)}" alt="${escapeHtml(companyName || "Emailové logo")}" style="display:block;max-width:320px;max-height:90px;height:auto;width:auto;" /></td>`
            : ""
        }${
          companyBlockParts.length > 0
            ? `<td valign="top" style="${emailLogoUrl ? "border-left:1px solid #d1d5db;padding-left:24px;" : ""}font-size:14px;line-height:1.5;">${companyBlockParts.join("")}</td>`
            : ""
        }</tr></table>`
      : "",
    disclaimerHtml
      ? `<div style="margin-top:24px;font-size:12px;line-height:1.8;color:#6b7280;font-style:italic;">${disclaimerHtml}</div>`
      : "",
    `</div>`,
  ].filter(Boolean);

  const textParts = [
    greeting,
    "",
    [signatureName, signatureRole].filter(Boolean).join(" | "),
    [primaryPhone, secondaryPhone, signatureEmail].filter(Boolean).join(" | "),
    "",
    [companyName, companyAddress, companyMeta].filter(Boolean).join("\n"),
    "",
    disclaimerHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  ]
    .filter((part, index, arr) => {
      if (part) return true;
      const prev = arr[index - 1];
      const next = arr[index + 1];
      return !!prev && !!next;
    })
    .join("\n")
    .trim();

  return {
    html: htmlParts.join(""),
    text: textParts,
    hasContent: Boolean(textParts),
    isBrandingComplete: Boolean(emailLogoUrl),
  };
};

export const appendSignatureToTemplate = (
  templateContent: string,
  signatureContent: string,
  options?: { format?: "html" | "text"; placeholder?: string },
): string => {
  const placeholder = options?.placeholder ?? "{PODPIS_UZIVATELE}";
  if (!signatureContent.trim()) return templateContent;
  if (templateContent.includes(placeholder)) return templateContent;

  const separator = options?.format === "html" ? "<br><br>" : "\n\n";
  return `${templateContent}${separator}${signatureContent}`;
};
