import React from 'react';
import type { ContractWithDetails } from '@/types';
import { formatDate } from '../../utils/format';

export const OcrDocumentSection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const hasDocument = Boolean(contract.documentUrl);
  const confidence = contract.extractionConfidence ?? null;

  return (
    <section id="sec-ocr" className="py-4 border-b border-dashed border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
        OCR dokument
      </h3>

      {!hasDocument ? (
        <div className="text-xs text-slate-500">
          K této smlouvě zatím není nahrán OCR dokument.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11.5px] font-mono text-slate-300 leading-relaxed">
            <strong>{contract.vendorName}</strong>
            <br />
            {contract.vendorIco ? `IČ: ${contract.vendorIco}` : null}
            <br />
            <br />
            <strong>{contract.title}</strong>
            {contract.contractNumber ? ` — č. ${contract.contractNumber}` : ''}
            <br />
            <br />
            Pozastávka krátkodobá: <strong>{contract.retentionShortPercent ?? 0} %</strong>
            <br />
            Pozastávka dlouhodobá: <strong>{contract.retentionLongPercent ?? 0} %</strong>
            <br />
            {contract.warrantyMonths ? `Záruční doba: ${contract.warrantyMonths} měsíců` : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs flex justify-between items-center">
              <span>
                <strong>v1</strong> · {formatDate(contract.signedAt)}
              </span>
              <span className="rounded-full bg-purple-500/15 text-purple-400 px-2 py-0.5 text-[10px] font-semibold">
                OCR
              </span>
            </div>
            <a
              href={contract.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs text-center hover:bg-slate-800"
            >
              ↓ Otevřít dokument
            </a>
            {confidence !== null && (
              <div className="text-[11px] text-slate-500">
                Parser confidence: {(confidence * 100).toFixed(0)} %
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
