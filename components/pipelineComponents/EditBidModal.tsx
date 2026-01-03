/**
 * EditBidModal Component
 * Modal dialog for editing bid details.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useState } from "react";
import { Bid } from "../../types";
import { formatInputNumber, parseFormattedNumber } from "../../utils/formatters";

export interface EditBidModalProps {
    bid: Bid;
    onClose: () => void;
    onSave: (updatedBid: Bid) => void;
}

export const EditBidModal: React.FC<EditBidModalProps> = ({ bid, onClose, onSave }) => {
    const [form, setForm] = useState({ ...bid });
    const [priceDisplay, setPriceDisplay] = useState(
        bid.price && bid.price !== "?" && bid.price !== "-"
            ? formatInputNumber(parseFormattedNumber(bid.price.replace(/[^\d\s,.-]/g, '')))
            : ""
    );

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const cleaned = raw.replace(/[^\d\s,]/g, '');
        setPriceDisplay(cleaned);

        const numericValue = parseFormattedNumber(cleaned);
        const priceStr = numericValue > 0 ? formatInputNumber(numericValue) + " Kč" : (cleaned ? cleaned : "?");

        const currentRound = form.selectionRound || 1;
        const newPriceHistory = { ...(form.priceHistory || {}) };

        if (numericValue > 0) {
            newPriceHistory[currentRound] = priceStr;
        } else {
            delete newPriceHistory[currentRound];
        }

        setForm({
            ...form,
            price: priceStr,
            priceHistory: Object.keys(newPriceHistory).length > 0 ? newPriceHistory : undefined
        });
    };

    const handlePriceBlur = () => {
        const numericValue = parseFormattedNumber(priceDisplay);
        if (numericValue > 0) {
            setPriceDisplay(formatInputNumber(numericValue));
        }
    };

    const handleRoundChange = (round: number) => {
        const newRound = form.selectionRound === round ? undefined : round;

        let newPriceDisplay = "";
        if (newRound && form.priceHistory && form.priceHistory[newRound]) {
            const existingPrice = form.priceHistory[newRound];
            newPriceDisplay = formatInputNumber(parseFormattedNumber(existingPrice.replace(/[^\d\s,.-]/g, '')));
        }

        setPriceDisplay(newPriceDisplay);
        setForm({
            ...form,
            selectionRound: newRound,
            price: newRound && form.priceHistory?.[newRound] ? form.priceHistory[newRound] : form.price
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Upravit nabídku
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Kontaktní osoba
                            </label>
                            <input
                                type="text"
                                value={form.contactPerson}
                                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={form.email || ""}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Telefon
                                </label>
                                <input
                                    type="text"
                                    value={form.phone || ""}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Cena (Kč)
                            </label>
                            <input
                                type="text"
                                value={priceDisplay}
                                onChange={handlePriceChange}
                                onBlur={handlePriceBlur}
                                placeholder="1 500 000"
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Datum k zaslání úpravy
                            </label>
                            <input
                                type="date"
                                value={form.updateDate || ""}
                                onChange={(e) => setForm({ ...form, updateDate: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                Kolo výběru
                            </label>
                            <div className="flex gap-3">
                                {[1, 2, 3].map((round) => (
                                    <label
                                        key={round}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.selectionRound === round
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.selectionRound === round}
                                            onChange={() => handleRoundChange(round)}
                                            className="sr-only"
                                        />
                                        <span className="text-sm font-medium">{round}. kolo</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Poznámka
                            </label>
                            <textarea
                                rows={5}
                                value={form.notes || ""}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-y min-h-[80px]"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                        >
                            Uložit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
