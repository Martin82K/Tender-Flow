import React, { useState } from "react";
import type { Signal } from "@features/dashboard/model/signal";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/Card";
import { AlertCard } from "@features/dashboard/ui/AlertCard";
import { EmptyCommandCenter } from "@features/dashboard/ui/EmptyCommandCenter";

interface AlertsPanelProps {
  signals: Signal[];
  onSignalClick: (signal: Signal) => void;
}

const MAX_VISIBLE = 5;

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  signals,
  onSignalClick,
}) => {
  const [expanded, setExpanded] = useState(false);

  const hasMore = signals.length > MAX_VISIBLE;
  const visible = expanded || !hasMore ? signals : signals.slice(0, MAX_VISIBLE);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Signály, které potřebují pozornost</CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <EmptyCommandCenter />
        ) : (
          <>
            <ul className="space-y-3">
              {visible.map((signal) => (
                <li key={signal.id}>
                  <AlertCard
                    signal={signal}
                    onClick={() => onSignalClick(signal)}
                  />
                </li>
              ))}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-3 w-full text-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                {expanded ? "Sbalit" : `Zobrazit všechny (${signals.length})`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
