import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapPriceOfferPath, validatePriceOfferPath } from '@shared/contracts/priceOfferMapping';
import type { Contract, ProjectDetails } from '@/types';

const mocks = vi.hoisted(() => ({ desktop: true, root: vi.fn(), selectFile: vi.fn(), openFile: vi.fn(), openExternal: vi.fn(), updateContract: vi.fn() }));
vi.mock('@infra/platform/platformAdapter', () => ({
  get isDesktop() { return mocks.desktop; },
  fileSystemAdapter: { selectFile: mocks.selectFile, openFile: mocks.openFile },
  shellAdapter: { openExternal: mocks.openExternal },
}));
vi.mock('@features/projects/dochub/model/personalRoot', () => ({ resolveEffectiveProjectDocHubRoot: mocks.root }));
vi.mock('@features/projects/contracts/api/contractMutationsApi', () => ({ contractMutationsApi: { updateContract: mocks.updateContract } }));
import { selectPriceOffer, openPriceOfferFile } from '@features/projects/contracts/api/priceOfferFiles';

describe('price offer file mapping', () => {
  const project = { id: 'p', docHubProvider: 'onedrive' } as ProjectDetails;
  const contract = { id: 'c', projectId: 'p' } as Contract;
  beforeEach(() => {
    vi.resetAllMocks(); mocks.desktop = true;
    mocks.root.mockResolvedValue('/Users/me/OneDrive/Project');
    mocks.selectFile.mockResolvedValue({ absolutePath: '/Users/me/OneDrive/Project/Supplier/offer.pdf' });
    mocks.openFile.mockResolvedValue({ success: true });
  });
  it('automatically maps the selected file without storing a personal absolute path', async () => {
    expect(await selectPriceOffer(contract, project, 'user')).toBe(true);
    expect(mocks.selectFile).toHaveBeenCalledWith({ title: 'Vybrat cenovou nabídku', defaultPath: '/Users/me/OneDrive/Project' });
    expect(mocks.updateContract).toHaveBeenCalledWith('c', { priceOfferPath: 'Supplier/offer.pdf' });
  });
  it('leaves the mapping unchanged after cancellation', async () => {
    mocks.selectFile.mockResolvedValue(null);
    expect(await selectPriceOffer(contract, project, 'user')).toBe(false);
    expect(mocks.updateContract).not.toHaveBeenCalled();
  });
  it('rejects a file outside the project', async () => {
    mocks.selectFile.mockResolvedValue({ absolutePath: '/Users/me/OneDrive/Project-other/offer.pdf' });
    await expect(selectPriceOffer(contract, project, 'user')).rejects.toThrow('uvnitř');
    expect(mocks.updateContract).not.toHaveBeenCalled();
  });
  it('opens using the current user’s mapped root', async () => {
    mocks.root.mockResolvedValue('/Users/colleague/Shared/Project');
    await openPriceOfferFile(project, 'colleague', 'Supplier/offer.pdf');
    expect(mocks.openFile).toHaveBeenCalledWith('/Users/colleague/Shared/Project/Supplier/offer.pdf');
  });
  it('reports an unavailable file', async () => {
    mocks.openFile.mockResolvedValue({ success: false });
    await expect(openPriceOfferFile(project, 'user', 'offer.pdf')).rejects.toThrow('synchronizaci');
  });
  it('automatically constructs an online SharePoint reference on mobile', async () => {
    mocks.desktop = false;
    await openPriceOfferFile({ ...project, docHubRootWebUrl: 'https://company.sharepoint.com/sites/build/Docs/Project' }, 'user', 'Supplier/offer.pdf');
    expect(mocks.openExternal).toHaveBeenCalledWith('https://company.sharepoint.com/sites/build/Docs/Project/Supplier/offer.pdf');
    expect(mocks.openFile).not.toHaveBeenCalled();
  });
  it('explains unsupported mobile mapping instead of pretending to save a file name', async () => {
    mocks.desktop = false;
    await expect(selectPriceOffer(contract, project, 'user')).rejects.toThrow('desktopové');
    await expect(openPriceOfferFile(project, 'user', 'offer.pdf')).rejects.toThrow('online odkaz');
    expect(mocks.updateContract).not.toHaveBeenCalled();
  });
  it('maps Windows paths independently of drive-letter case', () => {
    expect(mapPriceOfferPath('C:\\OneDrive\\Project', 'c:\\OneDrive\\Project\\Supplier\\Nabídka.xlsx')).toBe('Supplier/Nabídka.xlsx');
  });
  it.each(['../offer.pdf', '/offer.pdf', 'a/../offer.pdf', 'a//offer.pdf', 'a\\offer.pdf', 'file:offer.pdf', 'offer.exe', 'a\n.pdf'])('rejects unsafe path %s', path => {
    expect(() => validatePriceOfferPath(path)).toThrow();
  });
});
