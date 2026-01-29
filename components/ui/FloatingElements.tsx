import React from "react";

interface FloatingElement {
    icon?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    position: { top?: string; left?: string; right?: string; bottom?: string };
    delay?: number;
    duration?: number;
    color?: "orange" | "blue" | "purple" | "emerald";
}

interface FloatingElementsProps {
    elements: FloatingElement[];
    className?: string;
}

const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
};

const colorClasses = {
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
};

export const FloatingElements: React.FC<FloatingElementsProps> = ({
    elements,
    className = "",
}) => {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            {elements.map((el, index) => (
                <div
                    key={index}
                    className={`
                        absolute rounded-xl border backdrop-blur-sm
                        ${sizeClasses[el.size || "md"]}
                        ${colorClasses[el.color || "orange"]}
                        floating-element
                    `}
                    style={{
                        ...el.position,
                        animationDelay: `${el.delay || 0}s`,
                        animationDuration: `${el.duration || 6}s`,
                    }}
                >
                    {el.icon && (
                        <div className="w-full h-full flex items-center justify-center">
                            {el.icon}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// Predefined floating elements for hero section
export const HeroFloatingElements: React.FC = () => {
    return (
        <FloatingElements
            elements={[
                {
                    size: "lg",
                    position: { top: "10%", right: "5%" },
                    delay: 0,
                    duration: 8,
                    color: "orange",
                },
                {
                    size: "md",
                    position: { top: "30%", right: "15%" },
                    delay: 1,
                    duration: 7,
                    color: "blue",
                },
                {
                    size: "sm",
                    position: { bottom: "20%", right: "8%" },
                    delay: 2,
                    duration: 9,
                    color: "purple",
                },
                {
                    size: "md",
                    position: { bottom: "35%", left: "5%" },
                    delay: 0.5,
                    duration: 6,
                    color: "emerald",
                },
                {
                    size: "sm",
                    position: { top: "20%", left: "10%" },
                    delay: 1.5,
                    duration: 8,
                    color: "orange",
                },
            ]}
        />
    );
};
