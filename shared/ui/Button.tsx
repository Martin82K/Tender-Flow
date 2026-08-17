import React from "react";
import { Button as AppicaButton } from "@appica/ui-react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "warning";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "primary", size = "md", isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
        const appicaVariant = {
            primary: "primary",
            secondary: "secondary",
            outline: "outline",
            ghost: "ghost",
            danger: "destructive",
            success: "primary",
            warning: "primary",
        }[variant] as "primary" | "secondary" | "outline" | "ghost" | "destructive";

        const appicaSize = {
            sm: "sm",
            md: "md",
            lg: "lg",
            icon: "icon-md",
        }[size] as "sm" | "md" | "lg" | "icon-md";

        return (
            <AppicaButton
                ref={ref}
                variant={appicaVariant}
                size={appicaSize}
                data-tf-variant={variant}
                className={`tf-button tf-button-${variant} ${className}`}
                disabled={isLoading || disabled}
                {...props}
            >
                {isLoading && (
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </AppicaButton>
        );
    }
);

Button.displayName = "Button";
