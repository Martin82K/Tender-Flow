import React from "react";

interface PulseBadgeProps {
    children: React.ReactNode;
    className?: string;
    color?: "orange" | "emerald" | "blue" | "purple";
    pulse?: boolean;
}

const colorClasses = {
    orange: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

export const PulseBadge: React.FC<PulseBadgeProps> = ({
    children,
    className = "",
    color = "orange",
    pulse = true,
}) => {
    return (
        <span
            className={`
                inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border
                ${colorClasses[color]}
                ${pulse ? "pulse-glow" : ""}
                ${className}
            `}
        >
            {pulse && (
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                </span>
            )}
            {children}
        </span>
    );
};
