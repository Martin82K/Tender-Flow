import {
  createMailtoLink,
  downloadEmlFile,
  generateEmlContent,
} from "@/services/inquiryService";
import { organizationService } from "@/services/organizationService";
import {
  exportToXLSX,
  exportToMarkdown,
  exportToPDF,
} from "@/services/exportService";
import {
  getTemplateById,
  getDefaultTemplate,
} from "@/services/templateService";
import { userProfileService } from "@/services/userProfileService";
import {
  appendSignatureToTemplate,
  buildEmailSignature,
} from "@/shared/email/signature";
import { processTemplate } from "@/utils/templateUtils";
import platformAdapter from "@/services/platformAdapter";
import type { Bid, DemandCategory, ProjectDetails, User } from "@/types";
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
import {
  persistBidStatusChange,
  updateBidStatusInMemory,
} from "./pipelineBidStatusModel";

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
  userRole?: string;
  currentUser?: User | null;
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
  userRole,
  currentUser,
  updateBidsInternal,
  setIsExportMenuOpen,
  showAlert,
  runDocHubFallbackForCategory,
}: UsePipelineCommunicationActionsInput) => {
  const persistSentStatusForBid = async (bidId: string) => {
    if (!activeCategory) {
      return false;
    }

    const { error } = await persistBidStatusChange({
      bidId,
      targetStatus: "sent",
      userRole,
      projectDataId: projectDetails.id,
      bidsByCategory: bids,
      activeCategoryId: activeCategory.id,
    });

    if (error) {
      console.error("Error persisting bid sent status after inquiry generation:", {
        bidId,
        categoryId: activeCategory.id,
        message: error instanceof Error ? error.message : String(error),
      });
      showAlert({
        title: "Chyba uložení stavu",
        message:
          "Email se otevřel, ale nepodařilo se uložit stav jako odesláno. Obnovte prosím data a zkuste akci znovu.",
        variant: "danger",
      });
      return false;
    }

    updateBidsInternal((prev) =>
      updateBidStatusInMemory(prev, activeCategory.id, bidId, "sent"),
    );
    void runDocHubFallbackForCategory(activeCategory.id, "inquiry-sent");
    return true;
  };

  const getEmailSignature = async () => {
    if (!currentUser?.id) {
      return buildEmailSignature({
        profile: null,
        branding: null,
      });
    }

    const [profile, branding] = await Promise.all([
      userProfileService.getProfile(currentUser.id),
      currentUser.organizationId
        ? organizationService.getOrganizationEmailBranding(
            currentUser.organizationId,
            {
              expiresInSeconds: 1800,
            },
          )
        : Promise.resolve(null),
    ]);

    return buildEmailSignature({
      profile: {
        ...profile,
        signatureEmail: profile.signatureEmail || currentUser.email || null,
        signatureName:
          profile.signatureName || profile.displayName || currentUser.name || null,
      },
      branding,
    });
  };

  const wrapHtmlEmailBody = (rawBody: string): string => {
    const hasHtmlMarkup = /<[a-z][\s\S]*>/i.test(rawBody);
    const normalizedBody = hasHtmlMarkup ? rawBody : rawBody.replace(/\n/g, "<br>");
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333333;">${normalizedBody}</body></html>`;
  };

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
    const signature = await getEmailSignature();
    let body = "";
    let htmlBody = "";

    if (mode === "eml") {
      const contentWithSignaturePlaceholder = appendSignatureToTemplate(
        template.content,
        "{PODPIS_UZIVATELE}",
        { format: "html" },
      );
      const rawBody = processTemplate(
        contentWithSignaturePlaceholder,
        projectDetails,
        activeCategory,
        "html",
        signature.html,
      );
      htmlBody = wrapHtmlEmailBody(rawBody);
    } else {
      const contentWithSignaturePlaceholder = appendSignatureToTemplate(
        template.content,
        "{PODPIS_UZIVATELE}",
        { format: "text" },
      );
      const processedBody = processTemplate(
        contentWithSignaturePlaceholder,
        projectDetails,
        activeCategory,
        "text",
        signature.text,
      );
      body = htmlToPlainText(processedBody);
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
      await persistSentStatusForBid(bid.id);
      return;
    }

    const mailtoLink = createMailtoLink(bid.email || "", subject, body);
    console.log("[Pipeline] Sending inquiry via mailto:", mailtoLink);
    platformAdapter.shell.openExternal(mailtoLink);

    await persistSentStatusForBid(bid.id);
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
    const signature = await getEmailSignature();
    let subject = draft.subject;
    let htmlBody = draft.body
      .split("\n\n")
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");

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
          appendSignatureToTemplate(template.content, "{PODPIS_UZIVATELE}", {
            format: "html",
          }),
          projectDetails,
          activeCategory,
          "html",
          signature.html,
        );
        htmlBody = processed;
      }
    }

    const bccList = buildBccRecipientList(emails);
    const processedHtmlBody = processTemplate(
      appendSignatureToTemplate(htmlBody, "{PODPIS_UZIVATELE}", {
        format: "html",
      }),
      projectDetails,
      activeCategory,
      "html",
      signature.html,
    );
    const wrappedHtmlBody = wrapHtmlEmailBody(processedHtmlBody);

    if (platformAdapter.isDesktop) {
      const emlContent = generateEmlContent("", subject, wrappedHtmlBody, {
        bcc: bccList,
      });
      const filename = `Nevybrani_${Date.now()}.eml`;
      console.log("[Pipeline] Opening losers EML on desktop:", filename);
      platformAdapter.shell.openTempFile(emlContent, filename);
      return;
    }

    const emlContent = generateEmlContent("", subject, wrappedHtmlBody, {
      bcc: bccList,
    });
    const filename = `Nevybrani_${Date.now()}.eml`;
    platformAdapter.shell.openTempFile(emlContent, filename);
  };

  return {
    handleGenerateInquiry,
    handleGenerateMaterialInquiry,
    handleExport,
    handleEmailLosers,
  };
};
