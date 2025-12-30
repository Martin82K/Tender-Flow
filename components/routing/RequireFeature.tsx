import React from 'react';
import { useFeatures } from '../../context/FeatureContext';
import { FeatureKey } from '../../config/features';

interface RequireFeatureProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequireFeature: React.FC<RequireFeatureProps> = ({ feature, children, fallback }) => {
  const { hasFeature, isLoading } = useFeatures();

  if (isLoading) {
    return <div className="p-4 text-center text-slate-500">Ověřuji dostupnost funkce...</div>;
  }

  if (!hasFeature(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Default fallback: Redirect or show message
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4">lock</span>
        <h2 className="text-xl font-bold text-white mb-2">Funkce není dostupná</h2>
        <p className="text-slate-400 max-w-md">
          Tato funkce ({feature}) není ve vašem aktuálním plánu dostupná.
          Pro přístup prosím upgradujte svůj plán.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
