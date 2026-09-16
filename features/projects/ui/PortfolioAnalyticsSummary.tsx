import React from 'react';
import { formatMoney } from '@/shared/overview/overviewAnalytics';

interface PortfolioAnalyticsSummaryProps {
  awardedValue: number;
  demandCount: number;
  supplierCount: number;
  offerCount: number;
}

export function PortfolioAnalyticsSummary({ awardedValue, demandCount, supplierCount, offerCount }: PortfolioAnalyticsSummaryProps) {
  return <section className="tf-analytics-summary" aria-label="Souhrn portfolia">
    <dl data-help-id="overview-kpi" className="tf-analytics-metrics">
      {[
        ['Objem zakázek', formatMoney(awardedValue), 'Celkový objem oceněných zakázek'],
        ['Celkem poptávek', demandCount, 'Počet poptávek v systému'],
        ['Poptaní dodavatelé', supplierCount, 'Celkem oslovených dodavatelů'],
        ['Celkem nabídek', offerCount, 'Všechny přijaté nabídky'],
      ].map(([label, value, detail]) => <div key={label}>
        <dt>{label}</dt><dd className="tf-analytics-value">{value}</dd><dd className="tf-analytics-detail">{detail}</dd>
      </div>)}
    </dl>
  </section>;
}
