import { contractMutationsApi } from '../api';
import type { ContractAmendment } from '@/types';

type AmendmentDocumentMetadata = Pick<
  ContractAmendment,
  'documentStoragePath' | 'documentFileName' | 'documentMimeType' | 'documentSize'
>;

interface AttachAmendmentDocumentInput {
  amendmentId: string;
  projectId: string;
  file: File;
}

export const attachAmendmentDocument = async ({
  amendmentId,
  projectId,
  file,
}: AttachAmendmentDocumentInput): Promise<AmendmentDocumentMetadata> => {
  let uploaded: AmendmentDocumentMetadata | undefined;

  try {
    uploaded = await contractMutationsApi.uploadAmendmentDocument(file, projectId);
    await contractMutationsApi.updateAmendment(amendmentId, uploaded);
    return uploaded;
  } catch (error) {
    if (uploaded?.documentStoragePath) {
      try {
        await contractMutationsApi.deleteAmendmentDocument(uploaded.documentStoragePath);
      } catch (cleanupError) {
        console.error('Amendment document cleanup failed:', cleanupError);
      }
    }
    throw error;
  }
};
