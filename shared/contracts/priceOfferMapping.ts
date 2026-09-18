export const validatePriceOfferPath = (value: string): string => {
  const segments = value.split('/');
  if (!value || value.length > 2000 || /[\\:\u0000-\u001f\u007f]/.test(value)
    || segments.some(part => !part || part === '.' || part === '..')
    || !/\.(pdf|docx|xlsx)$/i.test(value)) {
    throw new Error('Vyberte PDF, DOCX nebo XLSX ve složce projektu ve Složkomatu.');
  }
  return value;
};

export const mapPriceOfferPath = (root: string, absolutePath: string): string => {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedFile = absolutePath.replace(/\\/g, '/');
  const windowsPath = /^[A-Za-z]:\//.test(normalizedRoot) || normalizedRoot.startsWith('//');
  const comparableRoot = windowsPath ? normalizedRoot.toLowerCase() : normalizedRoot;
  const comparableFile = windowsPath ? normalizedFile.toLowerCase() : normalizedFile;
  if (!normalizedRoot || !comparableFile.startsWith(`${comparableRoot}/`)) {
    throw new Error('Vyberte soubor uvnitř složky tohoto projektu ve Složkomatu.');
  }
  return validatePriceOfferPath(normalizedFile.slice(normalizedRoot.length + 1));
};
