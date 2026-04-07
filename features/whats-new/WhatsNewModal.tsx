import React from "react";
import { Modal } from "@/shared/ui/Modal";
import { APP_VERSION } from "@/config/version";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: "build_circle",
    title: "Opravy a stabilizace",
    description:
      "Patch verze s opravami uvítací obrazovky, release podkladů a čištěním projektu.",
  },
];

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Co je nového ve verzi ${APP_VERSION}`}
      size="lg"
      footer={
        <div className="flex w-full justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Rozumím
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                {f.icon}
              </span>
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {f.title}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
