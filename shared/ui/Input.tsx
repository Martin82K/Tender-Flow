import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = "", label, error, helperText, leftIcon, rightIcon, containerClassName = "", id, ...props }, ref) => {
        const inputId = id || React.useId();

        const baseInputStyles = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary focus:ring-primary/20";

        const errorStyles = error ? "border-red-500 focus-visible:ring-red-500/20 focus:border-red-500" : "";
        const leftIconPadding = leftIcon ? "pl-10" : "";
        const rightIconPadding = rightIcon ? "pr-10" : "";

        const inputClasses = `
            ${baseInputStyles}
            ${errorStyles}
            ${leftIconPadding}
            ${rightIconPadding}
            ${className}
        `.trim().replace(/\s+/g, " ");

        return (
            <div className={`w-full ${containerClassName}`}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block text-slate-700 dark:text-slate-200"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        ref={ref}
                        className={inputClasses}
                        aria-invalid={!!error}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {helperText && !error && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
                )}
                {error && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
