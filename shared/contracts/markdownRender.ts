import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export const sanitizeMarkdownHtml = (rawHtml: string): string =>
  DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onmouseenter",
      "onmouseleave",
    ],
  });

export const renderMarkdownToSafeHtml = (contentMd: string): string => {
  const parsed = marked.parse(contentMd || "");
  const html = typeof parsed === "string" ? parsed : "";
  return sanitizeMarkdownHtml(html);
};
