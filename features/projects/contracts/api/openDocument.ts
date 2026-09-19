import { isDesktop, shellAdapter } from '@infra/platform/platformAdapter';

/** Reserve the browser tab during the tap, before fetching the signed URL. */
export const openDocument = async (getUrl: () => Promise<string>): Promise<void> => {
  if (isDesktop) {
    await shellAdapter.openExternal(await getUrl());
    return;
  }
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new Error('Prohlížeč zablokoval otevření dokumentu. Povolte otevírání nových oken a zkuste to znovu.');
  tab.opener = null;
  try {
    const url = new URL(await getUrl());
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Neplatný odkaz na dokument.');
    tab.location.replace(url.href);
  } catch (error) {
    tab.close();
    throw error;
  }
};
