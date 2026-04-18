import type { Contract, ContractWithDetails } from '@/types';

export interface RetentionBreakdown {
  shortPercent: number;
  shortAmount: number;
  longPercent: number;
  longAmount: number;
  totalPercent: number;
  totalAmount: number;
}

/**
 * Spočítá krátk./dlouh. pozastávku. Pokud explicitní `retentionShortAmount`
 * není, dopočítá z procenta a `currentTotal` (resp. `basePrice`).
 */
export const computeRetention = (
  contract: Pick<
    Contract,
    | 'basePrice'
    | 'retentionShortPercent'
    | 'retentionShortAmount'
    | 'retentionLongPercent'
    | 'retentionLongAmount'
  > & { currentTotal?: number },
): RetentionBreakdown => {
  const base = contract.currentTotal ?? contract.basePrice ?? 0;

  const shortPercent = contract.retentionShortPercent ?? 0;
  const shortAmount =
    contract.retentionShortAmount ?? Math.round(base * (shortPercent / 100));

  const longPercent = contract.retentionLongPercent ?? 0;
  const longAmount =
    contract.retentionLongAmount ?? Math.round(base * (longPercent / 100));

  return {
    shortPercent,
    shortAmount,
    longPercent,
    longAmount,
    totalPercent: shortPercent + longPercent,
    totalAmount: shortAmount + longAmount,
  };
};

export const sumProjectRetention = (contracts: ContractWithDetails[]) => {
  let shortTotal = 0;
  let longTotal = 0;
  for (const contract of contracts) {
    if (contract.retentionShortStatus === 'released') continue;
    const breakdown = computeRetention(contract);
    shortTotal += breakdown.shortAmount;
  }
  for (const contract of contracts) {
    if (contract.retentionLongStatus === 'released') continue;
    const breakdown = computeRetention(contract);
    longTotal += breakdown.longAmount;
  }
  return { shortTotal, longTotal };
};
