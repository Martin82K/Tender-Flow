import React from "react";

interface GlowCardProps {
    children: React.ReactNode;
    className?: string;
    glowColor?: "orange" | "blue" | "purple" | "emerald";
    intensity?: "low" | "medium" | "high";
    hover?: boolean;
}

const glowColors = {
    orange: "rgba(255, 138, 51, ",
    blue: "rgba(96, 122, 251, ",
    purple: "rgba(168, 85, 247, ",
    emerald: "rgba(16, 185, 129, ",
};

const intensities = {
    low: "0.15",
    medium: "0.25",
    high: "0.4",
};

export const GlowCard: React.FC<GlowCardProps> = ({
    children,
    className = "",
    glowColor = "orange",
    intensity = "medium",
    hover = true,
}) => {
    const color = glowColors[glowColor];
    const alpha = intensities[intensity];

    return (
        <div
            className={`
                relative rounded-3xl border border-white/10 backdrop-blur
                transition-all duration-500
                ${hover ? "hover-glow" : ""}
                ${className}
            `}
            style={{
                background: `
                    radial-gradient(circle at 50% 0%, ${color}${alpha}) 0%, transparent 50%),
                    rgba(3, 7, 18, 0.4)
                `,
            }}
        >
            {children}
        </div>
    );
};
