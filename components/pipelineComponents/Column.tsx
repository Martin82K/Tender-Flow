/**
 * Column Component
 * Drag-and-drop column for the Pipeline Kanban board.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useState } from "react";
import { BidStatus } from "../../types";

export interface ColumnProps {
    title: string;
    status: BidStatus;
    color: "slate" | "blue" | "amber" | "green" | "red";
    children: React.ReactNode;
    count?: number;
    onDrop: (e: React.DragEvent, status: BidStatus) => void;
}

const colorStyles = {
    slate: {
        wrapper:
            "border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-950/30",
        headerBorder: "border-slate-200 dark:border-slate-700/50",
        headerBg: "bg-slate-200/50 dark:bg-slate-800/50",
    },
    blue: {
        wrapper:
            "border-blue-200 dark:border-blue-600/30 bg-blue-50 dark:bg-blue-500/10",
        headerBorder: "border-blue-200 dark:border-blue-600/30",
        headerBg: "bg-blue-100/50 dark:bg-blue-900/30",
    },
    amber: {
        wrapper:
            "border-amber-200 dark:border-amber-600/30 bg-amber-50 dark:bg-amber-500/10",
        headerBorder: "border-amber-200 dark:border-amber-600/30",
        headerBg: "bg-amber-100/50 dark:bg-amber-900/30",
    },
    green: {
        wrapper:
            "border-emerald-200 dark:border-emerald-600/30 bg-emerald-50 dark:bg-emerald-500/10",
        headerBorder: "border-emerald-200 dark:border-emerald-600/30",
        headerBg: "bg-emerald-100/50 dark:bg-emerald-900/30",
    },
    red: {
        wrapper:
            "border-red-200 dark:border-red-600/30 bg-red-50 dark:bg-red-500/10",
        headerBorder: "border-red-200 dark:border-red-600/30",
        headerBg: "bg-red-100/50 dark:bg-red-900/30",
    },
};

export const Column: React.FC<ColumnProps> = ({
    title,
    status,
    color,
    children,
    count,
    onDrop,
}) => {
    const [isOver, setIsOver] = useState(false);
    const styles = colorStyles[color];

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        setIsOver(false);
        onDrop(e, status);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col w-80 flex-shrink-0 rounded-2xl h-full max-h-full border backdrop-blur-xl transition-colors ${styles.wrapper
                } ${isOver ? "ring-2 ring-emerald-500/50 ring-inset" : ""}`}
        >
            <div
                className={`p-4 border-b ${styles.headerBorder} ${styles.headerBg} sticky top-0 rounded-t-2xl z-10 backdrop-blur-sm flex justify-between items-center transition-colors`}
            >
                <h2 className="text-slate-700 dark:text-white text-sm font-bold uppercase tracking-wide">
                    {title}
                </h2>
                {count !== undefined && (
                    <span className="bg-white dark:bg-slate-700/50 text-xs font-bold px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50">
                        {count}
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar flex-1">
                {children}
            </div>
        </div>
    );
};
