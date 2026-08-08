import React from "react";

export type ContractOverviewCheckboxState = boolean | "mixed";

interface ContractOverviewProjectCheckboxProps {
  checked: ContractOverviewCheckboxState;
  label: string;
  onChange: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ContractOverviewProjectCheckbox: React.FC<ContractOverviewProjectCheckboxProps> = ({
  checked,
  label,
  onChange,
  children,
  className = "",
}) => {
  const selected = checked === true || checked === "mixed";
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/45 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          selected
            ? "border-primary bg-primary text-white shadow-sm"
            : "border-slate-300 bg-white group-hover:border-primary/60 dark:border-slate-600 dark:bg-slate-950"
        }`}
      >
        <span data-checkbox-mark className="material-symbols-outlined text-[13px] font-bold leading-none">
          {checked === "mixed" ? "remove" : checked ? "check" : ""}
        </span>
      </span>
      {children}
    </button>
  );
};
