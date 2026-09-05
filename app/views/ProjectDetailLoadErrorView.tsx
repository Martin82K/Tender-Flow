import { Button } from "@shared/ui/Button";

interface ProjectDetailLoadErrorViewProps {
  unavailable: boolean;
  isFetching: boolean;
  onRetry?: () => void;
  onBack: () => void;
}

export const ProjectDetailLoadErrorView = ({
  unavailable,
  isFetching,
  onRetry,
  onBack,
}: ProjectDetailLoadErrorViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <div role="alert" className="max-w-md space-y-2">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        {unavailable ? "Projekt není dostupný" : "Detail projektu se nepodařilo načíst"}
      </h1>
      <p className="text-slate-600 dark:text-slate-300">
        {unavailable
          ? "Projekt mohl být odstraněn nebo k němu nemáte přístup."
          : "Zkontrolujte připojení a zkuste načíst detail znovu."}
      </p>
    </div>
    <div className="flex flex-wrap justify-center gap-3">
      {onRetry && (
        <Button type="button" onClick={onRetry} isLoading={isFetching}>
          {isFetching ? "Načítání…" : "Zkusit znovu"}
        </Button>
      )}
      <Button type="button" variant="secondary" onClick={onBack}>
        Zpět na projekty
      </Button>
    </div>
  </div>
);
