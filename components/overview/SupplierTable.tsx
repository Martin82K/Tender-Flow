import React from 'react';
import { Star, StarOff, Award, TrendingUp, Building2 } from 'lucide-react';

interface SupplierRow {
  id: string;
  name: string;
  rating?: number;
  ratingCount?: number;
  offerCount: number;
  sodCount: number;
  lastAwardedLabel?: string;
}

interface SupplierTableProps {
  suppliers: SupplierRow[];
  maxItems?: number;
  onSupplierClick?: (supplier: SupplierRow) => void;
  selectedSupplierId?: string;
}

const getRatingLabel = (rating?: number) => {
  if (!rating || rating <= 0) return 'Bez hodnocení';
  return rating.toFixed(1).replace('.', ',');
};

const getSuccessRateColor = (rate: number) => {
  if (rate >= 70) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
  if (rate >= 40) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
};

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  maxItems,
  onSupplierClick,
  selectedSupplierId,
}) => {
  if (suppliers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
        <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Žádní dodavatelé k zobrazení</p>
      </div>
    );
  }

  const displaySuppliers = maxItems ? suppliers.slice(0, maxItems) : suppliers;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Dodavatel
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Hodnocení
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nabídky
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                SOD
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Úspěšnost
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Poslední ocenění
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displaySuppliers.map((supplier, index) => {
              const successRate = supplier.offerCount > 0 
                ? (supplier.sodCount / supplier.offerCount) * 100 
                : 0;
              const isSelected = selectedSupplierId === supplier.id;
              const isTopThree = index < 3;

              return (
                <tr
                  key={supplier.id}
                  onClick={() => onSupplierClick?.(supplier)}
                  className={`
                    transition-colors duration-150
                    ${onSupplierClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                    ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                  `}
                >
                  {/* Supplier name with rank */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`
                        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                        ${isTopThree 
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }
                      `}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {supplier.name}
                        </p>
                      </div>
                      {isTopThree && (
                        <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="py-3 px-4">
                    {supplier.rating && supplier.rating > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }, (_, i) => {
                            const starValue = i + 1;
                            const isFilled = supplier.rating! >= starValue;
                            return (
                              <span
                                key={starValue}
                                className={`text-sm ${
                                  isFilled ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'
                                }`}
                              >
                                {isFilled ? '★' : '☆'}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {supplier.rating.toFixed(1).replace('.', ',')}
                        </span>
                        {supplier.ratingCount ? (
                          <span className="text-xs text-slate-400">
                            ({supplier.ratingCount}×)
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        {getRatingLabel(supplier.rating)}
                      </span>
                    )}
                  </td>

                  {/* Offer count */}
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {supplier.offerCount}
                    </span>
                  </td>

                  {/* SOD count */}
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {supplier.sodCount}
                    </span>
                  </td>

                  {/* Success rate */}
                  <td className="py-3 px-4 text-center">
                    <span className={`
                      inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${getSuccessRateColor(successRate)}
                    `}>
                      <TrendingUp className="w-3 h-3" />
                      {successRate.toFixed(0)}%
                    </span>
                  </td>

                  {/* Last awarded */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[200px] block">
                      {supplier.lastAwardedLabel || (
                        <span className="text-slate-400 dark:text-slate-500 italic">Bez ocenění</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierTable;
