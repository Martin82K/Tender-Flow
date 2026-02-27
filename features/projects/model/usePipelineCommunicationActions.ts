import {
  createMailtoLink,
  downloadEmlFile,
  generateEmlContent,
} from "@/services/inquiryService";
import {
  exportToXLSX,
  exportToMarkdown,
  exportToPDF,
} from "@/services/exportService";
import {
  getTemplateById,
  getDefaultTemplate,
} from "@/services/templateService";
import { processTemplate } from "@/utils/templateUtils";
import platformAdapter from "@/services/platformAdapter";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";
import type { PipelineInquiryGenerationKind } from "./pipelineModel";
import {
  buildBccRecipientList,
  buildDefaultLosersEmailDraft,
  getLoserBidsWithPrice,
  getLoserEmails,
} from "./pipelineEmailModel";
import {
  getTemplateLinksForInquiryKindModel,
  htmlToPlainText,
} from "./pipelineModel";

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
}

interface UsePipelineCommunicationActionsInput {
  activeCategory: DemandCategory | null;
  bids: Record<string, Bid[]>;
  projectDetails: ProjectDetails;
  emailClientMode?: string;
  updateBidsInternal: (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => void;
  setIsExportMenuOpen: (value: boolean) => void;
  showAlert: (args: ShowAlertArgs) => void;
  runDocHubFallbackForCategory: (
    categoryId: string,
    reason: string,
  ) => Promise<void> | void;
}

export const usePipelineCommunicationActions = ({
  activeCategory,
  bids,
  projectDetails,
  emailClientMode,
  updateBidsInternal,
  setIsExportMenuOpen,
  showAlert,
  runDocHubFallbackForCategory,
}: UsePipelineCommunicationActionsInput) => {
  const generateInquiryFromTemplateKind = async (
    bid: Bid,
    kind: PipelineInquiryGenerationKind,
  ) => {
    if (!activeCategory) return;

    const userPreferredMode = emailClientMode || "mailto";
    const mode = platformAdapter.isDesktop ? "eml" : userPreferredMode;

    let template;
    const templateLinks = getTemplateLinksForInquiryKindModel(projectDetails, kind);

    for (const templateLink of templateLinks) {
      const templateId = templateLink.split(":")[1];
      if (!templateId) continue;
      template = await getTemplateById(templateId);
      if (template) break;
    }

    if (!template) {
      template = await getDefaultTemplate();
    }

    if (!template) {
      showAlert({
        title: "Chyba šablony",
        message:
          "Nepodařilo se načíst šablonu emailu. Prosím zkontrolujte nastavení šablon.",
        variant: "danger",
      });
      return;
    }

    const subject = processTemplate(
      template.subject,
      projectDetails,
      activeCategory,
    );
    let body = "";
    let htmlBody = "";

    if (mode === "eml") {
      const rawBody = processTemplate(
        template.content,
        projectDetails,
        activeCategory,
        "html",
      );
      htmlBody = rawBody.replace(/\n/g, "<br>");
      htmlBody = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color: #333;">${htmlBody}</body></html>`;
    } else {
      const processedBody = processTemplate(
        template.content,
        projectDetails,
        activeCategory,
        "text",
      );
      body = processedBody
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ");
    }

    if (mode === "eml") {
      if (platformAdapter.isDesktop) {
        const emlContent = generateEmlContent(bid.email || "", subject, htmlBody);
        const filename =
          kind === "materialInquiry"
            ? `Materialova_poptavka_${Date.now()}.eml`
            : `Poptavka_${Date.now()}.eml`;
        console.log("[Pipeline] Opening EML on desktop:", filename);
        platformAdapter.shell.openTempFile(emlContent, filename);
      } else {
        downloadEmlFile(bid.email || "", subject, htmlBody);
      }

      updateBidsInternal((prev) => {
        const categoryBids = [...(prev[activeCategory.id] || [])];
        const index = categoryBids.findIndex((item) => item.id === bid.id);
        if (index > -1) {
          categoryBids[index] = { ...categoryBids[index], status: "sent" };
          return { ...prev, [activeCategory.id]: categoryBids };
        }
        return prev;
      });
      void runDocHubFallbackForCategory(activeCategory.id, "inquiry-sent");
      return;
    }

    const mailtoLink = createMailtoLink(bid.email || "", subject, body);
    console.log("[Pipeline] Sending inquiry via mailto:", mailtoLink);
    platformAdapter.shell.openExternal(mailtoLink);

    setTimeout(() => {
      updateBidsInternal((prev) => {
        const categoryBids = [...(prev[activeCategory.id] || [])];
        const index = categoryBids.findIndex((item) => item.id === bid.id);
        if (index > -1) {
          categoryBids[index] = { ...categoryBids[index], status: "sent" };
          return { ...prev, [activeCategory.id]: categoryBids };
        }
        return prev;
      });
      void runDocHubFallbackForCategory(activeCategory.id, "inquiry-sent");
    }, 100);
  };

  const handleGenerateInquiry = async (bid: Bid) => {
    await generateInquiryFromTemplateKind(bid, "inquiry");
  };

  const handleGenerateMaterialInquiry = async (bid: Bid) => {
    await generateInquiryFromTemplateKind(bid, "materialInquiry");
  };

  const handleExport = (format: "xlsx" | "markdown" | "pdf") => {
    if (!activeCategory) return;

    const categoryBids = bids[activeCategory.id] || [];

    try {
      switch (format) {
        case "xlsx":
          exportToXLSX(activeCategory, categoryBids, projectDetails);
          break;
        case "markdown":
          exportToMarkdown(activeCategory, categoryBids, projectDetails);
          break;
        case "pdf":
          exportToPDF(activeCategory, categoryBids, projectDetails);
          break;
      }
      setIsExportMenuOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      showAlert({
        title: "Chyba exportu",
        message: "Chyba při exportu. Zkuste to prosím znovu.",
        variant: "danger",
      });
    }
  };

  const handleEmailLosers = async () => {
    if (!activeCategory) return;

    const categoryBids = bids[activeCategory.id] || [];
    const loserBids = getLoserBidsWithPrice(categoryBids);

    if (loserBids.length === 0) {
      showAlert({
        title: "Info",
        message: "Nejsou žádní nevybráni účastníci s cenou.",
        variant: "info",
      });
      return;
    }

    const emails = getLoserEmails(loserBids);

    if (emails.length === 0) {
      showAlert({
        title: "Info",
        message: "Žádný z nevybraných účastníků nemá uvedený email.",
        variant: "info",
      });
      return;
    }

    const draft = buildDefaultLosersEmailDraft(
      projectDetails.title,
      activeCategory.title,
    );
    let subject = draft.subject;
    let body = draft.body;

    const templateLink = projectDetails.losersEmailTemplateLink || "";
    if (templateLink.startsWith("template:")) {
      const templateId = templateLink.split(":")[1];
      const template = await getTemplateById(templateId);
      if (template) {
        subject = processTemplate(
          template.subject,
          projectDetails,
          activeCategory,
        );
        const processed = processTemplate(
          template.content,
          projectDetails,
          activeCategory,
        );
        body = htmlToPlainText(processed);
      }
    }

    const bccList = buildBccRecipientList(emails);
    window.location.href = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return {
    handleGenerateInquiry,
    handleGenerateMaterialInquiry,
    handleExport,
    handleEmailLosers,
  };
};
