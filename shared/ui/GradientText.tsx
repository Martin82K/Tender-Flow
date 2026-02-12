import React from "react";

interface GradientTextProps {
    children: React.ReactNode;
    className?: string;
    animate?: boolean;
}

export const GradientText: React.FC<GradientTextProps> = ({
    children,
    className = "",
    animate = true,
}) => {
    return (
        <span
            className={`
                bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500
                bg-clip-text text-transparent
                ${animate ? "animate-gradient-x bg-[length:200%_auto]" : ""}
                ${className}
            `}
        >
            {children}
        </span>
    );
};
