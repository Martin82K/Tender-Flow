import React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className = "", variant = "default", ...props }, ref) => {
        const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

        const variants = {
            default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900",
            secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
            destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 bg-red-500 text-white",
            success: "border-transparent bg-green-500 text-white hover:bg-green-600",
            warning: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
            outline: "text-foreground",
        };

        const classes = `
            ${baseStyles}
            ${variants[variant]}
            ${className}
        `.trim().replace(/\s+/g, " ");

        return (
            <div
                ref={ref}
                className={classes}
                {...props}
            />
        );
    }
);

Badge.displayName = "Badge";
