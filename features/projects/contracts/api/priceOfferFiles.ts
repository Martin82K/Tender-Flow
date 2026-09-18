import { fileSystemAdapter, isDesktop, shellAdapter } from '@infra/platform/platformAdapter';
import { buildSharePointFolderUrl, joinDocHubPath } from '@shared/dochub/personalLocation';
import { mapPriceOfferPath, validatePriceOfferPath } from '@shared/contracts/priceOfferMapping';
import { resolveEffectiveProjectDocHubRoot } from '@features/projects/dochub/model/personalRoot';
import { contractMutationsApi } from './contractMutationsApi';
import type { Contract, ProjectDetails } from '@/types';

export const selectPriceOffer = async (
  contract: Contract,
  project: ProjectDetails,
  userId: string | null,
): Promise<boolean> => {
  if (contract.projectId !== project.id) throw new Error('Smlouva nepatří k tomuto projektu.');
  if (!isDesktop) throw new Error('Soubor vyberte v desktopové aplikaci Tender Flow, která má přístup ke složce Složkomatu.');
  if (!['onedrive', 'local'].includes(project.docHubProvider || '')) throw new Error('Nejprve připojte místní složku projektu ve Složkomatu.');
  const root = await resolveEffectiveProjectDocHubRoot(project, userId);
  if (!root) throw new Error('Nejprve připojte svou místní složku projektu ve Složkomatu.');
  const file = await fileSystemAdapter.selectFile({ title: 'Vybrat cenovou nabídku', defaultPath: root, withinRoot: root });
  if (!file) return false;
  const relativePath = mapPriceOfferPath(root, file.absolutePath);
  await contractMutationsApi.updateContract(contract.id, { priceOfferPath: relativePath });
  return true;
};

export const openPriceOfferFile = async (
  project: ProjectDetails,
  userId: string | null,
  path: string | undefined,
): Promise<void> => {
  const relativePath = validatePriceOfferPath(path || '');
  if (isDesktop) {
    const root = await resolveEffectiveProjectDocHubRoot(project, userId);
    if (root && ['onedrive', 'local'].includes(project.docHubProvider || '')) {
      const result = await fileSystemAdapter.openFile(joinDocHubPath(root, relativePath));
      if (!result.success) throw new Error('Soubor se nepodařilo otevřít. Zkontrolujte jeho umístění a synchronizaci Složkomatu.');
      return;
    }
  }
  const url = buildSharePointFolderUrl(project.docHubRootWebUrl, relativePath);
  if (!url) throw new Error('Pro tento soubor není dostupný online odkaz. Otevřete jej v desktopové aplikaci s připojenou složkou Složkomatu.');
  await shellAdapter.openExternal(url);
};
