import { contractService } from "@/services/contractService";

export const contractMutationsApi = {
  createAmendment(
    ...args: Parameters<typeof contractService.createAmendment>
  ): ReturnType<typeof contractService.createAmendment> {
    return contractService.createAmendment(...args);
  },

  updateAmendment(
    ...args: Parameters<typeof contractService.updateAmendment>
  ): ReturnType<typeof contractService.updateAmendment> {
    return contractService.updateAmendment(...args);
  },

  deleteAmendment(
    ...args: Parameters<typeof contractService.deleteAmendment>
  ): ReturnType<typeof contractService.deleteAmendment> {
    return contractService.deleteAmendment(...args);
  },

  createContract(
    ...args: Parameters<typeof contractService.createContract>
  ): ReturnType<typeof contractService.createContract> {
    return contractService.createContract(...args);
  },

  updateContract(
    ...args: Parameters<typeof contractService.updateContract>
  ): ReturnType<typeof contractService.updateContract> {
    return contractService.updateContract(...args);
  },

  updateVendorRating(
    ...args: Parameters<typeof contractService.updateVendorRating>
  ): ReturnType<typeof contractService.updateVendorRating> {
    return contractService.updateVendorRating(...args);
  },

  createInvoice(
    ...args: Parameters<typeof contractService.createInvoice>
  ): ReturnType<typeof contractService.createInvoice> {
    return contractService.createInvoice(...args);
  },

  updateInvoice(
    ...args: Parameters<typeof contractService.updateInvoice>
  ): ReturnType<typeof contractService.updateInvoice> {
    return contractService.updateInvoice(...args);
  },

  createMarkdownVersion(
    ...args: Parameters<typeof contractService.createMarkdownVersion>
  ): ReturnType<typeof contractService.createMarkdownVersion> {
    return contractService.createMarkdownVersion(...args);
  },

  deleteInvoice(
    ...args: Parameters<typeof contractService.deleteInvoice>
  ): ReturnType<typeof contractService.deleteInvoice> {
    return contractService.deleteInvoice(...args);
  },

  markInvoicePaid(
    ...args: Parameters<typeof contractService.markInvoicePaid>
  ): ReturnType<typeof contractService.markInvoicePaid> {
    return contractService.markInvoicePaid(...args);
  },

  releaseRetention(
    ...args: Parameters<typeof contractService.releaseRetention>
  ): ReturnType<typeof contractService.releaseRetention> {
    return contractService.releaseRetention(...args);
  },
};
