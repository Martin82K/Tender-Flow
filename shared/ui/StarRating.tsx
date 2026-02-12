import React, { useState } from "react";

interface StarRatingProps {
  value?: number | null;
  max?: number;
  readOnly?: boolean;
  allowClear?: boolean;
  size?: "sm" | "md";
  className?: string;
  onChange?: (value: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value = 0,
  max = 5,
  readOnly = false,
  allowClear = true,
  size = "md",
  className,
  onChange,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;
  const iconSize = size === "sm" ? "text-[16px]" : "text-[20px]";

  return (
    <div className={`inline-flex items-center gap-0.5 ${className || ""}`}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const isFilled = displayValue >= starValue;

        if (readOnly) {
          return (
            <span
              key={starValue}
              className={`material-symbols-outlined ${iconSize} ${
                isFilled ? "text-amber-400" : "text-slate-300 dark:text-slate-600"
              }`}
            >
              star
            </span>
          );
        }

        return (
          <button
            key={starValue}
            type="button"
            onMouseEnter={() => setHoverValue(starValue)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => {
              if (!onChange) return;
              if (allowClear && value === starValue) {
                onChange(0);
                return;
              }
              onChange(starValue);
            }}
            className="transition-transform hover:scale-110"
            aria-label={`Hodnocení ${starValue} z ${max}`}
          >
            <span
              className={`material-symbols-outlined ${iconSize} ${
                isFilled ? "text-amber-400" : "text-slate-300 dark:text-slate-600"
              }`}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
};
