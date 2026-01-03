/**
 * BidCard Component
 * Represents a single bid/subcontractor in the pipeline.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React from "react";
import { Bid } from "../../types";

export interface BidCardProps {
    bid: Bid;
    onClick?: () => void;
    onDragStart: (e: React.DragEvent, bidId: string) => void;
    onEdit: (bid: Bid) => void;
    onDelete?: (bidId: string) => void;
    onGenerateInquiry?: (bid: Bid) => void;
    onOpenDocHubFolder?: (bid: Bid) => void;
}

export const BidCard: React.FC<BidCardProps> = ({
    bid,
    onClick,
    onDragStart,
    onEdit,
    onDelete,
    onGenerateInquiry,
    onOpenDocHubFolder,
}) => {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, bid.id)}
            onClick={onClick}
            className="bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-sm dark:shadow-lg p-4 border border-slate-200 dark:border-slate-700/40 hover:shadow-md dark:hover:shadow-xl hover:border-emerald-500/30 transition-all cursor-grab active:cursor-grabbing group"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {bid.companyName}
                    </h3>
                    {onOpenDocHubFolder && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenDocHubFolder(bid);
                            }}
                            className="text-slate-500 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="DocHub složka dodavatele"
                        >
                            <span className="material-symbols-outlined text-[16px]">folder</span>
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(bid);
                        }}
                        className="text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(bid.id);
                            }}
                            className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Odebrat z výběrového řízení"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                </div>
                {bid.price && bid.price !== "-" && bid.price !== "?" && (
                    <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                        {bid.price}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1.5 mb-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {bid.contactPerson}
                </div>
                {bid.phone && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {bid.phone}
                    </div>
                )}
                {bid.email && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                        {bid.email}
                    </div>
                )}
                {/* Price History */}
                {bid.priceHistory && Object.keys(bid.priceHistory).length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        {Object.entries(bid.priceHistory)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([round, price]) => (
                                <div key={round} className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{round}. kolo:</span>
                                    <span className={Number(round) === bid.selectionRound ? "text-emerald-400 font-medium" : ""}>
                                        {price}
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
                {bid.notes && (
                    <p className="text-xs text-slate-500 italic mt-1">"{bid.notes}"</p>
                )}
            </div>

            {bid.tags && bid.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                    {bid.tags.map((tag) => (
                        <span
                            key={tag}
                            className="text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600/50"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Generate Inquiry Button */}
            {bid.status === "contacted" && onGenerateInquiry && bid.email && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onGenerateInquiry(bid);
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-lg"
                >
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    Generovat poptávku
                </button>
            )}
        </div>
    );
};
