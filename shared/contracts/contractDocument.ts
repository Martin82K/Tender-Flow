export const CONTRACT_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export type ContractDocumentKind = 'pdf' | 'docx';

export interface ValidatedContractDocument {
  extension: ContractDocumentKind;
  mimeType: string;
  fileName: string;
  size: number;
}

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const getContractDocumentKind = (
  mimeType: string | undefined,
  fileName: string | undefined,
): ContractDocumentKind | null => {
  const lowerName = fileName?.toLowerCase() || '';
  if (mimeType === PDF_MIME || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimeType === DOCX_MIME || lowerName.endsWith('.docx')) return 'docx';
  return null;
};

const readHeader = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Soubor se nepodařilo přečíst.'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file.slice(0, 5));
  });

export const validateContractDocument = async (
  file: File,
): Promise<ValidatedContractDocument> => {
  const extension = getContractDocumentKind(file.type, file.name);
  if (!extension) throw new Error('Soubor musí být ve formátu PDF nebo DOCX.');
  if (file.size <= 0) throw new Error('Soubor je prázdný.');
  if (file.size > CONTRACT_DOCUMENT_MAX_BYTES) {
    throw new Error('Soubor je větší než povolený limit 20 MB.');
  }

  const header = await readHeader(file);
  const isPdf = header.length >= 5
    && header[0] === 0x25
    && header[1] === 0x50
    && header[2] === 0x44
    && header[3] === 0x46
    && header[4] === 0x2d;
  const isZip = header.length >= 4
    && header[0] === 0x50
    && header[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(header[2])
    && [0x04, 0x06, 0x08].includes(header[3]);

  if ((extension === 'pdf' && !isPdf) || (extension === 'docx' && !isZip)) {
    throw new Error('Obsah souboru neodpovídá jeho příponě.');
  }

  return {
    extension,
    mimeType: extension === 'pdf' ? PDF_MIME : DOCX_MIME,
    fileName: file.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255),
    size: file.size,
  };
};
