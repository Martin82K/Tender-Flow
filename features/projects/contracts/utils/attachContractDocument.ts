import { contractMutationsApi } from '../api';
import type { Contract } from '@/types';

type ContractDocumentMetadata = Pick<
  Contract,
  'documentStoragePath' | 'documentFileName' | 'documentMimeType' | 'documentSize'
>;

interface AttachContractDocumentInput {
  contractId: string;
  projectId: string;
  file: File;
}

export const attachContractDocument = async ({
  contractId,
  projectId,
  file,
}: AttachContractDocumentInput): Promise<ContractDocumentMetadata> => {
  let uploaded: ContractDocumentMetadata | undefined;

  try {
    uploaded = await contractMutationsApi.uploadContractDocument(file, projectId);
    await contractMutationsApi.updateContract(contractId, uploaded);
    return uploaded;
  } catch (error) {
    if (uploaded?.documentStoragePath) {
      try {
        await contractMutationsApi.deleteContractDocument(uploaded.documentStoragePath);
      } catch (cleanupError) {
        console.error('Contract document cleanup failed:', cleanupError);
      }
    }
    throw error;
  }
};
