import {
  createMailtoLink,
  downloadEmlFile,
  generateEmlContent,
} from "@/services/inquiryService";
import { loadBudgetAttachmentForEmail } from "@/services/budgetAttachmentService";
import type { EmailAttachment } from "@/services/budgetAttachmentService";
import { isBudgetAttachmentOverEmailLimit } from "@/features/projects/model/budgetAttachmentModel";
import { organizationService } from "@features/organization/api";
import { projectExportApi } from "@features/projects/api/projectExportApi";
import {
  getTemplateById,
  getDefaultTemplate,
} from "@/services/templateService";
import { userProfileService } from "@/services/userProfileService";
import {
  appendSignatureToTemplate,
  buildEmailSignature,
} from "@/shared/email/signature";
import { processTemplate, renderTemplateHtml, sanitizeEmailHtml } from "@/shared/email/templateUtils";
import platformAdapter from "@infra/platform/platformAdapter";
import type { Bid, DemandCategory, ProjectDetails, User } from "@/types";
import type { PipelineInquiryGenerationKind } from "./pipelineModel";
import {
  buildBccRecipientList,
  buildDefaultLosersEmailDraft,
  isValidEmailAddress,
  normalizeEmailAddress,
  selectBulkInquiryRecipients,
  selectLoserEmailRecipients,
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
  resolveDesktopTenderFolderPath?: (categoryTitle: string) => Promise<string | null>;
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
  resolveDesktopTenderFolderPath,
}: UsePipelineCommunicationActionsInput) => {
  const persistSentStatusesForBids = async (bidIds: string[]) => {
    if (!activeCategory) {
      return false;
    }

    const uniqueBidIds = Array.from(new Set(bidIds));
    const persistenceResults = await Promise.all(
      uniqueBidIds.map(async (bidId) => ({
        bidId,
        result: await persistBidStatusChange({
          bidId,
          targetStatus: "sent",
          userRole,
          projectDataId: projectDetails.id,
          bidsByCategory: bids,
          activeCategoryId: activeCategory.id,
        }),
      })),
    );
    const successfulBidIds = persistenceResults
      .filter(({ result }) => !result.error)
      .map(({ bidId }) => bidId);
    const failedResults = persistenceResults.filter(({ result }) => result.error);

    if (successfulBidIds.length > 0) {
      updateBidsInternal((prev) =>
        successfulBidIds.reduce(
          (next, bidId) =>
            updateBidStatusInMemory(next, activeCategory.id, bidId, "sent"),
          prev,
        ),
      );
      void runDocHubFallbackForCategory(activeCategory.id, "inquiry-sent");
    }

    if (failedResults.length > 0) {
      console.error("Error persisting sent statuses after inquiry generation:", {
        bidIds: failedResults.map(({ bidId }) => bidId),
        categoryId: activeCategory.id,
        messages: failedResults.map(({ result }) =>
          result.error instanceof Error
            ? result.error.message
            : String(result.error),
        ),
      });
      showAlert({
        title: "Chyba uložení stavu",
        message:
          failedResults.length === 1
            ? "Email se otevřel, ale nepodařilo se uložit stav jako odesláno. Obnovte prosím data a zkuste akci znovu."
            : `Email se otevřel, ale u ${failedResults.length} dodavatelů se nepodařilo uložit stav jako odesláno. Obnovte prosím data a změny zkontrolujte.`,
        variant: "danger",
      });
    }

    return failedResults.length === 0;
  };

  const persistSentStatusForBid = async (bidId: string) =>
    persistSentStatusesForBids([bidId]);

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
    const normalizedBody = sanitizeEmailHtml(renderTemplateHtml(rawBody));
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333333;">${normalizedBody}</body></html>`;
  };

  const loadInquiryTemplate = async (kind: PipelineInquiryGenerationKind) => {
    let template;
    const templateLinks = getTemplateLinksForInquiryKindModel(projectDetails, kind);

    for (const templateLink of templateLinks) {
      const templateId = templateLink.split(":")[1];
      if (!templateId) continue;
      template = await getTemplateById(templateId, { projectId: projectDetails.id });
      if (template) break;
    }

    if (!template) {
      template = await getDefaultTemplate({ projectId: projectDetails.id });
    }

    if (!template) {
      showAlert({
        title: "Chyba šablony",
        message:
          "Nepodařilo se načíst šablonu emailu. Prosím zkontrolujte nastavení šablon.",
        variant: "danger",
      });
      return null;
    }

    return template;
  };

  const buildInquiryDraft = async (
    kind: PipelineInquiryGenerationKind,
    format: "html" | "text",
  ) => {
    if (!activeCategory) return null;

    const template = await loadInquiryTemplate(kind);
    if (!template) return null;

    const signature = await getEmailSignature();
    const contentWithSignaturePlaceholder = appendSignatureToTemplate(
      template.content,
      "{PODPIS_UZIVATELE}",
      { format },
    );
    const processedBody = processTemplate(
      contentWithSignaturePlaceholder,
      projectDetails,
      activeCategory,
      format,
      format === "html" ? signature.html : signature.text,
    );

    return {
      subject: processTemplate(
        template.subject,
        projectDetails,
        activeCategory,
      ),
      body:
        format === "html"
          ? wrapHtmlEmailBody(processedBody)
          : htmlToPlainText(processedBody),
    };
  };

  const loadInquiryAttachments = async (): Promise<EmailAttachment[]> => {
    if (
      !activeCategory ||
      !platformAdapter.isDesktop ||
      !activeCategory.budgetAttachment?.enabled ||
      !resolveDesktopTenderFolderPath ||
      isBudgetAttachmentOverEmailLimit(activeCategory.budgetAttachment)
    ) {
      return [];
    }

    try {
      const tenderFolderPath = await resolveDesktopTenderFolderPath(
        activeCategory.title,
      );
      if (!tenderFolderPath) {
        throw new Error("Nepodařilo se najít složku tohoto VŘ.");
      }
      return [
        await loadBudgetAttachmentForEmail(
          tenderFolderPath,
          activeCategory.budgetAttachment,
        ),
      ];
    } catch (error) {
      showAlert({
        title: "Příloha nebyla vložena",
        message: `${
          error instanceof Error
            ? error.message
            : "Rozpočtovou přílohu se nepodařilo načíst."
        } EML zpráva bude vytvořena bez této přílohy.`,
        variant: "info",
      });
      return [];
    }
  };

  const generateInquiryFromTemplateKind = async (
    bid: Bid,
    kind: PipelineInquiryGenerationKind,
  ) => {
    if (!activeCategory) return;

    const userPreferredMode = emailClientMode || "mailto";
    const mode = platformAdapter.isDesktop ? "eml" : userPreferredMode;

    const draft = await buildInquiryDraft(
      kind,
      mode === "eml" ? "html" : "text",
    );
    if (!draft) return;

    if (mode === "eml") {
      const attachments = await loadInquiryAttachments();

      if (platformAdapter.isDesktop) {
        const emlContent = generateEmlContent(bid.email || "", draft.subject, draft.body, {
          attachments,
        });
        const filename =
          kind === "materialInquiry"
            ? `Materialova_poptavka_${Date.now()}.eml`
            : `Poptavka_${Date.now()}.eml`;
        console.log("[Pipeline] Opening EML on desktop:", filename);
        await platformAdapter.shell.openTempFile(emlContent, filename);
      } else {
        downloadEmlFile(bid.email || "", draft.subject, draft.body);
      }
      await persistSentStatusForBid(bid.id);
      return;
    }

    const mailtoLink = createMailtoLink(bid.email || "", draft.subject, draft.body);
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

  const getCurrentUserEmail = (): string | null => {
    const email = normalizeEmailAddress(currentUser?.email || "");
    if (isValidEmailAddress(email)) return email;

    showAlert({
      title: "Chybí email odesílatele",
      message:
        "Hromadný koncept nelze vytvořit, protože přihlášený uživatel nemá platný email.",
      variant: "danger",
    });
    return null;
  };

  const handleGenerateBulkInquiry = async (
    kind: PipelineInquiryGenerationKind,
  ) => {
    if (!activeCategory) return false;

    const userEmail = getCurrentUserEmail();
    if (!userEmail) return false;

    const selection = selectBulkInquiryRecipients(
      bids[activeCategory.id] || [],
    );
    if (selection.candidateBids.length === 0) {
      showAlert({
        title: "Žádní dodavatelé k oslovení",
        message: "Ve sloupci Oslovení nejsou žádní dodavatelé.",
        variant: "info",
      });
      return false;
    }
    if (selection.emails.length === 0) {
      showAlert({
        title: "Chybí platné emaily",
        message:
          "Žádný dodavatel ve sloupci Oslovení nemá platnou emailovou adresu.",
        variant: "info",
      });
      return false;
    }

    const draft = await buildInquiryDraft(kind, "html");
    if (!draft) return false;
    const attachments = await loadInquiryAttachments();
    const emlContent = generateEmlContent(userEmail, draft.subject, draft.body, {
      bcc: buildBccRecipientList(selection.emails),
      attachments,
    });
    const filename =
      kind === "materialInquiry"
        ? `Materialova_poptavka_hromadne_${Date.now()}.eml`
        : `Poptavka_hromadne_${Date.now()}.eml`;

    try {
      await platformAdapter.shell.openTempFile(emlContent, filename);
    } catch (error) {
      console.error("Failed to open bulk inquiry draft:", {
        categoryId: activeCategory.id,
        message: error instanceof Error ? error.message : String(error),
      });
      showAlert({
        title: "Koncept se nepodařilo vytvořit",
        message: "Emailový koncept se nepodařilo otevřít. Stavy dodavatelů nebyly změněny.",
        variant: "danger",
      });
      return false;
    }

    await persistSentStatusesForBids(
      selection.recipientBids.map((bid) => bid.id),
    );
    return true;
  };

  const resolveExportMeta = async () => {
    const organizationLogoUrl = currentUser?.organizationId
      ? await organizationService
          .getOrganizationLogoUrl(currentUser.organizationId, {
            expiresInSeconds: 1800,
          })
          .catch(() => null)
      : null;

    return {
      organizationName: currentUser?.organizationName,
      organizationLogoUrl,
      sourceLabel: "Výběrové řízení",
    };
  };

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!activeCategory) return;

    const categoryBids = bids[activeCategory.id] || [];

    try {
      switch (format) {
        case "xlsx":
          await projectExportApi.exportToXLSX(
            activeCategory,
            categoryBids,
            projectDetails,
            await resolveExportMeta(),
          );
          break;
        case "pdf":
          await projectExportApi.exportToPDF(
            activeCategory,
            categoryBids,
            projectDetails,
            await resolveExportMeta(),
          );
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
    if (!activeCategory) return false;

    const userEmail = getCurrentUserEmail();
    if (!userEmail) return false;

    const categoryBids = bids[activeCategory.id] || [];
    const selection = selectLoserEmailRecipients(categoryBids);

    if (selection.candidateBids.length === 0) {
      showAlert({
        title: "Info",
        message: "Nejsou žádní nevybráni účastníci s cenou.",
        variant: "info",
      });
      return false;
    }

    if (selection.emails.length === 0) {
      showAlert({
        title: "Info",
        message: "Žádný z nevybraných účastníků nemá uvedený email.",
        variant: "info",
      });
      return false;
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
      const template = await getTemplateById(templateId, { projectId: projectDetails.id });
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

    const bccList = buildBccRecipientList(selection.emails);
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

    const emlContent = generateEmlContent(userEmail, subject, wrappedHtmlBody, {
      bcc: bccList,
    });
    const filename = `Nevybrani_${Date.now()}.eml`;
    try {
      await platformAdapter.shell.openTempFile(emlContent, filename);
      return true;
    } catch (error) {
      console.error("Failed to open losers email draft:", {
        categoryId: activeCategory.id,
        message: error instanceof Error ? error.message : String(error),
      });
      showAlert({
        title: "Koncept se nepodařilo vytvořit",
        message: "Emailový koncept se nepodařilo otevřít. Zkuste akci znovu.",
        variant: "danger",
      });
      return false;
    }
  };

  return {
    handleGenerateInquiry,
    handleGenerateMaterialInquiry,
    handleGenerateBulkInquiry,
    handleExport,
    handleEmailLosers,
  };
};
