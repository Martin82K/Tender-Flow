/**
 * OrgBrandingTab
 *
 * Organization branding — logo upload, email logo, email signature with
 * font settings and full live preview.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { organizationService } from '@/services/organizationService';
import { useUI } from '@/context/UIContext';
import {
  buildEmailSignature,
  SIGNATURE_FONT_OPTIONS,
  SIGNATURE_FONT_SIZE_OPTIONS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
} from '@/shared/email/signature';

interface OrgBrandingTabProps {
  orgId: string;
  isAdminOrOwner: boolean;
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const validateLogoFile = (file: File): void => {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Nepodporovaný formát. Povolené: PNG, JPG, WEBP, SVG.');
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('Soubor je příliš velký. Maximální velikost je 2 MB.');
  }
};

export const OrgBrandingTab: React.FC<OrgBrandingTabProps> = ({ orgId, isAdminOrOwner }) => {
  const { showAlert } = useUI();

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [emailLogoUrl, setEmailLogoUrl] = useState<string | null>(null);
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingEmailLogo, setIsUploadingEmailLogo] = useState(false);

  // Email branding state
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyMeta, setCompanyMeta] = useState('');
  const [disclaimerHtml, setDisclaimerHtml] = useState('');
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoadingLogo(true);
      try {
        const [logo, branding] = await Promise.all([
          organizationService.getOrganizationLogoUrl(orgId).catch(() => null),
          organizationService.getOrganizationEmailBranding(orgId).catch(() => null),
        ]);
        setLogoUrl(logo);
        if (branding) {
          setCompanyName(branding.companyName || '');
          setCompanyAddress(branding.companyAddress || '');
          setCompanyMeta(branding.companyMeta || '');
          setDisclaimerHtml(branding.disclaimerHtml || '');
          setFontFamily(branding.fontFamily || DEFAULT_FONT_FAMILY);
          setFontSize(branding.fontSize || DEFAULT_FONT_SIZE);
          const eLogoUrl = branding.emailLogoPath
            ? await organizationService.getOrganizationLogoUrl(orgId).catch(() => null)
            : null;
          setEmailLogoUrl(eLogoUrl);
        }
      } catch (err) {
        console.error('[OrgBrandingTab] Failed to load:', err);
      } finally {
        setIsLoadingLogo(false);
      }
    };
    load();
  }, [orgId]);

  // Live preview of the full signature
  const signaturePreview = useMemo(
    () =>
      buildEmailSignature({
        profile: {
          displayName: 'Jan Novák',
          signatureName: 'Jan Novák',
          signatureRole: 'obchodní manažer',
          signaturePhone: '+420 123 456 789',
          signaturePhoneSecondary: '+420 777 000 111',
          signatureEmail: 'novak@firma.cz',
          signatureGreeting: 'S pozdravem',
        },
        branding: {
          emailLogoPath: null,
          emailLogoUrl: emailLogoUrl,
          companyName: companyName || null,
          companyAddress: companyAddress || null,
          companyMeta: companyMeta || null,
          disclaimerHtml: disclaimerHtml || null,
          fontFamily: fontFamily || null,
          fontSize: fontSize || null,
        },
      }),
    [companyName, companyAddress, companyMeta, disclaimerHtml, fontFamily, fontSize, emailLogoUrl],
  );

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateLogoFile(file);
      setIsUploadingLogo(true);
      await organizationService.uploadOrganizationLogo(orgId, file);
      const url = await organizationService.getOrganizationLogoUrl(orgId);
      setLogoUrl(url);
      showAlert({ title: 'Hotovo', message: 'Logo bylo nahráno.', variant: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se nahrát logo.', variant: 'danger' });
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    try {
      await organizationService.removeOrganizationLogo(orgId);
      setLogoUrl(null);
      showAlert({ title: 'Info', message: 'Logo bylo odstraněno.' });
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se odstranit logo.', variant: 'danger' });
    }
  };

  const handleEmailLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateLogoFile(file);
      setIsUploadingEmailLogo(true);
      await organizationService.uploadOrganizationEmailLogo(orgId, file);
      showAlert({ title: 'Hotovo', message: 'E-mailové logo bylo nahráno.', variant: 'success' });
      const branding = await organizationService.getOrganizationEmailBranding(orgId);
      setEmailLogoUrl(branding?.emailLogoPath ? 'loaded' : null);
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se nahrát e-mailové logo.', variant: 'danger' });
    } finally {
      setIsUploadingEmailLogo(false);
      e.target.value = '';
    }
  };

  const handleEmailLogoRemove = async () => {
    try {
      await organizationService.removeOrganizationEmailLogo(orgId);
      setEmailLogoUrl(null);
      showAlert({ title: 'Info', message: 'E-mailové logo bylo odstraněno.' });
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se odstranit e-mailové logo.', variant: 'danger' });
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      await organizationService.saveOrganizationEmailBranding(orgId, {
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyMeta: companyMeta.trim(),
        disclaimerHtml: disclaimerHtml.trim(),
        fontFamily: fontFamily.trim() || null,
        fontSize: fontSize.trim() || null,
      });
      showAlert({ title: 'Hotovo', message: 'Branding byl uložen.', variant: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Chyba', message: err?.message || 'Nepodařilo se uložit branding.', variant: 'danger' });
    } finally {
      setIsSavingBranding(false);
    }
  };

  if (isLoadingLogo) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
        Branding organizace
      </h3>

      {!isAdminOrOwner && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          <span className="material-symbols-outlined text-[18px]">lock</span>
          Branding může upravovat pouze owner nebo admin organizace.
        </div>
      )}

      {/* Organization Logo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
            Logo organizace
          </h4>
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-32 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain" />
              ) : (
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">photo_camera</span>
                  <p className="text-xs text-slate-400 mt-1">Přetáhni logo nebo klikni pro nahrání</p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, SVG, WEBP · max 2 MB</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <label className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isAdminOrOwner
                  ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
              }`}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={!isAdminOrOwner || isUploadingLogo}
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {isUploadingLogo ? 'Nahrávám...' : 'Nahrát logo'}
              </label>
              {logoUrl && (
                <button
                  onClick={handleLogoRemove}
                  disabled={!isAdminOrOwner}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Smazat
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Email Logo */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
            Logo pro emaily
          </h4>
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-32 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              {emailLogoUrl ? (
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-emerald-500">check_circle</span>
                  <p className="text-xs text-slate-500 mt-1">E-mailové logo nahráno</p>
                </div>
              ) : (
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">mail</span>
                  <p className="text-xs text-slate-400 mt-1">Logo zobrazené v emailových notifikacích</p>
                  <p className="text-[10px] text-slate-400">Doporučený poměr 3:1</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <label className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isAdminOrOwner
                  ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
              }`}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={!isAdminOrOwner || isUploadingEmailLogo}
                  onChange={handleEmailLogoUpload}
                  className="hidden"
                />
                {isUploadingEmailLogo ? 'Nahrávám...' : 'Nahrát'}
              </label>
              {emailLogoUrl && (
                <button
                  onClick={handleEmailLogoRemove}
                  disabled={!isAdminOrOwner}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Smazat
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Signature */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
          Emailová signatura
        </h4>

        {/* Font settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Písmo
            </label>
            <select
              value={fontFamily}
              onChange={e => setFontFamily(e.target.value)}
              disabled={!isAdminOrOwner}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            >
              {SIGNATURE_FONT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Velikost písma
            </label>
            <select
              value={fontSize}
              onChange={e => setFontSize(e.target.value)}
              disabled={!isAdminOrOwner}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            >
              {SIGNATURE_FONT_SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Company fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Název společnosti
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              disabled={!isAdminOrOwner}
              placeholder="Tender Flow s.r.o."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Adresa
            </label>
            <input
              type="text"
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              disabled={!isAdminOrOwner}
              placeholder="Hlavní 123, Praha 1"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Doplňující údaje
          </label>
          <input
            type="text"
            value={companyMeta}
            onChange={e => setCompanyMeta(e.target.value)}
            disabled={!isAdminOrOwner}
            placeholder="IČ, DIČ, kontaktní telefon..."
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Disclaimer (HTML)
          </label>
          <textarea
            value={disclaimerHtml}
            onChange={e => setDisclaimerHtml(e.target.value)}
            disabled={!isAdminOrOwner}
            placeholder="Tato zpráva je určena pouze adresátovi..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 resize-vertical"
          />
        </div>
        {isAdminOrOwner && (
          <div className="flex justify-end">
            <button
              onClick={handleSaveBranding}
              disabled={isSavingBranding}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSavingBranding ? 'Ukládám...' : 'Uložit branding'}
            </button>
          </div>
        )}
      </div>

      {/* Full signature preview */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Náhled podpisu
          </h4>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Ukázkový podpis s vašimi firemními údaji
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-6">
          {signaturePreview.hasContent ? (
            <div
              className="text-slate-900 dark:text-white [&_a]:text-slate-900 [&_a]:underline dark:[&_*]:!text-inherit dark:[&_a]:!text-sky-400"
              dangerouslySetInnerHTML={{ __html: signaturePreview.html }}
            />
          ) : (
            <div className="text-sm text-slate-500 text-center py-4">
              Vyplňte údaje výše pro zobrazení náhledu podpisu.
            </div>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          Osobní údaje (jméno, pozice, telefon) si každý uživatel nastavuje ve svém profilu v sekci Prostředí uživatele.
        </p>
      </div>
    </section>
  );
};
