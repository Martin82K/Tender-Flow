import React from "react";

interface TimelineItem {
    step: number;
    title: string;
    description: string;
    icon?: React.ReactNode;
}

interface TimelineProps {
    items: TimelineItem[];
    className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = "" }) => {
    return (
        <div className={`relative ${className}`}>
            {/* Vertical line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-orange-500/50 via-orange-500/30 to-transparent" />

            <div className="space-y-8">
                {items.map((item, index) => (
                    <div
                        key={index}
                        className="relative flex gap-6 group"
                        style={{ animationDelay: `${index * 150}ms` }}
                    >
                        {/* Step number / icon */}
                        <div className="relative z-10 flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-gray-950 border border-orange-500/30 flex items-center justify-center text-orange-400 font-semibold text-lg group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-orange-500/30">
                                {item.icon || item.step}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-2">
                            <div className="rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur p-5 group-hover:border-orange-500/30 group-hover:bg-gray-950/60 transition-all duration-500">
                                <h3 className="text-white font-semibold text-lg group-hover:text-orange-200 transition-colors duration-300">
                                    {item.title}
                                </h3>
                                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Horizontal timeline variant
export const HorizontalTimeline: React.FC<TimelineProps> = ({ items, className = "" }) => {
    return (
        <div className={`relative ${className}`}>
            {/* Horizontal line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {items.map((item, index) => (
                    <div
                        key={index}
                        className="relative group"
                        style={{ animationDelay: `${index * 150}ms` }}
                    >
                        {/* Step number */}
                        <div className="relative z-10 mx-auto w-12 h-12 rounded-full bg-gray-950 border-2 border-orange-500/30 flex items-center justify-center text-orange-400 font-semibold text-lg group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 group-hover:scale-110 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-orange-500/30">
                            {item.step}
                        </div>

                        {/* Content */}
                        <div className="mt-6 text-center">
                            <div className="rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur p-5 group-hover:border-orange-500/30 group-hover:bg-gray-950/60 group-hover:-translate-y-1 transition-all duration-500">
                                <h3 className="text-white font-semibold group-hover:text-orange-200 transition-colors duration-300">
                                    {item.title}
                                </h3>
                                <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Bento grid style features
interface BentoFeature {
    icon: React.ReactNode;
    title: string;
    description: string;
    size?: "small" | "medium" | "large";
    color?: "orange" | "blue" | "purple" | "emerald";
}

interface BentoGridProps {
    features: BentoFeature[];
    className?: string;
}

const colorClasses = {
    orange: "group-hover:border-orange-500/40 group-hover:shadow-orange-500/10",
    blue: "group-hover:border-blue-500/40 group-hover:shadow-blue-500/10",
    purple: "group-hover:border-purple-500/40 group-hover:shadow-purple-500/10",
    emerald: "group-hover:border-emerald-500/40 group-hover:shadow-emerald-500/10",
};

const iconBgClasses = {
    orange: "bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20",
    blue: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20",
};

export const BentoGrid: React.FC<BentoGridProps> = ({ features, className = "" }) => {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
            {features.map((feature, index) => {
                const sizeClass = feature.size === "large"
                    ? "md:col-span-2 md:row-span-2"
                    : feature.size === "medium"
                        ? "md:col-span-2"
                        : "";

                const colorClass = colorClasses[feature.color || "orange"];
                const iconBgClass = iconBgClasses[feature.color || "orange"];

                return (
                    <div
                        key={index}
                        className={`group relative rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${colorClass} ${sizeClass}`}
                    >
                        {/* Glow effect */}
                        <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-${feature.color || "orange"}-500/5 to-transparent`} />

                        <div className="relative">
                            <div className={`w-10 h-10 rounded-xl ${iconBgClass} flex items-center justify-center transition-all duration-500 group-hover:scale-110`}>
                                {feature.icon}
                            </div>
                            <h3 className="mt-4 text-white font-semibold group-hover:text-orange-200 transition-colors duration-300">
                                {feature.title}
                            </h3>
                            <p className="mt-2 text-white/60 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                                {feature.description}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
