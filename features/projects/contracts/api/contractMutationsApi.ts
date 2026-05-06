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
};
