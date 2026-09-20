import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  persistent?: boolean;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  persistent = false,
  showCloseButton = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const latest = useRef({onClose, persistent});
  latest.current = {onClose, persistent};
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])
      .filter(element => !element.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
    const isTop = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1) === panel;
    const handleKey = (event: KeyboardEvent) => {
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === 'Escape' && !latest.current.persistent) { event.preventDefault(); latest.current.onClose(); }
      if (event.key === 'Tab') {
        const targets = focusable();
        const first = targets[0]; const last = targets.at(-1);
        if (!first) { event.preventDefault(); panel?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.style.overflow = 'hidden';
    if (!panel?.contains(document.activeElement)) (focusable()[0] ?? panel)?.focus();
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-[340px]",
    md: "max-w-[400px]",
    lg: "max-w-[480px]",
    xl: "max-w-[560px]",
    "2xl": "max-w-[1400px]",
    full: "max-w-full m-4",
  };

  return createPortal(
    <div className="tf-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={overlayRef}
        className="absolute inset-0"
        onClick={() => !persistent && onClose()}
      />
      <div
        className={`tf-modal-panel relative z-50 w-full ${sizeClasses[size]} bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col text-sm max-h-[90vh] animate-in zoom-in-95 duration-200`}
        ref={panelRef}
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="tf-modal-header flex flex-col space-y-1 p-4 pr-12 border-b border-slate-100 dark:border-slate-800">
            {title && (
              <h3 id={titleId} className="font-semibold leading-snug tracking-tight text-base">
                {title}
              </h3>
            )}
            {description && (
              <p id={descriptionId} className="text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="tf-modal-body p-4 overflow-y-auto">{children}</div>

        {footer && (
          <div className="tf-modal-footer flex items-center px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
            {footer}
          </div>
        )}

        {showCloseButton ? (
          <button
            onClick={() => !persistent && onClose()}
            disabled={persistent}
            type="button"
            className="tf-modal-close tf-icon-close absolute right-3 top-3 inline-flex size-8 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 disabled:pointer-events-none"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            <span className="sr-only">Zavřít dialog</span>
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
