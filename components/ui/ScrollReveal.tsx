import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
    children: React.ReactNode;
    direction?: "up" | "down" | "left" | "right" | "scale";
    delay?: number;
    duration?: number;
    threshold?: number;
    className?: string;
    once?: boolean;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
    children,
    direction = "up",
    delay = 0,
    threshold = 0.1,
    className = "",
    once = true,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once && ref.current) {
                        observer.unobserve(ref.current);
                    }
                } else if (!once) {
                    setIsVisible(false);
                }
            },
            {
                threshold,
            }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [threshold, once]);

    const directionClass = `reveal-${direction}`;

    return (
        <div
            ref={ref}
            className={`reveal ${directionClass} ${isVisible ? "reveal-active" : ""
                } ${className}`}
            style={{
                transitionDelay: `${delay}ms`,
            }}
        >
            {children}
        </div>
    );
};
