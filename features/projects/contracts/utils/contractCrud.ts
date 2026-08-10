import { contractMutationsApi } from '../api';
import type { Contract, ContractWithDetails } from '@/types';

interface CrudResult {
  cleanupWarning: string | null;
}

interface UpdateContractWithDocumentChangeInput {
  contract: ContractWithDetails;
  updates: Partial<Contract>;
  replacementFile?: File | null;
  removeDocument?: boolean;
}

const clearedDocumentMetadata: Partial<Contract> = {
  documentUrl: '',
  documentStoragePath: '',
  documentFileName: '',
  documentMimeType: '',
  documentSize: 0,
};

const cleanupDocument = async (storagePath: string | undefined): Promise<string | null> => {
  if (!storagePath) return null;
  try {
    await contractMutationsApi.deleteContractDocument(storagePath);
    return null;
  } catch (error) {
    console.error('Contract document cleanup failed:', error);
    return 'Záznam byl uložen, ale původní soubor přílohy se nepodařilo odstranit z úložiště.';
  }
};

export const updateContractWithDocumentChange = async ({
  contract,
  updates,
  replacementFile,
  removeDocument = false,
}: UpdateContractWithDocumentChangeInput): Promise<CrudResult> => {
  if (!replacementFile && !removeDocument) {
    await contractMutationsApi.updateContract(contract.id, updates);
    return { cleanupWarning: null };
  }

  if (replacementFile) {
    const uploaded = await contractMutationsApi.uploadContractDocument(
      replacementFile,
      contract.projectId,
    );
    try {
      await contractMutationsApi.updateContract(contract.id, { ...updates, ...uploaded });
    } catch (error) {
      if (uploaded.documentStoragePath) {
        try {
          await contractMutationsApi.deleteContractDocument(uploaded.documentStoragePath);
        } catch (cleanupError) {
          console.error('Replacement contract document rollback failed:', cleanupError);
        }
      }
      throw error;
    }

    return {
      cleanupWarning: await cleanupDocument(contract.documentStoragePath),
    };
  }

  await contractMutationsApi.updateContract(contract.id, {
    ...updates,
    ...clearedDocumentMetadata,
  });
  return {
    cleanupWarning: await cleanupDocument(contract.documentStoragePath),
  };
};

export const deleteContractWithDocuments = async (
  contract: ContractWithDetails,
): Promise<CrudResult> => {
  await contractMutationsApi.deleteContract(contract.id);

  const storagePaths = new Set<string>();
  if (contract.documentStoragePath) storagePaths.add(contract.documentStoragePath);
  for (const amendment of contract.amendments) {
    if (amendment.documentStoragePath) storagePaths.add(amendment.documentStoragePath);
  }

  const results = await Promise.allSettled(
    [...storagePaths].map((storagePath) =>
      contractMutationsApi.deleteContractDocument(storagePath),
    ),
  );
  const failedCount = results.filter((result) => result.status === 'rejected').length;
  return {
    cleanupWarning:
      failedCount > 0
        ? `Smlouva byla smazána, ale ${failedCount} příloh se nepodařilo odstranit z úložiště.`
        : null,
  };
};
